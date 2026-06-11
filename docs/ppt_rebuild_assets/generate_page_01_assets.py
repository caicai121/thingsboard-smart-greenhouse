from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "page_01"
VECTORS = OUT / "vectors"
PAGE_W = 1672
PAGE_H = 941

NAVY = "#07306f"
LINE = "#0a3475"
BORDER = "#86a8d9"
TEXT = "#111111"


def svg_wrap(width: int, height: int, body: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">\n{body}\n</svg>\n'
    )


def write_svg(name: str, width: int, height: int, body: str) -> str:
    path = VECTORS / f"{name}.svg"
    path.write_text(svg_wrap(width, height, body), encoding="utf-8")
    return f"vectors/{name}.svg"


def rounded_panel(width: int, height: int, stroke: str, stroke_width: float, rx: int, fill: str) -> str:
    return f'''<defs>
  <linearGradient id="panelFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{fill}" stop-opacity="0.88"/>
    <stop offset="1" stop-color="#eef7ff" stop-opacity="0.78"/>
  </linearGradient>
</defs>
<rect x="{stroke_width / 2}" y="{stroke_width / 2}" width="{width - stroke_width}" height="{height - stroke_width}"
      rx="{rx}" fill="url(#panelFill)" stroke="{stroke}" stroke-width="{stroke_width}"/>'''


def white_card(width: int, height: int, rx: int = 8) -> str:
    return f'''<defs>
  <filter id="softShadow" x="-8%" y="-12%" width="116%" height="124%">
    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#315887" flood-opacity="0.08"/>
  </filter>
</defs>
<rect x="1.25" y="1.25" width="{width - 2.5}" height="{height - 2.5}"
      rx="{rx}" fill="#ffffff" stroke="{LINE}" stroke-width="2.5" filter="url(#softShadow)"/>'''


def arrow(width: int, height: int, x1: float, y1: float, x2: float, y2: float) -> str:
    return f'''<defs>
  <marker id="arrowHead" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L9,4.5 L0,9 Z" fill="{LINE}"/>
  </marker>
</defs>
<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"
      stroke="{LINE}" stroke-width="3" stroke-linecap="round" marker-end="url(#arrowHead)"/>'''


def text_item(
    item_id: str,
    content: str,
    x: int,
    y: int,
    width: int,
    height: int,
    font_size: int,
    color: str = TEXT,
    weight: int | str = 400,
    align: str = "center",
    font_family: str = "Microsoft YaHei, Arial, sans-serif",
    layer: int = 100,
) -> dict:
    return {
        "id": item_id,
        "type": "text",
        "content": content,
        "bbox": {"x": x, "y": y, "width": width, "height": height},
        "fontFamily": font_family,
        "fontSize": font_size,
        "fontWeight": weight,
        "lineHeight": round(font_size * 1.18),
        "color": color,
        "align": align,
        "verticalAlign": "middle",
        "layer": layer,
    }


def main() -> None:
    VECTORS.mkdir(parents=True, exist_ok=True)

    shapes: list[dict] = []

    def add_shape(item_id: str, file_name: str, x: int, y: int, width: int, height: int, layer: int, body: str) -> None:
        rel = write_svg(file_name, width, height, body)
        shapes.append(
            {
                "id": item_id,
                "type": "svg",
                "file": rel,
                "bbox": {"x": x, "y": y, "width": width, "height": height},
                "layer": layer,
            }
        )

    add_shape(
        "background_canvas",
        "background_canvas",
        0,
        0,
        PAGE_W,
        PAGE_H,
        0,
        f'''<defs>
  <radialGradient id="cornerTint" cx="50%" cy="50%" r="70%">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="1" stop-color="#f7f7f4"/>
  </radialGradient>
</defs>
<rect width="{PAGE_W}" height="{PAGE_H}" fill="url(#cornerTint)"/>''',
    )

    for item_id, file_name, x, y, w, h in [
        ("source_panel", "panel_source", 46, 171, 472, 620),
        ("platform_panel", "panel_platform", 647, 171, 444, 620),
        ("digital_twin_panel", "panel_digital_twin", 1220, 171, 426, 620),
    ]:
        add_shape(item_id, file_name, x, y, w, h, 10, rounded_panel(w, h, BORDER, 2, 10, "#f6fbff"))

    for item_id, file_name, x, y, w, h in [
        ("sensor_card", "card_sensor_data", 80, 285, 399, 155),
        ("actuator_card", "card_actuator_status", 80, 563, 399, 153),
        ("mqtt_card", "card_mqtt_data", 698, 275, 342, 98),
        ("telemetry_storage_card", "card_telemetry_storage", 698, 399, 342, 98),
        ("rpc_card", "card_rpc_remote_control", 698, 524, 342, 98),
        ("rules_card", "card_alarm_rules", 698, 648, 342, 97),
        ("dashboard_card", "card_dashboard", 1265, 275, 336, 98),
        ("threejs_card", "card_threejs_greenhouse", 1265, 464, 336, 99),
        ("sync_card", "card_virtual_state_sync", 1265, 637, 336, 100),
    ]:
        add_shape(item_id, file_name, x, y, w, h, 20, white_card(w, h))

    add_shape("arrow_sensor_to_mqtt", "arrow_sensor_to_mqtt", 479, 313, 219, 22, 30, arrow(219, 22, 0, 11, 210, 11))
    add_shape("arrow_platform_to_dashboard", "arrow_platform_to_dashboard", 1040, 313, 225, 22, 30, arrow(225, 22, 0, 11, 216, 11))
    add_shape("arrow_rpc_to_actuator", "arrow_rpc_to_actuator", 479, 603, 219, 22, 30, arrow(219, 22, 219, 11, 9, 11))
    add_shape("arrow_dashboard_to_threejs", "arrow_dashboard_to_threejs", 1413, 373, 20, 91, 30, arrow(20, 91, 10, 0, 10, 82))
    add_shape("arrow_threejs_to_sync", "arrow_threejs_to_sync", 1413, 563, 20, 75, 30, arrow(20, 75, 10, 0, 10, 66))

    add_shape(
        "bottom_dashed_banner",
        "bottom_dashed_banner",
        510,
        822,
        716,
        72,
        15,
        f'''<defs>
  <linearGradient id="bannerFill" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff2c3" stop-opacity="0.78"/>
    <stop offset="0.52" stop-color="#ffffff" stop-opacity="0.62"/>
    <stop offset="1" stop-color="#eef7ff" stop-opacity="0.64"/>
  </linearGradient>
</defs>
<rect x="1.5" y="1.5" width="713" height="69" rx="10" fill="url(#bannerFill)"
      stroke="{LINE}" stroke-width="2" stroke-dasharray="9 7"/>''',
    )

    text = [
        text_item("title", "\u667a\u6167\u519c\u4e1a\u5927\u68da\u6570\u5b57\u5b6a\u751f\u76d1\u63a7\u4e0e\u8054\u52a8\u63a7\u5236\u7cfb\u7edf", 250, 17, 1172, 64, 52, NAVY, 700, "center", layer=100),
        text_item("subtitle", "\u9879\u76ee\u5b9a\u4f4d\u56fe", 724, 108, 224, 43, 34, "#333333", 400, "center", layer=100),
        text_item("source_heading", "\u5927\u68da\u6570\u636e\u6765\u6e90", 178, 195, 207, 43, 34, NAVY, 700, "center"),
        text_item("platform_heading", "ThingsBoard \u5e73\u53f0", 731, 195, 277, 43, 34, NAVY, 700, "center"),
        text_item("digital_twin_heading", "\u6570\u5b57\u5b6a\u751f\u5c55\u793a", 1327, 195, 212, 43, 34, NAVY, 700, "center"),
        text_item("sensor_title", "\u4f20\u611f\u5668\u6570\u636e", 197, 319, 166, 38, 30, TEXT, 700, "center"),
        text_item("sensor_body", "\u6e29\u5ea6 / \u6e7f\u5ea6 / \u5149\u7167 / \u6c34\u4f4d / CO\u2082", 120, 372, 318, 34, 26, TEXT, 400, "center"),
        text_item("actuator_title", "\u6267\u884c\u5668\u72b6\u6001", 198, 596, 166, 38, 30, TEXT, 700, "center"),
        text_item("actuator_body", "\u98ce\u6247 / \u8865\u5149\u706f / \u55b7\u6dcb / \u8865\u6c34\u6cf5", 124, 648, 314, 34, 26, TEXT, 400, "center"),
        text_item("mqtt_text", "MQTT \u6570\u636e\u63a5\u5165", 765, 309, 208, 34, 28, TEXT, 400, "center"),
        text_item("storage_text", "\u9065\u6d4b\u6570\u636e\u5b58\u50a8", 784, 435, 170, 34, 28, TEXT, 400, "center"),
        text_item("rpc_text", "RPC \u8fdc\u7a0b\u63a7\u5236", 781, 560, 179, 34, 28, TEXT, 400, "center"),
        text_item("rules_text", "\u544a\u8b66\u4e0e\u89c4\u5219\u8054\u52a8", 776, 685, 190, 34, 28, TEXT, 400, "center"),
        text_item("dashboard_text", "Dashboard \u5927\u5c4f", 1333, 309, 201, 34, 28, TEXT, 400, "center"),
        text_item("threejs_text", "Three.js 3D \u5927\u68da", 1326, 500, 216, 34, 28, TEXT, 400, "center"),
        text_item("sync_text", "\u865a\u5b9e\u72b6\u6001\u540c\u6b65", 1349, 680, 150, 34, 28, TEXT, 700, "center"),
        text_item("telemetry_label", "\u9065\u6d4b\u4e0a\u4f20", 536, 285, 92, 31, 25, TEXT, 400, "center"),
        text_item("realtime_label", "\u5b9e\u65f6\u5c55\u793a", 1108, 285, 92, 31, 25, TEXT, 400, "center"),
        text_item("rpc_label", "RPC \u63a7\u5236", 536, 581, 92, 31, 25, TEXT, 400, "center"),
        text_item("state_label", "\u72b6\u6001\u9a71\u52a8", 1444, 398, 98, 32, 25, TEXT, 400, "center"),
        text_item("bottom_text", "\u5b9e\u65f6\u6570\u636e\u9a71\u52a8\u865a\u62df\u5927\u68da\u540c\u6b65\u53d8\u5316", 618, 842, 493, 40, 33, NAVY, 700, "center", layer=110),
    ]

    manifest = {
        "page": 1,
        "sourceImage": "reference.png",
        "canvas": {"width": PAGE_W, "height": PAGE_H, "unit": "px", "origin": "top-left"},
        "notes": [
            "All text is specified as live text metadata; no text has been rasterized into image assets.",
            "SVG shape assets are intentionally kept as separate files and separate manifest layers.",
            "Coordinates are traced from the provided bitmap reference and may need sub-pixel adjustment in a PPT editor.",
        ],
        "assets": shapes + text,
    }

    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "text_spec.json").write_text(json.dumps(text, ensure_ascii=False, indent=2), encoding="utf-8")

    md_lines = [
        "# Page 01 Text Specification",
        "",
        "| id | content | x | y | w | h | font | size | weight | color | align | layer |",
        "|---|---|---:|---:|---:|---:|---|---:|---:|---|---|---:|",
    ]
    for item in text:
        bbox = item["bbox"]
        md_lines.append(
            f"| {item['id']} | {item['content']} | {bbox['x']} | {bbox['y']} | {bbox['width']} | {bbox['height']} | "
            f"{item['fontFamily']} | {item['fontSize']} | {item['fontWeight']} | {item['color']} | {item['align']} | {item['layer']} |"
        )
    (OUT / "text_spec.md").write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    composition = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{PAGE_W}" height="{PAGE_H}" viewBox="0 0 {PAGE_W} {PAGE_H}">',
        '  <title>Page 01 rebuild preview</title>',
    ]
    for item in sorted(shapes, key=lambda s: s["layer"]):
        bbox = item["bbox"]
        composition.append(
            f'  <image id="{item["id"]}" href="{item["file"]}" x="{bbox["x"]}" y="{bbox["y"]}" width="{bbox["width"]}" height="{bbox["height"]}"/>'
        )
    for item in sorted(text, key=lambda t: t["layer"]):
        bbox = item["bbox"]
        anchor = "middle" if item["align"] == "center" else "start"
        tx = bbox["x"] + bbox["width"] / 2 if item["align"] == "center" else bbox["x"]
        ty = bbox["y"] + bbox["height"] / 2 + item["fontSize"] * 0.36
        composition.append(
            f'  <text id="{item["id"]}" x="{tx:.1f}" y="{ty:.1f}" text-anchor="{anchor}" '
            f'font-family="{item["fontFamily"]}" font-size="{item["fontSize"]}" '
            f'font-weight="{item["fontWeight"]}" fill="{item["color"]}">{item["content"]}</text>'
        )
    composition.append("</svg>")
    (OUT / "page_01_rebuild_preview.svg").write_text("\n".join(composition) + "\n", encoding="utf-8")

    shape_only = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{PAGE_W}" height="{PAGE_H}" viewBox="0 0 {PAGE_W} {PAGE_H}">',
        '  <title>Page 01 vector shapes without text</title>',
    ]
    for item in sorted(shapes, key=lambda s: s["layer"]):
        bbox = item["bbox"]
        shape_only.append(
            f'  <image id="{item["id"]}" href="{item["file"]}" x="{bbox["x"]}" y="{bbox["y"]}" width="{bbox["width"]}" height="{bbox["height"]}"/>'
        )
    shape_only.append("</svg>")
    (OUT / "page_01_shapes_only.svg").write_text("\n".join(shape_only) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
