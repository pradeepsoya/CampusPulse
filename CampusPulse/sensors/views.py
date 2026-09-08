import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Sensor, SensorData


@csrf_exempt
def sensor_data_api(request):

    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST method is allowed"},
            status=405
        )

    try:
        data = json.loads(request.body)

        # Get sensor
        sensor_id = data.get("sensor")

        if not sensor_id:
            return JsonResponse(
                {"error": "sensor is required"},
                status=400
            )

        try:
            sensor = Sensor.objects.get(sensor_id=sensor_id)
        except Sensor.DoesNotExist:
            return JsonResponse(
                {"error": f"Sensor with ID {sensor_id} does not exist"},
                status=404
            )

        # Get sensor readings
        temperature = data.get("temperature")
        humidity = data.get("humidity")
        light_intensity = data.get("light_intensity")
        occupancy_status = data.get("occupancy_status")

        # Save reading
        reading = SensorData.objects.create(
            sensor=sensor,
            temperature=temperature,
            humidity=humidity,
            light_intensity=light_intensity,
            occupancy_status=occupancy_status
        )

        return JsonResponse({
            "message": "Sensor data received successfully",
            "data_id": reading.data_id,
            "sensor_id": sensor.sensor_id,
            "classroom": sensor.classroom.room_number
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Invalid JSON format"},
            status=400
        )

    except Exception as e:
        return JsonResponse(
            {"error": str(e)},
            status=400
        )