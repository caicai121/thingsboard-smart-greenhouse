"""Update full_scene widget type with merged 3D code."""
import requests, json

TB_URL = 'http://192.168.161.130:8080'
WT_ID = '30e7fb50-5855-11f1-97d0-3140d6cf905a'

login_resp = requests.post(
    f'{TB_URL}/api/auth/login',
    json={'username': 'tenant@thingsboard.org', 'password': 'tenant'},
    timeout=10
)
TOKEN = login_resp.json()['token']
headers = {'X-Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}

# Read merged files
BASE = 'D:/Projects/thingsboard-smart-greenhouse/widget/three_model_demo/thingsboard'
with open(f'{BASE}/full_scene_html_3d.html', 'r', encoding='utf-8') as f:
    html = f.read()
with open(f'{BASE}/full_scene_css_3d.css', 'r', encoding='utf-8') as f:
    css = f.read()
with open(f'{BASE}/full_scene_3d_merged.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Get current widget type
r = requests.get(f'{TB_URL}/api/widgetType/{WT_ID}', headers=headers)
wt = r.json()
print(f'Current WT: {wt["fqn"]} (ID: {WT_ID})')

# Update descriptor
wt['descriptor']['templateHtml'] = html
wt['descriptor']['templateCss'] = css
wt['descriptor']['controllerScript'] = js

# Save
r = requests.post(f'{TB_URL}/api/widgetType', json=wt, headers=headers)
if r.status_code in (200, 201):
    result = r.json()
    print(f'[OK] Widget type updated: {result["fqn"]}')
    print(f'  HTML: {len(html)} chars')
    print(f'  CSS:  {len(css)} chars')
    print(f'  JS:   {len(js)} chars')
else:
    print(f'[ERROR] Update failed: {r.status_code}')
    print(r.text[:500])
