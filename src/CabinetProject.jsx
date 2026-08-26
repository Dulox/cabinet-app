import React, { useState, useMemo, useEffect, useRef } from "react";

// Supabase credentials
const SUPABASE_URL = "https://sgcsvwxzppbldwatmzzq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tn6dBkwNzm-H99OAcurSJw_f4lB2o-G";
const ADMIN_EMAIL = "mario@gmail.com";

// Initialize Supabase client via global window object (loaded via script tag below)
let supabase = null;

// Load Supabase library from CDN
const loadSupabase = async () => {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
};

loadSupabase();

/* ------------------------------------------------------------------ *
 * Base Cabinet Cut List — shop-drawing style calculator (mm)
 * Types: base / drawers / sink / stove / corner.
 * Per-cabinet cut list + elevation, combined material totals,
 * board-count estimate (2800 x 2070), and a downloadable PDF.
 * ------------------------------------------------------------------ */


// Theme definitions (all colors are dynamic, no hardcoded C object)
const THEME_COLORS = {
  // LIGHT (default): off-white canvas, near-black cards, black accent — pure monochrome
  light: {
    paper: "#efece6",        // soft off-white canvas
    card: "#17181c",         // near-black cards
    ink: "#ffffff",          // text on cards = white
    mut: "#9a9ba2",          // muted grey on dark cards
    hair: "rgba(255,255,255,0.09)",
    amber: "#ffffff",        // "accent" on dark cards = white
    rust: "#111214",         // "accent" on light surfaces = near-black
    mat: "#1e2026",          // input/inset on dark cards
    matLine: "rgba(255,255,255,0.10)",
    panel: "#17181c",
    panelEdge: "rgba(255,255,255,0.10)",
    bgPrimary: "#efece6",
    bgSecondary: "#e6e2da",
    textPrimary: "#ffffff",
    textSecondary: "#c3c4ca",
    border: "rgba(17,18,20,0.10)",   // hairline on light canvas
    buttonBg: "#111214",             // black button on light
    buttonText: "#ffffff",
    inputBg: "#1e2026",
    inputBorder: "rgba(255,255,255,0.12)",
    // canvas-surface tokens (elements sitting directly on the light paper)
    canvasText: "#17181c",
    canvasMut: "#6a6b72",
    canvasBorder: "rgba(17,18,20,0.16)",
    canvasBtn: "#ffffff",
    canvasBtnText: "#17181c",
  },
  dark: {
    paper: "#0c0d10",        // near-black canvas
    card: "#17181c",         // dark grey cards
    ink: "#ffffff",
    mut: "#8b8c93",
    hair: "rgba(255,255,255,0.08)",
    amber: "#ffffff",
    rust: "#ffffff",
    mat: "#1e2026",
    matLine: "rgba(255,255,255,0.10)",
    panel: "#17181c",
    panelEdge: "rgba(255,255,255,0.10)",
    bgPrimary: "#0c0d10",
    bgSecondary: "#141519",
    textPrimary: "#ffffff",
    textSecondary: "#c3c4ca",
    border: "rgba(255,255,255,0.10)",
    buttonBg: "#ffffff",             // white button on black
    buttonText: "#0c0d10",
    inputBg: "#1e2026",
    inputBorder: "rgba(255,255,255,0.12)",
    // canvas-surface tokens (elements sitting directly on the dark paper)
    canvasText: "#ffffff",
    canvasMut: "#8b8c93",
    canvasBorder: "rgba(255,255,255,0.16)",
    canvasBtn: "#17181c",
    canvasBtnText: "#ffffff",
  }
}

// Global colors variable - will be updated by main component
let currentTheme = "light";
let getColors = () => THEME_COLORS[currentTheme];



const DEFAULTS = {
  t: 19, sideH: 786, sideD: 610,
  railH: 100, railQty: 2, frontRailH: 50,
  doorReveal: 2, doorGap: 3, doorH: 786,
  shelfSetback: 40, shelfClearance: 2, falseFrontH: 150,
  backBetween: true,
  backType: "melamine", grooveDepth: 5.5,
  boardW: 2800, boardH: 2070, kerf: 4, allowRotate: true,
  cornerDoorW: 400, cornerStileW: 100, cornerBlindW: 200, baseBuildUp: 25, buildUpStripH: 60, stripBoxClear: 5,
  drawerBoxes: true, drawerSideClear: 13, drawerBoxDepth: 500, drawerBoxHReduce: 20,
};

const TYPES = {
  base:    { label: "Base cabinet",            set: { doorCount: 1, shelfQty: 1, hingeType: "concealed" } },
  drawers: { label: "Base cabinet — drawers",  set: { drawerCount: 3, shelfQty: 0, hingeType: "concealed" } },
  wall:    { label: "Wall cabinet",            set: { doorCount: 1, shelfQty: 1, hingeType: "concealed" } },
  sink:    { label: "Sink cabinet",            set: { doorCount: 2, shelfQty: 0, falseFront: true, hingeType: "concealed" } },
  stove:   { label: "Stove cabinet",           set: { doorCount: 2, shelfQty: 0, falseFront: true, front: "doors", hingeType: "concealed" } },
  corner:  { label: "Corner cabinet (blind)",  set: { doorCount: 1, shelfQty: 1, hingeType: "concealed" } },
  deepwall: { label: "Wall cabinet (custom depth)", set: { doorCount: 1, shelfQty: 1, hingeType: "concealed" } },
  filler:  { label: "Filler piece",               set: { doorCount: 0, shelfQty: 0 } },
};

const round1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => { const r = round1(n); return Number.isInteger(r) ? String(r) : r.toFixed(1); };

/* ----------------------------------------------------------------- *
 * MiniPDF — dependency-free PDF writer (text + lines, A4 in mm).
 * Renders in the built-in Courier font (no embedding, no network),
 * so PDF export works in any browser, offline, and in sandboxes.
 * Exposes the small subset of the jsPDF API this app uses.
 * ----------------------------------------------------------------- */
const PDF_WINMAP = { "·":0xB7,"×":0xD7,"÷":0xF7,"²":0xB2,"³":0xB3,"°":0xB0,"−":0x2D,"–":0x96,"—":0x97,"…":0x85,"≈":0x7E,"’":0x92,"‘":0x91,"“":0x93,"”":0x94,"€":0x80,"£":0xA3 };
function pdfEscape(str) {
  let out = "";
  for (const ch of String(str)) {
    let code = ch.codePointAt(0);
    if (code > 126) {
      if (PDF_WINMAP[ch] != null) code = PDF_WINMAP[ch];
      else if (code >= 0xA0 && code <= 0xFF) { /* Latin-1 == WinAnsi byte, keep as-is */ }
      else code = 0x3F;
    }
    if (code === 0x28 || code === 0x29 || code === 0x5C) out += "\\" + String.fromCharCode(code);
    else if (code < 32 || code > 126) out += "\\" + code.toString(8).padStart(3, "0");
    else out += String.fromCharCode(code);
  }
  return out;
}
function MiniPDF() {
  this._K = 72 / 25.4;          // mm -> pt
  this._PW = 595.28; this._PH = 841.89;  // A4 pt
  this._CW = 0.6;               // Courier glyph width (em)
  this._pages = [[]]; this._pi = 0;
  this._font = "Courier"; this._size = 12;
  this._fill = [0, 0, 0]; this._draw = [0, 0, 0]; this._lw = 0.2;
}
MiniPDF.prototype._ops = function () { return this._pages[this._pi]; };
MiniPDF.prototype._ref = function () { return this._font === "Courier-Bold" ? "F2" : "F1"; };
MiniPDF.prototype._wMm = function (s, size) { return (String(s).length * this._CW * size) / this._K; };
MiniPDF.prototype.addPage = function () { this._pages.push([]); this._pi = this._pages.length - 1; return this; };
MiniPDF.prototype.setFont = function (_family, style) { this._font = style === "bold" ? "Courier-Bold" : "Courier"; return this; };
MiniPDF.prototype.setFontSize = function (s) { this._size = s; return this; };
MiniPDF.prototype.setTextColor = function (r, g, b) { if (g == null) g = b = r; this._fill = [r, g, b].map((v) => v / 255); return this; };
MiniPDF.prototype.setDrawColor = function (r, g, b) { if (g == null) g = b = r; this._draw = [r, g, b].map((v) => v / 255); return this; };
MiniPDF.prototype.setLineWidth = function (w) { this._lw = w; return this; };
MiniPDF.prototype.splitTextToSize = function (text, maxW) {
  const size = this._size;
  const maxChars = Math.max(1, Math.floor((maxW * this._K) / (this._CW * size)));
  const lines = []; let cur = "";
  String(text).split(/\s+/).forEach((word) => {
    let w = word;
    while (w.length > maxChars) { if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, maxChars)); w = w.slice(maxChars); }
    const t = cur ? cur + " " + w : w;
    if (t.length <= maxChars) cur = t; else { if (cur) lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
};
MiniPDF.prototype.text = function (str, x, y, opts) {
  opts = opts || {};
  const lines = Array.isArray(str) ? str : [str];
  const size = this._size, gap = (size / this._K) * 1.15, ops = this._ops();
  const [r, g, b] = this._fill;
  lines.forEach((ln, i) => {
    const s = String(ln);
    let xx = x;
    if (opts.align === "right") xx = x - this._wMm(s, size);
    else if (opts.align === "center") xx = x - this._wMm(s, size) / 2;
    const xpt = (xx * this._K).toFixed(2);
    const ypt = (this._PH - (y + i * gap) * this._K).toFixed(2);
    ops.push(`BT /${this._ref()} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${xpt} ${ypt} Td (${pdfEscape(s)}) Tj ET`);
  });
  return this;
};
MiniPDF.prototype.line = function (x1, y1, x2, y2, opt) {
  opt = opt || {};
  const col = opt.color ? opt.color.map((v) => v / 255) : this._draw;
  const lw = opt.lineWidth != null ? opt.lineWidth : this._lw;
  const X = (v) => (v * this._K).toFixed(2), Y = (v) => (this._PH - v * this._K).toFixed(2), ops = this._ops();
  if (opt.dash) ops.push(`[${(opt.dash[0] * this._K).toFixed(2)} ${(opt.dash[1] * this._K).toFixed(2)}] 0 d`);
  ops.push(`${col[0].toFixed(3)} ${col[1].toFixed(3)} ${col[2].toFixed(3)} RG ${(lw * this._K).toFixed(2)} w ${X(x1)} ${Y(y1)} m ${X(x2)} ${Y(y2)} l S`);
  if (opt.dash) ops.push("[] 0 d");
  return this;
};
MiniPDF.prototype.rect = function (x, y, w, h, opt) {
  opt = opt || {};
  const ops = this._ops();
  const xpt = (x * this._K).toFixed(2), ypt = (this._PH - (y + h) * this._K).toFixed(2);
  const wpt = (w * this._K).toFixed(2), hpt = (h * this._K).toFixed(2);
  if (opt.fill) { const [r, g, b] = opt.fill.map((v) => v / 255); ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`); }
  if (opt.stroke) { const [r, g, b] = opt.stroke.map((v) => v / 255); ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`); }
  if (opt.lineWidth != null) ops.push(`${(opt.lineWidth * this._K).toFixed(2)} w`);
  if (opt.dash) ops.push(`[${(opt.dash[0] * this._K).toFixed(2)} ${(opt.dash[1] * this._K).toFixed(2)}] 0 d`);
  const paint = (opt.fill && opt.stroke) ? "B" : (opt.fill ? "f" : "S");
  ops.push(`${xpt} ${ypt} ${wpt} ${hpt} re ${paint}`);
  if (opt.dash) ops.push("[] 0 d");
  return this;
};
MiniPDF.prototype.circle = function (cx, cy, r, opt) {
  opt = opt || {};
  const k = 0.5523 * r, ops = this._ops();
  const X = (v) => (v * this._K).toFixed(2), Y = (v) => (this._PH - v * this._K).toFixed(2);
  if (opt.fill) { const [a, b, c] = opt.fill.map((v) => v / 255); ops.push(`${a.toFixed(3)} ${b.toFixed(3)} ${c.toFixed(3)} rg`); }
  if (opt.stroke) { const [a, b, c] = opt.stroke.map((v) => v / 255); ops.push(`${a.toFixed(3)} ${b.toFixed(3)} ${c.toFixed(3)} RG`); }
  ops.push(`${X(cx + r)} ${Y(cy)} m`);
  ops.push(`${X(cx + r)} ${Y(cy - k)} ${X(cx + k)} ${Y(cy - r)} ${X(cx)} ${Y(cy - r)} c`);
  ops.push(`${X(cx - k)} ${Y(cy - r)} ${X(cx - r)} ${Y(cy - k)} ${X(cx - r)} ${Y(cy)} c`);
  ops.push(`${X(cx - r)} ${Y(cy + k)} ${X(cx - k)} ${Y(cy + r)} ${X(cx)} ${Y(cy + r)} c`);
  ops.push(`${X(cx + k)} ${Y(cy + r)} ${X(cx + r)} ${Y(cy + k)} ${X(cx + r)} ${Y(cy)} c`);
  ops.push(opt.fill && opt.stroke ? "B" : (opt.fill ? "f" : "S"));
  return this;
};
MiniPDF.prototype._build = function () {
  const objs = [], N = this._pages.length, pageNums = [], contentNums = [];
  let next = 5;
  for (let i = 0; i < N; i++) { contentNums.push(next++); pageNums.push(next++); }
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pageNums.map((n) => n + " 0 R").join(" ")}] /Count ${N} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>";
  for (let i = 0; i < N; i++) {
    const c = this._pages[i].join("\n");
    objs[contentNums[i]] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
    objs[pageNums[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this._PW} ${this._PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNums[i]} 0 R >>`;
  }
  const maxObj = next - 1, offsets = [];
  let pdf = "%PDF-1.4\n";
  for (let n = 1; n <= maxObj; n++) { offsets[n] = pdf.length; pdf += `${n} 0 obj\n${objs[n]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= maxObj; n++) pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
};
MiniPDF.prototype.output = function () {
  const pdf = this._build(), bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
};
MiniPDF.prototype.save = function (fname) {
  try {
    const url = URL.createObjectURL(this.output());
    const a = document.createElement("a");
    a.href = url; a.download = fname || "cutlist.pdf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { /* ignore */ }
  return this;
};

/* Draw one cabinet's front elevation into a MiniPDF, scaled to fit a box.
   Mirrors the on-screen Elevation: carcass panels, dashed face outlines,
   hinge dots, and width / height / opening dimensions. Print-optimised
   (white ground, dark lines) for taping up at the bench. */
function drawCabinetElevation(doc, x0, y0, boxW, boxH, W, p, shelfQty, faces) {
  const t = p.t, H = p.sideH, railH = p.railH;
  const PANEL = [225, 222, 210], EDGE = [150, 142, 124], INK = [28, 30, 22];
  const DOOR = [40, 44, 34], BLIND = [246, 224, 218], DIM = [120, 86, 50];
  const mL = 16, mR = 8, mT = 8, mB = 12;
  const innerW = boxW - mL - mR, innerH = boxH - mT - mB;
  const scale = Math.min(innerW / W, innerH / H);
  const dW = W * scale, dH = H * scale;
  const gx = x0 + mL + (innerW - dW) / 2, gy = y0 + mT;
  const PX = (cx) => gx + cx * scale, PY = (cy) => gy + cy * scale, S = (v) => v * scale;

  // carcass: two sides, bottom, top rail
  const car = { fill: PANEL, stroke: EDGE, lineWidth: 0.3 };
  doc.rect(PX(0), PY(0), S(t), S(H), car);
  doc.rect(PX(W - t), PY(0), S(t), S(H), car);
  doc.rect(PX(t), PY(H - t), S(W - 2 * t), S(t), car);
  doc.rect(PX(t), PY(0), S(W - 2 * t), S(railH), car);
  // shelves (evenly spaced in the opening)
  const openTop = railH, openBot = H - t;
  for (let i = 1; i <= shelfQty; i++) {
    const cy = openTop + (openBot - openTop) * i / (shelfQty + 1);
    doc.rect(PX(t), PY(cy - t / 2), S(W - 2 * t), S(t), car);
  }
  // faces (doors / drawers / blind panels) as dashed outlines
  faces.forEach((f) => {
    const isBlind = f.kind === "blind";
    doc.rect(PX(f.x), PY(f.y), S(f.w), S(f.h),
      { fill: isBlind ? BLIND : null, stroke: isBlind ? [150, 60, 50] : DOOR, lineWidth: 0.45, dash: [1.5, 1.1] });
    if (f.split === 2) doc.line(PX(f.x + f.w / 2), PY(f.y), PX(f.x + f.w / 2), PY(f.y + f.h), { color: DOOR, lineWidth: 0.45, dash: [1.5, 1.1] });
    if (f.kind === "door") {
      const inset = Math.min(40, f.w * 0.18);
      const hx = f.hinge === "left" ? f.x + inset : f.x + f.w - inset;
      doc.circle(PX(hx), PY(f.y + f.h / 2), 1.05, { fill: DOOR });
    }
  });

  // dimensions
  doc.setFont("courier", "normal"); doc.setFontSize(7.5); doc.setTextColor(DIM[0], DIM[1], DIM[2]);
  // width (below)
  const wy = gy + dH + 4;
  doc.line(PX(0), wy, PX(W), wy, { color: DIM, lineWidth: 0.25 });
  doc.line(PX(0), wy - 1.4, PX(0), wy + 1.4, { color: DIM, lineWidth: 0.25 });
  doc.line(PX(W), wy - 1.4, PX(W), wy + 1.4, { color: DIM, lineWidth: 0.25 });
  doc.text(`${fmt(W)} mm`, gx + dW / 2, wy + 4.2, { align: "center" });
  // height (left)
  const hx = gx - 4;
  doc.line(hx, PY(0), hx, PY(H), { color: DIM, lineWidth: 0.25 });
  doc.line(hx - 1.4, PY(0), hx + 1.4, PY(0), { color: DIM, lineWidth: 0.25 });
  doc.line(hx - 1.4, PY(H), hx + 1.4, PY(H), { color: DIM, lineWidth: 0.25 });
  doc.text(`${fmt(H)}`, x0 + 1, gy + dH / 2 + 1, { align: "left" });
  // opening (top)
  doc.setFontSize(6.5); doc.setTextColor(150, 120, 90);
  doc.text(`opening ${fmt(W - 2 * t)} mm`, gx + dW / 2, gy - 3, { align: "center" });
}

const translations = {
  en: {},
  es: {
    "+ Add cabinet": "+ Añadir armario",
    "Move up": "Subir",
    "Move down": "Bajar",
    "Duplicate cabinet": "Duplicar armario",
    "Download PDF": "Descargar PDF",
    "Shop drawing PDF": "Plano de taller PDF",
    "Copy text": "Copiar texto",
    "Copied ✓": "¡Copiado! ✓",
    "Save file": "Guardar archivo",
    "Open in new tab": "Abrir en pestaña nueva",
    "Close": "Cerrar",
    "Remove": "Quitar",
    "Cabinet type": "Tipo de armario",
    "Width": "Ancho",
    "Doors": "Puertas",
    "Drawers": "Gaveteros",
    "Front": "Frente",
    "Hinges": "Bisagras",
    "Shelves": "Estantes",
    "No doors": "Sin puertas",
    "1 door": "1 puerta",
    "2 doors": "2 puertas",
    "False front": "Frente falso",
    "False drawer": "Gaveta falsa",
    "False drawer face": "Frente de gaveta falso",
    "drawer": "gaveta",
    "drawers": "gavetas",
    "Concealed (European)": "Oculta (europea)",
    "Overlay": "Sobrepuesta",
    "Inset": "Embutida",
    "Butt": "De pomo",
    "Surface-Mount": "De superficie",
    "Soft-Close": "Cierre suave",
    "Lift-Up / Flap": "Abatible (lift-up)",
    "Base cabinet": "Armario base",
    "Base cabinet — drawers": "Armario base — gaveteros",
    "Wall cabinet": "Armario de pared",
    "Sink cabinet": "Armario de fregadero",
    "Stove cabinet": "Armario de estufa",
    "Corner cabinet (blind)": "Armario esquinero (ciego)",
    "Cabinet": "Armario",
    "Material total": "Total de material",
    "Hardware total": "Total de herrajes",
    "Hardware & fasteners": "Herrajes y tornillería",
    "Shelf pin hole positions (on each side)": "Posiciones de agujeros para soportes (en cada lado)",
    "32mm spacing · drill 5mm diameter holes": "Espaciado 32mm · perforar agujeros de 5mm de diámetro",
    "Shared specifications & assumptions": "Especificaciones y supuestos comunes",
    "Shop drawing · mm": "Plano de taller · mm",
    "Cabinets": "Armarios", "Log in": "Iniciar sesión",
    "Private access is coming soon — sign-in with owner approval. For now the app is open.": "El acceso privado llegará pronto — inicio de sesión con aprobación del propietario. Por ahora la app es abierta.",
    "Side": "Lado", "Bottom": "Fondo", "Top": "Tapa", "Back": "Espalda",
    "Rail / Support": "Riel / Soporte", "Rail / Support (front)": "Riel / Soporte (frontal)", "Rail / Support (back)": "Riel / Soporte (trasero)", "Shelf": "Estante", "Separator (fixed)": "Separador (fijo)",
    "Door": "Puerta", "Door (pair)": "Puertas (par)", "Door (flap, stacked)": "Puerta (abatible, apilada)",
    "Blind / filler panel": "Panel ciego / relleno", "Select a cabinet": "Selecciona un gabinete", "Select": "Seleccionar", "Click any cabinet in the list to view and edit it.": "Haz clic en cualquier gabinete de la lista para verlo y editarlo.", "Filler piece": "Pieza de relleno", "Wall cabinet (custom depth)": "Armario de pared (profundidad personalizada)", "Filler": "Relleno", "False drawer front": "Frente de gaveta falso",
    "Drawer front": "Frente de gaveta", "Drawer box side": "Lado de caja de gaveta",
    "Drawer box front/back": "Frente/fondo de caja de gaveta", "Drawer bottom": "Fondo de gaveta",
    "width": "ancho", "depth": "profundidad", "height": "alto", "length": "largo",
    "Cut list": "Lista de corte", "pieces": "piezas", "pcs": "pzs", "Boards": "Tableros",
    "about": "aprox.", "Hardware": "Herrajes", "No valid cabinets to draw.": "No hay armarios válidos para dibujar.",
    "sheet": "hoja", "board": "tablero", "hinges": "bisagras", "slide pairs": "pares de correderas",
    "shelf pins": "soportes de estante", "handles": "tiradores",
    "Melamine thickness": "Espesor de melamina",
    "Groove depth": "Profundidad de ranura", "Back panel": "Panel trasero",
    "Melamine (full)": "Melamina (completo)", "Thin hardboard": "Hardboard delgado",
    "Back thickness": "Espesor del trasero", "Groove depth +": "Prof. de ranura +",
    "Side height": "Alto del lado", "Side depth": "Prof. del lado", "Rail height": "Alto del riel",
    "Back rail height": "Alto riel trasero", "Front rail height": "Alto riel frontal",
    "Rail qty": "Cant. de rieles", "Shelf setback": "Retroceso del estante", "Shelf clearance": "Holgura del estante",
    "Door height": "Alto de puerta", "Door reveal": "Huelgo de puerta", "Door gap (pair)": "Separación entre puertas",
    "False front H": "Alto frente falso", "Corner door W": "Ancho puerta esquinera",
    "Door side": "Lado de la puerta", "Left": "Izquierda", "Right": "Derecha",
    "Blind panel W": "Ancho panel ciego", "Corner stile W": "Ancho montante esquina",
    "Corner blind W (default)": "Ancho panel ciego (predet.)", "Hinge stile / rail": "Montante de bisagras",
    "Base build-up (top)": "Refuerzo superior base",
    "Build-up strip height": "Altura del refuerzo",
    "Strip → top box clearance": "Holgura refuerzo → cajón superior",
    "Slide clear/side": "Holgura corredera/lado", "Drawer box depth": "Prof. caja de gaveta",
    "Box H = front −": "Alto caja = frente −", "Include drawer boxes": "Incluir cajas de gaveta",
    "Board width": "Ancho del tablero", "Board height": "Alto del tablero", "Saw kerf": "Ancho de corte",
    "Allow parts to rotate (no grain direction)": "Permitir rotar piezas (sin veta)",
    "Back fits between sides": "El trasero encaja entre los lados",
    "millimetres": "milímetros",
    "Shelf pins:": "Soportes de estante:",
    "Hinges (2 per door):": "Bisagras (2 por puerta):",
    "Drawer slide pairs:": "Pares de correderas:",
    "Handles / knobs:": "Tiradores / pomos:",
    "Hardboard backs (separate sheet):": "Traseros de hardboard (hoja aparte):",
    "lift-up set": "juego abatible", "lift-up sets": "juegos abatibles",
    "Back sits on bottom": "El trasero apoya sobre el fondo",
    "Boards needed": "Tableros necesarios",
    "est.": "aprox.", "used": "usado", "incl.": "incl.", "kerf": "de corte",
    "parts may rotate": "las piezas pueden rotar", "grain fixed": "veta fija",
    "part(s) bigger than a board!": "pieza(s) más grande(s) que un tablero!",
    "Layout estimate — real nesting varies. Buy at least one spare board for offcuts and mistakes.":
      "Estimado de despiece — el anidado real varía. Compra al menos un tablero extra para recortes y errores.",
    "Hardboard backs (separate sheet)": "Traseros de hardboard (hoja aparte)",
    "Shelf pins": "Soportes de estante",
    "Drawer slide pairs": "Pares de correderas", "Handles / knobs": "Tiradores / pomos",
    "4 per shelf · 32mm spacing from": "4 por estante · espaciado 32mm desde",
    "2 per door · 35mm cup hinges": "2 por puerta · bisagras de cazoleta 35mm",
    "1 pair per drawer ·": "1 par por gaveta ·", "1 per door & drawer": "1 por puerta y gaveta",
    "Corner = blind-corner approximation (one door + a blind/filler panel). Tell me how you build corners to refine it.":
      "Esquinero = aproximación de esquina ciega (una puerta + panel ciego/relleno). Dime cómo construyes esquineros para afinarlo.",
    "Auto-copy was blocked here — tap the box, select all, and copy:":
      "El copiado automático fue bloqueado — toca el cuadro, selecciona todo y copia:",
    "melamine": "melamina",
    "cabinet": "armario",
    "cabinets": "armarios",
    "wide": "de ancho",
    "Projects": "Proyectos",
    "+ New Project": "+ Nuevo Proyecto",
    "Delete this project? This cannot be undone.": "¿Borrar este proyecto? No se puede deshacer.",
    "Log out": "Cerrar sesión",
  }
};

const splitHeights = (total, n, gap) => {
  const each = (total - gap * (n - 1)) / n;
  return Array.from({ length: n }, () => Math.floor(each));
};

// Shelf pin hole positions (32mm spacing, DIN 1142)
function shelfPinHoles(sideH, startFromTop = 37, spacing = 32) {
  const holes = [];
  for (let y = startFromTop; y < sideH - 40; y += spacing) holes.push(y);
  return holes;
}

/* --------------------------- cut list ----------------------------- */
function buildCutList(W, p, cab) {
  const t = p.t;
  const carcassW = W - 2 * t;
  const thinBack = p.backType === "thin";
  const grooveDepth = thinBack ? (p.grooveDepth != null ? p.grooveDepth : 5.5) : 0;
  const backThick = thinBack ? grooveDepth : t;   // sheet thickness = groove width = groove depth
  const bottomDepth = p.sideD;                     // ALWAYS full depth (back sits on / grooves into bottom, never behind it)
  const backW = p.backBetween ? W - 2 * t : W;
  // Melamine back sits on the bottom (base: −t) or between top+bottom (wall: −2t).
  // Hardboard back reaches INTO the grooves, so it is taller by one groove depth per grooved edge.
  const isWall = cab.type === "wall" || cab.type === "deepwall";
  const backH = isWall
    ? (thinBack ? p.sideH - 2 * t + 2 * grooveDepth : p.sideH - 2 * t)
    : (thinBack ? p.sideH - t + grooveDepth : p.sideH - t);
  // Hardboard back spans groove-to-groove: opening (W−2t) + one groove depth reach on each side.
  const hardBackW = round1(W - 2 * t + 2 * grooveDepth);
  const doorTotal = W - p.doorReveal;
  const rev = p.doorReveal / 2;

  const parts = [
    { part: "Side", qty: 2, a: p.sideD, b: p.sideH, aLabel: "depth", bLabel: "height",
      note: "Fixed size" },
    { part: "Bottom", qty: 1, a: carcassW, b: bottomDepth, aLabel: "width", bLabel: "depth",
      note: `width = ${W} − ${2 * t} · depth = ${p.sideD} (full)` },
    ...((p.frontRailH != null ? p.frontRailH : p.railH) > 0 ? [{ part: "Rail / Support (front)", qty: 1, a: carcassW, b: (p.frontRailH != null ? p.frontRailH : p.railH), aLabel: "length", bLabel: "height",
      note: `length = ${W} − ${2 * t} · front rail` }] : []),
    ...(p.railQty > 1 ? [{ part: "Rail / Support (back)", qty: p.railQty - 1, a: carcassW, b: p.railH, aLabel: "length", bLabel: "height",
      note: `length = ${W} − ${2 * t} · back rail` }] : []),
    { part: thinBack ? `Back — ${backThick} mm hardboard` : "Back", qty: 1, a: thinBack ? hardBackW : backW, b: backH,
      aLabel: "width", bLabel: "height", material: thinBack ? "hardboard" : "melamine",
      note: `${thinBack ? `width ${hardBackW} = ${W} − ${2 * t} + 2×${grooveDepth} groove (sits in side grooves)` : (p.backBetween ? `width = ${W} − ${2 * t}` : "full width")} · ${
        thinBack ? `height ${backH} (into grooves)` : `height = ${p.sideH} − ${t} (sits on bottom)`}${
        thinBack ? ` · separate hardboard sheet` : ""}` },
  ];

  if (cab.shelfQty > 0) {
    parts.push({ part: "Shelf", qty: cab.shelfQty, a: carcassW - p.shelfClearance, b: bottomDepth - p.shelfSetback,
      aLabel: "width", bLabel: "depth",
      note: `width = ${W} − ${2 * t} − ${p.shelfClearance} (easy fit) · depth = ${bottomDepth} − ${p.shelfSetback} (setback)` });
  }

  const faces = []; // {x,y,w,h,split,kind} in mm relative to cabinet front (y down from top)
  // Base cabinets get a build-up strip along the top front edge (for strength /
  // countertop fixing). Doors and drawer fronts must drop below it so they open
  // without friction. buildUp is the height removed from the top of every front.
  const isWallLiftUp = ((cab.type === "wall" || cab.type === "deepwall") && cab.hingeType === "lift-up");
  const buildUp = (cab.type === "wall") ? 0 : (p.baseBuildUp != null ? p.baseBuildUp : 0);
  const frontH = round1(p.doorH - buildUp);
  const buildNote = buildUp ? ` · height = ${p.doorH} − ${buildUp} base build-up` : "";
  const doorH_calc = frontH;

  // The build-up is a real melamine strip along the top front edge. Cut it.
  if (buildUp > 0) {
    const stripH = (p.buildUpStripH != null ? p.buildUpStripH : buildUp);
    const overlap = round1(stripH - buildUp);
    parts.push({ part: "Base build-up strip", qty: 1, a: carcassW, b: stripH,
      aLabel: "length", bLabel: "height",
      note: `length = ${W} − ${2 * t} · strip along top front edge · fronts drop ${buildUp} · overlaps behind front by ${overlap}` });
  }
  const door = (n) => parts.push(n === 1
    ? { part: "Door", qty: 1, a: doorTotal, b: doorH_calc, aLabel: "width", bLabel: "height",
        note: `width = ${W} − ${p.doorReveal}${buildNote}` }
    : { part: "Door (pair)", qty: 2, a: round1((doorTotal - p.doorGap) / 2), b: doorH_calc, aLabel: "width", bLabel: "height",
        note: `each = (${W} − ${p.doorReveal} − ${p.doorGap} gap) ÷ 2${buildNote}` });

  if (cab.type === "drawers") {
    const heights = (cab.drawerHeights && cab.drawerHeights.length) ? cab.drawerHeights
      : splitHeights(frontH, cab.drawerCount || 3, p.doorGap);
    const boxW = carcassW - 2 * p.drawerSideClear; // outer box width (opening − slide clearance)
    const fbW = boxW - 2 * t;                       // front/back fit between the box sides
    let y = buildUp;
    const dmap = new Map();
    const add = (part, a, b, aL, bL, note, q = 1) => {
      const key = `${part}|${a}|${b}`; const e = dmap.get(key);
      if (e) e.qty += q; else dmap.set(key, { part, qty: q, a, b, aLabel: aL, bLabel: bL, note });
    };
    heights.forEach((h, i) => {
      add("Drawer front", doorTotal, h, "width", "height", `width = ${W} − ${p.doorReveal}${buildNote}`);
      faces.push({ x: rev, y, w: doorTotal, h, split: 1, kind: "drawer" });
      y += h + p.doorGap;
      if (p.drawerBoxes) {
        let boxH = Math.max(1, round1(h - p.drawerBoxHReduce));
        let boxNote = `box outer ${boxW} × ${p.drawerBoxDepth} (fits between slides) · height = front − ${p.drawerBoxHReduce}`;
        // Top drawer only: the build-up strip hangs down at the front, so this
        // box must stop clear of it or the drawer cannot be pulled out.
        if (i === 0 && buildUp > 0) {
          const stripH = (p.buildUpStripH != null ? p.buildUpStripH : buildUp);
          const clear = (p.stripBoxClear != null ? p.stripBoxClear : 5);
          const lower = heights.slice(1).reduce((a, b) => a + b, 0) + (heights.length - 1) * p.doorGap;
          const maxTopBoxH = round1(p.sideH - stripH - clear - lower);
          if (maxTopBoxH < boxH) {
            boxH = Math.max(1, maxTopBoxH);
            boxNote = `top drawer · clears the ${stripH} build-up strip by ${clear} · height = ${p.sideH} − ${stripH} − ${clear} − ${lower} (lower fronts + gaps)`;
          }
        }
        add("Drawer box side", p.drawerBoxDepth, boxH, "depth", "height", boxNote, 2);
        add("Drawer box front/back", fbW, boxH, "width", "height",
          `box outer ${boxW} = opening ${carcassW} − ${2 * p.drawerSideClear} slides · panel = ${boxW} − ${2 * t}`, 2);
        add("Drawer bottom", fbW, p.drawerBoxDepth - 2 * t, "width", "depth",
          `inside the box: ${fbW} × (${p.drawerBoxDepth} − ${2 * t})`, 1);
      }
    });
    [...dmap.values()].forEach((x) => parts.push(x));
  } else if (cab.type === "stove") {
    const drawerH = cab.falseFront ? p.falseFrontH + 2 : 0;
    const lowerH = round1(frontH - drawerH);
    if (cab.falseFront) {
      parts.push({ part: "False drawer front", qty: 1, a: doorTotal, b: p.falseFrontH, aLabel: "width", bLabel: "height",
        note: `top dummy drawer face · width = ${W} − ${p.doorReveal}` });
      faces.push({ x: rev, y: buildUp, w: doorTotal, h: p.falseFrontH, split: 1, kind: "drawer" });
    }
    if ((cab.front || "doors") === "doors") {
      parts.push({ part: "Door (pair)", qty: 2, a: round1((doorTotal - p.doorGap) / 2), b: lowerH, aLabel: "width", bLabel: "height",
        note: `each = (${W} − ${p.doorReveal} − ${p.doorGap} gap) ÷ 2 · height = ${frontH} − ${drawerH}${buildNote}` });
      const eachDoorW = round1((doorTotal - p.doorGap) / 2);
      faces.push({ x: rev, y: drawerH + buildUp, w: eachDoorW, h: lowerH, split: 1, kind: "door" });
      faces.push({ x: rev + eachDoorW + p.doorGap, y: drawerH + buildUp, w: eachDoorW, h: lowerH, split: 1, kind: "door" });
    } else {
      parts.push({ part: "False front", qty: 1, a: doorTotal, b: lowerH, aLabel: "width", bLabel: "height",
        note: `full lower panel · height = ${frontH} − ${drawerH}${buildNote}` });
      faces.push({ x: rev, y: drawerH + buildUp, w: doorTotal, h: lowerH, split: 1, kind: "false" });
    }
  } else if (cab.type === "sink") {
    if (cab.falseFront) {
      parts.push({ part: "False drawer front", qty: 1, a: doorTotal, b: p.falseFrontH, aLabel: "width", bLabel: "height",
        note: `top dummy drawer face (no working drawer over basin) · width = ${W} − ${p.doorReveal}` });
      faces.push({ x: rev, y: buildUp, w: doorTotal, h: p.falseFrontH, split: 1, kind: "drawer" });
    }
    const lowerY = cab.falseFront ? p.falseFrontH + 2 : 0;
    const lowerH = round1(frontH - lowerY);
    parts.push({ part: "Door (pair)", qty: 2, a: round1((doorTotal - p.doorGap) / 2), b: lowerH, aLabel: "width", bLabel: "height",
      note: `each = (${W} − ${p.doorReveal} − ${p.doorGap} gap) ÷ 2 · height = ${frontH} − ${lowerY}${buildNote}` });
    const eachDoorW = round1((doorTotal - p.doorGap) / 2);
    faces.push({ x: rev, y: lowerY + buildUp, w: eachDoorW, h: lowerH, split: 1, kind: "door" });
    faces.push({ x: rev + eachDoorW + p.doorGap, y: lowerY + buildUp, w: eachDoorW, h: lowerH, split: 1, kind: "door" });
  } else if (cab.type === "corner") {
    const doorOnLeft = (cab.cornerSide || "left") === "left";
    const stileW = p.cornerStileW || 100;
    // user-set blind panel width, clamped so the door keeps a usable width
    const maxBlind = round1(doorTotal - p.doorGap - 120);
    const req = (cab.blindW != null && cab.blindW !== "") ? Number(cab.blindW) : (p.cornerBlindW || 200);
    const blindW = round1(Math.max(40, Math.min(req, Math.max(40, maxBlind))));
    const innerW = W - 2 * t;
    const dW = round1(innerW - blindW - 1);
    parts.push({ part: "Door", qty: 1, a: dW, b: frontH, aLabel: "width", bLabel: "height",
      note: `corner door (${doorOnLeft ? "left side" : "right side"}) · width = ${innerW} − ${blindW} blind − 1mm clearance${buildNote}` });
    parts.push({ part: "Blind / filler panel", qty: 1, a: blindW, b: round1(p.doorH - t), aLabel: "width", bLabel: "height",
      note: `covers the dead corner (${doorOnLeft ? "right side" : "left side"}) · width set to ${blindW} · height = ${p.doorH} − ${t} (bottom panel)` });
    parts.push({ part: "Hinge stile / rail", qty: 1, a: stileW, b: round1(p.sideH - 2 * t), aLabel: "depth", bLabel: "height",
      note: `vertical, fixed 90° · between bottom and top rail · height = ${p.sideH} − ${2 * t} · door hinges screw to it` });
    if (doorOnLeft) {
      faces.push({ x: rev, y: buildUp, w: dW, h: frontH, split: 1, kind: "door", hinge: "right" });
      faces.push({ x: rev + dW + p.doorGap, y: buildUp, w: blindW, h: frontH, split: 1, kind: "blind" });
    } else {
      faces.push({ x: rev, y: buildUp, w: blindW, h: frontH, split: 1, kind: "blind" });
      faces.push({ x: rev + blindW + p.doorGap, y: buildUp, w: dW, h: frontH, split: 1, kind: "door", hinge: "left" });
    }
  } else if (cab.type === "filler") {
    // Filler piece: plain single panel — completely independent of cabinet logic
    const fW = parseFloat(cab.fillerW) || W || 100;
    const fH = parseFloat(cab.fillerH) || 786;
    const fT = parseFloat(cab.fillerT) || p.t || 18;
    const L = Math.max(fW, fH), A = Math.min(fW, fH);
    parts.push({ part: "Filler", qty: 1, a: L, b: A, t: fT, aLabel: "width", bLabel: "height",
      note: `filler piece · ${fW} × ${fH} × ${fT}mm · edge band all 4 edges` });
  } else if (cab.type === "wall" || cab.type === "deepwall") {
    // wall cabinet - depth and height configurable for deepwall
    const wallDepth = (cab.type === "deepwall" && cab.customDepth) ? parseFloat(cab.customDepth) : (cab.type === "wall" ? 305 : p.sideD);
    const wallH = (cab.type === "deepwall" && cab.customHeight) ? parseFloat(cab.customHeight) : p.sideH;
    const wallBottomDepth = wallDepth;
    parts.length = 0;
    const wallBackH = (thinBack ? wallH - 2 * t + 2 * grooveDepth : wallH - 2 * t);
    parts.push(
      { part: "Side", qty: 2, a: wallDepth, b: wallH, aLabel: "depth", bLabel: "height",
        note: `Fixed (${wallDepth}mm depth)` },
      { part: "Top", qty: 1, a: carcassW, b: wallBottomDepth, aLabel: "width", bLabel: "depth",
        note: `width = ${W} − ${2 * t} · depth = ${wallDepth} (full)` },
      { part: "Bottom", qty: 1, a: carcassW, b: wallBottomDepth, aLabel: "width", bLabel: "depth",
        note: `width = ${W} − ${2 * t} · depth = ${wallDepth} (full)` },
      { part: "Rail / Support", qty: 1, a: carcassW, b: p.railH, aLabel: "length", bLabel: "height",
        note: `length = ${W} − ${2 * t} · at top for wall mounting` },
      { part: thinBack ? `Back — ${backThick} mm hardboard` : "Back", qty: 1, a: thinBack ? hardBackW : backW, b: wallBackH,
        aLabel: "width", bLabel: "height", material: thinBack ? "hardboard" : "melamine",
        note: `${thinBack ? `width ${hardBackW} = ${W} − ${2 * t} + 2×${grooveDepth} groove (sits in grooves all round)` : (p.backBetween ? `width = ${W} − ${2 * t}` : "full width")} · height ${wallBackH}` }
    );
    // Shelves / separator
    const isLiftUp = cab.hingeType === "lift-up";
    if (isLiftUp) {
      // Lift-up flap: no movable shelves. With two stacked flaps a FIXED
      // separator is required — same size as the top, centre hinges screw to it.
      if (cab.doorCount === 2) {
        parts.push({ part: "Separator (fixed)", qty: 1, a: carcassW, b: wallBottomDepth,
          aLabel: "width", bLabel: "depth",
          note: `fixed horizontal divider — same size as top · centre hinges screw into it (not removable) · width = ${W} − ${2 * t} · depth = 305 (full)` });
      }
    } else if (cab.shelfQty > 0) {
      parts.push({ part: "Shelf", qty: cab.shelfQty, a: carcassW - p.shelfClearance, b: wallBottomDepth - p.shelfSetback,
        aLabel: "width", bLabel: "depth",
        note: `removable · width ${W - 2 * t - p.shelfClearance} × depth ${wallBottomDepth - p.shelfSetback}` });
    }
    // Doors. A lift-up flap folds upward. One flap covers the full opening;
    // two flaps stack vertically with the fixed separator between them.
    const isLU = cab.hingeType === "lift-up";
    // Wall cabinet doors: full height, no top/bottom gap
    const wallDoorH = wallH;
    if (cab.doorCount === 1) {
      parts.push({ part: "Door", qty: 1, a: doorTotal, b: wallDoorH, aLabel: "width", bLabel: "height",
        note: isLU
          ? `width = ${W} − ${p.doorReveal} · full-height lift-up flap (folds upward)`
          : `width = ${W} − ${p.doorReveal} · height = ${wallDoorH} (full, no top/bottom gap)` });
      faces.push({ x: rev, y: 0, w: doorTotal, h: wallDoorH, split: 1, kind: "door" });
    }
    else if (cab.doorCount === 2) {
      if (isLU) {
        const eachH = round1((wallDoorH - p.doorGap) / 2);
        parts.push({ part: "Door (flap, stacked)", qty: 2, a: doorTotal, b: eachH, aLabel: "width", bLabel: "height",
          note: `full width · each = (${fmt(wallDoorH)} − ${p.doorGap} gap) ÷ 2 · lift-up flaps fold upward` });
        faces.push({ x: rev, y: 0, w: doorTotal, h: eachH, split: 1, kind: "door" });
        faces.push({ x: rev, y: eachH + p.doorGap, w: doorTotal, h: eachH, split: 1, kind: "door" });
      } else {
        const eachDoorW = round1((doorTotal - p.doorGap) / 2);
        parts.push({ part: "Door (pair)", qty: 2, a: eachDoorW, b: wallDoorH, aLabel: "width", bLabel: "height",
          note: `each = (${W} − ${p.doorReveal} − ${p.doorGap} gap) ÷ 2 · height = ${wallDoorH} (full, no top/bottom gap)` });
        faces.push({ x: rev, y: 0, w: eachDoorW, h: wallDoorH, split: 1, kind: "door" });
        faces.push({ x: rev + eachDoorW + p.doorGap, y: 0, w: eachDoorW, h: wallDoorH, split: 1, kind: "door" });
      }
    }
  } else {
    // base
    if (cab.doorCount === 1) { door(1); faces.push({ x: rev, y: buildUp, w: doorTotal, h: doorH_calc, split: 1, kind: "door" }); }
    else if (cab.doorCount === 2) { 
      door(2);
      const eachDoorW = round1((doorTotal - p.doorGap) / 2);
      faces.push({ x: rev, y: buildUp, w: eachDoorW, h: doorH_calc, split: 1, kind: "door" }); 
      faces.push({ x: rev + eachDoorW + p.doorGap, y: buildUp, w: eachDoorW, h: doorH_calc, split: 1, kind: "door" }); 
    }
  }

  let area = 0, pieces = 0, hbArea = 0, hbPieces = 0;
  parts.forEach((x) => {
    const fa = (x.a / 1000) * (x.b / 1000) * x.qty;
    if (x.material === "hardboard") { hbArea += fa; hbPieces += x.qty; }
    else { area += fa; pieces += x.qty; }
  });

  // Hardware tally
  const shelfPins = cab.shelfQty > 0 ? cab.shelfQty * 4 : 0;
  const hinges = (cab.type !== "drawers" && cab.doorCount > 0) ? cab.doorCount * 2 : 0;
  const drawerSlides = cab.type === "drawers" ? (cab.drawerCount || 3) : 0;
  const handles = ((cab.type !== "drawers" && cab.doorCount > 0) ? cab.doorCount : 0) + (cab.type === "drawers" ? (cab.drawerCount || 3) : 0);
  const hardware = { shelfPins, hinges, drawerSlides, handles };

  // Fabrication notes: edge banding on visible parts, back groove (thin hardboard
  // option) positioned by melamine thickness, and shelf-pin drilling on sides.
  const bandAll = new Set(["Door", "Door (pair)", "Door (flap, stacked)", "False front", "False drawer front", "Drawer front", "Blind / filler panel"]);
  const bandFront = new Set(["Side", "Top", "Bottom", "Shelf", "Separator (fixed)"]);
  parts.forEach((x) => {
    const add = [];
    if (bandAll.has(x.part)) add.push("edge band all 4 edges");
    else if (bandFront.has(x.part)) add.push("edge band front edge");
    const grooveEdges = isWall ? ["Side", "Top", "Bottom"] : ["Side", "Bottom"];
    if (thinBack && grooveEdges.includes(x.part)) add.push(`back groove ${p.t}mm from back edge (${grooveDepth}mm wide × ${grooveDepth}mm deep)`);
    if (cab.shelfQty > 0 && x.part === "Side") add.push("drill shelf pin holes (inner face)");
    if (add.length) x.note = x.note ? `${x.note} · ${add.join(" · ")}` : add.join(" · ");
  });

  return { parts, area, pieces, hbArea, hbPieces, faces, hardware };
}

/* ----------------------- board estimate --------------------------- */
function estimateBoards(items, p) {
  const BW = p.boardW, BH = p.boardH, k = p.kerf, rot = p.allowRotate;
  let oversize = 0;
  const parts = [];
  items.forEach((it) => {
    const w = it.w + k, h = it.h + k;
    const fits = (w <= BW && h <= BH) || (rot && h <= BW && w <= BH);
    if (!fits) { oversize++; return; }
    parts.push({ w, h });
  });
  parts.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const orientations = (pp) => {
    const o = [{ w: pp.w, h: pp.h }];
    if (rot) o.push({ w: pp.h, h: pp.w });
    return o.filter((d) => d.w <= BW && d.h <= BH);
  };
  const boards = [];
  const placeOnBoard = (b, pp) => {
    const os = orientations(pp);
    for (const d of os)
      for (const sh of b.shelves)
        if (d.h <= sh.height && sh.usedW + d.w <= BW) { sh.usedW += d.w; return true; }
    let best = null;
    for (const d of os)
      if (d.w <= BW && b.usedH + d.h <= BH && (!best || d.h < best.h)) best = d;
    if (best) { b.shelves.push({ height: best.h, usedW: best.w }); b.usedH += best.h; return true; }
    return false;
  };
  parts.forEach((pp) => {
    for (const b of boards) if (placeOnBoard(b, pp)) return;
    const b = { shelves: [], usedH: 0 };
    boards.push(b);
    placeOnBoard(b, pp);
  });
  const used = items.reduce((s, it) => s + it.w * it.h, 0);
  const total = boards.length * BW * BH;
  return { boards: boards.length, oversize, utilization: total ? used / total : 0 };
}

/* ----------------------------- Diagram ---------------------------- */
function Elevation({ W, p, shelfQty, faces }) {
  const t = p.t, H = p.sideH;
  const padX = Math.max(120, W * 0.22), padTop = 60, padBot = 150;
  const vbW = W + padX * 2, vbH = H + padTop + padBot;
  const ox = padX, oy = padTop;
  const fs = Math.max(vbW / 34, 26);
  const openTop = oy + p.railH, openBot = oy + H - t;
  const dash = `${fs * 0.7} ${fs * 0.45}`;

  const tick = (x, y) => {
    const s = fs * 0.5;
    return <line x1={x - s} y1={y - s} x2={x + s} y2={y + s} stroke={getColors().amber} strokeWidth={fs * 0.07} />;
  };
  const shelves = [];
  for (let i = 1; i <= shelfQty; i++) {
    const y = openTop + ((openBot - openTop) * i) / (shelfQty + 1);
    shelves.push(<rect key={i} x={ox + t} y={y - t / 2} width={W - 2 * t} height={t}
      fill={getColors().panel} stroke={getColors().panelEdge} strokeWidth="1.5" />);
  }

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", borderRadius: 10, minWidth: 0, maxWidth: "100%" }} role="img"
      aria-label={`Front elevation of a ${W} mm cabinet`}>
      <rect x="0" y="0" width={vbW} height={vbH} fill={getColors().mat} />
      <defs>
        <pattern id="g" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" fill="none" stroke={getColors().matLine} strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={vbW} height={vbH} fill="url(#g)" />
      <rect x={ox + t} y={openTop} width={W - 2 * t} height={openBot - openTop} fill="rgba(216,208,189,0.06)" />
      <g className="cab-panels">
        <rect x={ox} y={oy} width={t} height={H} fill={getColors().panel} stroke={getColors().panelEdge} strokeWidth="1.5" />
        <rect x={ox + W - t} y={oy} width={t} height={H} fill={getColors().panel} stroke={getColors().panelEdge} strokeWidth="1.5" />
        <rect x={ox + t} y={oy + H - t} width={W - 2 * t} height={t} fill={getColors().panel} stroke={getColors().panelEdge} strokeWidth="1.5" />
        <rect x={ox + t} y={oy} width={W - 2 * t} height={p.railH} fill={getColors().panel} stroke={getColors().panelEdge} strokeWidth="1.5" />
        {shelves}
      </g>

      {/* front faces */}
      {faces.map((f, i) => (
        <g key={i}>
          <rect x={ox + f.x} y={oy + f.y} width={f.w} height={f.h} fill={f.kind === "blind" ? "rgba(194,70,40,0.08)" : "none"}
            stroke={f.kind === "blind" ? getColors().rust : getColors().amber} strokeWidth={fs * 0.09} strokeDasharray={dash} />
          {f.split === 2 && (
            <line x1={ox + f.x + f.w / 2} y1={oy + f.y} x2={ox + f.x + f.w / 2} y2={oy + f.y + f.h}
              stroke={getColors().amber} strokeWidth={fs * 0.09} strokeDasharray={dash} />
          )}
          {f.kind === "door" && (
            <circle cx={ox + f.x + (f.split === 2 ? f.w / 2 - 36 : f.w - 40)} cy={oy + f.y + f.h * 0.5} r={fs * 0.18} fill={getColors().amber} />
          )}
        </g>
      ))}

      {/* width dim */}
      <line x1={ox} y1={oy + H + 70} x2={ox + W} y2={oy + H + 70} stroke={getColors().amber} strokeWidth={fs * 0.06} />
      <line x1={ox} y1={oy + H} x2={ox} y2={oy + H + 86} stroke={getColors().amber} strokeWidth={fs * 0.05} opacity="0.7" />
      <line x1={ox + W} y1={oy + H} x2={ox + W} y2={oy + H + 86} stroke={getColors().amber} strokeWidth={fs * 0.05} opacity="0.7" />
      {tick(ox, oy + H + 70)}{tick(ox + W, oy + H + 70)}
      <text x={ox + W / 2} y={oy + H + 70 + fs * 1.5} fill={getColors().amber} fontSize={fs} textAnchor="middle"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{W} mm</text>
      {/* height dim */}
      <line x1={ox - 70} y1={oy} x2={ox - 70} y2={oy + H} stroke={getColors().amber} strokeWidth={fs * 0.06} />
      <line x1={ox - 86} y1={oy} x2={ox} y2={oy} stroke={getColors().amber} strokeWidth={fs * 0.05} opacity="0.7" />
      <line x1={ox - 86} y1={oy + H} x2={ox} y2={oy + H} stroke={getColors().amber} strokeWidth={fs * 0.05} opacity="0.7" />
      {tick(ox - 70, oy)}{tick(ox - 70, oy + H)}
      <text x={ox - 70 - fs * 0.7} y={oy + H / 2} fill={getColors().amber} fontSize={fs} textAnchor="middle"
        transform={`rotate(-90 ${ox - 70 - fs * 0.7} ${oy + H / 2})`}
        style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{H} mm</text>
      <line x1={ox + t} y1={oy - 34} x2={ox + W - t} y2={oy - 34} stroke="#EDEDE6" strokeWidth={fs * 0.045} opacity="0.65" />
      <text x={ox + W / 2} y={oy - 44} fill="#EDEDE6" fontSize={fs * 0.78} textAnchor="middle" opacity="0.75"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}>opening {W - 2 * t}</text>
    </svg>

  );
}

/* ------------------------------ fields ---------------------------- */
function NumField({ label, value, onChange, suffix = "mm", w = 92 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: getColors().mut,
        fontFamily: "'Archivo', sans-serif", fontWeight: 600 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: w, padding: "7px 9px", border: `1px solid ${getColors().hair}`, borderRadius: 7,
            background: "#fff", color: "#111", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 500, fontSize: 15, outline: "none" }} />
        {suffix && <span style={{ fontSize: 12, color: getColors().mut, fontFamily: "'JetBrains Mono', monospace" }}>{suffix}</span>}
      </span>
    </label>
  );
}

const labelCss = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: getColors().mut, fontWeight: 600 };
const navMini = (off) => ({ padding: 0, width: 22, minWidth: 22, border: `1px solid ${getColors().hair}`,
  borderRadius: 5, background: getColors().card, color: off ? getColors().hair : getColors().mut, fontSize: 10, lineHeight: 1,
  cursor: off ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" });
const btn = (bg, color, border) => ({ padding: "8px 14px", background: bg, color, border, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Archivo', sans-serif" });
const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const selCss = { padding: "9px 9px", border: `1px solid ${getColors().hair}`, borderRadius: 7, background: "#fff",
  fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#111" };

/* --------------------------- cabinet card ------------------------- */
/* Copy text to the clipboard with fallbacks. Returns true on success.
   Tries the async Clipboard API, then execCommand; if both are blocked
   (e.g. a sandboxed frame) returns false so the caller can show the text. */
/* Save/share a generated PDF blob. On iOS/Android the native share sheet
   (Save to Files, AirDrop, Mail…) is the only reliable path, since Safari
   ignores <a download>. Must be called inside the tap, with no await before
   it, or iOS blocks it. Falls back to an anchor download on desktop. */
function sharePdf(blob, fname) {
  try {
    const file = new File([blob], fname, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: fname }).catch(() => {});
      return true;
    }
  } catch (e) { /* fall through to download */ }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (e) { return false; }
}

async function writeClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

/* Auto-name a cabinet from its options, e.g. "1 Base cabinet 600mm". */
function cabLabel(cab, idx, t) {
  const W = parseFloat(cab.width);
  const w = (!isNaN(W) && W > 0) ? ` ${fmt(W)}mm` : "";
  const label = (TYPES[cab.type] && TYPES[cab.type].label) || "Cabinet";
  const qty = cab.qty && cab.qty > 1 ? ` ×${cab.qty}` : "";
  return `${idx + 1} ${t ? t(label) : label}${w}${qty}`;
}

/* Translate a part name (handles the dynamic "Back — Xmm hardboard"). */
function tName(name, t) {
  const m = /^Back — (.+)$/.exec(name);
  if (m) return `${t("Back")} — ${m[1]}`;
  return t(name);
}

/* Phrase-level translator for the freeform part notes. Leaves numbers and
   symbols intact; only swaps the recurring English vocabulary. */
const NOTE_ES = [
  ["front rail", "riel frontal"],
  ["back rail", "riel trasero"],
  ["base build-up", "refuerzo base"],
  ["vertical, fixed 90°", "vertical, fija a 90°"],
  ["between bottom and top rail", "entre el fondo y el riel superior"],
  ["door hinges screw to it", "las bisagras de la puerta se atornillan a él"],
  ["corner door", "puerta de esquina"],
  ["left side", "lado izquierdo"], ["right side", "lado derecho"],
  ["width set to", "ancho fijado a"],
  ["edge band all 4 edges", "cantear los 4 cantos"],
  ["edge band front edge", "cantear el canto frontal"],
  ["drill shelf pin holes (inner face)", "perforar agujeros para soportes (cara interior)"],
  ["back groove", "ranura para el trasero"],
  ["from back edge", "desde el canto trasero"],
  ["rout groove on back edge", "ranura fresada en el canto trasero"],
  ["rout groove", "ranura fresada"],
  ["at top for wall mounting", "arriba, para montaje en pared"],
  ["centre hinges screw into it (not removable)", "las bisagras centrales se atornillan a él (no removible)"],
  ["centre hinges screw into it", "las bisagras centrales se atornillan a él"],
  ["fixed horizontal divider — same size as top", "divisor horizontal fijo — mismo tamaño que la tapa"],
  ["same size as top", "mismo tamaño que la tapa"],
  ["full-height lift-up flap (folds upward)", "abatible de altura completa (se pliega hacia arriba)"],
  ["lift-up flaps fold upward", "las abatibles se pliegan hacia arriba"],
  ["folds upward", "se pliega hacia arriba"],
  ["not removable", "no removible"],
  ["sits in grooves, attached to top rail", "encaja en ranuras, fijada al riel superior"],
  ["sits in grooves on sides", "encaja en las ranuras de los lados"],
  ["separate hardboard sheet", "hoja de hardboard aparte"],
  ["no working drawer over basin", "sin gaveta funcional sobre el fregadero"],
  ["top dummy drawer face", "frente de gaveta simulado superior"],
  ["covers the dead corner", "cubre la esquina muerta"],
  ["full lower panel", "panel inferior completo"],
  ["Fixed (305mm depth)", "Fija (prof. 305mm)"],
  ["Fixed size", "Medida fija"],
  ["full width", "ancho completo"],
  ["removable", "removible"],
  ["easy fit", "ajuste holgado"],
  ["setback", "retroceso"],
  ["on bottom", "sobre el fondo"],
  ["behind bottom", "detrás del fondo"],
  ["deep", "profundo"],
  ["wide", "de ancho"],
  ["gap", "huelgo"],
  ["blind", "ciego"],
  ["each", "c/u"],
  ["back", "espalda"],
  ["width", "ancho"], ["depth", "profundidad"], ["height", "alto"], ["length", "largo"],
];
function trNote(note, lang) {
  if (lang !== "es" || !note) return note;
  let s = note;
  for (const [en, es] of NOTE_ES) s = s.split(en).join(es);
  return s;
}

function CabinetCard({ cab, index, t, lang, onChange, onRemove, canRemove }) {
  const p = cab.params || DEFAULTS;
  const W = parseFloat(cab.width);
  const valid = !isNaN(W) && W > 2 * p.t + 10;
  const data = valid ? buildCutList(W, p, cab) : null;
  const [pinsOpen, setPinsOpen] = useState(false);

  const pickType = (e) => {
    const k = e.target.value, s = TYPES[k].set;
    const patch = { type: k, ...s };
    if (k === "drawers") {
      patch.drawerHeights = splitHeights(p.doorH, s.drawerCount, p.doorGap);
      patch.doorCount = 0;
    }
    onChange(patch);
  };
  const setDrawerCount = (c) => onChange({ drawerCount: c, drawerHeights: splitHeights(p.doorH, c, p.doorGap) });
  const setDrawerHeight = (i, v) => {
    const arr = ((cab.drawerHeights && cab.drawerHeights.length > 0) ? cab.drawerHeights : splitHeights(p.doorH, cab.drawerCount || 3, p.doorGap)).slice();
    const newH = v === "" ? 0 : Math.max(0, Number(v) || 0);
    arr[i] = newH;
    // Auto-calculate: drawers AFTER the one you edited split the remaining space.
    // Drawers BEFORE it keep the heights you already set.
    const gap = p.doorGap || 3;
    const bUp = (cab.type === "wall") ? 0 : (p.baseBuildUp != null ? p.baseBuildUp : 0);
    const totalH = p.doorH - bUp - (arr.length - 1) * gap;
    const usedByPrev = arr.slice(0, i + 1).reduce((s, h) => s + h, 0);
    const after = arr.length - (i + 1);
    if (after > 0) {
      const remaining = Math.max(0, totalH - usedByPrev);
      const each = Math.floor(remaining / after);
      for (let idx = i + 1; idx < arr.length; idx++) {
        arr[idx] = (idx === arr.length - 1) ? remaining - each * (after - 1) : each;
      }
    }
    onChange({ drawerHeights: arr });
  };
  const buildUp = cab.type === "wall" ? 0 : (p.baseBuildUp ?? 0);
  const effectiveDoorH = p.doorH - buildUp;
  const heights = (cab.drawerHeights && cab.drawerHeights.length > 0) ? cab.drawerHeights : splitHeights(effectiveDoorH, cab.drawerCount || 3, p.doorGap);

  // When base build-up (or door height) changes, rescale existing drawer heights
  // proportionally so the fronts keep filling the opening exactly.
  // Depends ONLY on effectiveDoorH — never on drawerHeights — so it cannot fight typing.
  const prevEffH = useRef(effectiveDoorH);
  useEffect(() => {
    if (prevEffH.current === effectiveDoorH) return;
    prevEffH.current = effectiveDoorH;
    if (cab.type !== "drawers") return;
    if (!cab.drawerHeights || !cab.drawerHeights.length) return;
    const n = cab.drawerHeights.length;
    const target = effectiveDoorH - (n - 1) * (p.doorGap || 3);
    const oldSum = cab.drawerHeights.reduce((a, b) => a + b, 0);
    if (oldSum <= 0 || target <= 0) return;
    const scaled = cab.drawerHeights.map((h) => Math.floor((h * target) / oldSum));
    scaled[n - 1] += target - scaled.reduce((a, b) => a + b, 0);
    onChange({ drawerHeights: scaled });
  }, [effectiveDoorH]);

  const [cabPickerOpen, setCabPickerOpen] = React.useState(false);

  return (
    <div className="cab-card" style={{ background: getColors().card, border: `1px solid ${getColors().hair}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 17, color: getColors().ink,
          fontFamily: "'Archivo', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cabLabel(cab, index, t)}
        </div>
        {canRemove && (
          <button className="cab-noprint" onClick={onRemove}
            style={{ border: `1px solid ${getColors().hair}`, background: "transparent", color: getColors().rust, borderRadius: 7,
              padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{t("Remove")}</button>
        )}
      </div>

      <label className="cab-noprint" style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
        <span style={labelCss}>{t("Cabinet type")}</span>
        <select value={cab.type} onChange={pickType}
          style={{ padding: "10px 11px", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8, background: "#fff",
            fontFamily: "'Archivo', sans-serif", fontWeight: 700, fontSize: 15, color: "#111" }}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
        </select>
      </label>

      {/* Material selector */}
      <div className="cab-noprint" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: getColors().mut, whiteSpace: "nowrap" }}>{t("Material")}:</span>
          <input value={cab.material || ""} onChange={e => onChange({ material: e.target.value })}
            placeholder="—"
            style={{ border: `1px solid ${getColors().hair}`, borderRadius: 6, padding: "6px 10px", fontSize: 13,
              fontWeight: 600, width: 200, background: "#fff", color: "#111", outline: "none" }} />
        </label>
        <button onClick={() => setCabPickerOpen(true)}
          style={{ padding: "5px 12px", background: getColors().buttonBg, color: getColors().buttonText, border: "none",
            borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
          🎨 {t("Select")}
        </button>
      </div>
      {cabPickerOpen && (
        <MaterialPicker
          customMaterials={(() => { try { return JSON.parse(localStorage.getItem("customMaterials") || "[]"); } catch { return []; } })()}
          onClose={() => setCabPickerOpen(false)}
          onSelect={(val) => { onChange({ material: val }); setCabPickerOpen(false); }}
        />
      )}

      {cab.type === "filler" && (
        <div className="cab-noprint">
          <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "12px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Plain panel — no construction, just dimensions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>{t("Height")} (mm)</span>
                <input type="number" value={cab.fillerH || ""} onChange={e => onChange({ fillerH: e.target.value })}
                  placeholder="786"
                  style={{ width: 90, padding: "7px 10px", fontSize: 18, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                    background: "#fff", color: "#111", outline: "none" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>{t("Width")} (mm)</span>
                <input type="number" value={cab.fillerW || ""} onChange={e => onChange({ fillerW: e.target.value })}
                  placeholder="100"
                  style={{ width: 90, padding: "7px 10px", fontSize: 18, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                    background: "#fff", color: "#111", outline: "none" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>Thickness (mm)</span>
                <input type="number" value={cab.fillerT || ""} onChange={e => onChange({ fillerT: e.target.value })}
                  placeholder="18"
                  style={{ width: 80, padding: "7px 10px", fontSize: 18, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                    background: "#fff", color: "#111", outline: "none" }} />
              </label>
            </div>
          </div>
          <div style={{ border: `1px solid ${getColors().hair}`, borderRadius: 10, overflow: "hidden", background: "#fff", marginBottom: 12 }}>
            <div style={{ padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  <span style={{ color: getColors().rust, fontFamily: "'JetBrains Mono', monospace" }}>{cab.qty || 1}×</span> Filler
                </div>
                <div style={{ fontSize: 11, color: getColors().mut, marginTop: 2 }}>
                  height = {cab.fillerH || 786}mm · width = {cab.fillerW || "?"}mm · thickness = {cab.fillerT || 18}mm · edge band all 4 edges
                </div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15.5 }}>
                  {Math.max(Number(cab.fillerH) || 786, Number(cab.fillerW) || 0)} × {Math.min(Number(cab.fillerH) || 786, Number(cab.fillerW) || 0)}
                </div>
                <div style={{ fontSize: 10, color: getColors().mut }}>height × width</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="cab-printonly" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: getColors().mut, marginBottom: 10 }}>
        {TYPES[cab.type] ? t(TYPES[cab.type].label) : t("Cabinet")} · {fmt(W)} mm {t("wide")}
      </div>

      {cab.type !== "filler" && <div className="cab-noprint" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ ...labelCss, color: getColors().mut }}>{t("Width")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexDirection: "column" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="number" value={cab.width} onChange={(e) => onChange({ width: e.target.value })}
                style={{ width: 110, padding: "8px 11px", fontSize: 22, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                  background: "#fff", color: "#111", outline: "none" }} />
              <span style={{ fontSize: 13, color: getColors().mut, fontFamily: "'JetBrains Mono', monospace" }}>mm</span>
            </span>
          </span>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={labelCss}>{t("Qty")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="number" min="1" max="99" value={cab.qty || 1}
              onChange={(e) => onChange({ qty: Math.max(1, Number(e.target.value)) })}
              style={{ width: 64, padding: "8px 11px", fontSize: 22, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`,
                borderRadius: 8, background: "#fff", color: "#111", outline: "none" }} />
          </span>
        </label>

        {cab.type === "base" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={labelCss}>{t("Doors")}</span>
            <select value={cab.doorCount} onChange={(e) => onChange({ doorCount: Number(e.target.value) })} style={selCss}>
              <option value={0}>{t("No doors")}</option>
              <option value={1}>{t("1 door")}</option>
              <option value={2}>{t("2 doors")}</option>
            </select>
          </label>
        )}

        {cab.type === "corner" && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={labelCss}>{t("Door side")}</span>
              <select value={cab.cornerSide || "left"} onChange={(e) => onChange({ cornerSide: e.target.value })} style={selCss}>
                <option value="left">{t("Left")}</option>
                <option value="right">{t("Right")}</option>
              </select>
            </label>
            <NumField label={t("Blind panel W")} value={cab.blindW != null ? cab.blindW : (p.cornerBlindW || 200)}
              onChange={(v) => onChange({ blindW: v === "" ? "" : Math.max(0, Number(v) || 0) })} />
          </>
        )}

        {cab.type === "drawers" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={labelCss}>{t("Drawers")}</span>
            <select value={cab.drawerCount || 3} onChange={(e) => setDrawerCount(Number(e.target.value))} style={selCss}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {t(n > 1 ? "drawers" : "drawer")}</option>)}
            </select>
          </label>
        )}

        {cab.type === "stove" && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={labelCss}>{t("Front")}</span>
              <select value={cab.front || "doors"} onChange={(e) => { const f = e.target.value; onChange({ front: f, doorCount: f === "doors" ? 2 : 0 }); }}
                style={{ ...selCss, fontFamily: "'Archivo', sans-serif", fontWeight: 700, color: getColors().ink }}>
                <option value="doors">{t("2 doors")}</option>
                <option value="falsefront">{t("False front")}</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: getColors().ink, paddingBottom: 6 }}>
              <input type="checkbox" checked={!!cab.falseFront} onChange={(e) => onChange({ falseFront: e.target.checked })} />
              {t("False drawer")}
            </label>
          </>
        )}

        {cab.type === "sink" && (
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: getColors().ink, paddingBottom: 6 }}>
            <input type="checkbox" checked={!!cab.falseFront} onChange={(e) => onChange({ falseFront: e.target.checked })} />
            {t("False drawer face")}
          </label>
        )}

        {(cab.type === "wall" || cab.type === "deepwall") && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={labelCss}>{t("Doors")}</span>
              <select value={cab.doorCount} onChange={(e) => onChange({ doorCount: Number(e.target.value) })} style={selCss}>
                <option value={0}>{t("No doors")}</option>
                <option value={1}>{t("1 door")}</option>
                <option value={2}>{t("2 doors")}</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={labelCss}>{t("Hinges")}</span>
              <select value={cab.hingeType || "concealed"} onChange={(e) => { const h = e.target.value; onChange({ hingeType: h, ...(h === "lift-up" ? { shelfQty: 0 } : {}) }); }} style={selCss}>
                <option value="concealed">{t("Concealed (European)")}</option>
                <option value="overlay">{t("Overlay")}</option>
                <option value="inset">{t("Inset")}</option>
                <option value="butt">{t("Butt")}</option>
                <option value="surface">{t("Surface-Mount")}</option>
                <option value="soft-close">{t("Soft-Close")}</option>
                <option value="lift-up">{t("Lift-Up / Flap")}</option>
              </select>
            </label>
          </>
        )}

        {cab.type === "deepwall" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={labelCss}>{t("Height")} (mm)</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="number" value={cab.customHeight || ""} onChange={e => onChange({ customHeight: e.target.value })}
                placeholder={String(p.sideH)}
                style={{ width: 80, padding: "8px 11px", fontSize: 18, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                  background: "#fff", color: "#111", outline: "none" }} />
              <span style={{ fontSize: 13, color: getColors().mut, fontFamily: "'JetBrains Mono', monospace" }}>mm</span>
            </span>
          </label>
        )}
        {cab.type === "deepwall" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={labelCss}>{t("Depth")} (mm)</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="number" value={cab.customDepth || ""} onChange={e => onChange({ customDepth: e.target.value })}
                placeholder={String(p.sideD)}
                style={{ width: 80, padding: "8px 11px", fontSize: 18, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                  background: "#fff", color: "#111", outline: "none" }} />
              <span style={{ fontSize: 13, color: getColors().mut, fontFamily: "'JetBrains Mono', monospace" }}>mm</span>
            </span>
          </label>
        )}
        {cab.type !== "drawers" && cab.type !== "filler" && !(cab.type === "wall" && cab.hingeType === "lift-up") && (
          <NumField label={t("Shelves")} value={cab.shelfQty} suffix="" w={64}
            onChange={(v) => onChange({ shelfQty: v === "" ? 0 : Math.max(0, Math.floor(Number(v) || 0)) })} />
        )}
      </div>}

      {/* per-drawer heights */}
      {cab.type === "drawers" && (
        <div className="cab-noprint" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          {heights.map((h, i) => (
            <NumField key={i} label={`Drawer ${i + 1} H`} value={h} onChange={(v) => setDrawerHeight(i, v)} w={78} />
          ))}
        </div>
      )}

      {!valid && cab.type !== "filler" && <div style={{ color: getColors().rust, fontSize: 13 }}>Enter a width over {2 * p.t + 10} mm.</div>}

      {data && cab.type !== "filler" && (
        <>
          <div className="cab-mat cab-noprint" style={{ marginBottom: 12, maxWidth: 380, width: "100%", minWidth: 0, overflow: "hidden" }}>
            <Elevation W={W} p={p} shelfQty={cab.shelfQty} faces={data.faces} />
          </div>
          <div style={{ border: `1px solid ${getColors().hair}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            {data.parts.map((x, i) => (
              <div key={i} className="cab-row" style={{ padding: "10px 13px", borderTop: i ? `1px solid ${getColors().hair}` : "none",
                display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    <span style={{ color: getColors().rust, fontFamily: "'JetBrains Mono', monospace" }}>{x.qty * (cab.qty || 1)}×</span> {tName(x.part, t)}
                  </div>
                  <div style={{ fontSize: 11, color: getColors().mut, marginTop: 2 }}>{trNote(x.note, lang)}</div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15.5 }}>{fmt(x.a)} × {fmt(x.b)}</div>
                  <div style={{ fontSize: 10, color: getColors().mut, letterSpacing: "0.04em" }}>{t(x.aLabel)} × {t(x.bLabel)}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: "10px 13px", borderTop: `2px solid ${getColors().ink}`, display: "flex",
              justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}>
              <span>{data.pieces + data.hbPieces} pieces</span><span>{data.area.toFixed(2)} m² melamine</span>
            </div>
          </div>

          {/* Hardware & holes */}
          {(data.hardware.shelfPins > 0 || data.hardware.hinges > 0 || data.hardware.drawerSlides > 0 || data.hardware.handles > 0) && (
            <div style={{ border: `1px solid ${getColors().hair}`, borderRadius: 10, overflow: "hidden", background: "#fff", marginTop: 12 }}>
              <div style={{ padding: "10px 13px", background: "rgba(224,161,26,0.06)", borderBottom: `1px solid ${getColors().hair}`, fontWeight: 700, fontSize: 13 }}>{t("Hardware & fasteners")}</div>
              {data.hardware.shelfPins > 0 && (
                <div style={{ padding: "10px 13px", borderBottom: `1px solid ${getColors().hair}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}><span style={{ color: getColors().rust, fontFamily: "'JetBrains Mono', monospace" }}>{data.hardware.shelfPins}</span> {t("Shelf pins")}</div>
                  <div style={{ fontSize: 11, color: getColors().mut, marginTop: 2 }}>{t("4 per shelf · 32mm spacing from")} {shelfPinHoles(p.sideH)[0]}mm</div>
                </div>
              )}
              {data.hardware.hinges > 0 && (
                <div style={{ padding: "10px 13px", borderBottom: `1px solid ${getColors().hair}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}><span style={{ color: getColors().rust, fontFamily: "'JetBrains Mono', monospace" }}>{data.hardware.hinges}</span> {t("Hinges")}</div>
                  <div style={{ fontSize: 11, color: getColors().mut, marginTop: 2 }}>{t("2 per door · 35mm cup hinges")}</div>
                </div>
              )}
              {data.hardware.drawerSlides > 0 && (
                <div style={{ padding: "10px 13px", borderBottom: `1px solid ${getColors().hair}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}><span style={{ color: getColors().rust, fontFamily: "'JetBrains Mono', monospace" }}>{data.hardware.drawerSlides}</span> {t("Drawer slide pairs")}</div>
                  <div style={{ fontSize: 11, color: getColors().mut, marginTop: 2 }}>{t("1 pair per drawer ·")} {p.drawerBoxDepth}mm {t("depth")}</div>
                </div>
              )}
              {data.hardware.handles > 0 && (
                <div style={{ padding: "10px 13px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}><span style={{ color: getColors().rust, fontFamily: "'JetBrains Mono', monospace" }}>{data.hardware.handles}</span> {t("Handles / knobs")}</div>
                  <div style={{ fontSize: 11, color: getColors().mut, marginTop: 2 }}>{t("1 per door & drawer")}</div>
                </div>
              )}
            </div>
          )}

          {/* Shelf hole positions — collapsed by default */}
          {cab.shelfQty > 0 && (
            <div style={{ background: "rgba(224,161,26,0.06)", border: `1px solid ${getColors().hair}`, borderRadius: 10, marginTop: 12, fontSize: 11 }}>
              <button onClick={() => setPinsOpen((o) => !o)} className="cab-noprint"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  background: "transparent", border: "none", cursor: "pointer", padding: "10px 13px",
                  fontWeight: 700, fontSize: 11, color: getColors().ink, fontFamily: "inherit", textAlign: "left" }}>
                <span>{t("Shelf pin hole positions (on each side)")}</span>
                <span aria-hidden style={{ display: "inline-block", transition: "transform .15s ease",
                  transform: pinsOpen ? "rotate(90deg)" : "rotate(0deg)", color: getColors().mut, fontSize: 13 }}>▸</span>
              </button>
              {pinsOpen && (
                <div style={{ padding: "0 13px 11px" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: getColors().mut, lineHeight: 1.6 }}>
                    {shelfPinHoles(p.sideH).map((y, i) => (
                      <div key={i}>{i + 1}: {y}mm from top</div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: getColors().mut, marginTop: 6 }}>{t("32mm spacing · drill 5mm diameter holes")}</div>
                </div>
              )}
            </div>
          )}

          {cab.type === "filler" && (<>
          <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "12px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>Plain panel — no construction, just dimensions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>{t("Height")} (mm)</span>
                <input type="number" value={cab.fillerH || ""} onChange={e => onChange({ fillerH: e.target.value })}
                  placeholder="786"
                  style={{ width: 90, padding: "7px 10px", fontSize: 18, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                    background: "#fff", color: "#111", outline: "none" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>{t("Width")} (mm)</span>
                <input type="number" value={cab.fillerW || ""} onChange={e => onChange({ fillerW: e.target.value })}
                  placeholder="100"
                  style={{ width: 90, padding: "7px 10px", fontSize: 18, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                    background: "#fff", color: "#111", outline: "none" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>Thickness (mm)</span>
                <input type="number" value={cab.fillerT || ""} onChange={e => onChange({ fillerT: e.target.value })}
                  placeholder="18"
                  style={{ width: 80, padding: "7px 10px", fontSize: 18, fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace", border: `1.5px solid ${getColors().canvasBorder}`, borderRadius: 8,
                    background: "#fff", color: "#111", outline: "none" }} />
              </label>
            </div>
          </div>
          <div style={{ border: `1px solid ${getColors().hair}`, borderRadius: 10, overflow: "hidden", background: "#fff", marginTop: 12 }}>
            <div style={{ padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  <span style={{ color: getColors().rust, fontFamily: "'JetBrains Mono', monospace" }}>{cab.qty || 1}×</span> Filler
                </div>
                <div style={{ fontSize: 11, color: getColors().mut, marginTop: 2 }}>
                  height = {cab.fillerH || 786}mm · width = {cab.fillerW || "?"}mm · thickness = {cab.fillerT || 18}mm · edge band all 4 edges
                </div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15.5 }}>
                  {Math.max(Number(cab.fillerH) || 786, Number(cab.fillerW) || 0)} × {Math.min(Number(cab.fillerH) || 786, Number(cab.fillerW) || 0)}
                </div>
                <div style={{ fontSize: 10, color: getColors().mut }}>height × width</div>
              </div>
            </div>
          </div>
        </>)}
        {cab.type === "corner" && (
            <div style={{ fontSize: 11.5, color: getColors().rust, marginTop: 8 }}>
              {t("Corner = blind-corner approximation (one door + a blind/filler panel). Tell me how you build corners to refine it.")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------- auth screens ----------------------------- */

function LoginScreen({ signupMode, setSignupMode, loginEmail, setLoginEmail, loginPassword, setLoginPassword, authError, setAuthError, handleLogin, handleSignup, loading }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (signupMode) handleSignup();
    else handleLogin();
  };

  return (
    <div style={{ minHeight: "100svh", background: getColors().paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Archivo', sans-serif", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 420, background: getColors().card, border: `1px solid ${getColors().hair}`, borderRadius: 18, padding: 36, boxShadow: "0 18px 50px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: getColors().rust, textAlign: "center" }}>
          Private · Invite only
        </div>
        <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.5px", textAlign: "center", marginTop: 3, color: getColors().ink }}>
          {signupMode ? "Create account" : "Welcome back"}
        </div>
        <div style={{ fontSize: 13, color: getColors().mut, textAlign: "center", marginTop: 8, marginBottom: 26 }}>
          {signupMode ? "Sign up for cabinet access" : "Log in to open your projects"}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>Email</label>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@email.com"
              style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>Password</label>
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••"
              style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
          </div>

          {authError && <div style={{ fontSize: 13, color: getColors().rust, marginBottom: 14, textAlign: "center" }}>{authError}</div>}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: 12, background: getColors().rust, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Please wait..." : (signupMode ? "Sign up" : "Log in")}
          </button>
        </form>

        <div style={{ textAlign: "center", color: getColors().mut, fontSize: 13, marginTop: 20 }}>
          {signupMode ? (
            <>
              Already have an account? <button onClick={() => { setSignupMode(false); setAuthError(""); }} style={{ background: "none", border: "none", color: "#ccc", fontWeight: 700, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>Log in</button>
            </>
          ) : (
            <>
              No account? <button onClick={() => { setSignupMode(true); setAuthError(""); }} style={{ background: "none", border: "none", color: "#ccc", fontWeight: 700, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>Request access</button>
            </>
          )}
        </div>

        {!signupMode && (
          <div style={{ marginTop: 20, background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, padding: "11px 13px", fontSize: 12, color: "#9a9ba2", textAlign: "center", lineHeight: 1.5 }}>
            New accounts are <strong style={{ color: "#ccc" }}>reviewed by the owner</strong> before access is granted.
          </div>
        )}
      </div>
    </div>
  );
}

function RecoveryScreen({ recoveryPassword, setRecoveryPassword, recoveryConfirm, setRecoveryConfirm, recoveryError, recoveryStatus, handleRecoverySubmit }) {
  const handleSubmit = (e) => { e.preventDefault(); handleRecoverySubmit(); };
  return (
    <div style={{ minHeight: "100svh", background: getColors().paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Archivo', sans-serif", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 420, background: getColors().card, border: `1px solid ${getColors().hair}`, borderRadius: 18, padding: 36, boxShadow: "0 18px 50px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: getColors().rust, textAlign: "center" }}>
          Password recovery
        </div>
        <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.5px", textAlign: "center", marginTop: 3, color: getColors().ink }}>
          Set a new password
        </div>
        <div style={{ fontSize: 13, color: getColors().mut, textAlign: "center", marginTop: 8, marginBottom: 26 }}>
          Choose a new password for your account.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>New password</label>
            <input type="password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} placeholder="••••••••"
              style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>Confirm new password</label>
            <input type="password" value={recoveryConfirm} onChange={(e) => setRecoveryConfirm(e.target.value)} placeholder="••••••••"
              style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
          </div>

          {recoveryError && <div style={{ fontSize: 13, color: getColors().rust, marginBottom: 14, textAlign: "center" }}>{recoveryError}</div>}
          {recoveryStatus === "success" && <div style={{ fontSize: 13, color: "#27ae60", marginBottom: 14, textAlign: "center" }}>Password updated ✓ Redirecting...</div>}

          <button type="submit" disabled={recoveryStatus === "saving"} style={{ width: "100%", padding: 12, background: getColors().rust, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: recoveryStatus === "saving" ? "not-allowed" : "pointer", opacity: recoveryStatus === "saving" ? 0.6 : 1 }}>
            {recoveryStatus === "saving" ? "Please wait..." : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PendingScreen({ authState, handleLogout, checkAuth }) {
  const [checking, setChecking] = useState(false);
  const onCheckAgain = async () => {
    setChecking(true);
    try { await checkAuth(); } finally { setChecking(false); }
  };
  return (
    <div style={{ minHeight: "100vh", background: getColors().paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Archivo', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 470, background: getColors().card, border: `1px solid ${getColors().hair}`, borderRadius: 18, padding: 40, textAlign: "center", boxShadow: "0 18px 50px rgba(0,0,0,0.1)" }}>
        <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#FCE7DE", margin: "0 auto 20px", lineHeight: "66px", fontSize: 30 }}>⏱</div>
        <div style={{ display: "inline-block", background: "#FCE7DE", color: getColors().rust, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 26 }}>
          Pending approval
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", marginBottom: 12, color: getColors().ink }}>
          You're on the list
        </div>
        <div style={{ color: getColors().mut, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Thanks for signing up. Your account is waiting for the owner to approve access — you'll be able to log in as soon as it's approved.
        </div>
        <div style={{ display: "inline-block", background: "#F2F2EF", border: `1px solid ${getColors().hair}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 700, fontFamily: "'Courier New', monospace", marginBottom: 24 }}>
          {authState?.user?.email}
        </div><br />
        <button onClick={onCheckAgain} disabled={checking} style={{ padding: "8px 16px", border: `1.5px solid ${getColors().canvasBorder}`, background: "transparent", color: getColors().ink, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: checking ? "not-allowed" : "pointer", marginRight: 8, opacity: checking ? 0.6 : 1 }}>
          {checking ? "Checking..." : "Check again"}
        </button>
        <button onClick={handleLogout} style={{ padding: "8px 16px", border: "none", background: "transparent", color: getColors().mut, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Log out
        </button>
      </div>
    </div>
  );
}

function AdminPanel({ pendingUsers, handleApprove, authState, handleLogout }) {
  const c = getColors();
  return (
    <div>
      {/* header */}
      <div style={{ marginBottom: 22, paddingBottom: 14, borderBottom: `1px solid ${c.canvasBorder}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: c.canvasMut, textTransform: "uppercase" }}>Admin panel</div>
        <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 4, color: c.canvasText }}>User management</div>
      </div>

      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ background: c.card, borderRadius: 14, padding: "18px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.mut, marginBottom: 10 }}>Pending</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: c.ink, fontFamily: "'JetBrains Mono', monospace" }}>{pendingUsers.length}</div>
          <div style={{ fontSize: 11, color: c.mut, marginTop: 4 }}>awaiting approval</div>
        </div>
        <div style={{ background: c.canvasBtn, border: `1px solid ${c.canvasBorder}`, borderRadius: 14, padding: "18px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.canvasMut, marginBottom: 10 }}>Signed in as</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.canvasText, wordBreak: "break-all" }}>{authState?.user?.email || "—"}</div>
          <div style={{ fontSize: 11, color: c.canvasMut, marginTop: 4 }}>Admin account</div>
        </div>
      </div>

      {/* pending users list */}
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.canvasMut, marginBottom: 12 }}>Pending signups</div>

      {pendingUsers.length === 0 ? (
        <div style={{ background: c.card, borderRadius: 14, padding: "32px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.ink }}>All clear</div>
          <div style={{ fontSize: 12, color: c.mut, marginTop: 4 }}>No pending approvals. All users are approved.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pendingUsers.map((user) => (
            <div key={user.id} style={{
              background: c.card, border: `1px solid ${c.hair}`, borderRadius: 14,
              padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.ink }}>{user.email}</div>
                <div style={{ fontSize: 11, color: c.mut, marginTop: 4, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>{user.id}</div>
              </div>
              <button onClick={() => handleApprove(user.id)} style={{
                padding: "9px 18px", background: c.buttonBg, color: c.buttonText,
                border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13,
                cursor: "pointer", whiteSpace: "nowrap", transition: "opacity .15s"
              }}>
                Approve
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- main app ----------------------------- */
let SEQ = 2;
// IDs must never collide with cabinets loaded from Supabase (SEQ resets to 2 on
// every page load, so a counter alone hands out ids that already exist).
const nextCabId = (list) => (list || []).reduce((m, c) => Math.max(m, c.id || 0), 0) + 1;
const newCab = (n) => ({ id: ++SEQ, name: `Cabinet ${n}`, type: "base", width: "600",
  doorCount: 1, shelfQty: 1, falseFront: false, front: "doors", drawerCount: 3, drawerHeights: null, hingeType: "concealed",
  params: { ...DEFAULTS } });


const PORTASOL_MATERIALS = {
  proyectos: {
    label: "Proyectos",
    items: [
      { code: "8685", name: "Blanco",        texture: "BS",  bg: "#F2EFE9", grain: false },
      { code: "1700", name: "Gris Claro",    texture: "BS",  bg: "#C0BFBA", grain: false },
      { code: "0162", name: "Gris Oscuro",   texture: "PE",  bg: "#6B6B6B", grain: false },
      { code: "0190", name: "Negro",         texture: "PE",  bg: "#1A1A1A", grain: false },
      { code: "K358", name: "Honey",         texture: "PW",  bg: "#C8922A", grain: true  },
      { code: "K088", name: "Blanco Madera", texture: "PW",  bg: "#E8DDD0", grain: true  },
      { code: "5501", name: "Slavonia",      texture: "PW",  bg: "#B09070", grain: true  },
      { code: "K359", name: "Brandy",        texture: "PW",  bg: "#A0622A", grain: true  },
      { code: "K004", name: "Tobacco",       texture: "PW",  bg: "#8C6040", grain: true  },
      { code: "K089", name: "Gris Madera",   texture: "PW",  bg: "#9A9488", grain: true  },
      { code: "K007", name: "Café",          texture: "PW",  bg: "#7A5038", grain: true  },
      { code: "3025", name: "Sonoma",        texture: "SN",  bg: "#C4A882", grain: true  },
      { code: "5194", name: "Vintage",       texture: "SN",  bg: "#B09878", grain: true  },
      { code: "0729", name: "Walnut",        texture: "PR",  bg: "#5C3C24", grain: true  },
    ]
  },
  amaderados: {
    label: "Amaderados",
    items: [
      { code: "5501", name: "Slavonia",      texture: "PN",  bg: "#B09070", grain: true  },
      { code: "0381", name: "Bavaria",       texture: "PN",  bg: "#D4B896", grain: true  },
      { code: "K083", name: "Arte Claro",    texture: "SN",  bg: "#D0B890", grain: true  },
      { code: "K084", name: "Arte Oscuro",   texture: "SN",  bg: "#7A5830", grain: true  },
      { code: "K005", name: "Roble Urbano",  texture: "PW",  bg: "#C8A870", grain: true  },
      { code: "K010", name: "Pino Blanco",   texture: "PW",  bg: "#E8D8B8", grain: true  },
      { code: "K088", name: "Blanco Madera", texture: "PW",  bg: "#E8DDD0", grain: true  },
      { code: "5194", name: "Vintage",       texture: "SN",  bg: "#B09878", grain: true  },
      { code: "3025", name: "Sonoma",        texture: "SN",  bg: "#C4A882", grain: true  },
      { code: "K107", name: "Elegance",      texture: "PW",  bg: "#C09860", grain: true  },
      { code: "K004", name: "Tobacco",       texture: "PW",  bg: "#8C6040", grain: true  },
      { code: "K087", name: "Nogal Oscuro",  texture: "PW",  bg: "#4A3020", grain: true  },
      { code: "K089", name: "Gris Madera",   texture: "PW",  bg: "#9A9488", grain: true  },
      { code: "K358", name: "Honey",         texture: "PW",  bg: "#C8922A", grain: true  },
      { code: "K354", name: "Colonial",      texture: "PW",  bg: "#9A7850", grain: true  },
      { code: "0729", name: "Walnut",        texture: "PR",  bg: "#5C3C24", grain: true  },
      { code: "K359", name: "Brandy",        texture: "PW",  bg: "#A0622A", grain: true  },
      { code: "K003", name: "Gold Craft",    texture: "PW",  bg: "#B89040", grain: true  },
      { code: "K683", name: "Cajun Cremona", texture: "PD",  bg: "#D4B8A0", grain: true  },
      { code: "K2737",name: "Roble Cotta",   texture: "PW",  bg: "#C89870", grain: true  },
      { code: "K2739",name: "Roble Cannolo Cremona", texture: "PW", bg: "#D4C0A0", grain: true },
      { code: "K694", name: "Roble Seda Primavera Sombra", texture: "PV", bg: "#C0A878", grain: true },
      { code: "K696", name: "Roble Primavera", texture: "PV", bg: "#D4B880", grain: true },
      { code: "K697", name: "Roble Cocoa Primavera", texture: "PV", bg: "#A08060", grain: true },
    ]
  },
  colores: {
    label: "Colores",
    items: [
      { code: "8685", name: "Blanco",        texture: "BS",  bg: "#F2EFE9", grain: false },
      { code: "1700", name: "Gris Claro",    texture: "PE",  bg: "#C0BFBA", grain: false },
      { code: "7045", name: "Satin",         texture: "SU",  bg: "#E8E0D8", grain: false },
      { code: "0162", name: "Gris Oscuro",   texture: "PE",  bg: "#6B6B6B", grain: false },
      { code: "0190", name: "Negro",         texture: "PE",  bg: "#1A1A1A", grain: false },
      { code: "0134", name: "Amarillo",      texture: "BS",  bg: "#F0C020", grain: false },
      { code: "7113", name: "Rojo",          texture: "BS",  bg: "#C02020", grain: false },
      { code: "0125", name: "Azul Royal",    texture: "BS",  bg: "#2040A0", grain: false },
      { code: "0244", name: "Petrol",        texture: "SU",  bg: "#1E5060", grain: false },
      { code: "7166", name: "Latté",         texture: "SU",  bg: "#C8A878", grain: false },
      { code: "K353", name: "Carbón",        texture: "RT",  bg: "#4A4A4A", grain: false },
      { code: "K351", name: "Óxido",         texture: "RT",  bg: "#A04020", grain: false },
      { code: "4298", name: "Light Atelier", texture: "PW",  bg: "#D8C8B0", grain: false },
      { code: "4299", name: "Dark Atelier",  texture: "PW",  bg: "#7A6850", grain: false },
      { code: "6299", name: "Cobalt Grey",   texture: "SU",  bg: "#6080A0", grain: false },
      { code: "8984", name: "Azul Marino",   texture: "BS",  bg: "#1A2858", grain: false },
      { code: "K519", name: "Gris Ratón",    texture: "PW",  bg: "#888888", grain: false },
      { code: "K521", name: "Verde Humo",    texture: "SU",  bg: "#607868", grain: false },
      { code: "7063", name: "Verde Pastel",  texture: "SU",  bg: "#8AAE8A", grain: false },
      { code: "K692", name: "Nube Granada",  texture: "PN",  bg: "#D8C0B8", grain: false },
      { code: "K684", name: "Trufa Negra",   texture: "PD",  bg: "#3A2820", grain: false },
    ]
  },
  altobrillo: {
    label: "Alto Brillo",
    items: [
      { code: "8685", name: "Blanco MG",     texture: "MG",  bg: "#F8F8F8", grain: false },
      { code: "5981", name: "Cashmere MG",   texture: "MG",  bg: "#E0D0C0", grain: false },
      { code: "7166", name: "Latté MG",      texture: "MG",  bg: "#C8A878", grain: false },
      { code: "6299", name: "Cobalt Grey MG",texture: "MG",  bg: "#6080A0", grain: false },
      { code: "7045", name: "Satin MG",      texture: "MG",  bg: "#E8E0D8", grain: false },
      { code: "0190", name: "Negro MG",      texture: "MG",  bg: "#1A1A1A", grain: false },
    ]
  }
};

/* ── INNOVUS MATERIAL CATALOGUE ───────────────────────────────────── */
const INNOVUS_MATERIALS = {
  maderas: {
    label: "Maderas",
    items: [
      { code: "M6321", name: "Endless Oak Natural",  texture: "SPT", bg: "#D4B896", grain: true  },
      { code: "M6316", name: "Elegance Grey",         texture: "SPT", bg: "#9E9E93", grain: true  },
      { code: "M6315", name: "Elegance Brown",        texture: "SPT", bg: "#5C3D2E", grain: true  },
      { code: "M6320", name: "Blanco Supremo",        texture: "SPT", bg: "#EDE8DF", grain: true  },
      { code: "M6319", name: "Negro Supremo",         texture: "SPT", bg: "#3A3A3A", grain: true  },
      { code: "M6342", name: "French Echo",           texture: "FUN", bg: "#9E8060", grain: true  },
      { code: "M6280", name: "Roble Sanctuary",       texture: "FUN", bg: "#C4A882", grain: true  },
      { code: "M6326", name: "Durini Light",          texture: "FUN", bg: "#B8956A", grain: true  },
      { code: "M6293", name: "Nogal Imperial",        texture: "FUN", bg: "#7A5C3C", grain: true  },
      { code: "M6295", name: "Baccata",               texture: "FUN", bg: "#C08040", grain: true  },
      { code: "M6267", name: "Luna Nueva",            texture: "FUN", bg: "#2C2C2C", grain: true  },
      { code: "M6304", name: "Etna Oak",              texture: "FLW", bg: "#C4A070", grain: true  },
      { code: "M6344", name: "Karlstad Oak Grey",     texture: "FLW", bg: "#B0A898", grain: true  },
      { code: "M6252", name: "Bari Oak Nature",       texture: "FLW", bg: "#D4B87A", grain: true  },
      { code: "M9328", name: "Andu Wood",             texture: "FLW", bg: "#E8DDD0", grain: true  },
      { code: "M6307", name: "Smart Ash Dark",        texture: "FLW", bg: "#4E3828", grain: true  },
      { code: "M999",  name: "Iguazu Oak",            texture: "FLW", bg: "#D0BC98", grain: true  },
      { code: "M2112", name: "Pien Beech",            texture: "FLW", bg: "#D4A870", grain: true  },
      { code: "M9001", name: "Roble Espejo",          texture: "FLW", bg: "#D8C8A8", grain: true  },
      { code: "M3861", name: "Light Mediterranean",   texture: "SMA", bg: "#EAE0D0", grain: true  },
      { code: "M4451", name: "Mediterraneo",          texture: "SMA", bg: "#C8A880", grain: true  },
      { code: "M2106", name: "Clear Maple",           texture: "SMA", bg: "#E8D090", grain: true  },
      { code: "M2511", name: "Nogal Troia",           texture: "SMA", bg: "#8C6040", grain: true  },
      { code: "M6225", name: "Clasico Memphis",       texture: "SC",  bg: "#6C4830", grain: true  },
      { code: "M6120", name: "Roble Sonoma",          texture: "NTL", bg: "#B09070", grain: true  },
      { code: "M3866", name: "Whitewood",             texture: "NTL", bg: "#EDE8E0", grain: true  },
      { code: "M6053", name: "Pino Carrizo",          texture: "NTL", bg: "#D0B898", grain: true  },
      { code: "M6046", name: "Wengue Salonga",        texture: "NTL", bg: "#2A1A10", grain: true  },
    ]
  },
  fantasias: {
    label: "Fantasías",
    items: [
      { code: "F2281", name: "Urbanstone Clay",    texture: "CMS", bg: "#C8C4B8", grain: false },
      { code: "F2282", name: "Urbanstone Grafito", texture: "CMS", bg: "#3C3C3C", grain: false },
      { code: "F2273", name: "Yang Marble",        texture: "STU", bg: "#F0EEEA", grain: false },
      { code: "F2272", name: "Yin Marble",         texture: "STU", bg: "#2A2A2A", grain: false },
      { code: "F750",  name: "Atlas",              texture: "TL",  bg: "#D8D0C0", grain: false },
    ]
  },
  unicolores: {
    label: "Unicolores",
    items: [
      { code: "L968",  name: "Alabaster",    texture: "SMA", bg: "#F2EEE6", grain: false },
      { code: "L021",  name: "Gris Perla",   texture: "SC",  bg: "#B8BEC0", grain: false },
      { code: "L5200", name: "Cotton",       texture: "MA",  bg: "#C8C0B8", grain: false },
      { code: "L4054", name: "Anthracite",   texture: "SC",  bg: "#5A5A5A", grain: false },
      { code: "L3031", name: "Negro",        texture: "SC",  bg: "#1A1A1A", grain: false },
      { code: "L927",  name: "Basalt",       texture: "SMA", bg: "#7A7870", grain: false },
      { code: "L5219", name: "Hot Pepper",   texture: "SC",  bg: "#CC1414", grain: false },
      { code: "L6160", name: "Grey Beige",   texture: "SC",  bg: "#C0B4A4", grain: false },
      { code: "L5230", name: "Azurite",      texture: "SC",  bg: "#5A7090", grain: false },
      { code: "L6274", name: "Storm Grey",   texture: "MA",  bg: "#6E7880", grain: false },
      { code: "L5206", name: "Bambus",       texture: "MA",  bg: "#8C9478", grain: false },
      { code: "L5207", name: "Camouflage",   texture: "SMA", bg: "#7A806A", grain: false },
    ]
  }
};

/* ── MATERIAL PICKER MODAL ────────────────────────────────────────── */
function MaterialPicker({ onSelect, onClose, customMaterials = [] }) {
  const [activeCatalogue, setActiveCatalogue] = React.useState("favorites");
  const [activeTab, setActiveTab] = React.useState("recent");
  const [search, setSearch] = React.useState("");
  const [recentMaterials, setRecentMaterials] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("recentMaterials") || "[]"); } catch { return []; }
  });

  const addToRecent = (mat, source) => {
    const entry = { ...mat, source };
    const updated = [entry, ...recentMaterials.filter(m => !(m.code === mat.code && m.source === source))].slice(0, 20);
    setRecentMaterials(updated);
    try { localStorage.setItem("recentMaterials", JSON.stringify(updated)); } catch {}
  };

  const recentInnovus = recentMaterials.filter(m => m.source === "innovus");
  const recentPortasol = recentMaterials.filter(m => m.source === "portasol");

  const FAVORITES_DATA = {};
  if (recentInnovus.length > 0) FAVORITES_DATA.recentInnovus = { label: "Innovus recientes", items: recentInnovus };
  if (recentPortasol.length > 0) FAVORITES_DATA.recentPortasol = { label: "Portasol recientes", items: recentPortasol };
  if (customMaterials.length > 0) FAVORITES_DATA.mis = { label: "Mis Materiales", items: customMaterials.map(m => ({ ...m, texture: "", grain: false })) };
  if (Object.keys(FAVORITES_DATA).length === 0) FAVORITES_DATA.empty = { label: "Sin favoritos", items: [] };

  const CATALOGUES = {
    favorites: { label: "⭐ Favoritos", data: FAVORITES_DATA },
    innovus: { label: "Innovus", data: INNOVUS_MATERIALS },
    portasol: { label: "Portasol", data: PORTASOL_MATERIALS },
  };

  const currentData = CATALOGUES[activeCatalogue].data;
  const allInnovus = Object.entries(INNOVUS_MATERIALS).flatMap(([, cat]) => cat.items);
  const allPortasol = Object.entries(PORTASOL_MATERIALS).flatMap(([, cat]) => cat.items);
  const allCustom = customMaterials.map(m => ({ ...m, texture: "", grain: false, isCustom: true }));
  const allItems = [...allInnovus, ...allPortasol, ...allCustom];

  const filtered = search.trim()
    ? allItems.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase()))
    : (currentData[activeTab] ? currentData[activeTab].items : Object.values(currentData)[0]?.items || []);

  // Reset tab when switching catalogues
  const switchCatalogue = (cat) => {
    setActiveCatalogue(cat);
    const keys = Object.keys(CATALOGUES[cat].data);
    setActiveTab(keys[0] || "");
  };

  const tabStyle = (key) => ({
    padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 13,
    fontWeight: 700, borderBottom: activeTab === key && !search ? "3px solid #E4572E" : "3px solid transparent",
    background: "transparent", color: activeTab === key && !search ? "#E4572E" : "#666",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 12, width: 780, maxWidth: "95vw",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: "0 12px 48px rgba(0,0,0,0.35)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid #eee" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Innovus® — Selector de Material</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Catálogo Matching our nature · Sonae Arauco</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888" }}>×</button>
          </div>
          {/* Search */}
          {/* Catalogue selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {Object.entries(CATALOGUES).map(([key, cat]) => (
              <button key={key} onClick={() => switchCatalogue(key)}
                style={{ padding: "5px 14px", border: "none", borderRadius: 6, cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  background: activeCatalogue === key ? "#E4572E" : "#f0f0f0",
                  color: activeCatalogue === key ? "#fff" : "#555" }}>
                {cat.label}
              </button>
            ))}
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            style={{ width: "100%", padding: "8px 12px", border: "1.5px solid #ddd", borderRadius: 8,
              fontSize: 13, marginBottom: 10, outline: "none", boxSizing: "border-box" }}
          />
          {/* Tabs */}
          {!search && (
            <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
              {Object.entries(currentData).map(([key, cat]) => (
                <button key={key} style={tabStyle(key)} onClick={() => setActiveTab(key)}>
                  {cat.label} ({cat.items.length})
                </button>
              ))}

            </div>
          )}
        </div>

        {/* Grid */}
        <div style={{ overflowY: "auto", padding: 16, flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
            {filtered.map(mat => (
              <div key={mat.code}
                onClick={() => {
                  const label = [mat.code, mat.name, mat.texture].filter(Boolean).join(' ').trim();
                  const source = activeCatalogue === "favorites" ? (mat.source || "custom") : activeCatalogue;
                  addToRecent(mat, source === "favorites" ? (mat.source || "innovus") : source);
                  onSelect(label);
                }}
                style={{
                  borderRadius: 10, overflow: "hidden", cursor: "pointer",
                  border: "2px solid transparent", transition: "all 0.15s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
                onMouseEnter={e => { e.currentTarget.style.border = "2px solid #E4572E"; e.currentTarget.style.transform = "scale(1.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.border = "2px solid transparent"; e.currentTarget.style.transform = "scale(1)"; }}
              >
                {/* Swatch */}
                <div style={{
                  height: 90, background: mat.bg, position: "relative",
                  backgroundImage: mat.grain
                    ? `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 4px),
                       repeating-linear-gradient(180deg, transparent, transparent 8px, rgba(0,0,0,0.03) 8px, rgba(0,0,0,0.03) 10px)`
                    : "none",
                }}>
                  <span style={{
                    position: "absolute", top: 6, right: 6,
                    background: "rgba(0,0,0,0.45)", color: "#fff",
                    fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4,
                    letterSpacing: "0.05em",
                  }}>{mat.texture}</span>
                </div>
                {/* Label */}
                <div style={{ padding: "7px 8px", background: "#fafafa" }}>
                  <div style={{ fontSize: 10, color: "#999", fontWeight: 600 }}>{mat.code}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#222", lineHeight: 1.3, marginTop: 1 }}>{mat.name}</div>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "#aaa", padding: 40, fontSize: 14 }}>
              {search ? 'No se encontraron materiales para "' + search + '"' : 'No hay materiales en esta sección. Selecciona de Innovus o Portasol para agregar favoritos.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ================================================================
 * DESGLOSE SHEET — Formulario de Servicio: Corte y Canteado
 * Summarises all cabinet cut lists into one editable table
 * matching the Madesol workshop form format.
 * ================================================================ */
function DesgloseSheet({ cabs, projectName, onClose, initialLang = "en", allProjects = [] }) {
  const today = new Date().toLocaleDateString("es-DO");
  const confirmClose = () => {
    if (window.confirm(ms("Save your sheet before closing?", "¿Guardar la hoja antes de cerrar?"))) {
      // User clicked OK — save the sheet then close
      const name = saveSheetName && saveSheetName !== "__new__" ? saveSheetName : (projectName || "Hoja sin nombre");
      const now = new Date();
      const date = now.toLocaleDateString("es-DO") + " " + now.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
      const sheet = { name, date, rows, globalMaterial, factura, nombre, telefono };
      const existing = savedSheets.findIndex(s => s.name === name);
      let updated;
      if (existing >= 0) {
        updated = [...savedSheets];
        updated[existing] = sheet;
      } else {
        updated = [sheet, ...savedSheets.slice(0, 19)];
      }
      setSavedSheets(updated);
      try { localStorage.setItem("savedDesgloseSheets", JSON.stringify(updated)); } catch {}
      onClose();
    }
    // If user clicks Cancel, do nothing (just return)
  };

  // Build summarised cut list — group same dimensions, multiply by cabinet qty
  const buildRows = (cabsToUse) => {
    const map = new Map();
    // Helper: add a part to the map, merging by name+dimensions
    const emitPart = (map, name, L, A, G, qty, part, opts) => {
      const key = `${name}|${L}-${A}-${G}`;
      const o = opts || {};
      if (map.has(key)) {
        const existing = map.get(key);
        existing.cant += qty;
        // Update flags when merging: if this variant should have the flag, mark it
        if (o.hasBisagra && o.sideH) {
          // Mark on the dimension closest to cabinet height
          const distL = Math.abs(o.doorL - o.sideH);
          const distA = Math.abs(o.doorA - o.sideH);
          if (distL <= distA) { existing.hbl = "X"; }  // doorL is closer to sideH
          else { existing.hba = "X"; }  // doorA is closer to sideH
        }
        if (o.hasRanura) { existing.rl = "X"; existing.ra = "X"; }
      } else {
        map.set(key, {
          id: key, largo: L, ancho: A, grosor: G, cant: qty, nombre: name,
          cl1: "X", cl2: "X", ca1: "X", ca2: "X",
          vetas: "",
          // Ranuras: auto-mark on parts whose height matches cabinet height (back panel groove)
          rl: o.hasRanura ? "X" : "",
          ra: o.hasRanura ? "X" : "",
          // Bisagras: mark on dimension closest to cabinet height (where hinge attaches)
          hbl: (o.hasBisagra && o.sideH && Math.abs(L - o.sideH) <= Math.abs(A - o.sideH)) ? "X" : "",
          hba: (o.hasBisagra && o.sideH && Math.abs(A - o.sideH) < Math.abs(L - o.sideH)) ? "X" : "",
          material: (o && o.cabMaterial) || "", isHardboard: part.material === "hardboard",
          cabType: o.cabType || "",
        });
      }
    };
    (cabsToUse || cabs).forEach((cab) => {
      const cabQty = cab.qty || 1;

      // Filler piece — completely standalone, not a cabinet
      if (cab.type === "filler") {
        const fW = parseFloat(cab.fillerW) || 0;
        const fH = parseFloat(cab.fillerH) || 0;
        const fT = parseFloat(cab.fillerT) || 18;
        if (fW > 0 && fH > 0) {
          const L = Math.max(fW, fH), A = Math.min(fW, fH);
          const fakePart = { material: "melamine" };
          emitPart(map, "Filler", L, A, fT, cabQty, fakePart, { cabMaterial: cab.material || "" });
          // Override grosor since emitPart uses a fixed G — update it after
          const key = "Filler|" + L + "-" + A + "-" + fT;
          if (map.has(key)) map.get(key).grosor = fT;
        }
        return;
      }

      const W = parseFloat(cab.width);
      const p = cab.params || DEFAULTS;
      if (isNaN(W) || W <= 2 * p.t + 10) return;
      const d = buildCutList(W, p, cab);
      const cabMaterial = cab.material || "";
      d.parts.forEach((part) => {
        const L = Math.round(Math.max(part.a, part.b));
        const A = Math.round(Math.min(part.a, part.b));
        const G = part.material === "hardboard" ? Math.round(p.grooveDepth || 5.5) : p.t;

        // Auto-detect ranura (back panel groove) and bisagra (hinge drilling)
        const ranuraParts = new Set(["Side", "Bottom", "Top"]);
        const hasRanura = ranuraParts.has(part.part);

        // Side panels: all sides are plain (no "with doors" variant).
        // Doors will be marked with X in HB-L/HB-A to show they're fixed to the side.
        if (part.part === "Side") {
          const totalSides = part.qty * cabQty;      // usually 2 × cabQty
          // Emit all sides as plain, no hinge marking
          emitPart(map, "Side", L, A, G, totalSides, part, { hasRanura: true, hasBisagra: false, cabMaterial, cabType: cab.type });
          return;
        }

        const sideLabel = part.part;
        const totalQty = part.qty * cabQty;
        // Mark door parts: bisagra attaches on whichever dimension is closer to cabinet height
        const isDoorPart = sideLabel.includes("Door");
        const sideH = p.sideH;  // cabinet's side panel height
        emitPart(map, sideLabel, L, A, G, totalQty, part, { hasRanura, hasBisagra: isDoorPart, cabMaterial, cabType: cab.type, sideH, doorL: L, doorA: A });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.largo - a.largo || b.ancho - a.ancho);
  };

  const [rows, setRows] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("savedDesgloseSheets") || "[]");
      if (saved.length > 0 && saved[0].rows && saved[0].rows.length > 0) return saved[0].rows;
    } catch {}
    return buildRows(cabs);
  });
  const [globalMaterial, setGlobalMaterial] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("savedDesgloseSheets") || "[]");
      return saved.length > 0 ? (saved[0].globalMaterial || "") : "";
    } catch { return ""; }
  });
  const [pickerOpen, setPickerOpen] = React.useState(null);
  const [sortField, setSortField] = React.useState("nombre"); // default sort by name
  const [sortDir, setSortDir] = React.useState(1); // 1=asc
  const [showCustomMat, setShowCustomMat] = React.useState(false);
  const [showSaved, setShowSaved] = React.useState(false);
  const [savedSheets, setSavedSheets] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("savedDesgloseSheets") || "[]"); } catch { return []; }
  });
  const [saveSheetName, setSaveSheetName] = React.useState("");
  const [mLang, setMLang] = React.useState(initialLang);
  const [activeCabs, setActiveCabs] = React.useState(cabs);
  const [activeProjectName, setActiveProjectName] = React.useState(projectName);
  const ms = (en, es) => mLang === "es" ? es : en;
  const mTName = (name) => {
    if (mLang !== "es") return name;
    const map = {
      "Side": "Lateral",
      "Bottom Panel": "Panel de fondo",
      "Bottom": "Fondo",
      "Top Panel": "Panel superior",
      "Top": "Superior",
      "Back Panel": "Panel trasero",
      "Back": "Trasero",
      "Rail / Support (front)": "Riel / Soporte (frontal)",
      "Rail / Support (back)": "Riel / Soporte (trasero)",
      "Rail / Support": "Riel / Soporte",
      "Shelf": "Estante",
      "Separator (fixed)": "Separador (fijo)",
      "Door": "Puerta",
      "Door (pair)": "Puertas (par)",
      "Door (flap, stacked)": "Puerta (abatible)",
      "Blind / filler panel": "Panel ciego / relleno", "Filler piece": "Pieza de relleno", "Wall cabinet (custom depth)": "Armario de pared (profundidad personalizada)", "Filler": "Relleno",
      "False drawer front": "Frente de gaveta falso",
      "False front": "Frente falso",
      "Drawer front": "Frente de gaveta",
      "Drawer box side": "Lado de caja de gaveta",
      "Drawer box front/back": "Frente/fondo de caja de gaveta",
      "Drawer bottom": "Fondo de gaveta",
      "Hinge stile / rail": "Montante de bisagras",
      "Hinge Panel": "Panel de bisagras",
      "Blind Front Panel": "Panel frontal ciego",
      "Base build-up strip": "Refuerzo superior base",
    };
    // Check exact match first
    if (map[name]) return map[name];
    // Check partial match for dynamic names like "Back — 5.5mm hardboard"
    for (const [k, v] of Object.entries(map)) {
      if (name.startsWith(k)) return v + name.slice(k.length);
    }
    return name;
  };
  const [customMaterials, setCustomMaterials] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("customMaterials") || "[]"); } catch { return []; }
  });
  const [newMatName, setNewMatName] = React.useState("");
  const [newMatCode, setNewMatCode] = React.useState("");
  const [newMatColor, setNewMatColor] = React.useState("#C4A882");
  const [globalWidth, setGlobalWidth] = React.useState("");
  const [factura, setFactura] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [telefono, setTelefono] = React.useState("");

  // Apply global material to all rows unless individually overridden
  React.useEffect(() => {
    if (globalMaterial !== "") {
      setRows(rs => rs.map(r => r._matOverride ? r : { ...r, material: globalMaterial }));
    }
  }, [globalMaterial]);

  const updateRow = (id, field, val) => {
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };
      if (field === "material") updated._matOverride = true;
      return updated;
    }));
  };

  const toggleCell = (id, field) => {
    setRows(rs => rs.map(r => r.id !== id ? r : { ...r, [field]: r[field] ? "" : "X" }));
  };

  const totalCant = rows.reduce((s, r) => s + (Number(r.cant) || 0), 0);

  const saveCustomMat = () => {
    if (!newMatName.trim()) return;
    const m = { code: newMatCode.trim() || "—", name: newMatName.trim(), bg: newMatColor };
    const updated = [...customMaterials, m];
    setCustomMaterials(updated);
    try { localStorage.setItem("customMaterials", JSON.stringify(updated)); } catch {}
    setNewMatName(""); setNewMatCode(""); setNewMatColor("#C4A882");
  };

  const deleteCustomMat = (idx) => {
    const updated = customMaterials.filter((_, i) => i !== idx);
    setCustomMaterials(updated);
    try { localStorage.setItem("customMaterials", JSON.stringify(updated)); } catch {}
  };

  const saveSheet = () => {
    const name = saveSheetName.trim() || projectName || "Hoja sin nombre";
    const now = new Date();
    const date = now.toLocaleDateString("es-DO") + " " + now.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
    const sheet = { name, date, rows, globalMaterial, factura, nombre, telefono };
    const updated = [sheet, ...savedSheets.slice(0, 19)]; // keep last 20
    setSavedSheets(updated);
    try { localStorage.setItem("savedDesgloseSheets", JSON.stringify(updated)); } catch {}
    setSaveSheetName("");
    alert("Hoja guardada: " + name);
  };

  const loadSheet = (sheet) => {
    setRows(sheet.rows);
    setGlobalMaterial(sheet.globalMaterial || "");
    setFactura(sheet.factura || "");
    setNombre(sheet.nombre || "");
    setTelefono(sheet.telefono || "");
    setShowSaved(false);
  };

  const deleteSavedSheet = (idx) => {
    const updated = savedSheets.filter((_, i) => i !== idx);
    setSavedSheets(updated);
    try { localStorage.setItem("savedDesgloseSheets", JSON.stringify(updated)); } catch {}
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => -d);
    else { setSortField(field); setSortDir(1); }
  };

  const sortedRows = React.useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const av = sortField === "cant" ? (Number(a.cant) || 0) : String(a.nombre || "");
      const bv = sortField === "cant" ? (Number(b.cant) || 0) : String(b.nombre || "");
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return 0;
    });
  }, [rows, sortField, sortDir]);

  const inputStyle = {
    border: "none", background: "transparent", width: "100%",
    fontSize: 11, fontFamily: "Arial, sans-serif", textAlign: "center",
    padding: 0, outline: "none", cursor: "text",
  };
  const cellStyle = (extra = {}) => ({
    border: "1px solid #888", padding: "2px 3px", textAlign: "center",
    fontSize: 11, verticalAlign: "middle", ...extra,
  });
  const hdrStyle = (extra = {}) => ({
    ...cellStyle(), background: "#ddd", fontWeight: 700, fontSize: 10, ...extra,
  });

  return (
    <div className="desglose-overlay" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 3000, display: "flex", alignItems: "flex-start",
      justifyContent: "center", overflowY: "auto", padding: "20px 0",
    }} onClick={confirmClose}>
      <div className="desglose-print-area" style={{
        background: "#fff", width: 960, maxWidth: "98vw", borderRadius: 10,
        boxShadow: "0 8px 40px rgba(0,0,0,0.3)", padding: 24, position: "relative",
      }} onClick={e => e.stopPropagation()}>
        {/* Close */}
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>FORMULARIO DE SERVICIO: CORTE Y CANTEADO</div>
          <div style={{ fontSize: 11, color: "#555", textAlign: "right" }}>
            <div>Fecha: <strong>{today}</strong></div>
            <div>Proyecto: <strong>{activeProjectName}</strong></div>
          </div>
        </div>

        {/* Client info */}
        <div className="desglose-noprint" style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          {[["Factura No.", factura, setFactura, 100], ["Nombre", nombre, setNombre, 200], ["Número tel.", telefono, setTelefono, 140]].map(([label, val, setter, w]) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ whiteSpace: "nowrap" }}>{label}</span>
              <input value={val} onChange={e => setter(e.target.value)}
                style={{ border: "none", borderBottom: "1px solid #888", width: w, fontSize: 11, outline: "none", padding: "1px 3px" }} />
            </label>
          ))}
        </div>

        {/* Global controls */}
        <div className="desglose-noprint" style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center", flexWrap: "wrap",
          background: "#f5f5f5", padding: "10px 14px", borderRadius: 8 }}>
          {allProjects.length > 1 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}>
              {ms("Project:", "Proyecto:")}
              <select value={activeProjectName}
                onChange={e => {
                  const proj = allProjects.find(p => p.name === e.target.value);
                  if (proj && window.confirm(ms('Load cabinets from "' + proj.name + '"? Current rows will be replaced.', '¿Cargar gabinetes de "' + proj.name + '"? Las filas actuales serán reemplazadas.'))) {
                    setActiveCabs(proj.cabs || []);
                    setActiveProjectName(proj.name);
                    setRows(buildRows(proj.cabs || []));
                  }
                }}
                style={{ border: "1px solid #bbb", borderRadius: 4, padding: "4px 8px", fontSize: 12, maxWidth: 180 }}>
                {allProjects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </label>
          )}
          <button onClick={() => setMLang(l => l === "en" ? "es" : "en")}
            style={{ padding: "5px 12px", background: "#555", color: "#fff", border: "none",
              borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            {mLang === "en" ? "ES" : "EN"}
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
            <thead>
              {/* Main header groups */}
              <tr>
                <th style={hdrStyle({ width: 30 })} rowSpan={2}>No</th>
                <th style={hdrStyle({ minWidth: 80 })} rowSpan={2}>Material</th>
                <th style={hdrStyle({ minWidth: 60 })} rowSpan={2}>Type</th>
                <th style={{ ...hdrStyle({ minWidth: 100 }), cursor: "pointer" }} rowSpan={2}
                  onClick={() => toggleSort("nombre")}>
                  Nombre {sortField === "nombre" ? (sortDir === 1 ? "▲" : "▼") : "↕"}
                </th>
                <th style={hdrStyle({})} colSpan={5}>Despiece</th>
                <th style={hdrStyle({})} colSpan={4}>Canteado de pieza</th>
                <th style={hdrStyle({})} colSpan={2}>Ranuras</th>
                <th style={hdrStyle({})} colSpan={2}>Bisagras</th>
              </tr>
              <tr>
                {/* Despiece sub-headers */}
                <th style={hdrStyle({ width: 28 })}>Vetas a favor del largo</th>
                <th style={hdrStyle({ width: 60 })}>Largo (mm)</th>
                <th style={hdrStyle({ width: 60 })}>Ancho (mm)</th>
                <th style={hdrStyle({ width: 46 })}>Grosor (mm)</th>
                <th style={{ ...hdrStyle({ width: 36 }), cursor: "pointer" }}
                  onClick={() => toggleSort("cant")}>
                  Cant. {sortField === "cant" ? (sortDir === 1 ? "▲" : "▼") : "↕"}
                </th>
                {/* Canteado sub-headers: Largo1, Largo2, Ancho1, Ancho2 */}
                <th style={hdrStyle({ width: 38 })}>Largo 1</th>
                <th style={hdrStyle({ width: 38 })}>Largo 2</th>
                <th style={hdrStyle({ width: 38 })}>Ancho 1</th>
                <th style={hdrStyle({ width: 38 })}>Ancho 2</th>
                {/* Ranuras */}
                <th style={hdrStyle({ width: 32 })}>R-L</th>
                <th style={hdrStyle({ width: 32 })}>R-A</th>
                {/* Bisagras */}
                <th style={hdrStyle({ width: 32 })}>HB-L</th>
                <th style={hdrStyle({ width: 32 })}>HB-A</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr key={i} style={{ background: row.isHardboard ? "#fffbe6" : (i % 2 === 0 ? "#fff" : "#f9f9f9") }}>
                  <td style={cellStyle({ color: "#888" })}>{i + 1}</td>
                  {/* Material — editable */}
                  <td style={cellStyle({ textAlign: "left", minWidth: 100 })}>
                    <input value={row.material || ""} onChange={e => updateRow(row.id, "material", e.target.value)}
                      style={{ ...inputStyle, textAlign: "left", fontSize: 10 }} placeholder="—" />
                  </td>
                  {/* Type (Base/Wall) */}
                  <td style={cellStyle({ textAlign: "center", minWidth: 60, fontSize: 10, color: "#666", fontWeight: 500 })}>
                    {row.cabType || "—"}
                  </td>
                  {/* Nombre */}
                  <td style={cellStyle({ textAlign: "left", minWidth: 100, fontSize: 10, color: "#555" })}>
                    {mTName(row.nombre)}
                  </td>
                  {/* Vetas */}
                  <td style={{ ...cellStyle({ width: 28 }), cursor: "pointer", color: row.vetas ? "#c00" : "#ddd",
                    fontWeight: 700, fontSize: 14, userSelect: "none" }}
                    onClick={() => toggleCell(row.id, "vetas")}>
                    {row.vetas || "·"}
                  </td>
                  {/* Largo */}
                  <td style={cellStyle({ fontWeight: 700 })}>
                    <input value={row.largo} onChange={e => updateRow(row.id, "largo", e.target.value)} style={inputStyle} />
                  </td>
                  {/* Ancho */}
                  <td style={cellStyle({ fontWeight: 700 })}>
                    <input value={row.ancho} onChange={e => updateRow(row.id, "ancho", e.target.value)} style={inputStyle} />
                  </td>
                  {/* Grosor */}
                  <td style={cellStyle()}>
                    <input value={row.grosor} onChange={e => updateRow(row.id, "grosor", e.target.value)} style={inputStyle} />
                  </td>
                  {/* Cant */}
                  <td style={cellStyle({ fontWeight: 700 })}>
                    <input value={row.cant} onChange={e => updateRow(row.id, "cant", e.target.value)} style={inputStyle} />
                  </td>
                  {/* Canteado — clickable to toggle X, pre-filled */}
                  {["cl1","cl2","ca1","ca2"].map(field => (
                    <td key={field} style={{ ...cellStyle(), cursor: "pointer", color: row[field] ? "#c00" : "#ddd",
                      fontWeight: 700, fontSize: 14, userSelect: "none" }}
                      onClick={() => toggleCell(i, field)}>
                      {row[field] || "·"}
                    </td>
                  ))}
                  {/* Ranuras — clickable */}
                  {["rl","ra"].map(field => (
                    <td key={field} style={{ ...cellStyle(), cursor: "pointer", color: row[field] ? "#c00" : "#ddd",
                      fontWeight: 700, fontSize: 14, userSelect: "none" }}
                      onClick={() => toggleCell(row.id, field)}>
                      {row[field] || "·"}
                    </td>
                  ))}
                  {/* Bisagras — clickable */}
                  {["hbl","hba"].map(field => (
                    <td key={field} style={{ ...cellStyle(), cursor: "pointer", color: row[field] ? "#c00" : "#ddd",
                      fontWeight: 700, fontSize: 14, userSelect: "none" }}
                      onClick={() => toggleCell(row.id, field)}>
                      {row[field] || "·"}
                    </td>
                  ))}
                  {/* Delete row */}
                  <td className="desglose-noprint" style={{ border: "none", padding: "0 2px" }}>
                    <button onClick={() => setRows(rs => rs.filter(r => r.id !== row.id))}
                      style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer",
                        fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                      title="Eliminar fila">×</button>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ background: "#e8e8e8", fontWeight: 700 }}>
                <td style={cellStyle()} colSpan={7}>Total</td>
                <td style={cellStyle({ fontWeight: 700 })}>{totalCant}</td>
                <td style={cellStyle()} colSpan={7}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add row button */}
        <div className="desglose-noprint" style={{ marginTop: 8 }}>
          <button onClick={() => {
            const newId = "manual-" + Date.now();
            setRows(rs => [...rs, {
              id: newId, largo: "", ancho: "", grosor: "", cant: 1,
              nombre: "—", material: "", cl1: "X", cl2: "X", ca1: "X", ca2: "X",
              vetas: "", rl: "", ra: "", hbl: "", hba: "", isHardboard: false,
            }]);
          }} style={{ padding: "6px 16px", background: "#f5f5f5", border: "1.5px dashed #bbb",
            borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#444" }}>
            + Agregar fila manual
          </button>
        </div>

        {/* Notes */}
        <div className="desglose-noprint" style={{ marginTop: 14, fontSize: 10, color: "#555", maxWidth: 420,
          border: "1px solid #ccc", padding: "8px 12px", borderRadius: 4 }}>
          <strong>NOTAS:</strong><br/>
          1. Sobrantes deben ser retirados con la producción de lo contrario no somos responsables de los mismos.<br/>
          2. Después de notificados que su trabajo está listo deben retirar en un plazo no mayor de 72 horas de lo contrario se cobrará un servicio de almacenamiento de RD$1,000.00 diarios por producción.
        </div>

        {/* Custom Materials Modal */}
        {showCustomMat && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 4000,
            display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowCustomMat(false)}>
            <div style={{ background: "#fff", borderRadius: 12, width: 480, maxWidth: "95vw",
              maxHeight: "80vh", display: "flex", flexDirection: "column",
              boxShadow: "0 12px 48px rgba(0,0,0,0.3)", padding: 24 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>⭐ Mis Materiales</div>
                <button onClick={() => setShowCustomMat(false)}
                  style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888" }}>×</button>
              </div>
              {/* Add new */}
              <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: "#444" }}>Agregar material</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={newMatCode} onChange={e => setNewMatCode(e.target.value)}
                    placeholder="Código (ej. L021)" maxLength={12}
                    style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px", fontSize: 12, width: 110 }} />
                  <input value={newMatName} onChange={e => setNewMatName(e.target.value)}
                    placeholder="Nombre del material *"
                    style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 10px", fontSize: 12, flex: 1, minWidth: 140 }} />
                  <input type="color" value={newMatColor} onChange={e => setNewMatColor(e.target.value)}
                    title="Color del swatch"
                    style={{ width: 38, height: 34, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 2 }} />
                  <button onClick={saveCustomMat}
                    style={{ padding: "6px 14px", background: "#E4572E", color: "#fff", border: "none",
                      borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    + Agregar
                  </button>
                </div>
              </div>
              {/* List */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {customMaterials.length === 0 && (
                  <div style={{ color: "#aaa", textAlign: "center", padding: 30, fontSize: 13 }}>
                    No tienes materiales guardados aún.
                  </div>
                )}
                {customMaterials.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px",
                    borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: m.bg, flexShrink: 0,
                      border: "1px solid rgba(0,0,0,0.1)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{m.code} — {m.name}</div>
                    </div>
                    <button onClick={() => {
                      const val = `${m.code} ${m.name}`;
                      setGlobalMaterial(val);
                      setShowCustomMat(false);
                    }} style={{ padding: "4px 10px", background: "#f0f0f0", border: "none",
                      borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                      Usar
                    </button>
                    <button onClick={() => deleteCustomMat(i)}
                      style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Material Picker */}
        {pickerOpen && (
          <MaterialPicker
            customMaterials={customMaterials}
            onClose={() => setPickerOpen(null)}
            onSelect={(val) => {
              if (pickerOpen.target === "global") {
                setGlobalMaterial(val);
              } else {
                updateRow(pickerOpen.idx, "material", val);
              }
              setPickerOpen(null);
            }}
          />
        )}

        {/* Footer buttons */}
        <div className="desglose-noprint" style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          {/* Save row */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
            <select value={saveSheetName}
              onChange={e => {
                const val = e.target.value;
                setSaveSheetName(val);
                if (val && val !== "__new__") {
                  const found = savedSheets.find(s => s.name === val);
                  if (found) loadSheet(found);
                }
              }}
              style={{ border: "1px solid #bbb", borderRadius: 6, padding: "7px 10px", fontSize: 12, width: 220, background: "#fff" }}>
              <option value="__new__">— Nueva hoja —</option>
              {savedSheets.map((s, i) => (
                <option key={i} value={s.name}>{s.name} · {s.date}</option>
              ))}
            </select>
            <button onClick={(e) => {
              e.stopPropagation();  // prevent click from bubbling to overlay
              const name = saveSheetName && saveSheetName !== "__new__" ? saveSheetName : (projectName || "Hoja sin nombre");
              const now = new Date();
              const date = now.toLocaleDateString("es-DO") + " " + now.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
              const sheet = { name, date, rows, globalMaterial, factura, nombre, telefono };
              const existing = savedSheets.findIndex(s => s.name === name);
              let updated;
              if (existing >= 0) {
                updated = [...savedSheets];
                updated[existing] = sheet;
              } else {
                updated = [sheet, ...savedSheets.slice(0, 19)];
              }
              setSavedSheets(updated);
              try { localStorage.setItem("savedDesgloseSheets", JSON.stringify(updated)); } catch {}
              alert("Hoja guardada: " + name);
              onClose();
            }}
              style={{ padding: "8px 14px", background: "#276221", color: "#fff", border: "none",
                borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
              💾 Guardar hoja
            </button>
            <button onClick={() => {
              if (window.confirm("Rebuild? Your X marks, material, and client info will be kept.")) {
                const fresh = buildRows(activeCabs);
                setRows(fresh.map(newRow => {
                  const existing = rows.find(r => r.nombre === newRow.nombre && r.largo === newRow.largo && r.ancho === newRow.ancho);
                  if (!existing) return newRow;
                  return {
                    ...newRow,
                    vetas: existing.vetas,
                    cl1: existing.cl1, cl2: existing.cl2, ca1: existing.ca1, ca2: existing.ca2,
                    rl: existing.rl, ra: existing.ra, hbl: existing.hbl, hba: existing.hba,
                    material: existing._matOverride ? existing.material : newRow.material,
                    _matOverride: existing._matOverride,
                  };
                }));
                // preserve client info — don't touch nombre, telefono, factura, globalMaterial
              }
            }}
              style={{ padding: "8px 14px", background: "#555", color: "#fff", border: "none",
                borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
              🔄 Rebuild
            </button>
            <button onClick={() => setShowSaved(true)}
              style={{ padding: "8px 14px", background: "#f0f0f0", color: "#333", border: "1px solid #ddd",
                borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
              📂 Hojas guardadas {savedSheets.length > 0 ? `(${savedSheets.length})` : ""}
            </button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={confirmClose}
              style={{ padding: "9px 20px", border: "1.5px solid #bbb", borderRadius: 8, background: "#fff",
                cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {ms("Close", "Cerrar")}
            </button>
            <button onClick={() => {
              const el = document.querySelector('.desglose-print-area');
              if (!el) return;
              const win = window.open('', '_blank', 'width=1100,height=800');
              const css = [
                '@page{size:A4 landscape;margin:6mm}',
                '*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}',
                'body{font-size:8px}',
                'table{border-collapse:collapse;width:100%;font-size:8px;table-layout:auto}',
                'th,td{border:0.5px solid #888;padding:2px 3px;text-align:center;vertical-align:middle;white-space:nowrap}',
                'th{background:#ddd;font-weight:700;font-size:7.5px}',
                'td.left,span.left{text-align:left;white-space:nowrap}',
                'tr:nth-child(even) td{background:#f5f5f5}',
                'tr.total td{background:#ddd;font-weight:700}',
                '.red{color:#c00;font-weight:700;font-size:11px}',
                '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:2mm;border-bottom:1px solid #333;padding-bottom:1.5mm}',
                '.hdr h1{font-size:9px;font-weight:700}',
                '.hdr .meta{font-size:7.5px;text-align:right;color:#555}',
                '.cinfo{display:flex;gap:10px;margin-bottom:2mm;font-size:7.5px}',
                '.cinfo label{display:flex;gap:3px;align-items:center}',
                '.cinfo span{border-bottom:0.5px solid #888;min-width:50px;display:inline-block}',
              ].join('');
              win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Corte y Canteado</title><style>' + css + '</style></head><body>');
              win.document.write('<div class="hdr"><h1>FORMULARIO DE SERVICIO: CORTE Y CANTEADO</h1><div class="meta">Fecha: ' + new Date().toLocaleDateString('es-DO') + '<br>Proyecto: ' + (projectName || '') + '</div></div>');
              win.document.write('<div class="cinfo"><label>Factura No.: <span>' + factura + '</span></label><label>Nombre: <span>' + nombre + '</span></label><label>Tel.: <span>' + telefono + '</span></label></div>');
              const tbl = el.querySelector('table');
              if (tbl) {
                const clone = tbl.cloneNode(true);
                clone.querySelectorAll('input').forEach(function(inp) {
                  var sp = document.createElement('span');
                  sp.textContent = inp.value;
                  if (inp.style.textAlign === 'left') sp.className = 'left';
                  inp.parentNode.replaceChild(sp, inp);
                });
                clone.querySelectorAll('button,.desglose-noprint').forEach(function(b) { b.remove(); });
                // Remove any inline styles that would override our print CSS
                clone.querySelectorAll('td,th').forEach(function(cell) {
                  cell.style.cssText = '';
                  if (cell.className && cell.className.includes('left')) cell.className = 'left';
                  else cell.className = '';
                });
                // Mark total row
                var rows = clone.querySelectorAll('tr');
                rows.forEach(function(r) {
                  var first = r.querySelector('td');
                  if (first && first.colSpan > 3) r.className = 'total';
                });
                win.document.write(clone.outerHTML);
              }
              win.document.write('</body></html>');
              win.document.close();
              win.focus();
              setTimeout(function() { win.print(); }, 400);
            }}
              style={{ padding: "9px 20px", border: "none", borderRadius: 8, background: "#E4572E",
                color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              🖨 Imprimir / Guardar PDF
            </button>
            <button onClick={async () => {
              // Load SheetJS from CDN if not already loaded
              if (!window.XLSX) {
                const script = document.createElement("script");
                script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
                document.head.appendChild(script);
                await new Promise((r) => { script.onload = r; });
              }
              const XLSX = window.XLSX;
              const headers = ["No","Material","Type","Nombre","Vetas","Largo (mm)","Ancho (mm)","Grosor (mm)","Cant.","L1","L2","A1","A2","R-L","R-A","HB-L","HB-A"];
              const data = sortedRows.map((row, i) => ({
                "No": i + 1,
                "Material": row.material || "",
                "Type": row.cabType || "",
                "Nombre": mTName(row.nombre),
                "Vetas": row.vetas || "",
                "Largo (mm)": row.largo,
                "Ancho (mm)": row.ancho,
                "Grosor (mm)": row.grosor,
                "Cant.": row.cant,
                "L1": row.cl1 || "", "L2": row.cl2 || "",
                "A1": row.ca1 || "", "A2": row.ca2 || "",
                "R-L": row.rl || "", "R-A": row.ra || "",
                "HB-L": row.hbl || "", "HB-A": row.hba || "",
              }));
              const ws = XLSX.utils.json_to_sheet(data, { header: headers });
              // Set column widths
              ws["!cols"] = [
                {wch:4},{wch:24},{wch:12},{wch:22},{wch:6},{wch:10},{wch:10},{wch:9},{wch:6},
                {wch:4},{wch:4},{wch:4},{wch:4},{wch:4},{wch:4},{wch:5},{wch:5}
              ];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Desglose");
              XLSX.writeFile(wb, (activeProjectName || "desglose") + ".xlsx");
            }}
              style={{ padding: "9px 20px", border: "none", borderRadius: 8, background: "#1D6F42",
                color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              📊 Excel
            </button>
          </div>
        </div>

        {/* Saved Sheets Modal */}
        {showSaved && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 4500,
            display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowSaved(false)}>
            <div style={{ background: "#fff", borderRadius: 12, width: 480, maxWidth: "95vw",
              maxHeight: "75vh", display: "flex", flexDirection: "column", padding: 24,
              boxShadow: "0 12px 48px rgba(0,0,0,0.3)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>📂 Hojas Guardadas</div>
                <button onClick={() => setShowSaved(false)}
                  style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888" }}>×</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {savedSheets.length === 0 && (
                  <div style={{ color: "#aaa", textAlign: "center", padding: 30, fontSize: 13 }}>
                    No hay hojas guardadas aún.
                  </div>
                )}
                {[...savedSheets].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 4px", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{s.date} · {s.rows?.length || 0} piezas</div>
                    </div>
                    <button onClick={() => loadSheet(s)}
                      style={{ padding: "5px 12px", background: "#E4572E", color: "#fff",
                        border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      Cargar
                    </button>
                    <button onClick={() => deleteSavedSheet(i)}
                      style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 18 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CabinetProject() {
  // Auth state
  const [authState, setAuthState] = useState(null); // { user, approved, isAdmin } or null if logged out
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupMode, setSignupMode] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pendingUsers, setPendingUsers] = useState([]);
  const [adminViewActive, setAdminViewActive] = useState(false);
  const [activeView, setActiveView] = useState("workbench");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  const [theme, setTheme] = useState(() => {
    try {
      let stored = localStorage.getItem("cabinetTheme") || "light";
      if (!THEME_COLORS[stored]) stored = "light"; // guard old/invalid names
      return stored;
    } catch { return "light"; }
  });
  const colors = THEME_COLORS[theme];
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme); currentTheme = newTheme;
    try { localStorage.setItem("cabinetTheme", newTheme); } catch {}
  };
  
  const [lang, setLang] = useState("en");
  const t = (key) => (translations[lang] && translations[lang][key]) || key;
  const [projectName, setProjectName] = useState("Cabinet project");
  const [showSpec, setShowSpec] = useState(false);
  const [specTab, setSpecTab] = useState("shared"); // "shared" or "generic"
  const [copied, setCopied] = useState(false);
  const [copyBox, setCopyBox] = useState(null);
  const [pdfMsg, setPdfMsg] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfName, setPdfName] = useState("cutlist.pdf");
  const [cabs, setCabs] = useState([
    { id: 1, name: "Cabinet 1", type: "base", width: "600", doorCount: 1, shelfQty: 1, falseFront: false, front: "doors", drawerCount: 3, drawerHeights: null, hingeType: "concealed", params: { ...DEFAULTS } },
  ]);
  const [selectedId, setSelectedId] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(() => {
    try { return localStorage.getItem("lastProjectId") || null; } catch { return null; }
  });
  const [currentProjectName, setCurrentProjectName] = useState("My Project");
  const [saveStatus, setSaveStatus] = useState("");

  // Persist current project selection
  React.useEffect(() => {
    if (currentProjectId) {
      try { localStorage.setItem("lastProjectId", currentProjectId); } catch {}
    }
  }, [currentProjectId]);
  React.useEffect(() => {
    if (currentProjectName) {
      try { localStorage.setItem("lastProjectName", currentProjectName); } catch {}
    }
  }, [currentProjectName]); // "saving", "saved", "error"
  const [userProjects, setUserProjects] = useState([]); // List of all user's projects
  const [showProjectList, setShowProjectList] = useState(false);
  const [showDesglose, setShowDesglose] = useState(false);
  
  // Login handler
  const handleLogin = async () => {
    if (!supabase) {
      setAuthError("Supabase not loaded yet");
      return;
    }
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      
      if (error) {
        setAuthError(error.message || "Login failed");
        return;
      }
      
      const user = data.user;
      
      const { data: profiles, error: profError } = await supabase.from("profiles").select("*").eq("id", user.id);
      const prof = profiles?.[0];
      
      const isAdmin = prof?.is_admin || false;
      
      setAuthState({ user, approved: prof?.approved || false, isAdmin });
      
      if (isAdmin) {
        const { data: pending } = await supabase.from("profiles").select("*").eq("approved", false);
        setPendingUsers(pending || []);
      }
      
      setLoginEmail("");
      setLoginPassword("");
    } catch (e) {
      setAuthError(e.message);
    }
  };

  // Signup handler
  const handleSignup = async () => {
    if (!supabase) {
      setAuthError("Supabase not loaded yet");
      return;
    }
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.signUp({ email: loginEmail, password: loginPassword });
      
      if (error) {
        setAuthError(error.message || "Signup failed");
        return;
      }
      
      const user = data.user;
      const isAdmin = loginEmail === ADMIN_EMAIL;
      
      // Create profile row
      const { error: profileError, data: profileData } = await supabase.from("profiles").insert({
        id: user.id,
        email: loginEmail,
        approved: isAdmin,
        is_admin: isAdmin,
      });

      if (profileError) {
        setAuthError(profileError.message || "Failed to create profile");
        return;
      }

      // Show message to log in
      setLoginEmail("");
      setLoginPassword("");
      setSignupMode(false);
      setAuthError("Account created! Now log in with your credentials.");
    } catch (e) {
      setAuthError(e.message);
    }
  };

  // Approve user handler (admin only)
  const handleApprove = async (userId) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("profiles").update({ approved: true }).eq("id", userId);
      if (!error) {
        setPendingUsers((u) => u.filter((p) => p.id !== userId));
      }
    } catch (e) {
    }
  };

  const handleLogout = () => {
    if (supabase) {
      supabase.auth.signOut();
    }
    setAuthState(null);
    setPendingUsers([]);
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (!currentPassword) {
      setPwError(t("Enter your current password") || "Enter your current password");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPwError(t("Password must be at least 6 characters") || "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t("Passwords do not match") || "Passwords do not match");
      return;
    }
    if (!supabase) return;
    setPwStatus("saving");
    try {
      // Verify current password by re-authenticating before allowing the change
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authState.user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setPwStatus("error");
        setPwError(t("Current password is incorrect") || "Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPwStatus("error");
        setPwError(error.message);
        return;
      }
      setPwStatus("success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwStatus(""), 3000);
    } catch (e) {
      setPwStatus("error");
      setPwError(String(e));
    }
  };

  const handleChangeEmail = async () => {
    setEmailError("");
    if (!newEmail || !newEmail.includes("@")) {
      setEmailError(t("Enter a valid email address") || "Enter a valid email address");
      return;
    }
    if (newEmail === authState?.user?.email) {
      setEmailError(t("That is already your email") || "That is already your email");
      return;
    }
    if (!supabase) return;
    setEmailStatus("saving");
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        setEmailStatus("error");
        setEmailError(error.message);
        return;
      }
      setEmailStatus("success");
      setNewEmail("");
      setTimeout(() => setEmailStatus(""), 5000);
    } catch (e) {
      setEmailStatus("error");
      setEmailError(String(e));
    }
  };

  // Save project to Supabase
  const saveProject = async (projectId, name, cabinets) => {
    if (!supabase || !authState?.user?.id) return;
    
    try {
      setSaveStatus("saving");
      const currentLocked = userProjects.find(p => p.id === projectId)?.locked || false;
      const { error } = await supabase.from("cabinet_projects").upsert({
        id: projectId,
        user_id: authState.user.id,
        name: name,
        cabs: cabinets,
        locked: currentLocked,
        updated_at: new Date().toISOString(),
      });
      
      if (error) {
        setSaveStatus("error");
      } else {
        setSaveStatus("saved");
        // Update the project in userProjects list
        setUserProjects((projects) =>
          projects.map((p) =>
            p.id === projectId ? { ...p, name: name, cabs: cabinets, locked: currentLocked, updated_at: new Date().toISOString() } : p
          )
        );
        setTimeout(() => setSaveStatus(""), 2000);
      }
    } catch (e) {
      setSaveStatus("error");
    }
  };

  // Load user's projects from Supabase
  const loadUserProjects = async () => {
    if (!supabase || !authState?.user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("cabinet_projects")
        .select("*")
        .eq("user_id", authState.user.id)
        .order("updated_at", { ascending: false });
      
      if (error) {
        return;
      }
      
      if (data && data.length > 0) {
        setUserProjects(data);
        // Load saved project (from last session) or most recent
        const savedProjId = currentProjectId;
        const project = (savedProjId && data.find(p => p.id === savedProjId)) || data[0];
        setCurrentProjectId(project.id);
        setCurrentProjectName(project.name);
        setCabs(project.cabs || []);
        if (project.cabs?.length > 0) {
          setSelectedId(null);
        }
      } else {
        setUserProjects([]);
        // Create a new default project
        const newProjectId = crypto.randomUUID();
        setCurrentProjectId(newProjectId);
        setCurrentProjectName("My Project");
        await saveProject(newProjectId, "My Project", cabs);
      }
    } catch (e) {
    }
    setProjectsLoaded(true);
  };

  // Create a new project
  const createNewProject = async () => {
    const newProjectId = crypto.randomUUID();
    const newProjectName = `Project ${new Date().toLocaleDateString()}`;
    const defaultCabs = [
      { id: 1, name: "Cabinet 1", type: "base", width: "600", doorCount: 1, shelfQty: 1, falseFront: false, front: "doors", drawerCount: 3, drawerHeights: null, params: { ...DEFAULTS } },
    ];
    
    setCurrentProjectId(newProjectId);
    setCurrentProjectName(newProjectName);
    setCabs(defaultCabs);
    setSelectedId(null);
    setShowProjectList(false);
    
    await saveProject(newProjectId, newProjectName, defaultCabs);
    await loadUserProjects();
  };

  const [isSwitching, setIsSwitching] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pwStatus, setPwStatus] = useState(""); // "", "saving", "success", "error"
  const [pwError, setPwError] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState(""); // "", "saving", "success", "error"
  const [emailError, setEmailError] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirm, setRecoveryConfirm] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [recoveryError, setRecoveryError] = useState("");

  // Switch to a different project
  const switchProject = async (projectId) => {
    const project = userProjects.find(p => p.id === projectId);
    if (!project) return;
    
    // Save current project first before switching
    if (currentProjectId && cabs.length > 0) {
      await saveProject(currentProjectId, currentProjectName, cabs);
    }
    
    setIsSwitching(true);
    setCurrentProjectId(project.id);
    setCurrentProjectName(project.name);
    setCabs(project.cabs || []);
    if (project.cabs?.length > 0) {
      setSelectedId(null);
    }
    setShowProjectList(false);
    // Allow state to settle before re-enabling auto-save
    setTimeout(() => setIsSwitching(false), 1500);
  };

  // Delete a project
  const deleteProject = async (projectId) => {
    if (!supabase) return;
    const tText = (key) => translations[lang][key] || translations["en"][key] || key;
    if (!confirm(tText("Delete this project? This cannot be undone."))) return;
    
    try {
      await supabase.from("cabinet_projects").delete().eq("id", projectId);
      
      if (projectId === currentProjectId) {
        await loadUserProjects();
      } else {
        setUserProjects(userProjects.filter(p => p.id !== projectId));
      }
      setShowProjectList(false);
    } catch (e) {
    }
  };

  const toggleLockProject = async (proj) => {
    if (!supabase) return;
    const newLocked = !proj.locked;
    try {
      await supabase.from("cabinet_projects").update({ locked: newLocked }).eq("id", proj.id);
      setUserProjects(prev => prev.map(p => p.id === proj.id ? { ...p, locked: newLocked } : p));
    } catch (e) {}
  };

  const duplicateProject = async (proj) => {
    if (!supabase) return;
    const newName = proj.name + " (copy)";
    try {
      const { data, error } = await supabase
        .from("cabinet_projects")
        .insert([{ name: newName, user_id: authState.user.id, cabs: proj.cabs || [] }])
        .select()
        .single();
      if (!error && data) {
        setUserProjects(prev => [data, ...prev]);
      }
    } catch (e) {}
  };

  // Load Supabase library from CDN on mount
  useEffect(() => {
    const loadSupabase = async () => {
      if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return;
      }

      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0";
        script.async = true;
        script.onload = () => {
          if (window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            resolve();
          }
        };
        script.onerror = () => {
          setAuthLoading(false);
          resolve();
        };
        document.head.appendChild(script);
      });
    };

    loadSupabase().then(() => {
      // After Supabase loads, check auth
      checkAuth();
      if (supabase) {
        supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") {
            setRecoveryMode(true);
          }
        });
      }
    });
  }, []);

  const handleRecoverySubmit = async () => {
    setRecoveryError("");
    if (!recoveryPassword || recoveryPassword.length < 6) {
      setRecoveryError("Password must be at least 6 characters");
      return;
    }
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError("Passwords do not match");
      return;
    }
    if (!supabase) return;
    setRecoveryStatus("saving");
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) {
        setRecoveryStatus("error");
        setRecoveryError(error.message);
        return;
      }
      setRecoveryStatus("success");
      // Clean the recovery token out of the URL and drop back into the normal app
      try { window.history.replaceState(null, "", window.location.pathname); } catch {}
      setTimeout(() => {
        setRecoveryMode(false);
        setRecoveryPassword("");
        setRecoveryConfirm("");
        setRecoveryStatus("");
        checkAuth();
      }, 1500);
    } catch (e) {
      setRecoveryStatus("error");
      setRecoveryError(String(e));
    }
  };

  const checkAuth = async () => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profiles, error } = await supabase.from("profiles").select("*").eq("id", user.id);
        const prof = profiles?.[0];
        
        if (error) {
          setAuthLoading(false);
          return;
        }
        
        const isAdmin = prof?.is_admin || false;
        setAuthState({ user, approved: prof?.approved || false, isAdmin });

        if (isAdmin) {
          const { data: pending } = await supabase.from("profiles").select("*").eq("approved", false);
          setPendingUsers(pending || []);
        }
      }
    } catch (e) {
    } finally {
      setAuthLoading(false);
    }
  };

  // Load projects when user logs in
  useEffect(() => {
    if (authState?.user?.id) {
      loadUserProjects();
      setMobileNavOpen(false);
    }
  }, [authState?.user?.id]);

  // Auto-save projects when cabinets change (debounced)
  useEffect(() => {
    if (!currentProjectId || !authState?.user?.id || cabs.length === 0 || isSwitching || !projectsLoaded) return;
    
    const timer = setTimeout(() => {
      saveProject(currentProjectId, currentProjectName, cabs);
    }, 1000); // Save 1 second after last change
    
    return () => clearTimeout(timer);
  }, [cabs, currentProjectName]);

  // Close projects dropdown when clicking outside
  useEffect(() => {
    if (!showProjectList) return;
    
    const handleClickOutside = (e) => {
      // Check if click is outside the projects dropdown
      if (!e.target.closest('.projects-dropdown-container')) {
        setShowProjectList(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectList]);

  const setP = (k) => (v) => {
    let val;
    if (typeof v === "boolean") {
      val = v;
    } else if (k === "backType") {
      val = v; // Keep as string for backType
    } else if (v === "") {
      val = "";
    } else {
      val = Number(v);
    }
    if (selectedCab) updateCab(selectedId, { params: { ...selectedCab.params, [k]: val } });
  };
  
  const updateCab = (id, patch) => {
    setCabs((cs) => cs.map((c) => {
      if (c.id !== id) return c;
      // Deep copy params if being updated
      if (patch.params) {
        return { ...c, params: { ...c.params, ...patch.params } };
      }
      return { ...c, ...patch };
    }));
  };
  const addCab = () => {
    const id = nextCabId(cabs);
    const nc = { ...newCab(cabs.length + 1), id, params: { ...DEFAULTS } };
    setCabs((cs) => [...cs, nc]);
    setSelectedId(id);
  };
  const moveCab = (id, dir) => {
    setCabs((cs) => {
      const i = cs.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const next = cs.slice();
      const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
      return next;
    });
  };
  const duplicateCab = (id) => {
    const src = cabs.find((c) => c.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: nextCabId(cabs),
      params: { ...(src.params || DEFAULTS) },
      drawerHeights: src.drawerHeights ? [...src.drawerHeights] : null,
    };
    setCabs((cs) => {
      const i = cs.findIndex((c) => c.id === id);
      const next = cs.slice();
      next.splice(i + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
  };
  const removeCab = (id) => {
    setCabs((cs) => cs.filter((c) => c.id !== id));
    if (id === selectedId) { const rest = cabs.filter((c) => c.id !== id); setSelectedId(rest.length ? rest[0].id : null); }
  };

  const selectedCab = cabs.find((c) => c.id === selectedId) || cabs[0] || null;
  const currentProject = userProjects.find(p => p.id === currentProjectId);
  const isLocked = currentProject ? !!currentProject.locked : false;
  const selectedIndex = cabs.indexOf(selectedCab);

  const p = (selectedCab && selectedCab.params) || DEFAULTS;

  const summary = useMemo(() => {
    let area = 0, pieces = 0, n = 0, hbArea = 0, hbPieces = 0;
    let totalShelfPins = 0, totalHinges = 0, totalSlides = 0, totalHandles = 0;
    const items = [];
    cabs.forEach((c) => {
      const W = parseFloat(c.width);
      const p = c.params || DEFAULTS;
      if (isNaN(W) || W <= 2 * p.t + 10) return;
      const cabQty = c.qty || 1;
      const d = buildCutList(W, p, c);
      area += d.area * cabQty; pieces += d.pieces * cabQty; hbArea += d.hbArea * cabQty; hbPieces += d.hbPieces * cabQty; n += cabQty;
      totalShelfPins += d.hardware.shelfPins * cabQty;
      totalHinges += d.hardware.hinges * cabQty;
      totalSlides += d.hardware.drawerSlides * cabQty;
      totalHandles += d.hardware.handles * cabQty;
      d.parts.forEach((x) => {
        if (x.material === "hardboard") return;
        for (let i = 0; i < x.qty * cabQty; i++) items.push({ w: x.a, h: x.b });
      });
    });
    const p = (selectedCab && selectedCab.params) || DEFAULTS;
    const board = estimateBoards(items, p);
    return { area, pieces, n, board, hbArea, hbPieces, shelfPins: totalShelfPins, hinges: totalHinges, slides: totalSlides, handles: totalHandles };
  }, [cabs, selectedCab]);

  const exportProjectToPDF = async () => {
    try {
      const doc = new MiniPDF();
      const pageW = 297, pageH = 210, M = 8;
      let y = M;
      const col = { elem: M, nombre: M + 10, cant: M + 60, largo: M + 68, ancho: M + 76, grosor: M + 84, desc: M + 92, l1: M + 125, l2: M + 135, c1: M + 145, c2: M + 155 };
      const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Elem", col.elem, y);
        doc.text("Nombre", col.nombre, y);
        doc.text("Cant", col.cant, y);
        doc.text("Largo", col.largo, y);
        doc.text("Ancho", col.ancho, y);
        doc.text("Grosor", col.grosor, y);
        doc.text("Desc", col.desc, y);
        doc.text("L1", col.l1, y);
        doc.text("L2", col.l2, y);
        doc.text("C1", col.c1, y);
        doc.text("C2", col.c2, y);
        doc.line(M, y + 2, pageW - M, y + 2);
        y += 5;
      };
      drawHeader();
      const bandAll = new Set(["Door", "Door (pair)", "Door (flap, stacked)", "False front", "False drawer front", "Drawer front", "Blind / filler panel"]);
      const bandFront = new Set(["Side", "Top", "Bottom", "Shelf", "Separator (fixed)"]);
      cabs.forEach((cab, cabIdx) => {
        const W = parseFloat(cab.width);
        const p2 = cab.params || DEFAULTS;
        if (isNaN(W) || W <= 2 * p2.t + 10) return;
        const cutList = buildCutList(W, p2, cab);
        cutList.parts.forEach((part) => {
          if (part.material === "hardboard") return;
          const longDim = Math.max(part.a, part.b);
          const shortDim = Math.min(part.a, part.b);
          const hasL = bandAll.has(part.part);
          const hasC = bandFront.has(part.part) || bandAll.has(part.part);
          if (y + 3 > pageH - M) { doc.addPage(); y = M; drawHeader(); }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text(String(cabIdx + 1), col.elem, y);
          doc.text(part.part.substring(0, 28), col.nombre, y);
          doc.text(String(part.qty), col.cant, y);
          doc.text(String(Math.round(longDim)), col.largo, y);
          doc.text(String(Math.round(shortDim)), col.ancho, y);
          doc.text(String(p2.t), col.grosor, y);
          if (hasL) doc.text("x", col.l1, y);
          if (hasL) doc.text("x", col.l2, y);
          if (hasC) doc.text("x", col.c1, y);
          if (hasC) doc.text("x", col.c2, y);
          y += 3.5;
        });
      });
      const pdfBlob = doc.asBlob ? doc.asBlob() : new Blob([doc.output()], { type: "application/pdf" });
      sharePdf(pdfBlob, `${currentProjectName || "project"}_export.pdf`);
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const copyAll = async () => {
    const blocks = cabs.map((c, i) => {
      const W = parseFloat(c.width);
      const p = c.params || DEFAULTS;
      if (isNaN(W) || W <= 2 * p.t + 10) return `${cabLabel(c, i, t)}: (${t("Width")} ?)`;
      const cabQty = c.qty || 1;
      const d = buildCutList(W, p, c);
      return [`${cabLabel(c, i, t)} — ${t(TYPES[c.type].label)} — ${W} mm`,
        ...d.parts.map((x) => `  ${x.qty * cabQty}×  ${tName(x.part, t).padEnd(20)} ${fmt(x.a)} × ${fmt(x.b)} (${t(x.aLabel)} × ${t(x.bLabel)})`)].join("; currentTheme = theme;\n");
    });
    const p = (selectedCab && selectedCab.params) || DEFAULTS;
    const text = [`${projectName} — ${today} — ${p.t}mm ${t("melamine")}`, "", ...blocks, "",
      `TOTAL: ${summary.pieces} ${t("pieces")} · ${summary.area.toFixed(2)} m²`
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = async () => {
    setPdfMsg("Building PDF…");
    try {
      const doc = new MiniPDF();
      const M = 14, right = 210 - M, bottom = 297 - M;
      let y = M;
      const need = (h) => { if (y + h > bottom) { doc.addPage(); y = M; } };
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20, 23, 15);
      doc.text(projectName || t("Cut list"), M, y); y += 8;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 94, 82);
      doc.text(`${today}  ·  ${p.t} mm ${t("melamine")}  ·  ${t("millimetres")}`, M, y); y += 4;
      doc.setDrawColor(20); doc.setLineWidth(0.5); doc.line(M, y, right, y); y += 9;

      cabs.forEach((c, ci) => {
        const Wd = parseFloat(c.width);
        if (isNaN(Wd) || Wd <= 2 * p.t + 10) return;
        const cabQty = c.qty || 1;
        const d = buildCutList(Wd, p, c);
        need(20);
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20, 23, 15);
        doc.text(cabLabel(c, ci, t), M, y); y += 5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 94, 82);
        doc.text(`${t(TYPES[c.type].label)} · ${Wd} mm`, M, y);
        y += 4; doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(M, y, right, y); y += 6;
        d.parts.forEach((x) => {
          const noteLines = doc.splitTextToSize(`${t(x.aLabel)} × ${t(x.bLabel)} — ${trNote(x.note, lang)}`, right - M);
          need(5 + noteLines.length * 3.4 + 2);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20, 23, 15);
          doc.text(`${x.qty * cabQty}×  ${tName(x.part, t)}`, M, y);
          doc.setFont("courier", "bold"); doc.setFontSize(11);
          doc.text(`${fmt(x.a)} × ${fmt(x.b)} mm`, right, y, { align: "right" }); y += 4.4;
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 124, 112);
          doc.text(noteLines, M, y); y += noteLines.length * 3.4 + 4;
        });
        doc.setDrawColor(120); doc.setLineWidth(0.2); doc.line(M, y - 3, right, y - 3);
        doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(90, 94, 82);
        doc.text(`${d.pieces} ${t("pieces")} · ${d.area.toFixed(2)} m²`, right, y, { align: "right" }); y += 9;
      });

      need(18);
      doc.setDrawColor(20); doc.setLineWidth(0.5); doc.line(M, y, right, y); y += 7;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 23, 15);
      doc.text(t("Material total"), M, y);
      doc.setFont("courier", "bold");
      doc.text(`${summary.pieces} ${t("pieces")} · ${summary.area.toFixed(2)} m²`, right, y, { align: "right" }); y += 7;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(`${t("Boards")} ${p.boardW} × ${p.boardH}`, M, y);
      doc.setFont("courier", "bold");
      doc.text(`${t("about")} ${summary.board.boards}`, right, y, { align: "right" });
      if (summary.hbPieces > 0) {
        y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 94, 82);
        doc.text(`${t("Hardboard backs (separate sheet):")} ${summary.hbPieces} ${t("pcs")} · ${summary.hbArea.toFixed(2)} m²`, M, y);
      }
      if (summary.shelfPins > 0 || summary.hinges > 0 || summary.slides > 0 || summary.handles > 0) {
        y += 8; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 23, 15);
        doc.text(t("Hardware & fasteners"), M, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 94, 82);
        if (summary.shelfPins > 0) { doc.text(`${t("Shelf pins:")} ${summary.shelfPins}`, M, y); y += 4; }
        if (summary.hinges > 0) { doc.text(`${t("Hinges (2 per door):")} ${summary.hinges}`, M, y); y += 4; }
        if (summary.slides > 0) { doc.text(`${t("Drawer slide pairs:")} ${summary.slides}`, M, y); y += 4; }
        if (summary.handles > 0) { doc.text(`${t("Handles / knobs:")} ${summary.handles}`, M, y); y += 4; }
      }

      const fname = `${(projectName || "cutlist").trim().replace(/\s+/g, "_")}.pdf`;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setPdfName(fname);
      setPdfBlob(blob);
      sharePdf(blob, fname);
      setPdfMsg("");
    } catch (e) {
      setPdfMsg("Couldn't generate the PDF here — use Copy text and paste it instead.");
    }
  };

  const downloadShopPDF = async () => {
    setPdfMsg("Building shop drawings…");
    try {
      const doc = new MiniPDF();
      const M = 14, right = 210 - M, bottom = 297 - M;
      const valid = cabs.filter((c) => { const W = parseFloat(c.width); return !isNaN(W) && W > 2 * p.t + 10; });
      if (valid.length === 0) {
        doc.setFont("courier", "normal"); doc.setFontSize(12); doc.setTextColor(40, 40, 40);
        doc.text(t("No valid cabinets to draw."), M, M + 10);
      }
      valid.forEach((c, idx) => {
        if (idx > 0) doc.addPage();
        const Wd = parseFloat(c.width);
        const cabQty = c.qty || 1;
        const d = buildCutList(Wd, p, c);
        let y = M;
        // header
        doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(120, 124, 112);
        doc.text(`${projectName || t("Cabinet")}  ·  ${today}  ·  ${t("sheet")} ${idx + 1}/${valid.length}`, M, y); y += 5;
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(20, 23, 15);
        doc.text(cabLabel(c, cabs.indexOf(c), t), M, y); y += 5.5;
        doc.setFont("courier", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 94, 82);
        doc.text(`${t(TYPES[c.type].label)} · ${Wd} mm · ${p.t}mm ${t("board")}`, M, y); y += 3;
        doc.setDrawColor(20); doc.setLineWidth(0.4); doc.line(M, y, right, y); y += 3;
        // elevation
        const boxY = y, boxH = 124;
        drawCabinetElevation(doc, M, boxY, right - M, boxH, Wd, p, c.shelfQty, d.faces);
        y = boxY + boxH + 2;
        doc.setDrawColor(185); doc.setLineWidth(0.25); doc.line(M, y, right, y); y += 5;
        // cut list
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20, 23, 15);
        doc.text(t("Cut list"), M, y);
        doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(90, 94, 82);
        doc.text(`${d.pieces} ${t("pcs")} · ${d.area.toFixed(2)} m²`, right, y, { align: "right" }); y += 5;
        d.parts.forEach((x) => {
          if (y > bottom - 8) { doc.addPage(); y = M; }
          doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20, 23, 15);
          doc.text(`${x.qty * cabQty}x  ${tName(x.part, t)}`, M, y);
          doc.setFont("courier", "bold"); doc.setFontSize(10); doc.setTextColor(20, 23, 15);
          doc.text(`${fmt(x.a)} × ${fmt(x.b)} mm`, right, y, { align: "right" }); y += 4;
          if (x.note) {
            doc.setFont("courier", "normal"); doc.setFontSize(7.5); doc.setTextColor(125, 128, 116);
            const nl = doc.splitTextToSize(`${t(x.aLabel)} × ${t(x.bLabel)} — ${trNote(x.note, lang)}`, right - M);
            doc.text(nl, M, y); y += nl.length * 3.2 + 3.2;
          } else { y += 2.5; }
        });
        // hardware
        const hw = d.hardware || {};
        const hwparts = [];
        if (hw.hinges) hwparts.push(`${hw.hinges} ${t("hinges")}`);
        if (hw.drawerSlides) hwparts.push(`${hw.drawerSlides} ${t("slide pairs")}`);
        if (hw.shelfPins) hwparts.push(`${hw.shelfPins} ${t("shelf pins")}`);
        if (hw.handles) hwparts.push(`${hw.handles} ${t("handles")}`);
        if (hwparts.length) {
          if (y > bottom - 12) { doc.addPage(); y = M; }
          y += 1; doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20, 23, 15);
          doc.text(t("Hardware"), M, y);
          doc.setFont("courier", "normal"); doc.setFontSize(9); doc.setTextColor(90, 94, 82);
          doc.text(hwparts.join("   ·   "), right, y, { align: "right" });
        }
      });
      const fname = `${(projectName || "shop_drawing").trim().replace(/\s+/g, "_")}_shop.pdf`;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setPdfName(fname);
      setPdfBlob(blob);
      sharePdf(blob, fname);
      setPdfMsg("");
    } catch (e) {
      setPdfMsg("Couldn't build the shop drawing — try again or use Copy text.");
    }
  };

  if (recoveryMode) {
    return <RecoveryScreen recoveryPassword={recoveryPassword} setRecoveryPassword={setRecoveryPassword}
      recoveryConfirm={recoveryConfirm} setRecoveryConfirm={setRecoveryConfirm}
      recoveryError={recoveryError} recoveryStatus={recoveryStatus} handleRecoverySubmit={handleRecoverySubmit} />;
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: getColors().paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Archivo', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: getColors().ink }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!authState) {
    return <LoginScreen signupMode={signupMode} setSignupMode={setSignupMode} loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginPassword={loginPassword} setLoginPassword={setLoginPassword} authError={authError} setAuthError={setAuthError} handleLogin={handleLogin} handleSignup={handleSignup} loading={authLoading} />;
  }

  if (!authState.approved) {
    return <PendingScreen authState={authState} handleLogout={handleLogout} checkAuth={checkAuth} />;
  }


  return (
    <div className="cab-root" style={{ background: getColors().paper, color: getColors().ink, minHeight: "100%",
      padding: "18px 14px 44px", fontFamily: "'Archivo', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        html, body{overflow-x:hidden;max-width:100vw}
        .cab-root{overflow-x:hidden;max-width:100vw}
        .cab-root *{box-sizing:border-box}
        .cab-root input[type=number]{-moz-appearance:textfield}
        .cab-root input::-webkit-outer-spin-button,.cab-root input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        .cab-root input:focus,.cab-root select:focus{border-color:${getColors().amber}!important;box-shadow:0 0 0 3px rgba(228,87,46,.18)}
        .cab-name:hover{background:rgba(228,87,46,.08)!important;border-radius:6px}
        .cab-btn{transition:background .15s,color .15s}
        .cab-panels rect{transition:x .35s ease,width .35s ease}
        .cab-row{transition:background .15s}
        .cab-row:hover{background:rgba(228,87,46,.06)}
        .cab-printonly{display:none}
        @media (prefers-reduced-motion: reduce){.cab-panels rect,.cab-btn,.cab-row{transition:none}}
        @media (min-width:760px){.cab-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}.cab-card{margin-bottom:0}}
        .cab-wb{display:flex;gap:22px;align-items:flex-start;min-width:0}
        .app-shell{display:flex;gap:22px;align-items:flex-start;max-width:1320px;margin:0 auto}
        .app-rail{width:212px;flex-shrink:0;position:sticky;top:20px;border-radius:16px;padding:16px 12px;display:flex;flex-direction:column;min-height:calc(100vh - 40px)}
        .app-content{flex:1;min-width:0}
        .rail-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;border:none;background:transparent;width:100%;text-align:left;transition:background .15s,color .15s}
        .mobile-hamburger{display:none;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid ${getColors().canvasBorder};background:${getColors().canvasBtn};color:${getColors().canvasBtnText};border-radius:10px;cursor:pointer;padding:0;flex-shrink:0}
        .mobile-hamburger svg{width:18px;height:18px}
        .mobile-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999}
        @media (max-width:900px){
          .app-shell{flex-direction:column;gap:0}
          .app-rail{position:fixed;top:0;left:0;bottom:0;width:260px;min-height:100vh;height:100vh;border-radius:0;padding:20px 14px;z-index:1000;transform:translateX(-100%);transition:transform .25s ease;box-shadow:0 0 24px rgba(0,0,0,.3);flex-direction:column;flex-wrap:nowrap;overflow-y:auto}
          .app-rail.open{transform:translateX(0)}
          .app-content{width:100%}
          .mobile-hamburger{display:flex}
        }
        .cab-side{width:380px;flex-shrink:0}
        .cab-main{flex:1;min-width:0}
        .cab-card{min-width:0}
        .cab-nav{transition:background .15s,border-color .15s}
        @media (max-width:900px){.cab-wb{flex-direction:column}.cab-side{width:100%}.cab-main{width:100%;min-width:0}}
        @media (max-width:640px){
          .cab-name{font-size:20px!important}
          .projects-dropdown-menu{
            position:fixed!important;
            top:auto!important;
            left:12px!important;
            right:12px!important;
            bottom:auto!important;
            margin-top:8px!important;
            min-width:0!important;
            width:auto!important;
            max-width:none!important;
            max-height:70vh!important;
            overflow-y:auto!important;
          }
        }
        @media print{
          @page{margin:10mm}
          .cab-root{background:#fff!important;padding:0!important}
          .cab-noprint,.cab-mat{display:none!important}
          .cab-printonly{display:block!important}
          .cab-cards{display:block!important}
          .cab-card{break-inside:avoid;border:1px solid #000!important;background:#fff!important;margin-bottom:12px!important}
          .cab-root input,.cab-root select{border:none!important;background:transparent!important;color:#000!important;padding:0!important;font-weight:700}
          .cab-row:hover{background:transparent!important}
          /* Desglose print */
          body > *:not(.desglose-overlay){display:none!important}
          .desglose-overlay{position:static!important;background:none!important;padding:0!important;display:block!important}
          .desglose-print-area{box-shadow:none!important;border-radius:0!important;width:100%!important;max-width:100%!important;padding:8mm!important}
          .desglose-noprint{display:none!important}
          .desglose-print-area input{border:none!important;background:transparent!important;outline:none!important;font-size:11px!important}
          .desglose-print-area table{font-size:10px!important;border-collapse:collapse!important;width:100%!important}
          .desglose-print-area td,.desglose-print-area th{border:1px solid #888!important;padding:2px 3px!important}
          .desglose-print-area button{display:none!important}
        }
      `}</style>

      <div className="app-shell">
        {/* ── LEFT NAV RAIL ─────────────────────────────── */}
        {mobileNavOpen && <div className="mobile-backdrop" onClick={()=>setMobileNavOpen(false)} />}
        <aside className={`app-rail cab-noprint ${mobileNavOpen ? "open" : ""}`} style={{ background: getColors().card }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 8px 16px" }}>
            <div style={{ width:34, height:34, borderRadius:9, background:getColors().buttonBg, display:"grid", placeItems:"center", flexShrink:0, color:getColors().buttonText, fontWeight:800 }}>▣</div>
            <div><div style={{ color:getColors().ink, fontWeight:700, fontSize:14 }}>Cabinet APP</div><div style={{ color:getColors().mut, fontSize:11 }}>Cut-list Calculator</div></div>
          </div>
          {[
            ["workbench", t("Workbench") || "Workbench"],
            ["projects", t("Projects")],
            ["download", t("Download")],
            ["specs", t("Specs") || "Specs"],
          ].map(([k,label]) => (
            <button key={k} className="rail-item" onClick={()=>{setActiveView(k); setMobileNavOpen(false);}}
              style={{ color: activeView===k?getColors().buttonText:getColors().mut, background: activeView===k?getColors().buttonBg:"transparent" }}>
              {label}
            </button>
          ))}
          <button className="rail-item" onClick={()=>{setShowDesglose(true); setMobileNavOpen(false);}} style={{ color:getColors().mut }}>Madesol</button>
          <div style={{ height:1, background:getColors().hair, margin:"12px 8px" }} />
          {authState?.isAdmin && (
            <button className="rail-item" onClick={()=>{setActiveView("admin"); setMobileNavOpen(false);}} style={{ color: activeView==="admin"?getColors().buttonText:getColors().mut, background: activeView==="admin"?getColors().buttonBg:"transparent" }}>Admin</button>
          )}
          <button className="rail-item" onClick={()=>{setActiveView("account"); setMobileNavOpen(false);}} style={{ color: activeView==="account"?getColors().buttonText:getColors().mut, background: activeView==="account"?getColors().buttonBg:"transparent" }}>{t("Account") || "Account"}</button>
          <button className="rail-item" onClick={handleLogout} style={{ color:getColors().mut }}>{t("Log out")}</button>
          <div style={{ marginTop:"auto", display:"flex", alignItems:"center", gap:10, padding:10, borderRadius:12, background:getColors().mat }}>
            <div style={{ width:30, height:30, borderRadius:8, background:getColors().buttonBg, flexShrink:0 }} />
            <div><div style={{ color:getColors().ink, fontSize:12.5, fontWeight:600 }}>{authState?.email || "User"}</div><div style={{ color:getColors().mut, fontSize:10.5 }}>{authState?.isAdmin?"Admin":"Member"} · {lang.toUpperCase()}</div></div>
          </div>
        </aside>

        {/* ── CONTENT ─────────────────────────────── */}
        <div className="app-content">
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ borderBottom: `1px solid ${getColors().canvasBorder}`, paddingBottom: 14, marginBottom: 18,
            display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, minWidth: 0, flex: 1 }}>
              <button className="mobile-hamburger cab-noprint" onClick={()=>setMobileNavOpen(true)} aria-label="Menu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
              </button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.22em", color: getColors().canvasMut, fontWeight: 700, textTransform: "uppercase" }}>{t("Shop drawing · mm")} {saveStatus && <span style={{ fontSize: 10, color: saveStatus === "error" ? "#e74c3c" : getColors().canvasText }}>{saveStatus === "saving" ? "Saving..." : "Saved ✓"}</span>}</div>
                <input value={currentProjectName} onChange={(e) => setCurrentProjectName(e.target.value)} className="cab-name"
                  style={{ margin: "2px 0 0", fontSize: 27, fontWeight: 800, letterSpacing: "-0.01em", border: "none",
                    background: "transparent", color: getColors().canvasText, outline: "none", fontFamily: "'Archivo', sans-serif", maxWidth: "100%", width: "100%" }} />
              </div>
            </div>
            <div className="cab-noprint" style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button className="cab-btn" onClick={toggleTheme} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${getColors().canvasBorder}`, background:getColors().canvasBtn, color:getColors().canvasBtnText, cursor:"pointer", fontSize:13, fontWeight:700 }}>{theme === "dark" ? "☀️ LIGHT" : "🌙 DARK"}</button>
              <button className="cab-btn" onClick={() => setLang(lang === "en" ? "es" : "en")} style={{ padding:"7px 11px", borderRadius:8, border:`1px solid ${getColors().canvasBorder}`, background:getColors().canvasBtn, color:getColors().canvasBtnText, cursor:"pointer", fontSize:12, fontWeight:700 }}>{lang === "en" ? "ES" : "EN"}</button>
            </div>
          </div>
        {copyBox && (
          <div className="cab-noprint" style={{ marginTop: -8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: getColors().mut, marginBottom: 6 }}>
              {t("Auto-copy was blocked here — tap the box, select all, and copy:")}
            </div>
            <textarea readOnly value={copyBox} onFocus={(e) => e.target.select()}
              style={{ width: "100%", height: 180, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                padding: 10, borderRadius: 8, border: `1px solid ${getColors().hair}`, background: getColors().card, color: getColors().ink, resize: "vertical" }} />
            <button onClick={() => setCopyBox(null)} style={{ ...btn("transparent", getColors().mut, `1px solid ${getColors().hair}`), marginTop: 6 }}>{t("Close")}</button>
          </div>
        )}
        {pdfMsg && (
          <div className="cab-noprint" style={{ marginTop: -8, marginBottom: 16, fontSize: 12.5,
            color: pdfMsg.includes("Couldn't") ? getColors().rust : getColors().mut, fontFamily: "'JetBrains Mono', monospace" }}>{pdfMsg}</div>
        )}
        {pdfUrl && (
          <div className="cab-noprint" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <button onClick={() => sharePdf(pdfBlob, pdfName)} className="cab-btn" style={btn(getColors().ink, getColors().card, `1.5px solid ${getColors().ink}`)}>{t("Save file")}</button>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="cab-btn" style={{ ...btn("transparent", getColors().ink, `1.5px solid ${getColors().ink}`), textDecoration: "none" }}>{t("Open in new tab")}</a>
              <button onClick={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }} style={btn("transparent", getColors().mut, `1px solid ${getColors().hair}`)}>{t("Close")}</button>
            </div>
            <div style={{ fontSize: 12, color: getColors().mut, marginBottom: 8 }}>
              Preview below. If "Save file" does nothing, use the download / share button inside the preview, or "Open in new tab".
            </div>
            <iframe title="PDF preview" src={pdfUrl} style={{ width: "100%", height: 520, border: `1px solid ${getColors().hair}`, borderRadius: 10, background: "#fff" }} />
          </div>
        )}

          {activeView === "workbench" && (
        <div className="cab-wb">
          {/* LEFT: cabinet list */}
          <aside className="cab-side cab-noprint">
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: getColors().canvasMut, marginBottom: 8 }}>
              {t("Cabinets")}
            </div>
            {cabs.map((c, i) => {
              const on = c.id === selectedCab?.id;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "stretch", gap: 4, marginBottom: 7 }}>
                  <button className="cab-nav" onClick={() => setSelectedId(c.id)}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer",
                      padding: "11px 13px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      border: `1px solid ${on ? getColors().ink : getColors().hair}`, background: on ? getColors().ink : getColors().card, color: on ? getColors().card : getColors().ink,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cabLabel(c, i, t)}
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <button onClick={() => moveCab(c.id, -1)} disabled={i === 0} title={t("Move up")}
                      style={{ ...navMini(i === 0), flex: 1 }}>▲</button>
                    <button onClick={() => moveCab(c.id, 1)} disabled={i === cabs.length - 1} title={t("Move down")}
                      style={{ ...navMini(i === cabs.length - 1), flex: 1 }}>▼</button>
                  </div>
                  <button onClick={() => duplicateCab(c.id)} title={t("Duplicate cabinet")}
                    style={{ ...navMini(false), width: 26, minWidth: 26, fontSize: 13 }}>⧉</button>
                </div>
              );
            })}
            <button onClick={addCab} className="cab-nav" style={{ display: "block", width: "100%", textAlign: "center", cursor: "pointer",
              padding: "11px 13px", borderRadius: 10, fontSize: 14, fontWeight: 700, color: getColors().canvasMut,
              border: `1.5px dashed ${getColors().canvasBorder}`, background: "transparent" }}>
              {t("+ Add cabinet")}
            </button>
          </aside>

          {/* RIGHT: selected cabinet + totals */}
          <div className="cab-main">
            {selectedCab ? (
              <CabinetCard key={selectedCab.id} index={selectedIndex} cab={selectedCab} t={t} lang={lang} canRemove={cabs.length > 1}
                onChange={isLocked ? () => {} : (patch) => updateCab(selectedCab.id, patch)} onRemove={isLocked ? undefined : () => removeCab(selectedCab.id)} />
            ) : (
              <>
              {isLocked && (
                <div style={{ margin: "0 0 12px 0", background: "#FFF3CD", border: "1px solid #FFD700", borderRadius: 8,
                  padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#856404", display: "flex", alignItems: "center", gap: 8 }}>
                  🔒 {t("This project is locked. Unlock it from the project list to make changes.")}
                </div>
              )}
              <div style={{ padding: "32px 24px", textAlign: "center", color: getColors().canvasMut }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>👈</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: getColors().canvasText, marginBottom: 6 }}>
                  {t("Select a cabinet")}
                </div>
                <div style={{ fontSize: 13 }}>
                  {t("Click any cabinet in the list to view and edit it.")}
                </div>
              </div>
              </>
            )}
        {/* totals + boards */}
        <div style={{ background: getColors().card, color: getColors().ink, borderRadius: 12, padding: "16px", marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: getColors().amber }}>
              {t("Material total")} · {summary.n} {t(summary.n === 1 ? "cabinet" : "cabinets")}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700 }}>
              {summary.pieces} {t("pieces")} · {summary.area.toFixed(2)} m²</span>
          </div>
          <div style={{ borderTop: `1px solid ${getColors().hair}`, marginTop: 12, paddingTop: 12,
            display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut }}>
              {t("Boards needed")} · {p.boardW} × {p.boardH} mm</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: getColors().amber }}>
              ≈ {summary.board.boards}</span>
          </div>
          <div style={{ fontSize: 11.5, color: getColors().mut, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            {t("est.")} {Math.round(summary.board.utilization * 100)}% {t("used")} · {t("incl.")} {p.kerf}mm {t("kerf")}{p.allowRotate ? ` · ${t("parts may rotate")}` : ` · ${t("grain fixed")}`}
            {summary.board.oversize > 0 ? ` · ${summary.board.oversize} ${t("part(s) bigger than a board!")}` : ""}
          </div>
          <div style={{ fontSize: 11, color: getColors().mut, marginTop: 4, opacity: 0.7 }}>
            {t("Layout estimate — real nesting varies. Buy at least one spare board for offcuts and mistakes.")}
          </div>
          {summary.hbPieces > 0 && (
            <div style={{ borderTop: `1px solid ${getColors().hair}`, marginTop: 12, paddingTop: 12,
              display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut }}>
                {t("Hardboard backs (separate sheet)")}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700 }}>
                {summary.hbPieces} {t("pcs")} · {summary.hbArea.toFixed(2)} m²</span>
            </div>
          )}
          {(summary.shelfPins > 0 || summary.hinges > 0 || summary.slides > 0 || summary.handles > 0) && (
            <div style={{ borderTop: `1px solid ${getColors().hair}`, marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 8 }}>
                {t("Hardware total")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                {summary.shelfPins > 0 && <div><span style={{ fontWeight: 700 }}>{summary.shelfPins}</span> {t("shelf pins")}</div>}
                {summary.hinges > 0 && <div><span style={{ fontWeight: 700 }}>{summary.hinges}</span> {t("hinges")}</div>}
                {summary.slides > 0 && <div><span style={{ fontWeight: 700 }}>{summary.slides}</span> {t("slide pairs")}</div>}
                {summary.handles > 0 && <div><span style={{ fontWeight: 700 }}>{summary.handles}</span> {t("handles")}</div>}
              </div>
            </div>
          )}
        </div>
          </div>
        </div>
          )}
          {activeView === "projects" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:getColors().canvasMut }}>{t("Projects")}</div>
                <button onClick={createNewProject} style={{ padding:"9px 15px", background:getColors().canvasBtnText, color:getColors().canvasBtn, border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer" }}>{t("+ New Project")}</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                {userProjects.map((proj) => (
                  <div key={proj.id} style={{ background:getColors().card, border:`1px solid ${proj.id===currentProjectId?getColors().ink:getColors().hair}`, borderRadius:14, padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                      <button onClick={() => { switchProject(proj.id); setActiveView("workbench"); }} style={{ flex:1, textAlign:"left", border:"none", background:"transparent", cursor:"pointer", color:getColors().ink, fontSize:15, fontWeight:700 }}>{proj.name}</button>
                      <span style={{ fontSize:16 }}>{proj.locked ? "🔒" : ""}</span>
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:14 }}>
                      <button onClick={() => { switchProject(proj.id); setActiveView("workbench"); }} style={{ flex:1, padding:"8px", background:getColors().buttonBg, color:getColors().buttonText, border:"none", borderRadius:8, fontWeight:700, fontSize:12, cursor:"pointer" }}>{t("Open")}</button>
                      <button onClick={() => toggleLockProject(proj)} title="Lock" style={{ padding:"8px 10px", background:getColors().mat, color:getColors().ink, border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>{proj.locked?"🔓":"🔒"}</button>
                      <button onClick={() => duplicateProject(proj)} title="Duplicate" style={{ padding:"8px 10px", background:getColors().mat, color:getColors().ink, border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>⧉</button>
                      <button onClick={() => !proj.locked && deleteProject(proj.id)} title="Delete" style={{ padding:"8px 10px", background:getColors().mat, color:proj.locked?getColors().mut:"#e74c3c", border:"none", borderRadius:8, cursor:proj.locked?"not-allowed":"pointer", fontSize:13 }}>×</button>
                    </div>
                  </div>
                ))}
                {userProjects.length===0 && <div style={{ color:getColors().canvasMut, fontSize:13 }}>{t("No projects yet") || "No projects yet"}</div>}
              </div>
            </div>
          )}
          {activeView === "download" && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:getColors().canvasMut, marginBottom:16 }}>{t("Download")}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
                {[
                  [t("Download PDF"), downloadPDF],
                  ["Export Project PDF", exportProjectToPDF],
                  [t("Shop drawing PDF"), downloadShopPDF],
                  ["Madesol / Desglose", () => setShowDesglose(true)],
                  [t("Copy text"), copyAll],
                ].map(([label,fn],idx) => (
                  <button key={idx} onClick={fn} style={{ textAlign:"left", background:getColors().card, border:`1px solid ${getColors().hair}`, borderRadius:14, padding:"18px 16px", cursor:"pointer", color:getColors().ink, fontWeight:700, fontSize:14 }}>
                    ⬇ {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeView === "specs" && (
            <div>
        <div className="cab-noprint" style={{ marginTop: 14 }}>
          <button onClick={() => { setShowSpec((s) => !s); if (!showSpec) setSpecTab("shared"); }} style={{ width: "100%", textAlign: "left",
            background: "transparent", cursor: "pointer", border: `1px dashed ${getColors().canvasBorder}`, borderRadius: 10,
            padding: "11px 14px", color: getColors().canvasText, fontWeight: 700, fontSize: 13, letterSpacing: "0.04em",
            display: "flex", justifyContent: "space-between" }}>
            <span>{t("Shared specifications & assumptions")}</span>
            <span style={{ color: getColors().canvasMut }}>{showSpec ? "− hide" : "+ edit"}</span>
          </button>
          {showSpec && (
            <div style={{ background: getColors().card, border: `1px solid ${getColors().hair}`, borderRadius: 12, marginTop: 10, overflow: "hidden" }}>
              {/* Tab buttons */}
              <div style={{ display: "flex", borderBottom: `1px solid ${getColors().hair}` }}>
                <button onClick={() => setSpecTab("shared")} style={{ flex: 1, padding: "12px 14px", border: "none", background: specTab === "shared" ? getColors().card : "#f5f5f5", color: specTab === "shared" ? getColors().rust : getColors().mut, cursor: "pointer", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em" }}>
                  Shared Specifications
                </button>
                <button onClick={() => setSpecTab("generic")} style={{ flex: 1, padding: "12px 14px", border: "none", background: specTab === "generic" ? getColors().card : "#f5f5f5", color: specTab === "generic" ? getColors().rust : getColors().mut, cursor: "pointer", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em" }}>
                  Generic Options
                </button>
              </div>
              
              {/* Shared Specifications Tab */}
              {specTab === "shared" && (
                <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={labelCss}>{t("Back panel")}</span>
                    <select value={p.backType} onChange={(e) => setP("backType")(e.target.value)} style={selCss}>
                      <option value="melamine">{t("Melamine (full)")}</option>
                      <option value="thin">{t("Thin hardboard")}</option>
                    </select>
                  </label>
                  {p.backType === "thin" && (
                    <>
                      <NumField label={t("Groove depth")} value={p.grooveDepth} onChange={setP("grooveDepth")} suffix="mm" w={72} />
                      <NumField label={t("Saw kerf")} value={p.kerf} onChange={setP("kerf")} />
                    </>
                  )}
                  <NumField label={t("Side height")} value={p.sideH} onChange={setP("sideH")} />
                  <NumField label={t("Back rail height")} value={p.railH} onChange={setP("railH")} />
                  <NumField label={t("Front rail height")} value={p.frontRailH} onChange={setP("frontRailH")} />
                  <NumField label={t("Rail qty")} value={p.railQty} onChange={setP("railQty")} suffix="" w={60} />
                  <NumField label={t("Shelf setback")} value={p.shelfSetback} onChange={setP("shelfSetback")} />
                  <NumField label={t("Shelf clearance")} value={p.shelfClearance} onChange={setP("shelfClearance")} />
                  
                  {selectedCab && (selectedCab.type !== "wall" && selectedCab.front === "doors") && (
                    <>
                      <NumField label={t("Door height")} value={p.doorH} onChange={setP("doorH")} />
                      <NumField label={t("Door reveal")} value={p.doorReveal} onChange={setP("doorReveal")} />
                      <NumField label={t("Door gap (pair)")} value={p.doorGap} onChange={setP("doorGap")} />
                    </>
                  )}

                  {selectedCab && selectedCab.falseFront && (
                    <NumField label={t("False front H")} value={p.falseFrontH} onChange={setP("falseFrontH")} />
                  )}
                  
                  {selectedCab && selectedCab.type === "corner" && (
                    <>
                      <NumField label={t("Corner stile W")} value={p.cornerStileW} onChange={setP("cornerStileW")} />
                      <NumField label={t("Corner blind W (default)")} value={p.cornerBlindW} onChange={setP("cornerBlindW")} />
                    </>
                  )}
                  
                  {selectedCab && selectedCab.type !== "wall" && (
                    <>
                      <NumField label={t("Base build-up (top)")} value={p.baseBuildUp} onChange={setP("baseBuildUp")} />
                      <NumField label={t("Build-up strip height")} value={p.buildUpStripH} onChange={setP("buildUpStripH")} />
                      <NumField label={t("Strip → top box clearance")} value={p.stripBoxClear} onChange={setP("stripBoxClear")} />
                    </>
                  )}
                  
                  {selectedCab && selectedCab.type === "base" && selectedCab.front === "drawers" && (
                    <>
                      <NumField label={t("Slide clear/side")} value={p.drawerSideClear} onChange={setP("drawerSideClear")} />
                      <NumField label={t("Drawer box depth")} value={p.drawerBoxDepth} onChange={setP("drawerBoxDepth")} />
                      <NumField label={t("Box H = front −")} value={p.drawerBoxHReduce} onChange={setP("drawerBoxHReduce")} />
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: getColors().ink }}>
                        <input type="checkbox" checked={p.drawerBoxes} onChange={(e) => setP("drawerBoxes")(e.target.checked)} />
                        {t("Include drawer boxes")}
                      </label>
                    </>
                  )}
                </div>
              )}
              
              {/* Generic Options Tab */}
              {specTab === "generic" && (
                <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={labelCss}>{t("Melamine thickness")}</span>
                    <select value={p.t} onChange={(e) => setP("t")(Number(e.target.value))} style={selCss}>
                      <option value={19}>19 mm</option>
                      <option value={18}>18 mm</option>
                      <option value={15}>15 mm</option>
                    </select>
                  </label>
                  <NumField label={t("Board width")} value={p.boardW} onChange={setP("boardW")} />
                  <NumField label={t("Board height")} value={p.boardH} onChange={setP("boardH")} />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: getColors().ink }}>
                    <input type="checkbox" checked={p.allowRotate} onChange={(e) => setP("allowRotate")(e.target.checked)} />
                    {t("Allow parts to rotate (no grain direction)")}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: getColors().ink }}>
                    <input type="checkbox" checked={p.backBetween} onChange={(e) => setP("backBetween")(e.target.checked)} />
                    {t("Back fits between sides")} (−{2 * p.t})
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
            </div>
          )}

          {activeView === "admin" && authState?.isAdmin && (
            <AdminPanel pendingUsers={pendingUsers} handleApprove={handleApprove} authState={authState} handleLogout={handleLogout} />
          )}

          {activeView === "account" && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().canvasMut, marginBottom: 16 }}>
                {t("Account") || "Account"}
              </div>

              <div style={{ background: getColors().card, borderRadius: 16, padding: 24, maxWidth: 420, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: getColors().mut, marginBottom: 4 }}>{t("Signed in as") || "Signed in as"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: getColors().ink, marginBottom: 22 }}>{authState?.user?.email}</div>

                <div style={{ fontSize: 14, fontWeight: 700, color: getColors().ink, marginBottom: 14 }}>{t("Change email") || "Change email"}</div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>
                    {t("New email") || "New email"}
                  </label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@email.com"
                    style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
                </div>

                {emailError && <div style={{ fontSize: 13, color: "#e74c3c", marginBottom: 12 }}>{emailError}</div>}
                {emailStatus === "success" && <div style={{ fontSize: 13, color: "#27ae60", marginBottom: 12 }}>{t("Check your inbox to confirm the new email ✓") || "Check your inbox to confirm the new email ✓"}</div>}

                <button onClick={handleChangeEmail} disabled={emailStatus === "saving"}
                  style={{ padding: "11px 20px", background: getColors().buttonBg, color: getColors().buttonText, border: "none",
                    borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: emailStatus === "saving" ? "not-allowed" : "pointer", opacity: emailStatus === "saving" ? 0.6 : 1 }}>
                  {emailStatus === "saving" ? (t("Saving...") || "Saving...") : (t("Update email") || "Update email")}
                </button>
              </div>

              <div style={{ background: getColors().card, borderRadius: 16, padding: 24, maxWidth: 420 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: getColors().ink, marginBottom: 14 }}>{t("Change password") || "Change password"}</div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>
                    {t("Current password") || "Current password"}
                  </label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>
                    {t("New password") || "New password"}
                  </label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: getColors().mut, marginBottom: 5 }}>
                    {t("Confirm new password") || "Confirm new password"}
                  </label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", padding: "11px 12px", border: `1.5px solid ${getColors().hair}`, borderRadius: 9, fontSize: 14, fontFamily: "'Archivo', sans-serif", color: "#111", background: "#fff" }} />
                </div>

                {pwError && <div style={{ fontSize: 13, color: "#e74c3c", marginBottom: 12 }}>{pwError}</div>}
                {pwStatus === "success" && <div style={{ fontSize: 13, color: "#27ae60", marginBottom: 12 }}>{t("Password updated ✓") || "Password updated ✓"}</div>}

                <button onClick={handleChangePassword} disabled={pwStatus === "saving"}
                  style={{ padding: "11px 20px", background: getColors().buttonBg, color: getColors().buttonText, border: "none",
                    borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: pwStatus === "saving" ? "not-allowed" : "pointer", opacity: pwStatus === "saving" ? 0.6 : 1 }}>
                  {pwStatus === "saving" ? (t("Saving...") || "Saving...") : (t("Update password") || "Update password")}
                </button>
              </div>
            </div>
          )}

          </div>
        </div>
      </div>

      {/* ── DESGLOSE SHEET MODAL ─────────────────────────────── */}
      {showDesglose && (
        <DesgloseSheet
          cabs={cabs}
          projectName={currentProjectName}
          onClose={() => setShowDesglose(false)}
          initialLang={lang}
          allProjects={userProjects}
        />
      )}
    </div>
  );
}
