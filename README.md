# 智慧农业大棚监测与联动控制系统

基于 ThingsBoard 的智慧农业大棚 3D 数字孪生监控系统，8 设备双层布局 + SCADA 组态图 + AI 语音助手。

---

## 项目简介

- 8 个大棚设备 (前排 01-04，后排 11-14)，双租户隔离
- Python 模拟器通过 MQTT 上传传感器遥测 + 接收 RPC 控制
- 3D 数字孪生仪表盘 (Three.js)，支持大棚 hover/点击交互
- 2D SCADA 组态图 (SVG 管道 + CSS 设备模块)
- 趋势分析折线图
- AI 智能助手 (DeepSeek-R1)，支持自然语言控制 + 序列效果 (流水灯/波浪灯等)
- 自动联动控制 (温度/湿度/光照/CO2 阈值触发)

---

## 运行环境

| 组件 | 说明 |
|------|------|
| ThingsBoard | CE 4.3.0.1 @ `192.168.161.130:8080` (Ubuntu VM) |
| MQTT | 端口 1883 |
| Python | 3.11 (conda env `tb-iot`) |
| 3D 资源 | CORS 静态服务器 localhost:9000 |
| AI 代理 | Flask 代理 localhost:5055 → DeepSeek API |

---

## 快速启动

```bash
# 1. 启动 CORS 静态服务器 (3D 模型资源)
python widget/three_model_demo/cors_server.py &

# 2. 启动 8 个设备模拟器
cd device_simulator
python greenhouse_device_simulator.py &      # Device 01
python greenhouse_device_simulator_02.py &   # Device 02
python greenhouse_device_simulator_03.py &   # Device 03
python greenhouse_device_simulator_04.py &   # Device 04
python greenhouse_device_simulator_11.py &   # Device 11
python greenhouse_device_simulator_12.py &   # Device 12
python greenhouse_device_simulator_13.py &   # Device 13
python greenhouse_device_simulator_14.py &   # Device 14

# 3. (可选) 启动 AI 代理
cd kimi_proxy
python app.py &
```

---

## 设备信息

### 前排 (客户0, z=1.5)
| 大棚 | 设备名 | Token 环境变量 |
|------|--------|---------------|
| 01 | Greenhouse_Device_01 | `ACCESS_TOKEN` |
| 02 | Greenhouse_Device_02 | `TB_DEVICE_02_TOKEN` |
| 03 | Greenhouse_Device_03 | `TB_DEVICE_03_TOKEN` |
| 04 | Greenhouse_Device_04 | `TB_DEVICE_04_TOKEN` |

### 后排 (客户1, z=18.5)
| 大棚 | 设备名 | Token 环境变量 |
|------|--------|---------------|
| 11 | Greenhouse_Device_11 | `TB_DEVICE_11_TOKEN` |
| 12 | Greenhouse_Device_12 | `TB_DEVICE_12_TOKEN` |
| 13 | Greenhouse_Device_13 | `TB_DEVICE_13_TOKEN` |
| 14 | Greenhouse_Device_14 | `TB_DEVICE_14_TOKEN` |

---

## 传感器字段 (8 个)

`temperature`, `airHumidity`, `soilHumidity`, `outsideLight`, `lightIntensity`, `co2`, `waterLevel`, `hourOfDay`

## 执行器 (5 个)

`fanStatus`, `pumpStatus`, `lampStatus`, `sprayStatus`, `autoMode`

## 报警字段 (7 个)

`soilAlarm`, `soilOverAlarm`, `tempAlarm`, `tempLowAlarm`, `waterAlarm`, `waterOverAlarm`, `co2Alarm`

---

## Widget 部署

```bash
# 将源文件复制为合并文件
cp widget/three_model_demo/thingsboard/full_scene_dual_greenhouse.js \
   widget/three_model_demo/thingsboard/full_scene_3d_merged.js

# 部署到 ThingsBoard
python widget/three_model_demo/deploy_merged_wt.py
```

部署脚本将 HTML + CSS + JS 合并推送到 Widget Type `greenhouse_test.full_scene`。

---

## 仪表盘

| 页面 | 内容 |
|------|------|
| 第 0 页 | 2D SCADA 组态图 + v8 2D 大棚平面图 |
| 第 1 页 (默认) | 3D 数字孪生场景 |
| 第 2 页 | 趋势分析折线图 |

- Dashboard V3: `http://192.168.161.130:8080/dashboard/1e4b46b0-584a-11f1-97d0-3140d6cf905a`
- Widget Type FQN: `greenhouse_test.full_scene`

---

## 自动联动规则

当 `autoMode = true` 时：

| 条件 | 动作 |
|------|------|
| 土壤湿度 < 30% | 开喷淋 |
| 土壤湿度 > 50% | 关喷淋 |
| 水位 < 20% | 开水泵补水 |
| 水位 > 90% | 关水泵 |
| 温度 > 40°C 或 CO2 > 1000 | 开风扇 |
| 温度 < 20°C | 关风扇 |
| 夜晚 (18-6时) | 开补光灯 |
| 白天 (6-18时) | 关补光灯 |

---

## AI 助手

基于 DeepSeek-R1 推理模型，支持自然语言控制：

- **简单指令**: "打开 01 04 11 灯" → 批量执行
- **序列效果**: "流水灯" → 自动生成追光 CMD 序列，350ms 间隔执行
- **告警查询**: "检查告警" → 分析传感器数据
- **批量控制**: "全部自动模式" → 8 设备同时切换

代理配置见 `kimi_proxy/.env.example`，不要提交 `.env` (含 API Key)。

---

## 项目结构

```
thingsboard-smart-greenhouse/
├── README.md
├── .env.example
├── .gitignore
├── device_simulator/
│   ├── greenhouse_device_simulator.py       # Device 01
│   ├── greenhouse_device_simulator_02.py    # Device 02
│   ├── greenhouse_device_simulator_03.py    # Device 03
│   ├── greenhouse_device_simulator_04.py    # Device 04
│   ├── greenhouse_device_simulator_11.py    # Device 11
│   ├── greenhouse_device_simulator_12.py    # Device 12
│   ├── greenhouse_device_simulator_13.py    # Device 13
│   └── greenhouse_device_simulator_14.py    # Device 14
├── widget/three_model_demo/
│   ├── thingsboard/
│   │   ├── full_scene_dual_greenhouse.js    # 主 JS (~2900行)
│   │   ├── full_scene_html_3d.html          # 3 页 HTML
│   │   ├── full_scene_css_3d.css            # 全样式
│   │   └── full_scene_3d_merged.js          # 部署用合并 JS
│   ├── deploy_merged_wt.py                  # TB 部署脚本
│   └── cors_server.py                       # 3D 资源服务器
├── kimi_proxy/
│   ├── app.py                               # AI 代理 (Flask)
│   ├── requirements.txt
│   └── .env.example
├── thingsboard/backups/                     # Dashboard + Widget 备份
└── docs/
```

---

## 配置

1. 复制 `.env.example` 为 `.env`，填入 ThingsBoard Access Token
2. `kimi_proxy/` 下复制 `.env.example` 为 `.env`，填入 API Key
3. **所有 `.env` 文件已被 `.gitignore` 排除，不要提交到 Git**

---

## 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v1.0 | 2026-05 | 单设备模拟器 + MQTT |
| v2.0 | 2026-05 | 4 设备 + 3D 场景 |
| v3.0 | 2026-06 | 8 设备 + SCADA + 性能优化 |
| v4.0 | 2026-06 | AI 助手 + 延时队列 + 序列效果 + 装饰棚灯同步 |
