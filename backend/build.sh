#!/usr/bin/env bash
# Render build script for Django backend
set -o errexit

python -m pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py makemigrations --no-input || true
python manage.py migrate --no-input || echo "[Notice] Database migration will run on WSGI startup."
