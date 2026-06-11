const path = require("path");
const pptxgen = require("pptxgenjs");

const OUT_DIR = __dirname;
const PAGE_W = 1672;
const PAGE_H = 941;
const SLIDE_W = 13.333333;
const SLIDE_H = (SLIDE_W * PAGE_H) / PAGE_W;

const pptx = new pptxgen();
pptx.author = "Codex";
pptx.subject = "Editable rebuild from split PPT visual assets";
pptx.title = "Smart Greenhouse Digital Twin Editable Rebuild";
pptx.company = "thingsboard-smart-greenhouse";
pptx.lang = "zh-CN";
pptx.defineLayout({ name: "CUSTOM_LAYOUT", width: SLIDE_W, height: SLIDE_H });
pptx.theme = {
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};
pptx.layout = "CUSTOM_LAYOUT";
pptx.margin = 0;

const slide = pptx.addSlide();
slide.background = { color: "FBFAF7" };

const COLORS = {
  navy: "07306F",
  line: "0A3475",
  panelBorder: "86A8D9",
  text: "111111",
  subtitle: "333333",
  panelFill: "F4FAFF",
  white: "FFFFFF",
  banner: "FFF5CE",
};

const scaleX = SLIDE_W / PAGE_W;
const scaleY = SLIDE_H / PAGE_H;
const x = (px) => px * scaleX;
const y = (px) => px * scaleY;
const w = (px) => px * scaleX;
const h = (px) => px * scaleY;

function addText(text, bx, by, bw, bh, sizePx, color, bold = false, align = "center") {
  slide.addText(text, {
    x: x(bx),
    y: y(by),
    w: w(bw),
    h: h(bh),
    margin: 0,
    breakLine: false,
    wrap: false,
    fit: "shrink",
    fontFace: "Microsoft YaHei",
    fontSize: sizePx * 0.57,
    color,
    bold,
    align,
    valign: "mid",
  });
}

function addRoundRect(bx, by, bw, bh, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x(bx),
    y: y(by),
    w: w(bw),
    h: h(bh),
    rectRadius: opts.radius || 0.08,
    fill: opts.fill || { color: COLORS.white, transparency: 0 },
    line: opts.line || { color: COLORS.line, width: 1.2 },
    shadow: opts.shadow || undefined,
  });
}

function addLine(bx1, by1, bx2, by2, opts = {}) {
  slide.addShape(pptx.ShapeType.line, {
    x: x(bx1),
    y: y(by1),
    w: x(bx2 - bx1),
    h: y(by2 - by1),
    line: {
      color: opts.color || COLORS.line,
      width: opts.width || 1.8,
      beginArrowType: opts.beginArrowType || "none",
      endArrowType: opts.endArrowType || "triangle",
      dash: opts.dash,
    },
  });
}

function addPanel(bx, by, bw, bh) {
  addRoundRect(bx, by, bw, bh, {
    radius: 0.07,
    fill: { color: COLORS.panelFill, transparency: 14 },
    line: { color: COLORS.panelBorder, width: 1 },
  });
}

function addCard(bx, by, bw, bh) {
  addRoundRect(bx, by, bw, bh, {
    radius: 0.055,
    fill: { color: COLORS.white, transparency: 0 },
    line: { color: COLORS.line, width: 1.25 },
    shadow: {
      type: "outer",
      color: "315887",
      opacity: 0.08,
      blur: 2,
      angle: 90,
      distance: 1,
    },
  });
}

// Full-slide base and subtle corner tint approximation.
slide.addShape(pptx.ShapeType.rect, {
  x: 0,
  y: 0,
  w: SLIDE_W,
  h: SLIDE_H,
  fill: { color: "FBFAF7" },
  line: { color: "FBFAF7", transparency: 100 },
});

// Main column panels.
addPanel(46, 171, 472, 620);
addPanel(647, 171, 444, 620);
addPanel(1220, 171, 426, 620);

// Cards.
addCard(80, 285, 399, 155);
addCard(80, 563, 399, 153);
addCard(698, 275, 342, 98);
addCard(698, 399, 342, 98);
addCard(698, 524, 342, 98);
addCard(698, 648, 342, 97);
addCard(1265, 275, 336, 98);
addCard(1265, 464, 336, 99);
addCard(1265, 637, 336, 100);

// Connection arrows and labels.
addLine(479, 324, 690, 324);
addLine(1040, 324, 1256, 324);
addLine(488, 614, 698, 614, { beginArrowType: "triangle", endArrowType: "none" });
addLine(1423, 373, 1423, 455);
addLine(1423, 563, 1423, 629);

// Bottom dashed banner.
addRoundRect(510, 822, 716, 72, {
  radius: 0.075,
  fill: { color: COLORS.banner, transparency: 18 },
  line: { color: COLORS.line, width: 1, dash: "dash" },
});

// Title block.
addText("智慧农业大棚数字孪生监控与联动控制系统", 250, 17, 1172, 64, 52, COLORS.navy, true);
addText("项目定位图", 724, 108, 224, 43, 34, COLORS.subtitle, false);

// Column headings.
addText("大棚数据来源", 178, 195, 207, 43, 34, COLORS.navy, true);
addText("ThingsBoard 平台", 731, 195, 277, 43, 34, COLORS.navy, true);
addText("数字孪生展示", 1327, 195, 212, 43, 34, COLORS.navy, true);

// Left column content.
addText("传感器数据", 197, 319, 166, 38, 30, COLORS.text, true);
addText("温度 / 湿度 / 光照 / 水位 / CO₂", 120, 372, 318, 34, 26, COLORS.text, false);
addText("执行器状态", 198, 596, 166, 38, 30, COLORS.text, true);
addText("风扇 / 补光灯 / 喷淋 / 补水泵", 124, 648, 314, 34, 26, COLORS.text, false);

// Center column content.
addText("MQTT 数据接入", 765, 309, 208, 34, 28, COLORS.text, false);
addText("遥测数据存储", 784, 435, 170, 34, 28, COLORS.text, false);
addText("RPC 远程控制", 781, 560, 179, 34, 28, COLORS.text, false);
addText("告警与规则联动", 776, 685, 190, 34, 28, COLORS.text, false);

// Right column content.
addText("Dashboard 大屏", 1333, 309, 201, 34, 28, COLORS.text, false);
addText("Three.js 3D 大棚", 1326, 500, 216, 34, 28, COLORS.text, false);
addText("虚实状态同步", 1349, 680, 150, 34, 28, COLORS.text, true);

// Arrow labels.
addText("遥测上传", 536, 285, 92, 31, 25, COLORS.text, false);
addText("实时展示", 1108, 285, 92, 31, 25, COLORS.text, false);
addText("RPC 控制", 536, 581, 92, 31, 25, COLORS.text, false);
addText("状态驱动", 1444, 398, 98, 32, 25, COLORS.text, false);

// Bottom statement.
addText("实时数据驱动虚拟大棚同步变化", 618, 842, 493, 40, 33, COLORS.navy, true);

const output = path.join(OUT_DIR, "smart_greenhouse_page_01_editable.pptx");
pptx.writeFile({ fileName: output });
