# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2017-10-28 11:01
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('backend', '0010_prefix'),
    ]

    operations = [
        migrations.AddField(
            model_name='prefix',
            name='occurrences',
            field=models.IntegerField(default=1),
        ),
    ]