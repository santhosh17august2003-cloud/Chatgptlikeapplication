
from django.urls import re_path
# pyrefly: ignore [missing-import]
from . import views

urlpatterns = [
    # Authentication routes
    re_path(r'^auth/register/?$', views.auth_register, name='auth_register'),
    re_path(r'^auth/login/?$', views.auth_login, name='auth_login'),
    re_path(r'^auth/forgot-password/?$', views.auth_request_otp, name='auth_request_otp'),
    re_path(r'^auth/verify-otp/?$', views.auth_verify_otp, name='auth_verify_otp'),
    re_path(r'^auth/reset-password/?$', views.auth_reset_password, name='auth_reset_password'),

    # Chat & Document routes
    re_path(r'^threads/?$', views.threads_list_create, name='threads_list_create'),
    re_path(
        r'^threads/(?P<thread_id>\d+)/messages/?$',
        views.thread_messages_list,
        name='thread_messages_list'
    ),
    re_path(
        r'^threads/(?P<thread_id>\d+)/upload/?$',
        views.upload_document,
        name='upload_document'
    ),
    re_path(
        r'^threads/(?P<thread_id>\d+)/send/?$',
        views.send_message,
        name='send_message'
    ),
    re_path(
        r'^threads/(?P<thread_id>\d+)/document/?$',
        views.delete_document,
        name='delete_document'
    ),
    re_path(
        r'^threads/(?P<thread_id>\d+)/delete/?$',
        views.delete_thread,
        name='delete_thread'
    ),
]
