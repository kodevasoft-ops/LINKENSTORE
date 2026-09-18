"""
apps/orders/tasks.py
"""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('katalog.orders')


@shared_task(name='apps.orders.tasks.sync_tercero_tns', bind=True, max_retries=3)
def sync_tercero_tns(self, checkout_session_id: str):
    """
    Crea el cliente como Tercero en TNS — SOLO crea, nunca actualiza ni borra,
    tal como exige la regla de negocio. Idempotente: si el cliente ya tiene
    tns_tercero_id guardado, no vuelve a crear nada.

    Se dispara desde el webhook de Wompi cuando el pago queda aprobado —
    así el vendedor ya encuentra al cliente creado en TNS al momento de
    facturar manualmente, sin tener que digitarlo de nuevo.
    """
    from apps.orders.models import CheckoutSession
    from apps.catalog.services.tns import TNSClient

    try:
        session = CheckoutSession.objects.select_related('customer').get(id=checkout_session_id)
    except CheckoutSession.DoesNotExist:
        return {'error': 'sesion no encontrada'}

    customer = session.customer

    if customer.tns_tercero_id:
        return {'skipped': 'ya sincronizado', 'tns_tercero_id': customer.tns_tercero_id}

    document_number = customer.document_number or session.document_number
    document_type   = customer.document_type or session.document_type
    if not document_number:
        logger.warning('[TNS] No se puede crear Tercero para %s — sin número de documento.', customer.email)
        return {'skipped': 'sin documento'}

    client = TNSClient()
    if not client._is_configured():
        return {'skipped': 'TNS no configurado'}

    # Evita duplicados: si el tercero ya existe en TNS (creado por otro canal,
    # ej. compra presencial previa), solo se guarda su ID, nunca se crea de nuevo.
    existing = client.buscar_tercero(document_number)
    if existing:
        tercero_id = existing.get('id') or existing.get('terceroId')  # CONFIRMAR nombre del campo
        if tercero_id:
            customer.tns_tercero_id = str(tercero_id)
            customer.tns_synced_at = timezone.now()
            customer.save(update_fields=['tns_tercero_id', 'tns_synced_at'])
            return {'linked_existing': True, 'tns_tercero_id': str(tercero_id)}

    result = client.crear_tercero(
        nombre=customer.full_name,
        tipo_documento=document_type or 'CC',
        numero_documento=document_number,
        telefono=session.shipping_phone or customer.phone,
        email=customer.email,
        direccion=session.shipping_address,
    )
    if not result:
        # No reintentamos infinito — un tercero fallido no debe bloquear la
        # venta, el vendedor lo puede crear manualmente en TNS si hace falta.
        logger.warning('[TNS] No se pudo crear Tercero para %s.', customer.email)
        return {'error': 'creacion fallida'}

    tercero_id = result.get('id') or result.get('terceroId')  # CONFIRMAR nombre del campo real
    customer.tns_tercero_id = str(tercero_id) if tercero_id else ''
    customer.tns_synced_at = timezone.now()
    customer.save(update_fields=['tns_tercero_id', 'tns_synced_at'])
    logger.info('[TNS] Tercero creado para %s → %s', customer.email, tercero_id)
    return {'created': True, 'tns_tercero_id': str(tercero_id)}
