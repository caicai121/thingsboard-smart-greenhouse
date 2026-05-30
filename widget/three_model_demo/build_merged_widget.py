"""
Build merged Full Scene + 3D widget JS.
Reads full_scene_js.js (base) and tb_3d_widget_js.js (3D code),
produces merged JS with 3D canvas replacing background images.
"""
import re

BASE_DIR = 'D:/Projects/thingsboard-smart-greenhouse/widget/three_model_demo/thingsboard'

# Read source files
with open(f'{BASE_DIR}/full_scene_js.js', 'r', encoding='utf-8') as f:
    full_js = f.read()

with open(f'{BASE_DIR}/tb_3d_widget_js.js', 'r', encoding='utf-8') as f:
    td_js = f.read()

# ============================================================
# Extract 3D code sections from tb_3d_widget_js.js
# ============================================================

# 1. Three.js globals (lines 5-37 of 3D widget: THREE_BASE through dynamicObjects)
td_lines = td_js.split('\n')

# Find key sections by marker comments
def extract_section(js, start_marker, end_marker=None):
    """Extract lines between start_marker (inclusive) and end_marker (exclusive)."""
    lines = js.split('\n')
    start_idx = None
    end_idx = len(lines)
    for i, line in enumerate(lines):
        if start_idx is None and start_marker in line:
            start_idx = i
        if end_marker and start_idx is not None and end_marker in line:
            end_idx = i
            break
    if start_idx is None:
        return ''
    return '\n'.join(lines[start_idx:end_idx])

# Extract 3D globals section: from "const THREE_BASE" to end of "dynamicObjects"
three_globals = extract_section(td_js, 'const THREE_BASE', '// ========== 材质库 ==========')
materials_decl = extract_section(td_js, '// ========== 材质库 ==========', 'function initMaterials()')
init_materials = extract_section(td_js, 'function initMaterials()', '// ========== Three.js 加载 ==========')
load_three = extract_section(td_js, '// ========== Three.js 加载 ==========', '// ========== 场景初始化 ==========')
init_three = extract_section(td_js, '// ========== 场景初始化 ==========', '// ========== IntersectionObserver')
wait_visible = extract_section(td_js, '// ========== IntersectionObserver', '// ========== UI 事件')
setup_ui = extract_section(td_js, '// ========== UI 事件', 'function createLighting()')
# All create* functions: from createLighting to startRenderLoop
create_funcs = extract_section(td_js, 'function createLighting()', '// ========== 渲染循环 ==========')
render_loop = extract_section(td_js, '// ========== 渲染循环 ==========', '// ========== 尺寸同步')
resize_code = extract_section(td_js, '// ========== 尺寸同步', '// ========== 遥测读取')
# Skip the 3D widget's getLatestValue/parseBool (Full Scene has its own)
# Skip the 3D widget's lifecycle (Full Scene has its own)

print("Extracted sections:", len(three_globals), len(materials_decl), len(init_materials),
      len(load_three), len(init_three), len(wait_visible), len(setup_ui),
      len(create_funcs), len(render_loop), len(resize_code))

# ============================================================
# Build the merged JS
# ============================================================

# We'll build the merged file by inserting 3D code into the Full Scene JS

# --- Insert 1: After header comment, add Three.js globals ---
# Full Scene starts with: /** ... */  then blank line, then '// ========== 配置区 =========='
# Insert three_globals + materials_decl + init_materials between header and config

header_end = full_js.index('// ========== 配置区 ==========')

merged = full_js[:header_end]

# Add 3D globals (but rename variables to avoid conflicts)
# The 3D widget uses: THREE, OrbitControls, threeReady, renderer, scene, camera, controls,
# animFrameId, containerEl, rootEl, resizeObserver, intersectionObserver, threeInitStarted, frameCount
# sceneData, GH, mainPipeRef, alarmElements, lampOnColor, zeroColor, dynamicObjects
# matMetal, matMetalDark, etc.

# Full Scene uses: sceneMode, currentScenario, currentData, demoMode, currentPage, els, refreshTimer
# No conflict with 3D names since Full Scene doesn't use THREE variables

# Add the 3D globals section
merged += '\n' + three_globals + '\n'
merged += materials_decl + '\n'
merged += init_materials + '\n'
merged += load_three + '\n'

# Continue with Full Scene config section
merged += '\n' + full_js[header_end:]

# --- Insert 2: Add 3D scene init + create functions before TB lifecycle ---
lifecycle_marker = '// ========== ThingsBoard Widget 生命周期 =========='
lifecycle_pos = merged.index(lifecycle_marker)

# Build 3D section to insert
td_section = '\n// ========== 3D 场景初始化 ==========\n'
td_section += init_three + '\n\n'
td_section += wait_visible + '\n\n'
td_section += '// ========== 3D 测试面板(在Full Scene中隐藏) ==========\n'
# Skip setupUIHandlers since Full Scene has its own control panels
# But keep the testMode variable
td_section += 'var testMode3D = false;\n\n'
td_section += '// ========== 3D 模型创建函数 ==========\n'
td_section += create_funcs + '\n\n'
td_section += '// ========== 3D 渲染循环 ==========\n'
td_section += render_loop + '\n\n'
td_section += '// ========== 3D 尺寸同步 ==========\n'
td_section += resize_code + '\n\n'

# Add update3DModel bridge function
td_section += '''// ========== 3D 模型数据更新桥接 ==========
function update3DModel(data) {
  if (!threeReady) return;
  // 同步遥测数据到 3D sceneData
  sceneData.fanStatus = data.fanStatus || false;
  sceneData.lampStatus = data.lampStatus || false;
  sceneData.sprayStatus = data.sprayStatus || false;
  sceneData.pumpStatus = data.pumpStatus || false;
  sceneData.soilAlarm = data.soilAlarm || false;
  sceneData.tempAlarm = data.tempAlarm || false;
  sceneData.waterAlarm = data.waterAlarm || false;
  sceneData.co2Alarm = data.co2Alarm || false;
  sceneData.waterLevel = Number(data.waterLevel) || 60;
  sceneData.soilHumidity = Number(data.soilHumidity) || 50;
  sceneData.temperature = Number(data.temperature) || 25;
  sceneData.hourOfDay = Number(data.hourOfDay) || 12;
  sceneData.outsideLight = Number(data.outsideLight) || 500;
  sceneData.lightIntensity = Number(data.lightIntensity) || 500;
}

'''

merged = merged[:lifecycle_pos] + td_section + '\n' + merged[lifecycle_pos:]

# --- Insert 3: Modify onInit to add Three.js loading ---
# Replace the onInit function
old_oninit = """self.onInit = function() {
    console.log('[TB Widget] Greenhouse monitoring initializing...');

    // 缓存 DOM 元素（HTML 已由 ThingsBoard 从 HTML 标签页渲染到容器中）
    var $el = self.ctx.$container[0] || self.ctx.$container;
    cacheElements($el);

    // 设置图片 URL
    console.log('[Greenhouse] dayImage =', CONFIG.dayImage);
    console.log('[Greenhouse] nightImage =', CONFIG.nightImage);
    console.log('[Greenhouse] bgDay element =', els.bgDay);
    console.log('[Greenhouse] bgNight element =', els.bgNight);

    if (els.bgDay) {
        els.bgDay.src = CONFIG.dayImage;
        els.bgDay.onload = function() { console.log('[Greenhouse] day image loaded OK'); };
        els.bgDay.onerror = function() { console.error('[Greenhouse] day image FAILED'); };
    }
    if (els.bgNight) {
        els.bgNight.src = CONFIG.nightImage;
        els.bgNight.onload = function() { console.log('[Greenhouse] night image loaded OK'); };
        els.bgNight.onerror = function() { console.error('[Greenhouse] night image FAILED'); };
    }"""

new_oninit = """self.onInit = function() {
    console.log('[Full Scene+3D] Initializing...');

    // 缓存 DOM 元素（HTML 已由 ThingsBoard 从 HTML 标签页渲染到容器中）
    var $el = self.ctx.$container[0] || self.ctx.$container;
    cacheElements($el);

    // 不再加载白天/夜晚背景图片，3D 模型替代
    console.log('[Full Scene+3D] 3D model will replace background images');"""

merged = merged.replace(old_oninit, new_oninit)

# --- Insert 4: Add Three.js loading after cacheElements in onInit ---
# Find the point right after "不再加载白天/夜晚背景图片" and before 演示场景按钮
demo_btn_marker = "    // 演示场景按钮：根据配置显示/隐藏"
old_demo_section = """    // 演示场景按钮：根据配置显示/隐藏"""

new_demo_section = """    // ===== 加载 Three.js 并初始化 3D 场景 =====
    console.log('[Full Scene+3D] Loading Three.js...');
    window.addEventListener('resize', handleWindowResize);
    loadThreeModule().then(function() {
        waitUntilVisibleThenInit();
    }).catch(function(err) {
        console.error('[Full Scene+3D] Three.js load failed:', err);
    });

    // 演示场景按钮：根据配置显示/隐藏"""

merged = merged.replace(old_demo_section, new_demo_section)

# --- Insert 5: Add update3DModel call in updateDashboard ---
old_update = """    updateEffects(data);
    updateDataPanel(data);"""
new_update = """    update3DModel(data);  // 驱动 3D 模型状态
    updateEffects(data);
    updateDataPanel(data);"""
merged = merged.replace(old_update, new_update)

# --- Insert 6: Modify onDestroy to add 3D cleanup ---
old_destroy = """self.onDestroy = function() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    console.log('[TB Widget] Greenhouse monitoring destroyed');
};"""

new_destroy = """self.onDestroy = function() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    // 3D 资源释放
    window.removeEventListener('resize', handleWindowResize);
    if (intersectionObserver) { intersectionObserver.disconnect(); intersectionObserver = null; }
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (renderer) {
        renderer.dispose();
        if (containerEl && renderer.domElement && containerEl.contains(renderer.domElement))
            containerEl.removeChild(renderer.domElement);
        renderer = null;
    }
    if (scene) {
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(function(m){m.dispose();});
                else obj.material.dispose();
            }
        });
        scene = null;
    }
    threeReady = false;
    console.log('[Full Scene+3D] Destroyed');
};"""

merged = merged.replace(old_destroy, new_destroy)

# --- Insert 7: Modify self.onResize to include 3D resize ---
old_resize = """self.onResize = function() {
    // 如有需要，处理尺寸变化
};"""
new_resize = """self.onResize = function() {
    resize3D(true);
};"""
merged = merged.replace(old_resize, new_resize)

# --- Remove duplicate getLatestValue/parseBool from 3D code in the merged file ---
# The 3D code has its own getLatestValue and parseBool but Full Scene already has them
# The 3D versions are in the resize_code section. We'll remove them since they're not used
# (the 3D lifecycle that called them was replaced)

# Save merged JS
with open(f'{BASE_DIR}/full_scene_3d_merged.js', 'w', encoding='utf-8') as f:
    f.write(merged)

print(f'Merged JS saved: {len(merged)} chars')

# ============================================================
# Now modify the HTML: replace img backgrounds with 3D canvas
# ============================================================
with open(f'{BASE_DIR}/full_scene_html.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the two img tags with a 3D canvas div
old_imgs = '''                <!-- 背景图 -->
                <img class="tb-greenhouse-bg tb-day-bg active" src="" alt="白天大棚">
                <img class="tb-greenhouse-bg tb-night-bg" src="" alt="夜晚大棚">'''

new_canvas = '''                <!-- 3D 场景画布 (替代原来的白天/夜晚背景图片) -->
                <div class="tb-3d-canvas"></div>'''

html = html.replace(old_imgs, new_canvas)

# Hide 2D effects layer (keep the div but add hidden style since 3D handles effects)
old_effects = '''                <!-- 特效层 -->
                <div class="tb-effects-layer">'''
new_effects = '''                <!-- 特效层 (2D效果已由3D模型替代, 保留结构以备后用) -->
                <div class="tb-effects-layer" style="display:none;">'''
html = html.replace(old_effects, new_effects)

with open(f'{BASE_DIR}/full_scene_html_3d.html', 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Modified HTML saved: {len(html)} chars')

# ============================================================
# Add 3D canvas CSS
# ============================================================
with open(f'{BASE_DIR}/full_scene_css.css', 'r', encoding='utf-8') as f:
    css = f.read()

canvas_css = '''
/* ========== 3D Canvas 样式 ========== */
.tb-3d-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 1;
}
.tb-3d-canvas canvas {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    z-index: 1;
}
'''
css += canvas_css

with open(f'{BASE_DIR}/full_scene_css_3d.css', 'w', encoding='utf-8') as f:
    f.write(css)
print(f'Modified CSS saved: {len(css)} chars')

print('\nDone! Merged files:')
print('  JS:  full_scene_3d_merged.js')
print('  HTML: full_scene_html_3d.html')
print('  CSS: full_scene_css_3d.css')
