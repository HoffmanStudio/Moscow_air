from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

sensor_data = []

@app.route('/api/data', methods=['POST', 'OPTIONS'])
def receive_data():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json()
        current_time = datetime.now()

        print(f"\nПолучены данные в {current_time.strftime('%H:%M:%S')}")
        print(f"   ID: {data.get('sensor_id')}")

        record = {
            'received_at': current_time.strftime('%H:%M:%S'),
            'sensor_id': data.get('sensor_id'),
            'timestamp': data.get('timestamp'),
            'data': data.get('data', {})
        }

        sensor_data.append(record)
        print(f"   Всего записей: {len(sensor_data)}")

        if len(sensor_data) > 100:
            sensor_data.pop(0)

        return jsonify({"status": "ok", "records": len(sensor_data)}), 200

    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"status": "error"}), 500


@app.route('/api/latest-data', methods=['GET', 'OPTIONS'])
def get_latest_data():
    if request.method == 'OPTIONS':
        return '', 200

    if not sensor_data:
        return jsonify([{
            'sensor_id': 'MQ2_SENSOR_01',
            'sensor_name': 'MQ-2 Датчик',
            'timestamp': datetime.now().isoformat(),
            'latitude': 55.7558,
            'longitude': 37.6173,
            'lpg_ppm': 12.5,
            'co_ppm': 4.2,
            'smoke_ppm': 8.7,
            'propane_ppm': 3.1,
            'alarm': False,
            'battery': 85,
            'aqi': 42
        }]), 200

    latest = {}
    for record in reversed(sensor_data):
        sensor_id = record['sensor_id']
        if sensor_id not in latest:
            latest[sensor_id] = {
                'sensor_id': sensor_id,
                'sensor_name': f"Датчик {sensor_id}",
                'timestamp': record['timestamp'],
                'latitude': 55.7558,
                'longitude': 37.6173,
                'lpg_ppm': record['data'].get('lpg_ppm', 0),
                'co_ppm': record['data'].get('co_ppm', 0),
                'smoke_ppm': record['data'].get('smoke_ppm', 0),
                'propane_ppm': record['data'].get('propane_ppm', 0),
                'alarm': record['data'].get('alarm', False),
                'battery': 85,
                'aqi': calculate_aqi(record['data'])
            }

    return jsonify(list(latest.values())), 200


@app.route('/api/status', methods=['GET', 'OPTIONS'])
def get_status():
    if request.method == 'OPTIONS':
        return '', 200

    return jsonify({
        "status": "running",
        "records": len(sensor_data),
        "last_update": sensor_data[-1]['received_at'] if sensor_data else None
    }), 200


@app.route('/api/test', methods=['GET', 'OPTIONS'])
def get_test():
    if request.method == 'OPTIONS':
        return '', 200

    return jsonify([{
        'sensor_id': 'MQ2_SENSOR_01',
        'sensor_name': 'Тестовый датчик',
        'timestamp': datetime.now().isoformat(),
        'latitude': 55.7558,
        'longitude': 37.6173,
        'lpg_ppm': 12.5,
        'co_ppm': 4.2,
        'smoke_ppm': 8.7,
        'propane_ppm': 3.1,
        'alarm': False,
        'battery': 85,
        'aqi': 42
    }]), 200


def calculate_aqi(data):
    smoke = data.get('smoke_ppm', 0)
    co = data.get('co_ppm', 0)
    lpg = data.get('lpg_ppm', 0)
    score = smoke * 0.5 + co * 2 + lpg * 0.3

    if score < 10:
        return 35
    if score < 20:
        return 75
    if score < 30:
        return 120
    return 180


if __name__ == '__main__':
    print("Сервер MQ-2 запущен")
    print("http://192.168.0.218:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
