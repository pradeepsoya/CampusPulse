from django.contrib import admin
from .models import User, Classroom, Sensor, SensorData


admin.site.register(User)
admin.site.register(Classroom)
admin.site.register(Sensor)
admin.site.register(SensorData)