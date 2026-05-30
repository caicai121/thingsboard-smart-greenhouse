"""Create fresh widget type with new FQN to avoid browser cache."""
import requests, json, uuid

TB_URL = 'http://192.168.161.130:8080'
DASHBOARD_ID = 'd0439c80-5900-11f1-bd9f-8392d05e68a2'
NEW_FQN = 'greenhouse_test.three_d_' + str(uuid.uuid4())[:8]

login_resp = requests.post(
    f'{TB_URL}/api/auth/login',
    json={'username': 'tenant@thingsboard.org', 'password': 'tenant'},
    timeout=10
)
TOKEN = login_resp.json()['token']
headers = {'X-Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}

# Read local files
BASE = r'D:\Projects\thingsboard-smart-greenhouse\widget\three_model_demo\thingsboard'
with open(f'{BASE}\\tb_3d_widget_html.html', 'r', encoding='utf-8') as f:
    html = f.read()
with open(f'{BASE}\\tb_3d_widget_css.css', 'r', encoding='utf-8') as f:
    css = f.read()
with open(f'{BASE}\\tb_3d_widget_js.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Add cache-busting comment
js = '// v3 fresh ' + str(uuid.uuid4())[:8] + '\n' + js

# Delete old v3 type if exists
search = requests.get(f'{TB_URL}/api/widgetTypes?isSystem=false&pageSize=100', headers=headers)
for item in search.json().get('data', []):
    if item.get('fqn') == NEW_FQN:
        print(f'Deleting old v3: {item["id"]["id"]}')
        requests.delete(f'{TB_URL}/api/widgetType/{item["id"]["id"]}', headers=headers)

# Create new widget type
wt = {
    'fqn': NEW_FQN,
    'name': '3D Greenhouse Model V3',
    'deprecated': False,
    'scada': False,
    'descriptor': {
        'type': 'latest',
        'sizeX': 24,
        'sizeY': 16,
        'resources': [],
        'templateHtml': html,
        'templateCss': css,
        'controllerScript': js,
        'dataKeySettingsSchema': '{}',
        'settingsDirective': '',
        'defaultConfig': json.dumps({
            'datasources': [{
                'type': 'entity',
                'name': 'Greenhouse_Device_01',
                'entityAliasId': None,
                'filterId': None,
                'dataKeys': [
                    {'name': 'fanStatus', 'type': 'timeseries', 'label': 'Fan', 'color': '#00d9ff', 'settings': {}, '_hash': 0.1},
                    {'name': 'lampStatus', 'type': 'timeseries', 'label': 'Lamp', 'color': '#ffe066', 'settings': {}, '_hash': 0.2},
                    {'name': 'sprayStatus', 'type': 'timeseries', 'label': 'Spray', 'color': '#88ddff', 'settings': {}, '_hash': 0.3},
                    {'name': 'pumpStatus', 'type': 'timeseries', 'label': 'Pump', 'color': '#00a8e8', 'settings': {}, '_hash': 0.4},
                    {'name': 'soilAlarm', 'type': 'timeseries', 'label': 'Soil Alarm', 'color': '#ff9500', 'settings': {}, '_hash': 0.5},
                    {'name': 'waterAlarm', 'type': 'timeseries', 'label': 'Water Alarm', 'color': '#ff3860', 'settings': {}, '_hash': 0.6}
                ]
            }],
            'timewindow': {'realtime': {'timewindowMs': 60000}},
            'showTitle': True, 'backgroundColor': '#020b12', 'color': 'rgba(224,240,255,1)',
            'padding': '0px', 'settings': {}, 'title': '3D Greenhouse Model',
            'dropShadow': False, 'enableFullscreen': True, 'widgetStyle': {},
            'titleStyle': {'fontSize': '16px', 'fontWeight': 400},
            'showLegend': False, 'actions': {}
        }, ensure_ascii=False)
    }
}

resp = requests.post(f'{TB_URL}/api/widgetType', json=wt, headers=headers)
if resp.status_code in (200, 201):
    result = resp.json()
    new_wt_id = result['id']['id']
    print(f'[OK] New widget type: {NEW_FQN} -> {new_wt_id}')
else:
    print(f'[ERROR] Create failed: {resp.status_code} {resp.text[:300]}')
    exit(1)

# Update dashboard
resp = requests.get(f'{TB_URL}/api/dashboard/{DASHBOARD_ID}', headers=headers)
d = resp.json()
cfg = d['configuration']

alias_id = list(cfg['entityAliases'].keys())[0]

# Remove old 3D widget(s)
for wid in list(cfg['widgets'].keys()):
    fqn = str(cfg['widgets'][wid].get('typeFullFqn', ''))
    if 'three_d_' in fqn:
        del cfg['widgets'][wid]
        cfg['states']['default']['layouts']['main']['layout'] = [
            l for l in cfg['states']['default']['layouts']['main']['layout'] if l.get('id') != wid
        ]
        if wid in cfg['states']['default']['layouts']['main']['widgets']:
            del cfg['states']['default']['layouts']['main']['widgets'][wid]
        print(f'Removed old widget: {wid}')

# Add new widget
new_wid = str(uuid.uuid4())
cfg['widgets'][new_wid] = {
    'type': 'latest', 'sizeX': 24, 'sizeY': 16, 'row': 0, 'col': 0,
    'typeFullFqn': f'tenant.{NEW_FQN}',
    'config': json.loads(wt['descriptor']['defaultConfig'])
}
# Replace None entityAliasId with actual alias
cfg['widgets'][new_wid]['config']['datasources'][0]['entityAliasId'] = alias_id

cfg['states']['default']['layouts']['main']['widgets'][new_wid] = {
    'col': 0, 'row': 0, 'sizeX': 24, 'sizeY': 16
}
cfg['states']['default']['layouts']['main']['layout'].insert(0, {
    'id': new_wid, 'sizeX': 24, 'sizeY': 16, 'row': 0, 'col': 0
})

resp = requests.post(f'{TB_URL}/api/dashboard', json=d, headers=headers)
if resp.status_code == 200:
    print(f'[OK] Dashboard updated, widget ID: {new_wid}')
else:
    print(f'[ERROR] Dashboard save: {resp.status_code} {resp.text[:300]}')
