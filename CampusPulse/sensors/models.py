from django.db import models

# Create your models here.
from django.db import models
from django.db import models
from django.utils import timezone

class User(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('staff', 'Staff'),
        ('student', 'Student'),
    ]

    user_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')

    def __str__(self):
        return self.username


class Classroom(models.Model):
    classroom_id = models.AutoField(primary_key=True)
    room_number = models.CharField(max_length=20)
    location = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField()

    def __str__(self):
        return self.room_number


class Sensor(models.Model):
    SENSOR_TYPE_CHOICES = [
        ('DHT22', 'Temperature & Humidity'),
        ('BH1750', 'Ambient Light'),
        ('PIR', 'Motion / Occupancy'),
    ]

    OCCUPANCY_CHOICES = [
        ('occupied', 'Occupied'),
        ('vacant', 'Vacant'),
    ]

    sensor_id = models.AutoField(primary_key=True)
    sensor_type = models.CharField(max_length=20, choices=SENSOR_TYPE_CHOICES)
    temperature = models.FloatField(null=True, blank=True)
    humidity = models.FloatField(null=True, blank=True)
    light_intensity = models.FloatField(null=True, blank=True)
    occupancy_status = models.CharField(max_length=10, choices=OCCUPANCY_CHOICES, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    classroom = models.ForeignKey(
        Classroom,
        on_delete=models.CASCADE,
        db_column='classroom_id',
        related_name='sensors'
    )

    def __str__(self):
        return f"{self.sensor_type} ({self.classroom.room_number})"


class SensorData(models.Model):
    data_id = models.AutoField(primary_key=True)
    sensor = models.ForeignKey(
        Sensor,
        on_delete=models.CASCADE,
        db_column='sensor_id',
        related_name='readings'
    )
    temperature = models.FloatField(null=True, blank=True)
    humidity = models.FloatField(null=True, blank=True)
    light_intensity = models.FloatField(null=True, blank=True)
    occupancy_status = models.CharField(max_length=10, null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Reading {self.data_id} - Sensor {self.sensor_id}"