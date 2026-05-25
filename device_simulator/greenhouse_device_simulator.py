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
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN", "YOUR_ACCESS_TOKEN")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
UPLOAD_INTERVAL = int(os.getenv("UPLOAD_INTERVAL", "3"))

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

        # 执行器状态
        self.fanStatus = False
        self.pumpStatus = False
        self.lampStatus = False
        self.sprayStatus = False
        self.autoMode = False

        # 报警状态
        self.soilAlarm = False
        self.tempAlarm = False
        self.waterAlarm = False
        self.co2Alarm = False


state = GreenhouseState()
client = None


# ========== 数据生成函数 ==========
def generate_sensor_data():
    """生成模拟传感器数据，使用随机游走模拟真实变化"""
    global state

    # 温度：基础25°C，开灯+2°C，风扇-2°C
    temp_target = 25.0
    if state.lampStatus:
        temp_target += 2.0
    if state.fanStatus:
        temp_target -= 2.0

    state.temperature += random.uniform(-0.5, 0.5)
    state.temperature += (temp_target - state.temperature) * 0.1
    state.temperature = max(15.0, min(45.0, state.temperature))

    # 空气湿度：与温度反向相关，喷淋时增加
    humidity_target = 90.0 - state.temperature * 1.5
    if state.sprayStatus:
        humidity_target += 15.0
    state.airHumidity += random.uniform(-1.0, 1.0)
    state.airHumidity += (humidity_target - state.airHumidity) * 0.05
    state.airHumidity = max(30.0, min(100.0, state.airHumidity))

    # 土壤湿度：水泵开启时上升，关闭时自然下降
    if state.pumpStatus:
        state.soilHumidity += random.uniform(0.5, 2.0)
    else:
        state.soilHumidity -= random.uniform(0.1, 0.5)
    state.soilHumidity = max(5.0, min(90.0, state.soilHumidity))

    # 光照强度：白天自然变化，补光灯+300
    hour = datetime.now().hour
    if 6 <= hour <= 18:
        base_light = 200 + 800 * max(0, 1 - abs(hour - 12) / 6.0)
    else:
        base_light = 0
    if state.lampStatus:
        base_light += 300
    state.lightIntensity += random.uniform(-20, 20)
    state.lightIntensity += (base_light - state.lightIntensity) * 0.1
    state.lightIntensity = max(0.0, min(1200.0, state.lightIntensity))

    # CO2：通风降低，温度高时上升
    if state.fanStatus:
        co2_target = 400.0
    else:
        co2_target = 600.0 + state.temperature * 10
    state.co2 += random.uniform(-10, 10)
    state.co2 += (co2_target - state.co2) * 0.05
    state.co2 = max(300.0, min(2000.0, state.co2))

    # 水位：用水时下降
    if state.pumpStatus:
        state.waterLevel -= random.uniform(0.2, 0.8)
    state.waterLevel = max(0.0, min(100.0, state.waterLevel))


# ========== 自动控制函数 ==========
def apply_auto_control():
    """自动联动逻辑"""
    global state

    if not state.autoMode:
        return

    # 水位保护优先级最高
    if state.waterLevel < 20:
        if state.pumpStatus or state.sprayStatus:
            state.pumpStatus = False
            state.sprayStatus = False
            logging.warning("[AUTO] waterLevel low, pump and spray forced OFF")
        return

    # 土壤湿度控制
    if state.soilHumidity < 30:
        if not state.pumpStatus or not state.sprayStatus:
            state.pumpStatus = True
            state.sprayStatus = True
            logging.info("[AUTO] soilHumidity low, pump and spray enabled")
    elif state.soilHumidity > 45:
        if state.pumpStatus or state.sprayStatus:
            state.pumpStatus = False
            state.sprayStatus = False
            logging.info("[AUTO] soilHumidity normal, pump and spray disabled")

    # 温度控制
    if state.temperature > 32:
        if not state.fanStatus:
            state.fanStatus = True
            logging.info("[AUTO] temperature high, fan enabled")
    elif state.temperature < 28:
        if state.fanStatus:
            state.fanStatus = False
            logging.info("[AUTO] temperature normal, fan disabled")

    # 光照控制
    if state.lightIntensity < 200:
        if not state.lampStatus:
            state.lampStatus = True
            logging.info("[AUTO] lightIntensity low, lamp enabled")
    elif state.lightIntensity > 500:
        if state.lampStatus:
            state.lampStatus = False
            logging.info("[AUTO] lightIntensity high, lamp disabled")


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

    if not client or not client.is_connected():
        return

    payload = {
        "temperature": round(state.temperature, 1),
        "airHumidity": round(state.airHumidity, 1),
        "soilHumidity": round(state.soilHumidity, 1),
        "lightIntensity": round(state.lightIntensity, 1),
        "co2": round(state.co2, 1),
        "waterLevel": round(state.waterLevel, 1),
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
            f"[TELEMETRY] temp={payload['temperature']:.1f} "
            f"soil={payload['soilHumidity']:.1f} "
            f"water={payload['waterLevel']:.1f} "
            f"light={payload['lightIntensity']:.1f} "
            f"co2={payload['co2']:.1f}"
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
        if state.waterLevel < 20 and value:
            logging.warning("[RPC] waterLevel low, reject pump ON")
            value = False
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
        logging.info(f"[STATE] autoMode set to {value}")
    else:
        logging.warning(f"[RPC] Unknown method: {method}")
        return

    logging.info(f"[STATE] {method} -> {value}")

    # 立即回传状态到 ThingsBoard
    status_payload = {
        "fanStatus": state.fanStatus,
        "pumpStatus": state.pumpStatus,
        "lampStatus": state.lampStatus,
        "sprayStatus": state.sprayStatus,
        "autoMode": state.autoMode,
    }
    client.publish("v1/devices/me/telemetry", json.dumps(status_payload))

    # 回复 RPC
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
        format="%(asctime)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    if ACCESS_TOKEN == "YOUR_ACCESS_TOKEN":
        logging.error("请在 .env 文件中配置 ACCESS_TOKEN")
        logging.error("复制 .env.example 为 .env 并填入真实 Token")
        return

    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        protocol=mqtt.MQTTv311
    )
    client.username_pw_set(ACCESS_TOKEN)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    try:
        client.connect(THINGSBOARD_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()

        logging.info("[MAIN] Greenhouse simulator started")
        logging.info(f"[MAIN] Server: {THINGSBOARD_HOST}:{MQTT_PORT}")
        logging.info(f"[MAIN] Upload interval: {UPLOAD_INTERVAL}s")

        while True:
            generate_sensor_data()
            apply_auto_control()
            update_alarm_state()
            publish_telemetry()
            time.sleep(UPLOAD_INTERVAL)

    except KeyboardInterrupt:
        logging.info("[MAIN] Stopped by user")
    except Exception as e:
        logging.error(f"[MAIN] Error: {e}")
    finally:
        client.loop_stop()
        client.disconnect()
        logging.info("[MQTT] Disconnected")


if __name__ == "__main__":
    main()
