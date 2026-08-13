from django.urls import path
from .views import LoginView, LogoutView, RegisterView, MeView, ChangePasswordView
from apps.core.auth.mfa import MFASetupView, MFAVerifyView
urlpatterns = [
    path('login/',           LoginView.as_view(),          name='auth-login'),
    path('logout/',          LogoutView.as_view(),         name='auth-logout'),
    path('register/',        RegisterView.as_view(),       name='auth-register'),
    path('me/',              MeView.as_view(),             name='auth-me'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('mfa/setup/',  MFASetupView.as_view(),  name='mfa-setup'),
    path('mfa/verify/', MFAVerifyView.as_view(), name='mfa-verify'),
]
