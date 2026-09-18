import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0001_initial'),
        ('catalog', '0001_initial'),
    ]
    operations = [
        migrations.AddField(
            model_name='user',
            name='punto',
            field=models.ForeignKey(
                to='catalog.Punto', null=True, blank=True,
                on_delete=django.db.models.deletion.SET_NULL, related_name='staff',
            ),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['punto', 'role'], name='core_user_punto_role_idx'),
        ),
    ]
