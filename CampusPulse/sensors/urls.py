from django.urls import path
from . import views

urlpatterns = [
    path("sensor-data/", views.sensor_data_api, name="sensor_data_api"),
]