from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse, HttpResponse
from django.views.static import serve

def health_check(request):
    if request.method == 'HEAD':
        return HttpResponse(status=200)
    return JsonResponse({
        "status": "ok",
        "message": "Django backend is running"
    })

urlpatterns = [
    path('', health_check, name='home'),
    path('healthz/', health_check, name='healthz'),
    path('admin/', admin.site.urls),
    path('api/', include('chats.urls')),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
