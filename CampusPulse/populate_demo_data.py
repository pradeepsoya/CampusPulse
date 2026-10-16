import json
import math
import random
from datetime import datetime, timedelta, time
from pathlib import Path

from django.utils import timezone
from sensors.models import Sensor, SensorData


# ============================================================
# CAMPUSPULSE DEMO DATA GENERATOR
# Creates simulated readings without deleting existing records.
# ============================================================

random.seed(20261011)

DAYS = 45
INTERVAL_MINUTES = 30

BASE_DIR = Path(__file__).resolve().parent
MANIFEST_FILE = BASE_DIR / "demo_generated_reading_ids.json"

# Recovered database readings must be preserved.
original_count = SensorData.objects.count()

# Refuse to run again if this script has already generated data.
if MANIFEST_FILE.exists():
    raise SystemExit(
        f"\nA generation manifest already exists:\n{MANIFEST_FILE}\n"
        "No readings were added. Check the manifest before proceeding."
    )

sensors = {
    sensor.sensor_type: sensor
    for sensor in Sensor.objects.all()
}

required_types = {"DHT22", "PIR", "BH1750"}

if not required_types.issubset(sensors):
    raise SystemExit(
        f"Missing sensors. Found: {list(sensors.keys())}"
    )

# Keep a record of recovered readings before inserting anything.
original_ids = set(
    SensorData.objects.values_list("data_id", flat=True)
)

now = timezone.localtime()
today = now.date()
start_date = today - timedelta(days=DAYS - 1)

# Existing readings may be real. Do not mix new data into a date
# that already contains readings.
protected_dates = set(
    SensorData.objects.datetimes(
        "timestamp", "day", order="ASC"
    )
)

protected_dates = {
    timezone.localtime(dt).date() if timezone.is_aware(dt) else dt.date()
    for dt in protected_dates
}

created_ids = []
created_count = 0
skipped_days = 0

print(f"Generating simulated data from {start_date} to {today}")
print(f"Existing readings: {original_count}")
print(f"Dates with existing readings will be preserved: {sorted(protected_dates)}")

for day_offset in range(DAYS):
    current_date = start_date + timedelta(days=day_offset)

    # Preserve entire dates containing recovered readings.
    if current_date in protected_dates:
        skipped_days += 1
        continue

    for hour in range(24):
        for minute in (0, 30):
            # Do not create future readings for today.
            sample_time = time(hour, minute)

            if current_date == today and sample_time > now.time():
                continue

            timestamp = timezone.make_aware(
                datetime.combine(current_date, sample_time),
                timezone.get_current_timezone(),
            )

            hour_decimal = hour + minute / 60

            # Typical classroom activity:
            # low occupancy overnight, busier during class hours.
            if 8 <= hour < 16:
                occupied_probability = 0.82
            elif 16 <= hour < 18:
                occupied_probability = 0.40
            elif 7 <= hour < 8 or 18 <= hour < 20:
                occupied_probability = 0.18
            else:
                occupied_probability = 0.02

            occupied = random.random() < occupied_probability
            occupancy = "occupied" if occupied else "vacant"

            # Temperature pattern: cooler at night, warmer in the afternoon.
            daily_temperature = (
                27.0
                + 3.0 * math.sin((hour_decimal - 9) * math.pi / 12)
                + random.uniform(-1.2, 1.2)
            )

            # Humidity tends to be higher during cooler hours.
            humidity = (
                66.0
                - (daily_temperature - 27.0) * 3.2
                + random.uniform(-5.0, 5.0)
            )
            humidity = max(40.0, min(85.0, humidity))

            # Simulated classroom light:
            # daylight is stronger during school hours;
            # artificial lighting may be present when occupied.
            daylight = max(
                0,
                math.sin((hour_decimal - 6) * math.pi / 12)
            ) * 650

            if occupied and 8 <= hour < 18:
                artificial_light = random.uniform(180, 420)
            else:
                artificial_light = 0

            light_level = max(
                0,
                daylight + artificial_light + random.uniform(-45, 45)
            )

            # DHT22: temperature and humidity.
            row = SensorData.objects.create(
                sensor=sensors["DHT22"],
                temperature=round(daily_temperature, 2),
                humidity=round(humidity, 2),
                light_intensity=None,
                occupancy_status=None,
                timestamp=timestamp,
            )
            created_ids.append(row.data_id)
            created_count += 1

            # BH1750: light level.
            row = SensorData.objects.create(
                sensor=sensors["BH1750"],
                temperature=None,
                humidity=None,
                light_intensity=round(light_level, 2),
                occupancy_status=None,
                timestamp=timestamp,
            )
            created_ids.append(row.data_id)
            created_count += 1

            # PIR: occupancy state.
            row = SensorData.objects.create(
                sensor=sensors["PIR"],
                temperature=None,
                humidity=None,
                light_intensity=None,
                occupancy_status=occupancy,
                timestamp=timestamp,
            )
            created_ids.append(row.data_id)
            created_count += 1

# Verify recovered rows still exist.
remaining_original_ids = set(
    SensorData.objects.filter(
        data_id__in=original_ids
    ).values_list("data_id", flat=True)
)

if remaining_original_ids != original_ids:
    raise RuntimeError(
        "Verification failed: some original readings are missing."
    )

# Record exactly which rows this script created.
MANIFEST_FILE.write_text(
    json.dumps(
        {
            "description": "Simulated CampusPulse demo readings",
            "start_date": str(start_date),
            "end_date": str(today),
            "created_reading_ids": created_ids,
        },
        indent=2,
    ),
    encoding="utf-8",
)

print("\nGeneration completed successfully.")
print(f"Simulated readings created: {created_count}")
print(f"Dates skipped to preserve existing data: {skipped_days}")
print(f"Original readings preserved: {len(original_ids)}")
print(f"Total readings now: {SensorData.objects.count()}")
print(f"Manifest saved to: {MANIFEST_FILE}")
print("\nThese new records are simulated demo data, not hardware measurements.")