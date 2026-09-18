import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
logger = logging.getLogger('katalog')
def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        logger.exception('Unhandled exception', exc_info=exc)
        return Response({'error': True, 'status': 500, 'message': 'Error interno del servidor.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    original = response.data
    payload = {'error': True, 'status': response.status_code}
    if isinstance(original, dict) and 'detail' in original:
        payload['message'] = str(original['detail'])
    elif isinstance(original, dict):
        payload['message'] = 'Error de validación'
        payload['details'] = original
    else:
        payload['message'] = str(original)
    response.data = payload
    return response
