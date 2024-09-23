# Generated by Django 5.0.3 on 2024-09-22 19:29

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("backend", "0072_backend_isnoslugmode"),
    ]

    operations = [
        migrations.AddField(
            model_name="backend",
            name="mapViewBaseURL",
            field=models.CharField(
                blank=True,
                default="",
                help_text="The base URL for the Map view including a trailing slash (/).",
                max_length=2048,
                verbose_name="Map view base URL",
            ),
        ),
    ]
