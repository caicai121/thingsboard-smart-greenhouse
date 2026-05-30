import os
import json
import time
import random
import logging
from datetime import datetime
from dotenv import load_dotenv
import paho.mqtt.client as mqtt

# ========== 配置区 ==========
load_dotenv()

THINGSBOARD_HOST = os.getenv("THINGSBOARD_HOST", "192.168.161.130")
ACCESS_TOKEN = os.getenv("TB_DEVICE_11_TOKEN", os.getenv("ACCESS_TOKEN", "YOUR_ACCESS_TOKEN"))
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
UPLOAD_INTERVAL = float(os.getenv("UPLOAD_INTERVAL", "3"))

# ========== 状态变量区 ==========
class GreenhouseState:
    def __init__(self):
        # 传感器数据
        self.temperature = 25.0
        self.airHumidity = 60.0
        self.soilHumidity = 45.0
        self.lightIntensity = 400.0
        self.co2 = 600.0
        self.waterLevel = 80.0
        self.hourOfDay = float(datetime.now().hour)

        # 执行器状态
        self.fanStatus = False
        self.pumpStatus = False
        self.lampStatus = False
        self.sprayStatus = False
        self.autoMode = False
        self._pid = os.getpid()
        self._created_at = time.time()

        # 调试覆盖
        self.debug_lock_until = {}
        self.debug_override = {
            "soilHumidity": None,
            "temperature": None,
            "lightIntensity": None,
            "waterLevel": None,
            "co2": None,
            "airHumidity": None,
            "hourOfDay": None,
        }

        # 报警状态
        self.soilAlarm = False
        self.tempAlarm = False
        self.waterAlarm = False
        self.co2Alarm = False


state = GreenhouseState()
client = None


# 调试限制
DEBUG_LIMITS = {
    "soilHumidity": (0, 100),
    "temperature": (0, 50),
    "lightIntensity": (0, 2000),
    "waterLevel": (0, 100),
    "co2": (0, 5000),
    "airHumidity": (0, 100),
    "hourOfDay": (0, 24),
}

def _is_locked(key):
    return state.debug_lock_until.get(key, 0) > time.time()

def apply_debug_overrides():
    for key in state.debug_override:
        val = state.debug_override[key]
        if val is None: continue
        # 锁过期：清除 override，恢复自然模拟
        if not _is_locked(key):
            state.debug_override[key] = None
            logging.info(f"[DEBUG] Override {key} expired, resumed natural simulation")
            continue
        v = float(val)
        lo, hi = DEBUG_LIMITS.get(key, (None, None))
        if lo is not None: v = max(lo, min(hi, v))
        if key == "soilHumidity": state.soilHumidity = v
        elif key == "temperature": state.temperature = v
        elif key == "lightIntensity": state.lightIntensity = v
        elif key == "waterLevel": state.waterLevel = v
        elif key == "co2": state.co2 = v
        elif key == "airHumidity": state.airHumidity = v
        elif key == "hourOfDay": state.hourOfDay = v

# ========== 数据生成函数 ==========
def generate_sensor_data():
    """生成模拟传感器数据，使用随机游走模拟真实变化"""
    global state

    # ===== 执行器效果（始终生效，不受锁影响） =====
    if state.fanStatus:
        state.temperature -= random.uniform(0.3, 0.8)
    if state.sprayStatus:
        state.soilHumidity += random.uniform(1.5, 3.0)
        state.waterLevel -= random.uniform(0.5, 1.5)
        state.airHumidity += random.uniform(0.5, 1.5)
    if state.pumpStatus:
        state.waterLevel += random.uniform(1.0, 3.0)
    if state.lampStatus:
        state.lightIntensity += random.uniform(5, 15)

    # ===== 自然漂移（locked时跳过，保护调试设置值） =====
    if not _is_locked("temperature"):
        state.temperature += random.uniform(-0.3, 0.3)
    if not _is_locked("airHumidity"):
        state.airHumidity += random.uniform(-0.5, 0.5)
    if not _is_locked("soilHumidity"):
        state.soilHumidity -= random.uniform(0.05, 0.2)
    if not _is_locked("lightIntensity"):
        state.lightIntensity += random.uniform(-10, 10)
    if not _is_locked("co2"):
        state.co2 += random.uniform(-5, 5)
    if not _is_locked("waterLevel"):
        pass  # 水位只由设备驱动，无自然漂移

    # 边界约束
    state.temperature = max(10.0, min(50.0, state.temperature))
    state.airHumidity = max(20.0, min(100.0, state.airHumidity))
    state.soilHumidity = max(5.0, min(100.0, state.soilHumidity))
    state.lightIntensity = max(0.0, min(1500.0, state.lightIntensity))
    state.co2 = max(300.0, min(3000.0, state.co2))
    state.waterLevel = max(0.0, min(100.0, state.waterLevel))


# ========== 自动控制函数 ==========
def apply_auto_control():
    """联动逻辑：始终生效的自动关闭 + 仅自动模式的主动开启"""
    global state

    # ===== 补光灯：纯手动控制，不受时间/自动模式影响 =====

    # ===== 手动模式：所有执行器纯手动，无自动关闭 =====

    # ===== 仅自动模式：自动开启 + 自动关闭 =====
    if not state.autoMode:
        return

    # 喷淋：土壤 <30 且水位 >=20 → 开；土壤 >50 → 关
    if state.soilHumidity > 50 and state.sprayStatus:
        state.sprayStatus = False; logging.info("[AUTO-OFF] soilHumidity > 50, spray OFF")
    if state.waterLevel < 20 and state.sprayStatus:
        state.sprayStatus = False; logging.warning("[PROTECT] waterLevel < 20, spray forced OFF")
    if state.soilHumidity < 30 and state.waterLevel >= 20 and not state.sprayStatus:
        state.sprayStatus = True; logging.info("[AUTO] soilHumidity < 30, spray ON")

    # 水泵：水位 >90 → 关；水位 <20 → 开
    if state.waterLevel > 90 and state.pumpStatus:
        state.pumpStatus = False; logging.info("[AUTO-OFF] waterLevel > 90, pump OFF")
    if state.waterLevel < 20 and not state.pumpStatus:
        state.pumpStatus = True; logging.info("[AUTO] waterLevel < 20, pump ON")

    # 风扇：温度 <20 → 关；温度 >40 或 CO2 >1000 → 开
    if state.temperature < 20 and state.fanStatus:
        state.fanStatus = False; logging.info("[AUTO-OFF] temp < 20, fan OFF")
    if (state.temperature > 40 or state.co2 > 1000) and not state.fanStatus:
        state.fanStatus = True; logging.info(f"[AUTO] temp={state.temperature:.0f} CO2={state.co2:.0f}, fan ON")


# ========== 报警判断函数 ==========
def update_alarm_state():
    """更新报警字段"""
    global state

    state.soilAlarm = state.soilHumidity < 30
    state.tempAlarm = state.temperature > 35
    state.waterAlarm = state.waterLevel < 20
    state.co2Alarm = state.co2 > 1000


# ========== 数据上传函数 ==========
def publish_telemetry():
    """上传所有遥测数据到 ThingsBoard"""
    global client, state

    payload = {
        "temperature": round(state.temperature, 1),
        "airHumidity": round(state.airHumidity, 1),
        "soilHumidity": round(state.soilHumidity, 1),
        "lightIntensity": round(state.lightIntensity, 1),
        "co2": round(state.co2, 1),
        "waterLevel": round(state.waterLevel, 1),
        "hourOfDay": round(state.hourOfDay, 1),
        "fanStatus": state.fanStatus,
        "pumpStatus": state.pumpStatus,
        "lampStatus": state.lampStatus,
        "sprayStatus": state.sprayStatus,
        "autoMode": state.autoMode,
        "soilAlarm": state.soilAlarm,
        "tempAlarm": state.tempAlarm,
        "waterAlarm": state.waterAlarm,
        "co2Alarm": state.co2Alarm,
    }

    try:
        client.publish("v1/devices/me/telemetry", json.dumps(payload))
        logging.info(
            f"[TELEMETRY] PID={os.getpid()} autoMode={state.autoMode} "
            f"temp={payload['temperature']:.1f} "
            f"soil={payload['soilHumidity']:.1f} "
            f"water={payload['waterLevel']:.1f}"
        )
    except Exception as e:
        logging.error(f"[TELEMETRY] Publish failed: {e}")


# ========== RPC 处理函数 ==========
def handle_rpc(method, params, request_id):
    """处理 RPC 请求（支持 set 和 get 两种模式）"""
    global state, client

    logging.info(f"[RPC] Received method={method} params={params} request_id={request_id}")

    response_topic = f"v1/devices/me/rpc/response/{request_id}"

    # ===== GET 方法：返回当前状态值 =====
    if method == "getFan":
        client.publish(response_topic, json.dumps(state.fanStatus))
        logging.info(f"[RPC] getFan -> {state.fanStatus}")
        return
    elif method == "getPump":
        client.publish(response_topic, json.dumps(state.pumpStatus))
        logging.info(f"[RPC] getPump -> {state.pumpStatus}")
        return
    elif method == "getLamp":
        client.publish(response_topic, json.dumps(state.lampStatus))
        logging.info(f"[RPC] getLamp -> {state.lampStatus}")
        return
    elif method == "getSpray":
        client.publish(response_topic, json.dumps(state.sprayStatus))
        logging.info(f"[RPC] getSpray -> {state.sprayStatus}")
        return
    elif method == "getAutoMode":
        client.publish(response_topic, json.dumps(state.autoMode))
        logging.info(f"[RPC] getAutoMode -> {state.autoMode}")
        return

    # ===== SET 方法：修改状态 =====
    if isinstance(params, bool):
        value = params
    elif isinstance(params, str):
        value = params.lower() == "true"
    elif isinstance(params, (int, float)):
        value = bool(params)
    else:
        value = False

    if method == "setFan":
        state.fanStatus = value
    elif method == "setPump":
        state.pumpStatus = value
    elif method == "setLamp":
        state.lampStatus = value
    elif method == "setSpray":
        if state.waterLevel < 20 and value:
            logging.warning("[RPC] waterLevel low, reject spray ON")
            value = False
        state.sprayStatus = value
    elif method == "setAutoMode":
        state.autoMode = value
        logging.info(f"[AUTO] PID={os.getpid()} autoMode={value}")
        import time as _t; _t.sleep(0.5)
        publish_telemetry()
    elif method == "setDebugSensor":
        key = params.get("key") if isinstance(params, dict) else None
        val = params.get("value") if isinstance(params, dict) else None
        if key in state.debug_override:
            v = float(val)
            lo, hi = DEBUG_LIMITS.get(key, (None, None))
            if lo is not None: v = max(lo, min(hi, v))
            # 直接写入实际状态，锁定只防自然漂移
            if key == "soilHumidity": state.soilHumidity = v
            elif key == "temperature": state.temperature = v
            elif key == "lightIntensity": state.lightIntensity = v
            elif key == "waterLevel": state.waterLevel = v
            elif key == "co2": state.co2 = v
            elif key == "airHumidity": state.airHumidity = v
            elif key == "hourOfDay": state.hourOfDay = v
            state.debug_lock_until[key] = time.time() + 3
            logging.info(f"[DEBUG] Set {key}={v} (locked 3s)")
        else:
            logging.warning(f"[DEBUG] Unknown key: {key}")
        value = True
    elif method == "clearDebugSensor":
        key = params.get("key") if isinstance(params, dict) else params
        if key in state.debug_override:
            state.debug_override[key] = None
            state.debug_lock_until.pop(key, None)
            logging.info(f"[DEBUG] Clear override {key}")
        value = True
    else:
        logging.warning(f"[RPC] Unknown method: {method}")
        return

    logging.info(f"[STATE] {method} -> {value}")

    # 回复 RPC（不再向telemetry发status_payload，统一由主循环发布）
    response = {"success": True, "method": method, "value": value}
    client.publish(response_topic, json.dumps(response))
    logging.info(f"[RPC] Response sent")


# ========== MQTT 回调函数 ==========
def on_connect(client, userdata, connect_flags, reason_code, properties):
    """连接成功回调"""
    if reason_code == 0:
        logging.info("[MQTT] Connected to ThingsBoard")
        client.subscribe("v1/devices/me/rpc/request/+")
        logging.info("[MQTT] Subscribed to RPC topic")
    else:
        logging.error(f"[MQTT] Connection failed, rc={reason_code}")


def on_message(client, userdata, msg):
    """接收消息回调"""
    try:
        payload = json.loads(msg.payload.decode())
        request_id = msg.topic.split("/")[-1]
        method = payload.get("method", "")
        params = payload.get("params", None)
        handle_rpc(method, params, request_id)
    except json.JSONDecodeError:
        logging.error(f"[MQTT] Invalid JSON: {msg.payload}")
    except Exception as e:
        logging.error(f"[MQTT] Error: {e}")


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    """断开连接回调"""
    logging.warning(f"[MQTT] Disconnected, rc={reason_code}")


# ========== 主程序 ==========
def main():
    global client

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [DEVICE_11] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    if ACCESS_TOKEN == "YOUR_ACCESS_TOKEN":
        logging.error("请在 .env 文件中配置 TB_DEVICE_11_TOKEN")
        logging.error("复制 .env.example 为 .env 并填入真实 Token")
        return

    client = mqtt.Client(
        client_id="greenhouse_device_11_simulator",
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        protocol=mqtt.MQTTv311
    )
    client.username_pw_set(ACCESS_TOKEN)
    client.max_queued_messages_set(1)  # 断连时只保留最新一条遥测，避免重连后数据雪崩
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    logging.info(f"[MAIN] PID={os.getpid()} Greenhouse Device 11 simulator started")
    logging.info(f"[MAIN] Server: {THINGSBOARD_HOST}:{MQTT_PORT}")
    logging.info(f"[MAIN] Upload interval: {UPLOAD_INTERVAL}s")

    while True:
        try:
            # 确保连接存在
            if not client.is_connected():
                try:
                    client.connect(THINGSBOARD_HOST, MQTT_PORT, keepalive=60)
                    client.loop_start()
                    time.sleep(1)
                except Exception as conn_err:
                    logging.error(f"[MAIN] Connect failed: {conn_err}, retry in 5s")
                    time.sleep(5)
                    continue

            generate_sensor_data()
            apply_auto_control()
            update_alarm_state()
            publish_telemetry()
            time.sleep(UPLOAD_INTERVAL)

        except KeyboardInterrupt:
            logging.info("[MAIN] Stopped by user")
            break
        except Exception as loop_err:
            logging.error(f"[MAIN] Loop error: {loop_err}")
            time.sleep(5)


if __name__ == "__main__":
    main()
