import os
import json
import time
import requests
from dotenv import load_dotenv

load_dotenv()

THINGSBOARD_HOST = os.getenv("THINGSBOARD_HOST", "192.168.161.130")
TB_URL = f"http://{THINGSBOARD_HOST}:8080"
DEVICE_NAME = "Greenhouse_Device_01"

def login():
    url = f"{TB_URL}/api/auth/login"
    payload = {"username": "tenant@thingsboard.org", "password": "tenant"}
    resp = requests.post(url, json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()["token"]

DEVICE_ID = "2d415ac0-5803-11f1-928b-253a5007835b"  # Greenhouse_Device_01

def get_device_id(token):
    return DEVICE_ID

def send_rpc(token, device_id, method, params):
    headers = {"X-Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{TB_URL}/api/plugins/rpc/twoway/{device_id}"
    payload = {"method": method, "params": params, "timeout": 3000}
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"  [{method}] status={resp.status_code}, response={resp.text}")
        return resp.status_code == 200
    except Exception as e:
        print(f"  [{method}] ERROR: {e}")
        return False

def main():
    print("=" * 50)
    print("RPC Test Tool")
    print("=" * 50)

    token = login()
    device_id = get_device_id(token)
    print(f"Device ID: {device_id}")

    tests = [
        ("setFan", True),
        ("setFan", False),
        ("setPump", True),
        ("setPump", False),
        ("setLamp", True),
        ("setLamp", False),
        ("setSpray", True),
        ("setSpray", False),
        ("setAutoMode", True),
        ("setAutoMode", False),
    ]

    print("\n--- Test SET methods ---")
    for method, params in tests:
        send_rpc(token, device_id, method, params)
        time.sleep(0.5)

    print("\n--- Test GET methods ---")
    get_tests = ["getFan", "getPump", "getLamp", "getSpray", "getAutoMode"]
    for method in get_tests:
        send_rpc(token, device_id, method, None)
        time.sleep(0.5)

    print("\n[Done] Check Python terminal for [RPC] logs!")

if __name__ == "__main__":
    main()
