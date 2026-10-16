import bisect
from datetime import datetime, timedelta
from django.db.models import Q
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from sensors.models import SensorData, Classroom, Sensor


# ---- existing views ----

@login_required(login_url='login')
def home(request):
    classrooms = Classroom.objects.all().order_by('room_number')

    room_data = []
    recent_activity = []
    critical_count = 0
    warning_count = 0
    online_count = 0

    for classroom in classrooms:
        sensors = classroom.sensors.all()

        latest_occupancy = (
            SensorData.objects
            .filter(
                sensor__classroom=classroom,
                sensor__sensor_type='PIR'
            )
            .order_by('-timestamp')
            .first()
        )

        if latest_occupancy and latest_occupancy.occupancy_status == 'occupied':
            status = 'occupied'
        elif latest_occupancy and latest_occupancy.occupancy_status == 'vacant':
            status = 'available'
        else:
            status = 'unknown'

        room_data.append({
            'classroom_id': classroom.classroom_id,
            'room_number': classroom.room_number,
            'location': classroom.location,
            'status': status,
        })

        # Count classrooms with recent sensor records.
        latest_any = (
            SensorData.objects
            .filter(sensor__classroom=classroom)
            .order_by('-timestamp')
            .first()
        )

        if latest_any:
            online_count += 1

        # Generate alerts from the latest relevant readings.
        for sensor in sensors:
            latest = (
                SensorData.objects
                .filter(sensor=sensor)
                .order_by('-timestamp')
                .first()
            )

            if not latest:
                continue

            if (
                sensor.sensor_type == 'DHT22'
                and latest.temperature is not None
                and latest.temperature > TEMP_THRESHOLD
            ):
                critical_count += 1

            elif (
                sensor.sensor_type == 'BH1750'
                and latest.light_intensity is not None
                and latest.light_intensity < LUX_THRESHOLD
            ):
                warning_count += 1

    # Build recent activity from actual sensor records.
    recent_records = (
        SensorData.objects
        .select_related('sensor', 'sensor__classroom')
        .order_by('-timestamp')[:5]
    )

    for record in recent_records:
        sensor_type = record.sensor.sensor_type
        room_number = record.sensor.classroom.room_number
        timestamp = timezone.localtime(record.timestamp)

        activity = {
            'timestamp': timestamp,
            'time_ago': _time_ago(timestamp),
            'room_number': room_number,
            'icon': 'bi-activity',
            'color': 'blue',
            'title': 'Sensor reading received',
            'description': f'{sensor_type} · {room_number}',
        }

        if sensor_type == 'PIR':
            if record.occupancy_status == 'occupied':
                activity.update({
                    'title': f'{room_number} became occupied',
                    'description': 'Motion detected',
                    'icon': 'bi-people-fill',
                    'color': 'purple',
                })
            elif record.occupancy_status == 'vacant':
                activity.update({
                    'title': f'{room_number} became vacant',
                    'description': 'No motion detected',
                    'icon': 'bi-people',
                    'color': 'teal',
                })

        elif sensor_type == 'DHT22':
            if record.temperature is not None:
                activity.update({
                    'title': 'Temperature reading received',
                    'description': f'{record.temperature}°C',
                    'icon': 'bi-thermometer-half',
                    'color': 'blue',
                })

        elif sensor_type == 'BH1750':
            if record.light_intensity is not None:
                activity.update({
                    'title': 'Light intensity updated',
                    'description': f'{record.light_intensity} Lux',
                    'icon': 'bi-brightness-high-fill',
                    'color': 'yellow',
                })

        recent_activity.append(activity)

    context = {
        'room_data': room_data,
        'recent_activity': recent_activity,
        'critical_count': critical_count,
        'warning_count': warning_count,
        'online_count': online_count,
    }

    return render(request, 'dashboard.html', context)


def _time_ago(timestamp):
    seconds = max(
        0,
        int((timezone.localtime() - timestamp).total_seconds())
    )

    if seconds < 60:
        return 'just now' if seconds < 5 else f'{seconds} sec ago'

    minutes = seconds // 60

    if minutes < 60:
        return f'{minutes} min ago'

    hours = minutes // 60

    if hours < 24:
        return f'{hours} hr ago'

    days = hours // 24
    return f'{days} day ago'

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")
        if not username or not password:
            messages.error(request, "Please enter both username and password")
        elif (user := authenticate(request, username=username, password=password)) is not None:
            login(request, user)
            return redirect('dashboard')
        else:
            messages.error(request, "Invalid username or password")
    return render(request, "login.html")


def logout_view(request):
    logout(request)
    return redirect('login')


@login_required(login_url='login')
def live_monitoring(request):

    classrooms = Classroom.objects.all().order_by('room_number')

    critical_count = 0
    warning_count = 0
    online_count = 0

    alerts = []

    # Check each classroom
    for classroom in classrooms:

        sensors = classroom.sensors.all()

        classroom_has_recent_data = False

        for sensor in sensors:

            latest = (
                SensorData.objects
                .filter(sensor=sensor)
                .order_by('-timestamp')
                .first()
            )

            if not latest:
                continue

            # Sensor has data
            classroom_has_recent_data = True

            # -------------------------
            # DHT22 - Temperature
            # -------------------------
            if sensor.sensor_type == "DHT22":

                if latest.temperature is not None:

                    if latest.temperature > TEMP_THRESHOLD:

                        critical_count += 1

                        alerts.append({
                            "type": "critical",
                            "icon": "bi-thermometer-high",
                            "title": "High Temperature",
                            "message": (
                                f"{classroom.room_number} temperature "
                                f"is {latest.temperature}°C."
                            ),
                        })


            # -------------------------
            # BH1750 - Light
            # -------------------------
            elif sensor.sensor_type == "BH1750":

                if latest.light_intensity is not None:

                    if latest.light_intensity < LUX_THRESHOLD:

                        warning_count += 1

                        alerts.append({
                            "type": "warning",
                            "icon": "bi-brightness-low",
                            "title": "Insufficient Natural Light",
                            "message": (
                                f"{classroom.room_number} light level "
                                f"is {latest.light_intensity} Lux."
                            ),
                        })


            # -------------------------
            # PIR - Occupancy
            # -------------------------
            elif sensor.sensor_type == "PIR":

                if latest.occupancy_status == "vacant":

                    # We don't create a warning just because
                    # the room is vacant. Vacancy itself is normal.
                    pass


        if classroom_has_recent_data:
            online_count += 1


    # No problems
    if critical_count == 0 and warning_count == 0:

        alert_message = {
            "title": "Everything looks good",
            "description": (
                "No critical issues detected across monitored classrooms."
            ),
        }

    else:

        alert_message = {
            "title": "Attention required",
            "description": (
                f"{critical_count} critical issue(s) and "
                f"{warning_count} warning(s) detected."
            ),
        }


    return render(request, "live_monitoring.html", {
        "classrooms": classrooms,

        "critical_count": critical_count,
        "warning_count": warning_count,
        "online_count": online_count,

        "alerts": alerts,
        "alert_message": alert_message,
    })


# ---- Analytics ----

LUX_THRESHOLD = 300          # below this lux = insufficient natural light
TEMP_THRESHOLD = 28.0        # above this °C = fan considered necessary
GRACE_PERIOD_MINUTES = 5     # appliance assumed to stay ON this long after room goes vacant

@login_required(login_url='login')
def live_monitoring_api(request):
    classroom_id = request.GET.get('classroom_id')

    if not classroom_id:
        return JsonResponse(
            {'error': 'classroom_id is required'},
            status=400
        )

    try:
        classroom_id = int(classroom_id)
    except (TypeError, ValueError):
        return JsonResponse(
            {'error': 'Invalid classroom_id'},
            status=400
        )

    if not Classroom.objects.filter(classroom_id=classroom_id).exists():
        return JsonResponse(
            {'error': 'Classroom not found'},
            status=404
        )

    def latest_for(sensor_type):
        return (
            SensorData.objects
            .filter(
                sensor__classroom_id=classroom_id,
                sensor__sensor_type=sensor_type
            )
            .order_by('-timestamp')
            .first()
        )

    dht = latest_for('DHT22')
    pir = latest_for('PIR')
    bh = latest_for('BH1750')

    # Keep timestamps separate so each sensor's freshness
    # can be evaluated independently.
    now = timezone.now()
    stale_after_seconds = 15

    def sensor_payload(record):
        if record is None:
            return {
                'value': None,
                'timestamp': None,
                'status': 'no_data',
            }

        age_seconds = max(
            0,
            (now - record.timestamp).total_seconds()
        )

        status = (
            'live'
            if age_seconds <= stale_after_seconds
            else 'offline'
        )

        return {
            'value': record.timestamp.isoformat(),
            'timestamp': record.timestamp.isoformat(),
            'status': status,
            'age_seconds': round(age_seconds, 1),
        }

    timestamps = [
        record.timestamp
        for record in (dht, pir, bh)
        if record is not None
    ]

    latest_timestamp = max(timestamps) if timestamps else None

    sensor_status = {
        'DHT22': sensor_payload(dht),
        'PIR': sensor_payload(pir),
        'BH1750': sensor_payload(bh),
    }

    any_live = any(
        item['status'] == 'live'
        for item in sensor_status.values()
    )

    return JsonResponse({
        'classroom_id': classroom_id,

        'temperature': dht.temperature if dht else None,
        'humidity': dht.humidity if dht else None,
        'light_intensity': bh.light_intensity if bh else None,
        'occupancy_status': pir.occupancy_status if pir else None,

        'timestamp': (
            timezone.localtime(latest_timestamp).isoformat()
            if latest_timestamp else None
        ),

        'sensor_status': sensor_status,
        'system_status': 'online' if any_live else 'offline',

        # These remain unknown until actual device-state data exists.
        'fan_status': None,
        'light_status': None,
    })
    
@login_required(login_url='login')
def analytics(request):
    classrooms = Classroom.objects.all()
    return render(request, "analytics.html", {"classrooms": classrooms})


def _parse_range(request):
    """Resolve the selected date range into aware start/end datetimes."""
    range_type = request.GET.get('range', 'today')
    now = timezone.localtime()

    if range_type == 'today':
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif range_type == '7days':
        start = now - timedelta(days=7)
        end = now
    elif range_type == '30days':
        start = now - timedelta(days=30)
        end = now
    elif range_type == 'custom':
        start_str = request.GET.get('start')
        end_str = request.GET.get('end')
        try:
            start = timezone.make_aware(datetime.strptime(start_str, '%Y-%m-%d'))
            end = timezone.make_aware(datetime.strptime(end_str, '%Y-%m-%d')) + timedelta(days=1)
        except (TypeError, ValueError):
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now

    return start, end


def _fmt_duration(td):
    total_seconds = max(int(td.total_seconds()), 0)
    h, rem = divmod(total_seconds, 3600)
    m, _ = divmod(rem, 60)
    return f"{h}h {m}m"


def _latest_value(times, vals, target):
    """Latest known reading at or before `target` timestamp (binary search)."""
    idx = bisect.bisect_right(times, target) - 1
    return vals[idx] if idx >= 0 else None


@login_required(login_url='login')
def analytics_api(request):
    start, end = _parse_range(request)
    classroom_id = request.GET.get('classroom_id')

    qs = SensorData.objects.filter(timestamp__gte=start, timestamp__lte=end)
    if classroom_id:
        qs = qs.filter(sensor__classroom_id=classroom_id)
    qs = qs.select_related('sensor').order_by('timestamp')

    temp_points, humidity_points, light_points, occupancy_points = [], [], [], []

    for row in qs:
        stype = row.sensor.sensor_type
        ts = row.timestamp
        if stype == 'DHT22':
            if row.temperature is not None:
                temp_points.append((ts, row.temperature))
            if row.humidity is not None:
                humidity_points.append((ts, row.humidity))
        elif stype == 'BH1750':
            if row.light_intensity is not None:
                light_points.append((ts, row.light_intensity))
        elif stype == 'PIR':
            if row.occupancy_status:
                occupancy_points.append((ts, row.occupancy_status))

    # ---- Averages ----
    avg_temp = round(sum(v for _, v in temp_points) / len(temp_points), 1) if temp_points else None
    avg_humidity = round(sum(v for _, v in humidity_points) / len(humidity_points), 1) if humidity_points else None
    avg_light = round(sum(v for _, v in light_points) / len(light_points), 1) if light_points else None

    # ---- Occupancy intervals (status held until the next PIR reading) ----
    occupancy_points.sort(key=lambda x: x[0])
    intervals = []
    for i, (ts, status) in enumerate(occupancy_points):
        next_ts = occupancy_points[i + 1][0] if i + 1 < len(occupancy_points) else end
        if next_ts > ts:
            intervals.append({'start': ts, 'end': next_ts, 'status': status})

    total_occupied = timedelta()
    total_unoccupied = timedelta()
    for iv in intervals:
        dur = iv['end'] - iv['start']
        if iv['status'] == 'occupied':
            total_occupied += dur
        else:
            total_unoccupied += dur

    # ---- Derive light/fan ON periods (see automation-rule note above) ----
    temp_times = [t for t, _ in temp_points]
    temp_vals = [v for _, v in temp_points]
    light_times = [t for t, _ in light_points]
    light_vals = [v for _, v in light_points]

    grace = timedelta(minutes=GRACE_PERIOD_MINUTES)
    light_on_time = timedelta()
    fan_on_time = timedelta()
    light_on_while_unoccupied = timedelta()
    fan_on_while_unoccupied = timedelta()
    waste_events = []

    prev_light_on, prev_fan_on = False, False

    for iv in intervals:
        dur = iv['end'] - iv['start']
        if dur.total_seconds() <= 0:
            continue

        if iv['status'] == 'occupied':
            lux = _latest_value(light_times, light_vals, iv['start'])
            temp = _latest_value(temp_times, temp_vals, iv['start'])
            is_light_on = lux is not None and lux < LUX_THRESHOLD
            is_fan_on = temp is not None and temp > TEMP_THRESHOLD

            if is_light_on:
                light_on_time += dur
            if is_fan_on:
                fan_on_time += dur

            prev_light_on, prev_fan_on = is_light_on, is_fan_on
        else:
            # vacant interval: apply grace period if appliance was left on
            if prev_light_on:
                g = min(grace, dur)
                light_on_time += g
                light_on_while_unoccupied += g
                waste_events.append({
                    'appliance': 'Light',
                    'start': iv['start'].isoformat(),
                    'end': (iv['start'] + g).isoformat(),
                    'duration': _fmt_duration(g),
                })
            if prev_fan_on:
                g = min(grace, dur)
                fan_on_time += g
                fan_on_while_unoccupied += g
                waste_events.append({
                    'appliance': 'Fan',
                    'start': iv['start'].isoformat(),
                    'end': (iv['start'] + g).isoformat(),
                    'duration': _fmt_duration(g),
                })
            prev_light_on, prev_fan_on = False, False

    # ---- Natural light sufficiency ----
    sufficient_pct = None
    if light_points:
        sufficient_count = sum(1 for _, v in light_points if v >= LUX_THRESHOLD)
        sufficient_pct = round(100 * sufficient_count / len(light_points), 1)

    total_period_seconds = (end - start).total_seconds()
    light_pct = round(100 * light_on_time.total_seconds() / total_period_seconds, 1) if total_period_seconds else 0
    fan_pct = round(100 * fan_on_time.total_seconds() / total_period_seconds, 1) if total_period_seconds else 0

    data = {
        'summary': {
            'avg_temperature': avg_temp,
            'avg_humidity': avg_humidity,
            'avg_light': avg_light,
            'total_occupied_fmt': _fmt_duration(total_occupied),
            'total_unoccupied_fmt': _fmt_duration(total_unoccupied),
            'light_on_fmt': _fmt_duration(light_on_time),
            'fan_on_fmt': _fmt_duration(fan_on_time),
        },
        'occupancy_timeline': [
            {'timestamp': iv['start'].isoformat(), 'status': iv['status']} for iv in intervals
        ],
        'temperature_trend': [{'timestamp': t.isoformat(), 'value': v} for t, v in temp_points],
        'humidity_trend': [{'timestamp': t.isoformat(), 'value': v} for t, v in humidity_points],
        'light_trend': [{'timestamp': t.isoformat(), 'value': v} for t, v in light_points],
        'usage_bar': {
            'light_on_hours': round(light_on_time.total_seconds() / 3600, 2),
            'fan_on_hours': round(fan_on_time.total_seconds() / 3600, 2),
        },
        'waste_events': waste_events,
        'insights': {
            'total_unoccupied_fmt': _fmt_duration(total_unoccupied),
            'light_on_while_unoccupied_fmt': _fmt_duration(light_on_while_unoccupied),
            'fan_on_while_unoccupied_fmt': _fmt_duration(fan_on_while_unoccupied),
            'sufficient_light_pct': sufficient_pct,
            'light_usage_pct': light_pct,
            'fan_usage_pct': fan_pct,
        },
        'has_data': bool(temp_points or humidity_points or light_points or occupancy_points),
    }
    return JsonResponse(data)


@login_required(login_url='login')
def settings_view(request):

    if request.method == "POST":

        room_number = request.POST.get("room_number", "").strip()
        location = request.POST.get("location", "").strip()
        capacity = request.POST.get("capacity", "").strip()

        # Validate required fields
        if not room_number or not location or not capacity:
            messages.error(request, "Please fill in all classroom fields.")

        else:
            try:
                capacity = int(capacity)

                if capacity <= 0:
                    messages.error(request, "Capacity must be greater than 0.")

                elif Classroom.objects.filter(
                    room_number__iexact=room_number
                ).exists():
                    messages.error(
                        request,
                        f"Classroom {room_number} already exists."
                    )

                else:
                    Classroom.objects.create(
                        room_number=room_number,
                        location=location,
                        capacity=capacity
                    )

                    messages.success(
                        request,
                        f"Classroom {room_number} added successfully."
                    )

                    return redirect("settings")

            except ValueError:
                messages.error(request, "Capacity must be a valid number.")


    classrooms = Classroom.objects.prefetch_related('sensors').all()

    total_classrooms = classrooms.count()

    total_sensors = Sensor.objects.count()

    return render(request, "settings.html", {
        "classrooms": classrooms,
        "total_classrooms": total_classrooms,
        "total_sensors": total_sensors,
    })

@login_required(login_url='login')
def profile_view(request):
    return render(request, "profile.html")


@login_required(login_url='login')
def account_settings_view(request):
    return render(request, "account_settings.html", {
        "current_username": request.user.username,
        "current_email": request.user.email,
        "date_joined": request.user.date_joined,
        "last_login": request.user.last_login,
        "is_active": request.user.is_active,
    })