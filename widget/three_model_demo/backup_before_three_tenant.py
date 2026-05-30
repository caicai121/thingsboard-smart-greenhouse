"""Backup V3 dashboard and Full Scene widget type before three-tenant farm expansion."""
import requests, json, shutil, os

TB_URL = 'http://192.168.161.130:8080'
DASHBOARD_ID = '1e4b46b0-584a-11f1-97d0-3140d6cf905a'
WT_ID = '30e7fb50-5855-11f1-97d0-3140d6cf905a'
BACKUP_DIR = 'D:/Projects/thingsboard-smart-greenhouse/thingsboard/backups'
CODE_BACKUP_DIR = f'{BACKUP_DIR}/code_before_three_tenant_farm'
BASE = 'D:/Projects/thingsboard-smart-greenhouse/widget/three_model_demo/thingsboard'

login_resp = requests.post(
    f'{TB_URL}/api/auth/login',
    json={'username': 'tenant@thingsboard.org', 'password': 'tenant'},
    timeout=10
)
TOKEN = login_resp.json()['token']
headers = {'X-Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}

# 1. Backup dashboard
r = requests.get(f'{TB_URL}/api/dashboard/{DASHBOARD_ID}', headers=headers)
dashboard = r.json()
dash_path = f'{BACKUP_DIR}/dashboard_smart_greenhouse_v3_before_three_tenant_farm.json'
with open(dash_path, 'w', encoding='utf-8') as f:
    json.dump(dashboard, f, indent=2, ensure_ascii=False)
print(f'[OK] Dashboard backup: {dash_path}')

# 2. Backup widget type
r = requests.get(f'{TB_URL}/api/widgetType/{WT_ID}', headers=headers)
wt = r.json()
wt_path = f'{BACKUP_DIR}/widget_type_full_scene_before_three_tenant_farm.json'
with open(wt_path, 'w', encoding='utf-8') as f:
    json.dump(wt, f, indent=2, ensure_ascii=False)
print(f'[OK] Widget Type backup: {wt_path}')

# 3. Backup JS file
js_src = f'{BASE}/full_scene_3d_merged.js'
js_dst = f'{CODE_BACKUP_DIR}/full_scene_3d_merged.js'
shutil.copy2(js_src, js_dst)
print(f'[OK] JS backup: {js_dst} ({os.path.getsize(js_dst)} bytes)')

print('\nAll backups complete. Ready for three-tenant farm expansion.')
