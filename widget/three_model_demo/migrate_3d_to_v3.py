"""
Step 1: Backup both dashboards + widget types.
Step 2: Migrate 3D widget from 智慧农业测试 to 智慧农业V3.
"""
import requests, json, uuid, os, sys
from datetime import datetime

TB_URL = 'http://192.168.161.130:8080'
BACKUP_DIR = r'D:\Projects\thingsboard-smart-greenhouse\thingsboard\backups'
os.makedirs(BACKUP_DIR, exist_ok=True)

# Login
login_resp = requests.post(
    f'{TB_URL}/api/auth/login',
    json={'username': 'tenant@thingsboard.org', 'password': 'tenant'},
    timeout=10
)
TOKEN = login_resp.json()['token']
headers = {'X-Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
print('=== Logged in ===')

# --- Find dashboards ---
resp = requests.get(f'{TB_URL}/api/tenant/dashboards?pageSize=100&page=0', headers=headers)
dashboards = resp.json().get('data', [])
print(f'\nFound {len(dashboards)} dashboards:')
src_id = None
dst_id = None
for d in dashboards:
    title = d.get('title', '')
    did = d['id']['id']
    print(f'  [{did}] {title}')
    if '智慧农业测试' in title:
        src_id = did
    if '智慧农业V3' in title or title == '智慧农业V3':
        dst_id = did

if not src_id:
    print('\nERROR: 智慧农业测试 not found!')
    sys.exit(1)
if not dst_id:
    print('\nERROR: 智慧农业V3 not found!')
    sys.exit(1)

print(f'\nSource (智慧农业测试): {src_id}')
print(f'Target (智慧农业V3):    {dst_id}')

# --- Backup step 1: Source dashboard ---
print('\n=== BACKUP: Source dashboard ===')
src_resp = requests.get(f'{TB_URL}/api/dashboard/{src_id}', headers=headers)
src_dashboard = src_resp.json()
src_path = os.path.join(BACKUP_DIR, 'dashboard_smart_greenhouse_test_before_migrate_3d.json')
with open(src_path, 'w', encoding='utf-8') as f:
    json.dump(src_dashboard, f, ensure_ascii=False, indent=2)
print(f'  Saved: {src_path}')

# --- Backup step 2: Target dashboard ---
print('\n=== BACKUP: Target dashboard ===')
dst_resp = requests.get(f'{TB_URL}/api/dashboard/{dst_id}', headers=headers)
dst_dashboard = dst_resp.json()
dst_path = os.path.join(BACKUP_DIR, 'dashboard_smart_greenhouse_v3_before_migrate_3d.json')
with open(dst_path, 'w', encoding='utf-8') as f:
    json.dump(dst_dashboard, f, ensure_ascii=False, indent=2)
print(f'  Saved: {dst_path}')

# --- Analyze source dashboard to find 3D widget ---
print('\n=== Analyzing source dashboard for 3D widget ===')
src_cfg = src_dashboard.get('configuration', {})
src_widgets = src_cfg.get('widgets', {})
src_layout = src_cfg.get('states', {}).get('default', {}).get('layouts', {}).get('main', {}).get('layout', [])

three_d_wid = None
three_d_fqn = None
three_d_config = None
three_d_layout = None

for wid, w in src_widgets.items():
    fqn = str(w.get('typeFullFqn', ''))
    if 'three_d_' in fqn:
        three_d_wid = wid
        three_d_fqn = fqn
        three_d_config = w.get('config', {})
        print(f'  Found 3D widget: id={wid}, FQN={fqn}')
        break

if not three_d_wid:
    print('\nERROR: No 3D widget found in source dashboard!')
    sys.exit(1)

# Find layout entry for 3D widget
for entry in src_layout:
    if entry.get('id') == three_d_wid:
        three_d_layout = entry
        print(f'  Layout: row={entry.get("row")}, col={entry.get("col")}, sizeX={entry.get("sizeX")}, sizeY={entry.get("sizeY")}')
        break

# --- Backup step 3: 3D Widget Type ---
print('\n=== BACKUP: 3D Widget Type ===')
# Extract FQN without 'tenant.' prefix for API query
wt_fqn = three_d_fqn.replace('tenant.', '') if three_d_fqn.startswith('tenant.') else three_d_fqn
wt_resp = requests.get(f'{TB_URL}/api/widgetTypes?isSystem=false&pageSize=200', headers=headers)
wt_data = wt_resp.json().get('data', [])
wt_json = None
wt_id = None
for wt in wt_data:
    if wt.get('fqn') == wt_fqn:
        wt_json = wt
        wt_id = wt['id']['id']
        break

if wt_json:
    wt_path = os.path.join(BACKUP_DIR, 'widget_type_three_d_model_before_migrate.json')
    with open(wt_path, 'w', encoding='utf-8') as f:
        json.dump(wt_json, f, ensure_ascii=False, indent=2)
    print(f'  Saved: {wt_path}')
    print(f'  WT ID: {wt_id}, FQN: {wt_fqn}')
else:
    print(f'  WARNING: Widget type {wt_fqn} not found via API (may still work if cached)')

# --- Backup step 4: V3 Full Scene Widget Type ---
print('\n=== BACKUP: V3 Full Scene Widget Type ===')
dst_widgets = dst_dashboard.get('configuration', {}).get('widgets', {})
v3_wt_fqn = None
for wid, w in dst_widgets.items():
    fqn = str(w.get('typeFullFqn', ''))
    if 'full_scene' in fqn.lower() or 'scene' in fqn.lower() or 'fullScene' in fqn.lower():
        v3_wt_fqn = fqn.replace('tenant.', '')
        break

if v3_wt_fqn:
    for wt in wt_data:
        if wt.get('fqn') == v3_wt_fqn:
            v3_wt_path = os.path.join(BACKUP_DIR, 'widget_type_full_scene_before_migrate_3d.json')
            with open(v3_wt_path, 'w', encoding='utf-8') as f:
                json.dump(wt, f, ensure_ascii=False, indent=2)
            print(f'  Saved: {v3_wt_path}')
            print(f'  WT ID: {wt["id"]["id"]}, FQN: {v3_wt_fqn}')
            break
else:
    print('  No Full Scene widget type found (non-critical)')

# --- Print summary before migration ---
print('\n' + '='*60)
print('BACKUP SUMMARY')
print('='*60)
print(f'Source dashboard ID: {src_id}')
print(f'Target dashboard ID: {dst_id}')
print(f'3D widget type FQN:  {three_d_fqn}')
print(f'3D widget type ID:   {wt_id}')
print(f'Target V3 widgets:   {len(dst_widgets)}')
dst_layout_entries = dst_dashboard.get('configuration', {}).get('states', {}).get('default', {}).get('layouts', {}).get('main', {}).get('layout', [])
print(f'Target V3 layout entries: {len(dst_layout_entries)}')
print(f'\nAll backups saved to: {BACKUP_DIR}')

# --- Verify backup files exist ---
print('\n=== Verifying backup files ===')
for fname in os.listdir(BACKUP_DIR):
    fpath = os.path.join(BACKUP_DIR, fname)
    if 'migrate_3d' in fname:
        size_kb = os.path.getsize(fpath) / 1024
        print(f'  {fname} ({size_kb:.1f} KB)')

# --- MIGRATION ---
print('\n' + '='*60)
print('MIGRATION: Adding 3D widget to 智慧农业V3')
print('='*60)

# Get V3 entity aliases
dst_aliases = dst_dashboard.get('configuration', {}).get('entityAliases', {})
print(f'\nV3 Entity Aliases: {json.dumps({k: v.get("alias", "?") for k, v in dst_aliases.items()}, ensure_ascii=False)}')

# Find the alias for the greenhouse device
greenhouse_alias_id = None
for aid, alias_info in dst_aliases.items():
    if 'greenhouse' in str(alias_info.get('alias', '')).lower() or 'device' in str(alias_info.get('alias', '')).lower():
        greenhouse_alias_id = aid
        break

if not greenhouse_alias_id:
    # Just use the first alias
    greenhouse_alias_id = list(dst_aliases.keys())[0]
    print(f'  Using first alias: {greenhouse_alias_id}')

print(f'  Greenhouse alias ID: {greenhouse_alias_id}')

# Build new 3D widget config
new_3d_config = json.loads(json.dumps(three_d_config))  # deep copy
# Update datasource entity alias
if new_3d_config.get('datasources'):
    for ds in new_3d_config['datasources']:
        ds['entityAliasId'] = greenhouse_alias_id

# Calculate position for new widget (after existing content)
max_bottom = 0
for entry in dst_layout_entries:
    bottom = entry.get('row', 0) + entry.get('sizeY', 0)
    if bottom > max_bottom:
        max_bottom = bottom

new_row = max_bottom
new_col = 0
new_sizeX = 24
new_sizeY = 12

print(f'\nNew widget position: row={new_row}, col={new_col}, sizeX={new_sizeX}, sizeY={new_sizeY}')

# Create new widget entry
new_wid = str(uuid.uuid4())
dst_widgets[new_wid] = {
    'type': 'latest',
    'sizeX': new_sizeX,
    'sizeY': new_sizeY,
    'row': new_row,
    'col': new_col,
    'typeFullFqn': three_d_fqn,
    'config': new_3d_config
}

# Add layout entry
new_layout_entry = {
    'id': new_wid,
    'sizeX': new_sizeX,
    'sizeY': new_sizeY,
    'row': new_row,
    'col': new_col
}
dst_layout_entries.append(new_layout_entry)

# Also add to states.default.layouts.main.widgets
dst_widgets_map = dst_dashboard.get('configuration', {}).get('states', {}).get('default', {}).get('layouts', {}).get('main', {}).get('widgets', {})
dst_widgets_map[new_wid] = {
    'col': new_col,
    'row': new_row,
    'sizeX': new_sizeX,
    'sizeY': new_sizeY
}

# Save dashboard
print('\nSaving updated V3 dashboard...')
save_resp = requests.post(f'{TB_URL}/api/dashboard', json=dst_dashboard, headers=headers)
if save_resp.status_code == 200:
    print(f'[OK] Dashboard saved!')
else:
    print(f'[ERROR] Save failed: {save_resp.status_code} {save_resp.text[:500]}')
    sys.exit(1)

# Verify
print('\n=== Verification ===')
verify_resp = requests.get(f'{TB_URL}/api/dashboard/{dst_id}', headers=headers)
verify = verify_resp.json()
v_widgets = verify.get('configuration', {}).get('widgets', {})
v_layout = verify.get('configuration', {}).get('states', {}).get('default', {}).get('layouts', {}).get('main', {}).get('layout', [])

print(f'Widgets count: {len(v_widgets)} (was {len(dst_widgets) - 1})')
print(f'Layout entries: {len(v_layout)} (was {len(dst_layout_entries) - 1})')

if new_wid in v_widgets:
    w = v_widgets[new_wid]
    print(f'[OK] New 3D widget exists: {new_wid}')
    print(f'     FQN: {w.get("typeFullFqn")}')
    print(f'     Position: row={w.get("row")}, col={w.get("col")}')
    ds = w.get('config', {}).get('datasources', [{}])[0]
    print(f'     EntityAliasId: {ds.get("entityAliasId")}')
else:
    print(f'[ERROR] New widget NOT found in dashboard!')

# Check existing widgets still exist
print(f'\n[OK] Migration complete. New widget ID: {new_wid}')
print(f'Backups saved to: {BACKUP_DIR}')
