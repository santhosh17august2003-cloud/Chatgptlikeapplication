from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse, HttpResponse
from django.views.static import serve
from django.db import connection
import sys

def health_check(request):
    if request.method == 'HEAD':
        return HttpResponse(status=200)

    db_status = "unknown"
    tables = []
    error_msg = None

    try:
        tables = connection.introspection.table_names()
        db_status = "connected"
    except Exception as e:
        db_status = "error"
        error_msg = str(e)

    return JsonResponse({
        "status": "ok",
        "message": "Django backend is running",
        "database": db_status,
        "tables_count": len(tables),
        "tables": tables[:10],
        "database_error": error_msg,
        "version": "v3-diagnostic"
    })

def custom_server_error_500(request):
    exc_type, exc_value, exc_tb = sys.exc_info()
    detail = str(exc_value) if exc_value else "Unknown server error"
    return JsonResponse({
        "error": "Internal Server Error (500)",
        "detail": detail,
    }, status=500)

handler500 = custom_server_error_500

urlpatterns = [
    path('', health_check, name='home'),
    path('healthz/', health_check, name='healthz'),
    path('api/health/', health_check, name='api_health'),
    path('admin/', admin.site.urls),
    path('api/', include('chats.urls')),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
