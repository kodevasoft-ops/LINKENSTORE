from django.db import migrations

class Migration(migrations.Migration):
    """
    Technicians app has no models of its own.
    All repair models (RepairTicket, RepairPart, RepairImage) live in apps.orders.
    This migration exists only to satisfy Django's app migration requirement.
    """
    initial = True
    dependencies = [
        ('orders', '0001_initial'),
    ]
    operations = []
