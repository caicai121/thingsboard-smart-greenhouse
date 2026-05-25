import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv()

THINGSBOARD_HOST = os.getenv("THINGSBOARD_HOST", "192.168.161.130")
TB_URL = f"http://{THINGSBOARD_HOST}:8080"
USERNAME = "tenant@thingsboard.org"
PASSWORD = "tenant"

def login():
    url = f"{TB_URL}/api/auth/login"
    payload = {"username": USERNAME, "password": PASSWORD}
    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json().get("token")
    except Exception as e:
        print(f"[FAIL] Login: {e}")
        return None

def get_dashboards(token):
    headers = {"X-Authorization": f"Bearer {token}"}
    url = f"{TB_URL}/api/tenant/dashboards?pageSize=100&page=0"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json().get("data", [])
    except Exception as e:
        print(f"[FAIL] Get dashboards: {e}")
        return []

def get_dashboard_detail(token, dashboard_id):
    headers = {"X-Authorization": f"Bearer {token}"}
    url = f"{TB_URL}/api/dashboard/{dashboard_id}"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[FAIL] Get dashboard detail: {e}")
        return {}

def analyze_widgets(dashboard):
    config = dashboard.get("configuration", {})
    widgets = config.get("widgets", {})
    entity_aliases = config.get("entityAliases", {})

    print(f"\n{'='*60}")
    print("Entity Aliases:")
    print("-" * 60)
    for alias_id, alias in entity_aliases.items():
        name = alias.get("alias", "")
        filter_type = alias.get("filter", {}).get("type", "")
        entity_type = alias.get("filter", {}).get("entityType", "")
        entity_list = alias.get("filter", {}).get("entityList", [])
        print(f"  '{name}' (type={filter_type}, entityType={entity_type})")
        if entity_list:
            print(f"    -> entities: {entity_list}")

    print(f"\n{'='*60}")
    print(f"Widgets ({len(widgets)} total):")
    print("-" * 60)

    for widget_id, widget in widgets.items():
        wtype = widget.get("typeFullFqn", "")
        config = widget.get("config", {})
        title = config.get("title", "")
        datasource = config.get("datasources", [{}])[0]

        print(f"\n  Widget: {title or '(no title)'}")
        print(f"    Type: {wtype}")

        # 显示数据源
        alias_id = datasource.get("entityAliasId", "")
        if alias_id and alias_id in entity_aliases:
            alias_name = entity_aliases[alias_id].get("alias", alias_id)
            print(f"    Entity Alias: '{alias_name}'")
        elif alias_id:
            print(f"    Entity Alias ID: {alias_id} (NOT FOUND in aliases!)")
        else:
            print(f"    Entity Alias: (EMPTY - THIS IS THE PROBLEM!)")

        # 显示数据键
        data_keys = datasource.get("dataKeys", [])
        if data_keys:
            keys = [k.get("name", "?") for k in data_keys]
            print(f"    Data Keys: {keys}")

        # RPC 设置（针对 Switch Control）
        if "switch" in wtype.lower() or "control" in wtype.lower():
            rpc_enabled = config.get("rpcEnabled", False)
            rpc_method = config.get("rpcMethod", "")
            rpc_params = config.get("rpcRequestParams", {})
            print(f"    RPC Enabled: {rpc_enabled}")
            print(f"    RPC Method: {rpc_method}")
            print(f"    RPC Params: {rpc_params}")

            # 检查是否有问题
            problems = []
            if not alias_id:
                problems.append("Entity Alias is empty!")
            if not rpc_method:
                problems.append("RPC Method is empty!")
            if problems:
                print(f"    *** PROBLEMS: {'; '.join(problems)}")

def main():
    print("=" * 60)
    print("Dashboard Configuration Analyzer")
    print(f"Server: {TB_URL}")
    print("=" * 60)

    token = login()
    if not token:
        sys.exit(1)
    print("[OK] Login successful")

    dashboards = get_dashboards(token)
    print(f"\nFound {len(dashboards)} dashboard(s)")

    target = None
    for db in dashboards:
        name = db.get("title", "")
        db_id = db.get("id", {}).get("id", "")
        print(f"  - {name} (id={db_id})")
        if "智慧农业大棚" in name or "greenhouse" in name.lower():
            target = db

    if not target:
        print("\n[WARNING] '智慧农业大棚' dashboard not found!")
        print("Checking all dashboards for Switch Control widgets...")
        for db in dashboards:
            db_id = db.get("id", {}).get("id", "")
            detail = get_dashboard_detail(token, db_id)
            if detail:
                analyze_widgets(detail)
        return

    db_id = target.get("id", {}).get("id", "")
    print(f"\n[OK] Analyzing dashboard: '{target.get('title')}'")

    detail = get_dashboard_detail(token, db_id)
    if detail:
        analyze_widgets(detail)
    else:
        print("[FAIL] Could not fetch dashboard configuration")

if __name__ == "__main__":
    main()
