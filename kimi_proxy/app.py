"""
Kimi API Proxy — 前端 → 本地代理 → Kimi API
运行: python app.py
"""
import os, time, requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

API_KEY = os.getenv("MOONSHOT_API_KEY", "")
BASE_URL = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.ai/v1/chat/completions")
MODEL = os.getenv("KIMI_MODEL", "moonshot-v1-8k")

SYSTEM_PROMPT = """你是智慧大棚AI助手。管理8个大棚(01-04前排,11-14后排)。仅有5个开关: setFan/setLamp/setPump/setSpray/setAutoMode。

输出格式: [CMD:方法:设备号:true/false] 多个CMD串联无空格，系统350ms间隔执行。

★ 关键规则:
1. 简单操作(开/关设备)直接输出CMD，禁止分析传感器，禁止解释。
2. 传感器阈值仅在用户明确要求分析时参考: soil<30需喷淋, water<20需水泵, temp>35需风扇, light<300需补光灯, co2>1500需风扇。
3. 复杂效果(流水灯/波浪灯)自行拆解为CMD序列，不留空档。
4. 回复仅含CMD序列，不解释、不反问。"""

@app.route("/api/health")
def health():
    return jsonify({"ok": True, "has_key": bool(API_KEY), "model": MODEL})

# 会话历史（简单内存存储，最多保留 20 条/会话）
from collections import defaultdict
HISTORY = defaultdict(list)  # key: session_id, value: [{role,content}]
MAX_HISTORY = 3

@app.route("/api/kimi/chat", methods=["POST"])
def chat():
    if not API_KEY:
        return jsonify({"ok": False, "error": "API Key not configured"}), 500

    data = request.get_json(silent=True) or {}
    user_text = str(data.get("message", "")).strip()
    context = data.get("context", {})
    sid = str(data.get("sid", "default"))

    if not user_text:
        return jsonify({"ok": False, "error": "empty message"}), 400

    # 构建设备数据摘要
    devices = context.get("devices", [])
    ctx = f"租户:{context.get('tenant','admin')} 当前大棚:{context.get('activeId','01')}。所有设备数据: {devices}"

    # 构建消息列表：system + 历史 + 当前
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "system", "content": ctx}]
    hist = HISTORY[sid][-MAX_HISTORY:]
    messages.extend(hist)
    messages.append({"role": "user", "content": user_text})

    try:
        t0 = time.time()
        r = requests.post(BASE_URL,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
            json={"model": MODEL, "messages": messages, "temperature": 0.2},
            timeout=60)
        ms = int((time.time() - t0)*1000)

        if r.status_code != 200:
            return jsonify({"ok": False, "status": r.status_code, "error": r.text[:500]}), r.status_code

        reply = r.json()["choices"][0]["message"]["content"]

        # 保存历史
        HISTORY[sid].append({"role": "user", "content": user_text})
        HISTORY[sid].append({"role": "assistant", "content": reply})
        if len(HISTORY[sid]) > MAX_HISTORY * 2:
            HISTORY[sid] = HISTORY[sid][-MAX_HISTORY*2:]

        return jsonify({"ok": True, "reply": reply, "elapsedMs": ms})

    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "timeout"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("KIMI_PROXY_PORT", "5055"))
    print("Kimi Proxy :" + str(port) + "  model=" + MODEL + "  key=" + ("OK" if API_KEY else "MISSING"))
    app.run(host="0.0.0.0", port=port)
