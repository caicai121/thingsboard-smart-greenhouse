"""
调试 RPC 测试脚本
通过 ThingsBoard REST API 发送 setDebugSensor / clearDebugSensor / clearAllDebugSensors

用法:
  python test_debug_rpc.py --key soilHumidity --value 20
  python test_debug_rpc.py --clear soilHumidity
  python test_debug_rpc.py --clear-all
  python test_debug_rpc.py --key temperature --value 36
  python test_debug_rpc.py --key lightIntensity --value 100
  python test_debug_rpc.py --key waterLevel --value 10
  python test_debug_rpc.py --key co2 --value 1200
"""
import argparse
import requests

TB_URL = "http://192.168.161.130:8080"
DEVICE_ID = "2d415ac0-5803-11f1-928b-253a5007835b"
USERNAME = "tenant@thingsboard.org"
PASSWORD = "tenant"

VALID_KEYS = ["soilHumidity", "temperature", "lightIntensity", "waterLevel", "co2", "airHumidity"]


def get_token():
    r = requests.post(f"{TB_URL}/api/auth/login",
                      json={"username": USERNAME, "password": PASSWORD})
    r.raise_for_status()
    return r.json()["token"]


def send_oneway_rpc(token, method, params):
    r = requests.post(
        f"{TB_URL}/api/rpc/oneway/{DEVICE_ID}",
        json={"method": method, "params": params},
        headers={"X-Authorization": f"Bearer {token}"}
    )
    return r.status_code


def main():
    parser = argparse.ArgumentParser(description="Debug Sensor RPC CLI")
    parser.add_argument("--key", choices=VALID_KEYS, help="Sensor key to override")
    parser.add_argument("--value", type=float, help="Override value (0-1500)")
    parser.add_argument("--clear", choices=VALID_KEYS, help="Clear override for one sensor")
    parser.add_argument("--clear-all", action="store_true", help="Clear all overrides")
    args = parser.parse_args()

    token = get_token()

    if args.clear_all:
        status = send_oneway_rpc(token, "clearAllDebugSensors", {})
        print(f"[OK] clearAllDebugSensors → HTTP {status}")

    elif args.clear:
        status = send_oneway_rpc(token, "clearDebugSensor", {"key": args.clear})
        print(f"[OK] clearDebugSensor({args.clear}) → HTTP {status}")

    elif args.key and args.value is not None:
        params = {"key": args.key, "value": args.value}
        status = send_oneway_rpc(token, "setDebugSensor", params)
        print(f"[OK] setDebugSensor({args.key}={args.value}) → HTTP {status}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
