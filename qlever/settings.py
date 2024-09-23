"""
Django settings for qlever project.

Generated by 'django-admin startproject' using Django 1.11.3.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.1/ref/settings/
"""

import os
import subprocess
import re
import environ
try:
    from .settings_secret import *
    print("settings_secret.py is deprecated. Please migrate to using settings_local.py. "
          "To this rename the file. You can also remove all assignments to the default value.")
except ImportError:
    pass

env = environ.FileAwareEnv()

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# Suppress warning in Django 3.2 version.
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool('QLEVERUI_DEBUG', default=True)
# https://docs.djangoproject.com/en/5.1/ref/settings/#allowed-hosts

# The values set in settings_secret.py have a higher precedence than the default values.
# They may or may not be set. If they are set we use them instead of the default value.
# Otherwise, we get a NameError and use the default value in the except branch
try:
    ALLOWED_HOSTS_DEFAULT = ALLOWED_HOSTS
    print("Using value from settings_secret.py for ALLOWED_HOSTS.")
except NameError:
    ALLOWED_HOSTS_DEFAULT = ['*']
ALLOWED_HOSTS = env.list('QLEVERUI_ALLOWED_HOSTS', default=ALLOWED_HOSTS_DEFAULT)

try:
    SECRET_KEY_DEFAULT = SECRET_KEY
    print("Using value from settings_secret.py for SECRET_KEY.")
except NameError:
    SECRET_KEY_DEFAULT = '!!super_secret!!'
SECRET_KEY = env.str('QLEVERUI_SECRET_KEY', default=SECRET_KEY_DEFAULT)

# Application definition

INSTALLED_APPS = [
    'whitenoise.runserver_nostatic',
    'django.contrib.admin',
    'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages',
    'django.contrib.staticfiles', 'backend', 'import_export'
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CSRF_TRUSTED_ORIGINS = env.list('QLEVERUI_CSRF_TRUSTED_ORIGINS', default=['https://*.uni-freiburg.de'])

ROOT_URLCONF = 'qlever.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': ['backend/templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'qlever.context_processor.additional_context',
            ],
        },
    },
]

WSGI_APPLICATION = 'qlever.wsgi.application'

# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    'default': env.db("QLEVERUI_DATABASE_URL", default=f'sqlite:////{os.path.join(BASE_DIR, "db", "qleverui.sqlite3")}')
}

# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME':
        'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME':
        'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME':
        'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME':
        'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = '/static/'

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

STATIC_VERSION = ""

STORAGES = {
    'default': {
        # Django's default
        'BACKEND': 'django.core.files.storage.FileSystemStorage'
    },
    'staticfiles': {
        # Use WhiteNoise (https://whitenoise.readthedocs.io) for static file serving
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'
    },
}

try:
    # Get git info from files in .git
    with open(".git/HEAD", "r") as headFile:
        GIT_HEAD = headFile.read().strip()
    with open(".git/{}".format(GIT_HEAD.split(" ")[-1]), "r") as hashFile:
        GIT_HASH = hashFile.read()[:7]
    STATIC_VERSION = "Git commit {} on {}".format(
        GIT_HASH, GIT_HEAD.split("/")[-1])
except Exception as e:
    print(e)
    pass

if not STATIC_VERSION:
    # get svn version info if git was not successful
    try:
        versionInfo = (subprocess.check_output("svn info -r HEAD;",
                                               shell=True)).decode("utf-8")
        STATIC_VERSION = re.search(r"(Revision: \d+)", versionInfo).group(1)
    except:
        pass

IMPORT_EXPORT_USE_TRANSACTIONS = True

try:
    from .settings_local import *
    print("Loaded settings_local.py")
except ImportError:
    pass
