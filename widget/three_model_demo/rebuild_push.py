"""
Rebuild 3D model widget JSON and push to ThingsBoard.
"""
import json
import sys
import requests

BASE_DIR = r"D:\Projects\thingsboard-smart-greenhouse\widget\three_model_demo\thingsboard"

# Read source files
with open(f"{BASE_DIR}\\tb_3d_widget_html.html", "r", encoding="utf-8") as f:
    html_content = f.read()

with open(f"{BASE_DIR}\\tb_3d_widget_css.css", "r", encoding="utf-8") as f:
    css_content = f.read()

with open(f"{BASE_DIR}\\tb_3d_widget_js.js", "r", encoding="utf-8") as f:
    js_content = f.read()

# Build widget type JSON (fresh) — structure mirrors working full_scene widget type
widget_json = {
    "fqn": "greenhouse_test.three_d_model",
    "name": "3D Greenhouse Model",
    "deprecated": False,
    "scada": False,
    "descriptor": {
        "type": "latest",
        "sizeX": 12,
        "sizeY": 8,
        "resources": [],
        "templateHtml": html_content,
        "templateCss": css_content,
        "controllerScript": js_content,
        "dataKeySettingsSchema": "{}",
        "settingsDirective": "",
        "defaultConfig": json.dumps({
            "datasources": [
                {
                    "type": "entity",
                    "name": "Greenhouse_Device_01",
                    "entityAliasId": None,
                    "filterId": None,
                    "dataKeys": [
                        {"name": "fanStatus", "type": "timeseries", "label": "Fan", "color": "#00d9ff", "settings": {}, "_hash": 0.1},
                        {"name": "lampStatus", "type": "timeseries", "label": "Lamp", "color": "#ffe066", "settings": {}, "_hash": 0.2},
                        {"name": "sprayStatus", "type": "timeseries", "label": "Spray", "color": "#88ddff", "settings": {}, "_hash": 0.3},
                        {"name": "pumpStatus", "type": "timeseries", "label": "Pump", "color": "#00a8e8", "settings": {}, "_hash": 0.4},
                        {"name": "soilAlarm", "type": "timeseries", "label": "Soil Alarm", "color": "#ff9500", "settings": {}, "_hash": 0.5},
                        {"name": "waterAlarm", "type": "timeseries", "label": "Water Alarm", "color": "#ff3860", "settings": {}, "_hash": 0.6}
                    ]
                }
            ],
            "timewindow": {
                "realtime": {"timewindowMs": 60000}
            },
            "showTitle": True,
            "backgroundColor": "#020b12",
            "color": "rgba(224,240,255,1)",
            "padding": "0px",
            "settings": {},
            "title": "3D Greenhouse Model",
            "dropShadow": False,
            "enableFullscreen": True,
            "widgetStyle": {},
            "titleStyle": {"fontSize": "16px", "fontWeight": 400},
            "showLegend": False,
            "actions": {}
        }, ensure_ascii=False)
    }
}

# Write JSON
json_path = f"{BASE_DIR}\\three_d_model_widget_type.json"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(widget_json, f, ensure_ascii=False, indent=2)
print(f"[OK] Widget JSON written to {json_path}")

# Push to ThingsBoard
TB_URL = "http://192.168.161.130:8080"
WIDGET_TYPE_ID = "38fe7450-5903-11f1-bd9f-8392d05e68a2"  # greenhouse_test.three_d_model

login_resp = requests.post(
    f"{TB_URL}/api/auth/login",
    json={"username": "tenant@thingsboard.org", "password": "tenant"},
    timeout=10
)
if login_resp.status_code != 200:
    print(f"[ERROR] Login failed: {login_resp.status_code} {login_resp.text}")
    sys.exit(1)

token = login_resp.json()["token"]
headers = {
    "X-Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Update existing widget type by ID
widget_json["id"] = {"id": WIDGET_TYPE_ID, "entityType": "WIDGET_TYPE"}
resp = requests.post(
    f"{TB_URL}/api/widgetType",
    json=widget_json,
    headers=headers,
    timeout=30
)

if resp.status_code in (200, 201):
    print("[OK] 3D Widget type pushed to ThingsBoard successfully")
    result = resp.json()
    print(f"  FQN: {result.get('fqn', 'N/A')}")
    print(f"  ID:  {result.get('id', {}).get('id', 'N/A')}")
    print("\n[INFO] Next step: Add this widget to '智慧农业测试' dashboard")
    print("  1. Open ThingsBoard → 仪表盘 → 智慧农业测试")
    print("  2. Click edit (pencil icon)")
    print("  3. Add new widget → 选择 '3D Greenhouse Model'")
    print("  4. Select device: Greenhouse_Device_01")
else:
    print(f"[ERROR] Push failed: {resp.status_code}")
    print(resp.text[:500])
