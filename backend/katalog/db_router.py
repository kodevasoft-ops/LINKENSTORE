"""
katalog/db_router.py
Routes read-heavy queries (analytics, catalog) to replica.
Writes always go to default (master).
"""

READ_APPS = frozenset(['analytics', 'catalog'])

class AnalyticsReadRouter:
    def db_for_read(self, model, **hints):
        if model._meta.app_label in READ_APPS:
            return 'replica'
        return None

    def db_for_write(self, model, **hints):
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == 'default'
