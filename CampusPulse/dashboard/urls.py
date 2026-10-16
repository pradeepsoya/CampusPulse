from django.urls import path, reverse_lazy
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path("", views.login_view, name="login"),
    path("home/", views.home, name="dashboard"),
    path("logout/", views.logout_view, name="logout"),

    path("live_monitoring/", views.live_monitoring, name="live_monitoring"),
    path(
        "api/live-monitoring/",
        views.live_monitoring_api,
        name="live_monitoring_api"
    ),

    path("analytics/", views.analytics, name="analytics"),
    path("api/analytics-data/", views.analytics_api, name="analytics_api"),
    path("settings/", views.settings_view, name="settings"),
    path("profile/", views.profile_view, name="profile"),
    path("account-settings/", views.account_settings_view, name="account_settings"),

    path(
        "change-password/",
        auth_views.PasswordChangeView.as_view(
            template_name="change_password.html",
            success_url=reverse_lazy("account_settings")
        ),
        name="password_change"
    )
]