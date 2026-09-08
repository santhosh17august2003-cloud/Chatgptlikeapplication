"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = get_wsgi_application()

# Ensure database tables exist by running migrations on startup
try:
    from django.core.management import call_command
    print("--- Checking and applying database migrations on startup ---")
    call_command('migrate', interactive=False)
    print("--- Database migrations applied successfully ---")
except Exception as e:
    print(f"--- Notice during startup migration: {e} ---")
