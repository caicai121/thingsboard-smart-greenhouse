"""
Rebuild full_scene_widget_type.json from source files and push to ThingsBoard.
"""
import json
import sys
import requests

BASE_DIR = r"D:\Projects\thingsboard-smart-greenhouse\widget\v3_real_scene\thingsboard"

# Read source files
with open(f"{BASE_DIR}\\tb_widget_html.html", "r", encoding="utf-8") as f:
    html_content = f.read()

# Use same CSS (no changes for this refactor)
with open(f"{BASE_DIR}\\tb_widget_css.css", "r", encoding="utf-8") as f:
    css_content = f.read()

with open(f"{BASE_DIR}\\tb_widget_js.js", "r", encoding="utf-8") as f:
    js_content = f.read()

# Load existing JSON to preserve metadata
with open(f"{BASE_DIR}\\full_scene_widget_type.json", "r", encoding="utf-8") as f:
    widget_json = json.load(f)

# Update the three content fields
widget_json["descriptor"]["templateHtml"] = html_content
widget_json["descriptor"]["templateCss"] = css_content
widget_json["descriptor"]["controllerScript"] = js_content

# Update defaultConfig to add outsideLight and hourOfDay dataKeys
default_config = json.loads(widget_json["descriptor"]["defaultConfig"])
existing_keys = [dk["name"] for dk in default_config["datasources"][0]["dataKeys"]]

new_keys = [
    ("outsideLight", "Outside Light", "#ffeb3b"),
    ("hourOfDay", "Hour of Day", "#ff9800"),
]
for name, label, color in new_keys:
    if name not in existing_keys:
        default_config["datasources"][0]["dataKeys"].append({
            "name": name,
            "type": "timeseries",
            "label": label,
            "color": color,
            "settings": {},
            "_hash": 1.6 if name == "outsideLight" else 1.7
        })

widget_json["descriptor"]["defaultConfig"] = json.dumps(default_config, ensure_ascii=False)

# Write updated JSON
with open(f"{BASE_DIR}\\full_scene_widget_type.json", "w", encoding="utf-8") as f:
    json.dump(widget_json, f, ensure_ascii=False, indent=2)

print("[OK] full_scene_widget_type.json rebuilt with new lighting fields")

# Push to ThingsBoard
TB_URL = "http://192.168.161.130:8080"
# Must get a fresh token
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

# Save widget type
resp = requests.post(
    f"{TB_URL}/api/widgetType",
    json=widget_json,
    headers=headers,
    timeout=30
)

if resp.status_code in (200, 201):
    print("[OK] Widget type pushed to ThingsBoard successfully")
    result = resp.json()
    print(f"  FQN: {result.get('fqn', 'N/A')}")
    print(f"  ID:  {result.get('id', {}).get('id', 'N/A')}")
else:
    print(f"[ERROR] Push failed: {resp.status_code}")
    print(resp.text[:500])
