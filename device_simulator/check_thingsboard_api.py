import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv()

THINGSBOARD_HOST = os.getenv("THINGSBOARD_HOST", "192.168.161.130")
TB_URL = f"http://{THINGSBOARD_HOST}:8080"

# 登录信息 (租户管理员)
USERNAME = "tenant@thingsboard.org"
PASSWORD = "tenant"

# 期望的字段
EXPECTED_SENSOR_KEYS = [
    "temperature", "airHumidity", "soilHumidity",
    "lightIntensity", "co2", "waterLevel"
]
EXPECTED_ACTUATOR_KEYS = [
    "fanStatus", "pumpStatus", "lampStatus",
    "sprayStatus", "autoMode"
]
EXPECTED_ALARM_KEYS = [
    "soilAlarm", "tempAlarm", "waterAlarm", "co2Alarm"
]

def login():
    """登录获取 JWT Token"""
    url = f"{TB_URL}/api/auth/login"
    payload = {"username": USERNAME, "password": PASSWORD}
    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        token = resp.json().get("token")
        print(f"[OK] Login successful, token acquired")
        return token
    except Exception as e:
        print(f"[FAIL] Login failed: {e}")
        return None

def get_device_list(token):
    """获取设备列表"""
    headers = {"X-Authorization": f"Bearer {token}"}
    # 尝试多种端点
    urls = [
        f"{TB_URL}/api/devices?pageSize=100&page=0",
        f"{TB_URL}/api/tenant/devices?pageSize=100&page=0",
    ]
    for url in urls:
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                print(f"  [OK] Using endpoint: {url.split('/')[-1].split('?')[0]}")
                return data
        except Exception:
            continue
    print("[FAIL] All device list endpoints failed")
    return []

def get_device_telemetry(token, device_id):
    """获取设备最新遥测数据"""
    headers = {"X-Authorization": f"Bearer {token}"}
    keys = ",".join(
        EXPECTED_SENSOR_KEYS + EXPECTED_ACTUATOR_KEYS + EXPECTED_ALARM_KEYS
    )
    url = f"{TB_URL}/api/plugins/telemetry/DEVICE/{device_id}/values/timeseries?keys={keys}"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[FAIL] Get telemetry failed: {e}")
        return {}

def check_device(device):
    """检查单个设备信息"""
    name = device.get("name", "")
    device_type = device.get("type", "")
    device_id = device.get("id", {}).get("id", "")
    print(f"\n  Name: {name}")
    print(f"  Type: {device_type}")
    print(f"  ID: {device_id}")
    return device_id

def check_telemetry(telemetry):
    """检查遥测数据完整性"""
    all_expected = EXPECTED_SENSOR_KEYS + EXPECTED_ACTUATOR_KEYS + EXPECTED_ALARM_KEYS

    print(f"\n[3] Telemetry Check ({len(all_expected)} fields expected)")
    print("-" * 50)

    found = set(telemetry.keys())
    missing = []

    # 传感器数据
    print("\n  Sensor Data (6 fields):")
    for key in EXPECTED_SENSOR_KEYS:
        if key in telemetry:
            val = telemetry[key][0].get("value", "N/A") if telemetry[key] else "N/A"
            ts = telemetry[key][0].get("ts", 0) if telemetry[key] else 0
            print(f"    [OK] {key:15s} = {val}")
        else:
            print(f"    [MISSING] {key}")
            missing.append(key)

    # 执行器状态
    print("\n  Actuator State (5 fields):")
    for key in EXPECTED_ACTUATOR_KEYS:
        if key in telemetry:
            val = telemetry[key][0].get("value", "N/A") if telemetry[key] else "N/A"
            print(f"    [OK] {key:15s} = {val}")
        else:
            print(f"    [MISSING] {key}")
            missing.append(key)

    # 报警字段
    print("\n  Alarm Fields (4 fields):")
    for key in EXPECTED_ALARM_KEYS:
        if key in telemetry:
            val = telemetry[key][0].get("value", "N/A") if telemetry[key] else "N/A"
            print(f"    [OK] {key:15s} = {val}")
        else:
            print(f"    [MISSING] {key}")
            missing.append(key)

    print(f"\n{'-' * 50}")
    total = len(all_expected)
    found_count = total - len(missing)
    print(f"Result: {found_count}/{total} fields found")

    if missing:
        print(f"\nMissing fields:")
        for key in missing:
            print(f"  - {key}")
        return False
    else:
        print("\n[PASS] All telemetry fields are present!")
        return True

def main():
    print("=" * 60)
    print("ThingsBoard API Check Tool")
    print(f"Server: {TB_URL}")
    print("=" * 60)

    # Step 1: Login
    print("\n[1] Logging in...")
    token = login()
    if not token:
        sys.exit(1)

    # Step 2: Get devices
    print("\n[2] Fetching device list...")
    devices = get_device_list(token)
    print(f"Found {len(devices)} device(s)")

    target_device = None
    for d in devices:
        check_device(d)
        if d.get("name") == "Greenhouse_Device_01":
            target_device = d

    if not target_device:
        print("\n[FAIL] Greenhouse_Device_01 not found!")
        print("Please create the device in ThingsBoard first.")
        sys.exit(1)

    print("\n[OK] Target device found!")
    device_id = target_device.get("id", {}).get("id", "")

    # Step 3: Check telemetry
    telemetry = get_device_telemetry(token, device_id)
    if not telemetry:
        print("\n[FAIL] No telemetry data received!")
        print("Make sure the simulator is running.")
        sys.exit(1)

    success = check_telemetry(telemetry)

    # Summary
    print("\n" + "=" * 60)
    if success:
        print("OVERALL: PASS - Device and telemetry are ready!")
        print("You can now proceed to dashboard configuration.")
    else:
        print("OVERALL: FAIL - Some telemetry fields are missing.")
        print("Check if the simulator is running correctly.")
    print("=" * 60)

    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
