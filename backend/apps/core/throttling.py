from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'
    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class PublicCatalogThrottle(AnonRateThrottle):
    """
    Throttle para endpoints públicos de catálogo de alto tráfico
    (listado, búsqueda, destacados). Usa el scope 'search' ya definido
    en DEFAULT_THROTTLE_RATES — evita picos de scraping sin bloquear
    navegación normal.
    """
    scope = 'search'


class OrderCreateThrottle(UserRateThrottle):
    """Throttle específico para creación de checkout — evita spam de órdenes fantasma."""
    scope = 'order_create'
