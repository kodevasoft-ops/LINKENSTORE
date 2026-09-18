"""
apps/whatsapp/tasks.py
Toda la inteligencia de negocio del módulo vive aquí — el webhook solo
encola, estas tareas son las que de verdad consultan la base de datos y
deciden qué responder. Ninguna de estas tareas envía nada si el módulo
está pausado (WhatsAppConfig.is_usable() == False).
"""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('katalog.whatsapp')


def _normalize_phone(raw: str) -> str:
    return ''.join(c for c in (raw or '') if c.isdigit())


@shared_task(name='apps.whatsapp.tasks.process_whatsapp_webhook_event')
def process_whatsapp_webhook_event(payload: dict):
    """
    Procesa UN evento de webhook (mensaje entrante o cambio de estado).
    Si es un mensaje entrante y 'responder apenas el cliente escriba' está
    activo, contesta al instante consultando el pedido/reparación más
    reciente de ese número — dentro de la ventana de 24h, esto es gratis.
    """
    from apps.whatsapp.models import WhatsAppConfig, WhatsAppConversation, WhatsAppMessage
    from apps.whatsapp.services.dialog360 import get_client_or_none
    from apps.core.models import User

    config = WhatsAppConfig.get()
    if not config.is_usable():
        return {'skipped': 'modulo pausado'}

    # ── Actualizaciones de estado (sent/delivered/read/failed) ───────────
    for status_evt in payload.get('statuses', []):
        WhatsAppMessage.objects.filter(wa_message_id=status_evt.get('id')).update(
            status=status_evt.get('status', 'sent')
        )

    # ── Mensajes entrantes ────────────────────────────────────────────────
    contacts_by_wa_id = {c['wa_id']: c for c in payload.get('contacts', [])}
    for msg in payload.get('messages', []):
        phone = _normalize_phone(msg.get('from', ''))
        if not phone:
            continue
        contact = contacts_by_wa_id.get(msg.get('from'), {})
        contact_name = contact.get('profile', {}).get('name', '')
        body_text = (msg.get('text') or {}).get('body', '')

        customer = User.objects.filter(phone__icontains=phone[-10:]).first() if len(phone) >= 10 else None

        conversation, _ = WhatsAppConversation.objects.get_or_create(
            phone_number=phone,
            defaults={'wa_id': msg.get('from', ''), 'contact_name': contact_name, 'customer': customer},
        )
        conversation.last_inbound_at = timezone.now()
        conversation.contact_name = contact_name or conversation.contact_name
        conversation.customer = customer or conversation.customer
        conversation.awaiting_customer_reply = False  # ya escribió, ya no está "esperando que vuelva"
        conversation.followup_sent_at = None
        conversation.save()

        WhatsAppMessage.objects.create(
            conversation=conversation, direction='inbound', trigger='customer',
            message_type='text', body=body_text, wa_message_id=msg.get('id', ''),
            status='delivered', raw_payload=msg,
        )

        if config.respond_on_message:
            _send_instant_reply(conversation, body_text)


def _send_instant_reply(conversation, incoming_text: str):
    """
    'Sabe todo': si el cliente pregunta por su pedido o su reparación,
    responde con el estado real desde la base de datos — no un genérico.
    """
    from apps.whatsapp.services.dialog360 import get_client_or_none
    from apps.whatsapp.models import WhatsAppMessage

    client = get_client_or_none()
    if not client:
        return

    text_lower = (incoming_text or '').lower()
    reply = None

    if conversation.customer:
        if any(w in text_lower for w in ('pedido', 'orden', 'compra', 'factura')):
            from apps.orders.models import Order
            last_order = Order.objects.filter(customer=conversation.customer).order_by('-created_at').first()
            if last_order:
                reply = (
                    f'Hola {conversation.customer.first_name or ""}. Tu pedido {last_order.order_number} '
                    f'está: {last_order.get_status_display()}.'
                )
        elif any(w in text_lower for w in ('reparacion', 'reparación', 'arreglo', 'ticket', 'tecnico', 'técnico')):
            from apps.orders.models import RepairTicket
            last_repair = RepairTicket.objects.filter(customer=conversation.customer).order_by('-received_at').first()
            if last_repair:
                reply = (
                    f'Tu reparación {last_repair.ticket_number} ({last_repair.device_type}) '
                    f'está: {last_repair.get_status_display()}.'
                )

    if not reply:
        reply = (
            '¡Hola! Gracias por escribirnos. En un momento un asesor te atiende. '
            'Si tienes un pedido o reparación en curso, pregúntame por el número y te cuento el estado.'
        )

    result = client.send_text(to=conversation.phone_number, body=reply)
    conversation.last_outbound_at = timezone.now()
    conversation.awaiting_customer_reply = True  # ahora esperamos a ver si el cliente responde
    conversation.save(update_fields=['last_outbound_at', 'awaiting_customer_reply'])

    WhatsAppMessage.objects.create(
        conversation=conversation, direction='outbound', trigger='auto_reply',
        message_type='text', body=reply,
        wa_message_id=(result.get('data', {}).get('messages', [{}])[0].get('id', '') if result.get('ok') else ''),
        status='sent' if result.get('ok') else 'failed',
    )


@shared_task(name='apps.whatsapp.tasks.send_order_confirmation')
def send_order_confirmation(checkout_session_id: str, template_name: str = 'confirmacion_de_compra'):
    """
    Se dispara desde el webhook de Wompi cuando el pago queda APPROVED.
    Requiere una plantilla ('template_name') ya aprobada por Meta en tu
    cuenta de 360dialog — un mensaje de negocio-inicia-conversación NO
    puede ser texto libre, así lo exige WhatsApp.
    """
    from apps.whatsapp.models import WhatsAppConfig, WhatsAppConversation, WhatsAppMessage
    from apps.whatsapp.services.dialog360 import get_client_or_none
    from apps.orders.models import CheckoutSession

    config = WhatsAppConfig.get()
    if not config.is_usable() or not config.order_confirmation_enabled:
        return {'skipped': 'deshabilitado o pausado'}

    try:
        session = CheckoutSession.objects.select_related('customer').get(id=checkout_session_id)
    except CheckoutSession.DoesNotExist:
        return {'error': 'sesion no encontrada'}

    phone = _normalize_phone(session.shipping_phone or session.customer.phone)
    if not phone:
        return {'skipped': 'sin telefono'}

    client = get_client_or_none()
    if not client:
        return {'skipped': 'cliente no configurado'}

    conversation, _ = WhatsAppConversation.objects.get_or_create(
        phone_number=phone, defaults={'customer': session.customer},
    )

    # Dentro de la ventana de 24h ya es gratis mandar texto libre; si no,
    # usa la plantilla (puede tener costo — ver DEPLOY.md).
    if conversation.window_open:
        body = f'¡Gracias por tu compra! Tu pedido {session.session_number} fue confirmado. Total: ${session.total:,.0f} COP.'
        result = client.send_text(to=phone, body=body)
        msg_type, tpl = 'text', ''
    else:
        result = client.send_template(to=phone, template_name=template_name, language_code='es',
                                       body_params=[session.session_number, f'${session.total:,.0f}'])
        msg_type, tpl, body = 'template', template_name, ''

    WhatsAppMessage.objects.create(
        conversation=conversation, direction='outbound', trigger='order_confirm',
        message_type=msg_type, template_name=tpl, body=body,
        related_checkout_session=session,
        status='sent' if result.get('ok') else 'failed', raw_payload=result,
    )
    return {'sent': result.get('ok', False)}


@shared_task(name='apps.whatsapp.tasks.send_cart_reminders')
def send_cart_reminders():
    """
    Corre periódicamente (Celery Beat). Revisa CartAbandonment que ya
    cumplieron el retraso configurado y todavía no recibieron recordatorio
    por WhatsApp — reutiliza el mismo modelo que ya alimenta el recordatorio
    por email, no crea un sistema paralelo.
    """
    from apps.whatsapp.models import WhatsAppConfig, WhatsAppConversation, WhatsAppMessage
    from apps.whatsapp.services.dialog360 import get_client_or_none
    from apps.analytics.models import CartAbandonment

    config = WhatsAppConfig.get()
    if not config.is_usable() or not config.cart_reminder_enabled:
        return {'skipped': 'deshabilitado o pausado'}

    client = get_client_or_none()
    if not client:
        return {'skipped': 'cliente no configurado'}

    cutoff = timezone.now() - timezone.timedelta(minutes=config.cart_reminder_delay_minutes)
    candidates = CartAbandonment.objects.filter(
        status='abandoned', abandoned_at__lte=cutoff,
    ).exclude(whatsapp_messages__isnull=False)[:50]  # nunca dos veces al mismo carrito

    sent = 0
    for abandonment in candidates:
        phone = _normalize_phone(abandonment.user.phone if abandonment.user else '')
        if not phone:
            continue
        conversation, _ = WhatsAppConversation.objects.get_or_create(
            phone_number=phone, defaults={'customer': abandonment.user},
        )
        if conversation.window_open:
            body = f'¡Tu carrito te espera! Tienes {abandonment.items_count} producto(s) por ${abandonment.cart_total:,.0f} COP.'
            result = client.send_text(to=phone, body=body)
            msg_type, tpl = 'text', ''
        else:
            result = client.send_template(to=phone, template_name='carrito_abandonado', language_code='es',
                                           body_params=[str(abandonment.items_count), f'${abandonment.cart_total:,.0f}'])
            msg_type, tpl, body = 'template', 'carrito_abandonado', ''

        WhatsAppMessage.objects.create(
            conversation=conversation, direction='outbound', trigger='cart_reminder',
            message_type=msg_type, template_name=tpl, body=body,
            related_cart_abandonment=abandonment,
            status='sent' if result.get('ok') else 'failed', raw_payload=result,
        )
        if result.get('ok'):
            sent += 1

    return {'sent': sent}


@shared_task(name='apps.whatsapp.tasks.send_followups')
def send_followups():
    """
    'Preguntó y se fue': si el cliente escribió, se le respondió, y no ha
    vuelto a escribir después del plazo configurado, se le manda un
    recordatorio amable de que seguimos aquí.
    """
    from apps.whatsapp.models import WhatsAppConfig, WhatsAppConversation, WhatsAppMessage
    from apps.whatsapp.services.dialog360 import get_client_or_none

    config = WhatsAppConfig.get()
    if not config.is_usable() or not config.followup_enabled:
        return {'skipped': 'deshabilitado o pausado'}

    client = get_client_or_none()
    if not client:
        return {'skipped': 'cliente no configurado'}

    cutoff = timezone.now() - timezone.timedelta(hours=config.followup_delay_hours)
    candidates = WhatsAppConversation.objects.filter(
        awaiting_customer_reply=True, last_outbound_at__lte=cutoff, followup_sent_at__isnull=True,
    )[:50]

    sent = 0
    for conversation in candidates:
        if conversation.window_open:
            body = '¿Sigues ahí? Quedamos atentos si necesitas algo más.'
            result = client.send_text(to=conversation.phone_number, body=body)
            msg_type, tpl = 'text', ''
        else:
            result = client.send_template(to=conversation.phone_number, template_name='seguimiento_cliente', language_code='es')
            msg_type, tpl, body = 'template', 'seguimiento_cliente', ''

        WhatsAppMessage.objects.create(
            conversation=conversation, direction='outbound', trigger='follow_up',
            message_type=msg_type, template_name=tpl, body=body,
            status='sent' if result.get('ok') else 'failed', raw_payload=result,
        )
        conversation.followup_sent_at = timezone.now()
        conversation.save(update_fields=['followup_sent_at'])
        if result.get('ok'):
            sent += 1

    return {'sent': sent}
