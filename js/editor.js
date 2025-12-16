// =========================
// Helpers
// =========================
function uid() {
  return (crypto?.randomUUID?.() ?? String(Date.now()) + "_" + Math.random().toString(16).slice(2));
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
function nowTS() { return new Date().toLocaleTimeString(); }

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// =========================
// Project / Scene storage
// =========================
const params = new URLSearchParams(window.location.search);
const projectId = params.get("project") || "no_project";

const projects = JSON.parse(localStorage.getItem("void_projects") || "[]");
const project = projects.find(p => p.id === projectId);

document.getElementById("editorProjectName").textContent = project ? project.name : `Project (${projectId})`;

const SCENE_KEY = `void_scene_${projectId}`;

// =========================
// State
// =========================
let GRID_SIZE = 50;

let entities = [
  { id: uid(), name: "Main Camera", tag: "Camera", enabled: true, transform: { x: 0, y: 0, rot: 0, scale: 1 }, render: { shape: "cross", size: 24 } },
  { id: uid(), name: "Player", tag: "Player", enabled: true, transform: { x: 120, y: 40, rot: 0, scale: 1 }, render: { shape: "rect", size: 40 } },
  { id: uid(), name: "Enemy", tag: "Enemy", enabled: true, transform: { x: -140, y: -60, rot: 0, scale: 1 }, render: { shape: "circle", size: 34 } },
];

const camera = { x: 0, y: 0, zoom: 1 };

const GizmoMode = { MOVE: "move", ROTATE: "rotate" };
const GizmoSpace = { WORLD: "world", LOCAL: "local" };
let gizmoMode = GizmoMode.MOVE;
let gizmoSpace = GizmoSpace.WORLD;

let ctrlDown = false;
let spaceDown = false;

// Multi-select
let selectedIds = new Set([entities[0]?.id].filter(Boolean));
let lastClickedId = entities[0]?.id ?? null;

// =========================
// DOM
// =========================
const hierarchyList = document.getElementById("hierarchyList");
const hierarchySearch = document.getElementById("hierarchySearch");
const addEntityBtn = document.getElementById("addEntityBtn");
const deleteEntityBtn = document.getElementById("deleteEntityBtn");

const emptyInspector = document.getElementById("emptyInspector");
const inspectorBody = document.getElementById("inspectorBody");
const multiNote = document.getElementById("multiNote");

const statusText = document.getElementById("statusText");

const hudZoom = document.getElementById("hudZoom");
const hudCam = document.getElementById("hudCam");
const hudSel = document.getElementById("hudSel");
const hudMode = document.getElementById("hudMode");
const hudSpace = document.getElementById("hudSpace");
const hudSnap = document.getElementById("hudSnap");

const inpName = document.getElementById("inpName");
const inpTag = document.getElementById("inpTag");
const inpEnabled = document.getElementById("inpEnabled");
const inpX = document.getElementById("inpX");
const inpY = document.getElementById("inpY");
const inpRot = document.getElementById("inpRot");
const inpScale = document.getElementById("inpScale");
const inpShape = document.getElementById("inpShape");
const inpSize = document.getElementById("inpSize");

const btnSaveScene = document.getElementById("btnSaveScene");
const btnSaveAs = document.getElementById("btnSaveAs");
const btnExport = document.getElementById("btnExport");
const btnImport = document.getElementById("btnImport");
const importFile = document.getElementById("importFile");

const btnClearConsole = document.getElementById("btnClearConsole");
const consoleList = document.getElementById("consoleList");

const viewTabs = document.getElementById("viewTabs");
const sceneViewport = document.getElementById("sceneViewport");
const gameViewport = document.getElementById("gameViewport");

const btnGizmoMove = document.getElementById("btnGizmoMove");
const btnGizmoRotate = document.getElementById("btnGizmoRotate");
const btnSpace = document.getElementById("btnSpace");

const gridSnapSelect = document.getElementById("gridSnapSelect");

const editorRoot = document.getElementById("editorRoot");
const resizerLeft = document.getElementById("resizerLeft");
const resizerRight = document.getElementById("resizerRight");

const canvas = document.getElementById("sceneCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

// =========================
// Console
// =========================
function logConsole(type, message) {
  const el = document.createElement("div");
  el.className = "console-item";
  el.innerHTML = `<span class="ts">${nowTS()}</span><b>${type.toUpperCase()}</b> — ${message}`;
  consoleList.prepend(el);
}
btnClearConsole.addEventListener("click", () => {
  consoleList.innerHTML = "";
  logConsole("info", "Console cleared.");
});

// =========================
// Status / HUD
// =========================
function setStatus(msg) { statusText.textContent = `Status: ${msg}`; }

function getSelectedEntities() {
  return entities.filter(e => selectedIds.has(e.id));
}
function getPrimarySelected() {
  // primary = lastClickedId если он в selectedIds, иначе любой
  if (lastClickedId && selectedIds.has(lastClickedId)) {
    return entities.find(e => e.id === lastClickedId) ?? null;
  }
  const any = getSelectedEntities()[0] ?? null;
  return any;
}

function updateHUD() {
  hudZoom.textContent = `Zoom: ${Math.round(camera.zoom * 100)}%`;
  hudCam.textContent = `Cam: ${Math.round(camera.x)}, ${Math.round(camera.y)}`;
  hudMode.textContent = `Gizmo: ${gizmoMode === GizmoMode.MOVE ? "Move" : "Rotate"}`;
  hudSpace.textContent = `Space: ${gizmoSpace === GizmoSpace.WORLD ? "World" : "Local"}`;
  hudSnap.textContent = `Snap: ${GRID_SIZE}${ctrlDown ? " (Ctrl)" : ""}`;

  const sel = getSelectedEntities();
  if (sel.length === 0) hudSel.textContent = "Selected: —";
  else if (sel.length === 1) hudSel.textContent = `Selected: ${sel[0].name}`;
  else hudSel.textContent = `Selected: ${sel.length} entities`;
}

// =========================
// Save/Load
// =========================
function serializeScene() {
  return { version: 1, projectId, savedAt: Date.now(), entities };
}

function saveSceneLocal(silent = false) {
  localStorage.setItem(SCENE_KEY, JSON.stringify(serializeScene()));
  if (!silent) {
    setStatus("Saved (local)");
    logConsole("info", "Scene saved to localStorage.");
  }
}

function loadSceneLocal() {
  const raw = localStorage.getItem(SCENE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data?.entities && Array.isArray(data.entities)) {
      entities = data.entities;

      // восстановим selection адекватно
      const first = entities[0]?.id ?? null;
      selectedIds = new Set(first ? [first] : []);
      lastClickedId = first;

      return true;
    }
  } catch {}
  return false;
}

async function saveAsDevice() {
  const json = JSON.stringify(serializeScene(), null, 2);
  const filename = `${(project?.name || "scene").replace(/[^\w\- ]+/g, "")}.voidscene.json`;

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Void Scene JSON", accept: { "application/json": [".json"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      setStatus("Saved to device");
      logConsole("info", "Saved to device via Save As.");
      return;
    } catch {
      logConsole("warn", "Save As cancelled/blocked. Using download fallback.");
    }
  }

  downloadText(filename, json);
  setStatus("Downloaded JSON");
  logConsole("info", "Downloaded scene JSON.");
}

function exportScene() {
  const json = JSON.stringify(serializeScene(), null, 2);
  const filename = `${(project?.name || "scene").replace(/[^\w\- ]+/g, "")}.voidscene.json`;
  downloadText(filename, json);
  setStatus("Exported JSON");
  logConsole("info", "Exported scene JSON (download).");
}

function importSceneFromText(text) {
  const data = JSON.parse(text);
  if (!data?.entities || !Array.isArray(data.entities)) throw new Error("Invalid scene file (no entities).");
  entities = data.entities;

  const first = entities[0]?.id ?? null;
  selectedIds = new Set(first ? [first] : []);
  lastClickedId = first;

  saveSceneLocal(true);
  pushHistory("Import scene");
  renderHierarchy();
  renderInspector();
  setStatus("Imported");
  logConsole("info", "Imported scene JSON and saved locally.");
}

// =========================
// Undo / Redo (drag grouped)
// =========================
const history = {
  undo: [],
  redo: [],
  limit: 80,
  pending: null
};

function snapshot() {
  return {
    entities: deepClone(entities),
    selectedIds: [...selectedIds],
    lastClickedId
  };
}

function applySnapshot(snap) {
  entities = deepClone(snap.entities);
  selectedIds = new Set(snap.selectedIds || []);
  lastClickedId = snap.lastClickedId || (snap.selectedIds?.[0] ?? null);

  renderHierarchy();
  renderInspector();
  saveSceneLocal(true);
}

function pushHistory(label) {
  const snap = snapshot();
  history.undo.push({ label, snap, ts: Date.now() });
  if (history.undo.length > history.limit) history.undo.shift();
  history.redo = [];
}

function scheduleHistory(label) {
  clearTimeout(history.pending);
  history.pending = setTimeout(() => pushHistory(label), 250);
}

function undo() {
  if (history.undo.length === 0) return;
  const current = snapshot();
  const last = history.undo.pop();
  history.redo.push({ label: last.label, snap: current, ts: Date.now() });
  applySnapshot(last.snap);
  setStatus(`Undo: ${last.label}`);
  logConsole("info", `Undo: ${last.label}`);
}

function redo() {
  if (history.redo.length === 0) return;
  const current = snapshot();
  const next = history.redo.pop();
  history.undo.push({ label: next.label, snap: current, ts: Date.now() });
  applySnapshot(next.snap);
  setStatus(`Redo: ${next.label}`);
  logConsole("info", `Redo: ${next.label}`);
}

// base snapshot
pushHistory("Initial");

// =========================
// Tabs
// =========================
function setViewTab(tab) {
  [...viewTabs.querySelectorAll(".tab")].forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  sceneViewport.classList.toggle("active", tab === "scene");
  gameViewport.classList.toggle("active", tab === "game");
}
viewTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  setViewTab(btn.dataset.tab);
});

// =========================
// Hierarchy render + multi-select
// =========================
function renderHierarchy() {
  const q = hierarchySearch.value.trim().toLowerCase();
  hierarchyList.innerHTML = "";

  const list = entities.filter(e => !q || e.name.toLowerCase().includes(q) || (e.tag ?? "").toLowerCase().includes(q));
  for (const e of list) {
    const row = document.createElement("div");
    row.className = "entity" + (selectedIds.has(e.id) ? " active" : "");
    row.dataset.id = e.id;

    const left = document.createElement("div");
    left.className = "entity-name";
    left.innerHTML = `<span>${e.name}</span><span class="badge">${e.tag || "Untagged"}</span>`;

    const right = document.createElement("div");
    right.innerHTML = `<span class="badge">${e.enabled ? "On" : "Off"}</span>`;

    row.appendChild(left);
    row.appendChild(right);
    hierarchyList.appendChild(row);
  }
}

function selectSingle(id) {
  selectedIds.clear();
  selectedIds.add(id);
  lastClickedId = id;
}
function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  lastClickedId = id;
}
function selectRange(fromId, toId) {
  const ids = entities.map(e => e.id);
  const a = ids.indexOf(fromId);
  const b = ids.indexOf(toId);
  if (a === -1 || b === -1) { selectSingle(toId); return; }
  const [min, max] = [Math.min(a, b), Math.max(a, b)];
  selectedIds.clear();
  for (let i = min; i <= max; i++) selectedIds.add(ids[i]);
  lastClickedId = toId;
}

hierarchyList.addEventListener("click", (e) => {
  const row = e.target.closest(".entity");
  if (!row) return;
  const id = row.dataset.id;

  if (e.shiftKey && lastClickedId) {
    selectRange(lastClickedId, id);
  } else if (e.ctrlKey) {
    toggleSelect(id);
  } else {
    selectSingle(id);
  }

  renderHierarchy();
  renderInspector();
  setStatus("Selection changed");
});

hierarchySearch.addEventListener("input", renderHierarchy);

// =========================
// Inspector (single vs multi)
// =========================
function renderInspector() {
  const sel = getSelectedEntities();

  if (sel.length === 0) {
    emptyInspector.classList.remove("hidden");
    inspectorBody.classList.add("hidden");
    return;
  }

  emptyInspector.classList.add("hidden");
  inspectorBody.classList.remove("hidden");

  if (sel.length > 1) {
    multiNote.textContent = `Multi-selection: ${sel.length} entities\n(Inspector edits apply to PRIMARY only: last clicked)`;
  } else {
    multiNote.textContent = "Single selection";
  }

  const primary = getPrimarySelected();
  if (!primary) return;

  inpName.value = primary.name ?? "";
  inpTag.value = primary.tag ?? "";
  inpEnabled.value = String(!!primary.enabled);

  inpX.value = String(primary.transform.x);
  inpY.value = String(primary.transform.y);
  inpRot.value = String(primary.transform.rot);
  inpScale.value = String(primary.transform.scale);

  inpShape.value = primary.render.shape;
  inpSize.value = String(primary.render.size);
}

function bindInspector() {
  function apply(label, fn) {
    const primary = getPrimarySelected();
    if (!primary) return;

    fn(primary);

    renderHierarchy();
    renderInspector();
    saveSceneLocal(true);
    scheduleHistory(label);
  }

  inpName.addEventListener("input", () => apply("Rename", e => e.name = inpName.value));
  inpTag.addEventListener("input", () => apply("Change tag", e => e.tag = inpTag.value));
  inpEnabled.addEventListener("change", () => apply("Toggle enabled", e => e.enabled = (inpEnabled.value === "true")));

  inpX.addEventListener("input", () => apply("Move", e => e.transform.x = Number(inpX.value || 0)));
  inpY.addEventListener("input", () => apply("Move", e => e.transform.y = Number(inpY.value || 0)));
  inpRot.addEventListener("input", () => apply("Rotate", e => e.transform.rot = Number(inpRot.value || 0)));
  inpScale.addEventListener("input", () => apply("Scale", e => e.transform.scale = Math.max(0.01, Number(inpScale.value || 1))));

  inpShape.addEventListener("change", () => apply("Change shape", e => e.render.shape = inpShape.value));
  inpSize.addEventListener("input", () => apply("Change size", e => e.render.size = Math.max(1, Number(inpSize.value || 1))));
}
bindInspector();

// =========================
// Add/Delete selected
// =========================
addEntityBtn.addEventListener("click", () => {
  pushHistory("Before add");

  const n = entities.length + 1;
  const e = {
    id: uid(),
    name: `Entity ${n}`,
    tag: "Untagged",
    enabled: true,
    transform: { x: 0, y: 0, rot: 0, scale: 1 },
    render: { shape: "rect", size: 30 }
  };
  entities.push(e);
  selectSingle(e.id);

  renderHierarchy();
  renderInspector();
  saveSceneLocal(true);

  pushHistory("Add entity");
  setStatus(`Created "${e.name}"`);
});

deleteEntityBtn.addEventListener("click", () => {
  const sel = getSelectedEntities();
  if (sel.length === 0) return;

  pushHistory("Before delete");

  const ids = new Set(sel.map(s => s.id));
  entities = entities.filter(e => !ids.has(e.id));

  const first = entities[0]?.id ?? null;
  selectedIds = new Set(first ? [first] : []);
  lastClickedId = first;

  renderHierarchy();
  renderInspector();
  saveSceneLocal(true);

  pushHistory("Delete selected");
  setStatus("Deleted selected");
});

// =========================
// Grid size selector
// =========================
gridSnapSelect.addEventListener("change", () => {
  GRID_SIZE = Number(gridSnapSelect.value);
  saveSceneLocal(true);
  setStatus(`Grid: ${GRID_SIZE}`);
});

// =========================
// Save/Export/Import buttons
// =========================
btnSaveScene.addEventListener("click", () => saveSceneLocal(false));
btnSaveAs.addEventListener("click", saveAsDevice);
btnExport.addEventListener("click", exportScene);
btnImport.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    importSceneFromText(text);
  } catch (e) {
    setStatus("Import failed");
    logConsole("error", String(e?.message || e));
  }
});

// =========================
// Resizable panels
// =========================
function parseCols() {
  const s = getComputedStyle(editorRoot).gridTemplateColumns;
  const parts = s.split(" ").map(x => x.trim());
  return { left: parseFloat(parts[0]), right: parseFloat(parts[4]) };
}
function setCols(leftPx, rightPx) {
  const left = clamp(leftPx, 200, 520);
  const right = clamp(rightPx, 240, 520);
  editorRoot.style.gridTemplateColumns = `${left}px 8px 1fr 8px ${right}px`;
  scheduleResizeCanvas();
}
function bindResizer(handle, mode) {
  let dragging = false;
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = editorRoot.getBoundingClientRect();
    const { left, right } = parseCols();
    if (mode === "left") setCols(e.clientX - rect.left, right);
    else setCols(left, rect.right - e.clientX);
  });
}
bindResizer(resizerLeft, "left");
bindResizer(resizerRight, "right");

// =========================
// Canvas resize
// =========================
let needsResize = true;
let resizeTimer = null;

function scheduleResizeCanvas() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { needsResize = true; }, 0);
}
function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  needsResize = false;
}
window.addEventListener("resize", () => needsResize = true);

// =========================
// World <-> Screen
// =========================
function screenToWorld(sx, sy) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w / 2 + camera.x;
  const cy = h / 2 + camera.y;
  return { x: (sx - cx) / camera.zoom, y: (sy - cy) / camera.zoom };
}
function worldToScreen(wx, wy) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cx = w / 2 + camera.x;
  const cy = h / 2 + camera.y;
  return { x: wx * camera.zoom + cx, y: wy * camera.zoom + cy };
}

// =========================
// Drawing
// =========================
function drawGrid() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.fillStyle = "#0c1022";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2 + camera.x, h / 2 + camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  const grid = GRID_SIZE;
  const halfW = w / camera.zoom;
  const halfH = h / camera.zoom;

  const startX = Math.floor((-halfW - camera.x / camera.zoom) / grid) * grid - grid * 2;
  const endX   = Math.floor(( halfW - camera.x / camera.zoom) / grid) * grid + grid * 2;
  const startY = Math.floor((-halfH - camera.y / camera.zoom) / grid) * grid - grid * 2;
  const endY   = Math.floor(( halfH - camera.y / camera.zoom) / grid) * grid + grid * 2;

  ctx.strokeStyle = "#1f2450";
  ctx.lineWidth = 1 / camera.zoom;

  for (let x = startX; x <= endX; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
  }
  for (let y = startY; y <= endY; y += grid) {
    ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
  }

  ctx.strokeStyle = "#3f5bff";
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.beginPath(); ctx.moveTo(0, startY); ctx.lineTo(0, endY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(endX, 0); ctx.stroke();

  ctx.restore();
}

function drawEntities() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.save();
  ctx.translate(w / 2 + camera.x, h / 2 + camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  for (const e of entities) {
    if (!e.enabled) continue;

    const { x, y, rot, scale } = e.transform;
    const size = (e.render.size ?? 24) * (scale ?? 1);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 2 / camera.zoom;

    if (e.render.shape === "rect") {
      ctx.beginPath();
      ctx.rect(-size/2, -size/2, size, size);
      ctx.fill(); ctx.stroke();
    } else if (e.render.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, size/2, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.moveTo(-size/2, 0); ctx.lineTo(size/2, 0);
      ctx.moveTo(0, -size/2); ctx.lineTo(0, size/2);
      ctx.stroke();
    }

    if (selectedIds.has(e.id)) {
      ctx.strokeStyle = "rgba(91,124,250,0.9)";
      ctx.lineWidth = 2.5 / camera.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.70, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

// =========================
// Gizmo (fixed arrow bug)
// =========================
function angleRad(deg) { return (deg * Math.PI) / 180; }

function computePivotWorld() {
  const sel = getSelectedEntities();
  if (sel.length === 0) return { x: 0, y: 0 };
  let sx = 0, sy = 0;
  for (const e of sel) { sx += e.transform.x; sy += e.transform.y; }
  return { x: sx / sel.length, y: sy / sel.length };
}

function drawArrow(x1, y1, x2, y2, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const headLen = 12;
  const headWid = 6;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * headLen + px * headWid, y2 - uy * headLen + py * headWid);
  ctx.lineTo(x2 - ux * headLen - px * headWid, y2 - uy * headLen - py * headWid);
  ctx.closePath();
  ctx.fill();
}

function gizmoHandlesScreen(pivot, primaryRotDeg) {
  const center = worldToScreen(pivot.x, pivot.y);
  const len = 70;

  let ax = { x: 1, y: 0 };
  let ay = { x: 0, y: -1 };

  if (gizmoSpace === GizmoSpace.LOCAL) {
    const a = angleRad(primaryRotDeg);
    // local X in screen (y down): (cos, sin)
    ax = { x: Math.cos(a), y: Math.sin(a) };
    // local Y perpendicular
    ay = { x: -Math.sin(a), y: Math.cos(a) };
    // to make arrow go visually "up" for Y axis:
    ay = { x: ay.x, y: -ay.y };
  }

  return {
    center,
    xEnd: { x: center.x + ax.x * len, y: center.y + ax.y * len },
    yEnd: { x: center.x + ay.x * len, y: center.y + ay.y * len },
    rot: { x: center.x, y: center.y, r: 55 }
  };
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const c1 = vx*wx + vy*wy;
  if (c1 <= 0) return Math.hypot(px - x1, py - y1);
  const c2 = vx*vx + vy*vy;
  if (c2 <= c1) return Math.hypot(px - x2, py - y2);
  const t = c1 / c2;
  const bx = x1 + t * vx, by = y1 + t * vy;
  return Math.hypot(px - bx, py - by);
}

function drawGizmo() {
  const sel = getSelectedEntities();
  if (sel.length === 0) return;

  const pivot = computePivotWorld();
  const primary = getPrimarySelected();
  const rotDeg = primary ? primary.transform.rot : 0;

  const h = gizmoHandlesScreen(pivot, rotDeg);

  if (gizmoMode === GizmoMode.MOVE) {
    drawArrow(h.center.x, h.center.y, h.xEnd.x, h.xEnd.y, "rgba(255,80,80,0.95)");     // X
    drawArrow(h.center.x, h.center.y, h.yEnd.x, h.yEnd.y, "rgba(80,255,120,0.95)");    // Y

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(h.center.x, h.center.y, 3, 0, Math.PI*2); ctx.fill();
  }

  if (gizmoMode === GizmoMode.ROTATE) {
    ctx.strokeStyle = "rgba(91,124,250,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(h.rot.x, h.rot.y, h.rot.r, 0, Math.PI*2); ctx.stroke();
  }
}

function pickGizmoHandle(mx, my) {
  const sel = getSelectedEntities();
  if (sel.length === 0) return null;

  const pivot = computePivotWorld();
  const primary = getPrimarySelected();
  const rotDeg = primary ? primary.transform.rot : 0;
  const h = gizmoHandlesScreen(pivot, rotDeg);

  if (gizmoMode === GizmoMode.MOVE) {
    const dx = pointToSegmentDist(mx, my, h.center.x, h.center.y, h.xEnd.x, h.xEnd.y);
    const dy = pointToSegmentDist(mx, my, h.center.x, h.center.y, h.yEnd.x, h.yEnd.y);

    if (dx < 10) return "move-x";
    if (dy < 10) return "move-y";
    if (Math.hypot(mx - h.center.x, my - h.center.y) < 10) return "move-free";
  }

  if (gizmoMode === GizmoMode.ROTATE) {
    const dist = Math.hypot(mx - h.rot.x, my - h.rot.y);
    if (Math.abs(dist - h.rot.r) < 10) return "rotate";
  }

  return null;
}

function snap(v) {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

// =========================
// Gizmo UI
// =========================
function setGizmoMode(mode) {
  gizmoMode = mode;
  btnGizmoMove.classList.toggle("active", mode === GizmoMode.MOVE);
  btnGizmoRotate.classList.toggle("active", mode === GizmoMode.ROTATE);
}
function toggleGizmoSpace() {
  gizmoSpace = (gizmoSpace === GizmoSpace.WORLD) ? GizmoSpace.LOCAL : GizmoSpace.WORLD;
  btnSpace.textContent = (gizmoSpace === GizmoSpace.WORLD) ? "World" : "Local";
}
btnGizmoMove.addEventListener("click", () => setGizmoMode(GizmoMode.MOVE));
btnGizmoRotate.addEventListener("click", () => setGizmoMode(GizmoMode.ROTATE));
btnSpace.addEventListener("click", toggleGizmoSpace);

// =========================
// Camera controls
// =========================
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

let panning = false;
let lastMX = 0, lastMY = 0;

canvas.addEventListener("mousedown", (e) => {
  const isRMB = e.button === 2;
  const isSpaceLMB = (e.button === 0 && spaceDown);
  if (isRMB || isSpaceLMB) {
    panning = true;
    lastMX = e.clientX; lastMY = e.clientY;
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  }
});
window.addEventListener("mouseup", () => {
  if (!panning) return;
  panning = false;
  canvas.style.cursor = "";
});
window.addEventListener("mousemove", (e) => {
  if (!panning) return;
  camera.x += (e.clientX - lastMX);
  camera.y += (e.clientY - lastMY);
  lastMX = e.clientX; lastMY = e.clientY;
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const before = screenToWorld(mx, my);
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  camera.zoom = clamp(camera.zoom * factor, 0.15, 6);
  const after = screenToWorld(mx, my);

  camera.x += (after.x - before.x) * camera.zoom;
  camera.y += (after.y - before.y) * camera.zoom;
});

// =========================
// Picking + drag grouped undo
// =========================
function pickEntityAtWorld(wx, wy) {
  let best = null;
  let bestDist = Infinity;
  for (const ent of entities) {
    if (!ent.enabled) continue;
    const dx = ent.transform.x - wx;
    const dy = ent.transform.y - wy;
    const dist = Math.hypot(dx, dy);
    const pickRadius = (ent.render.size * (ent.transform.scale ?? 1)) * 0.7;
    if (dist < pickRadius && dist < bestDist) {
      best = ent;
      bestDist = dist;
    }
  }
  return best;
}

let dragState = null;
// dragState: { type, startMouse, pivotStart, selStart[], primaryRotStart, beforeSnap }

function beginDrag(label) {
  pushHistory(`Before ${label}`);
}

function endDrag(label) {
  pushHistory(label);
  saveSceneLocal(true);
}

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // left only
  if (spaceDown) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // gizmo handle?
  const handle = pickGizmoHandle(mx, my);
  if (handle) {
    beginDrag(handle);

    const sel = getSelectedEntities();
    const primary = getPrimarySelected();
    const pivot = computePivotWorld();

    dragState = {
      type: handle,
      startMouse: { x: mx, y: my },
      pivotStart: { x: pivot.x, y: pivot.y },
      selStart: sel.map(s => ({ id: s.id, x: s.transform.x, y: s.transform.y, rot: s.transform.rot })),
      primaryRotStart: primary ? primary.transform.rot : 0
    };

    setStatus(`Dragging: ${handle}`);
    return;
  }

  // pick entity
  const wPos = screenToWorld(mx, my);
  const picked = pickEntityAtWorld(wPos.x, wPos.y);
  if (picked) {
    if (e.shiftKey && lastClickedId) selectRange(lastClickedId, picked.id);
    else if (e.ctrlKey) toggleSelect(picked.id);
    else selectSingle(picked.id);

    renderHierarchy();
    renderInspector();
    setStatus("Selected in scene");
  } else {
    // click empty -> clear (без ctrl/shift)
    if (!e.ctrlKey && !e.shiftKey) {
      selectedIds.clear();
      lastClickedId = null;
      renderHierarchy();
      renderInspector();
    }
  }
});

window.addEventListener("mousemove", (e) => {
  if (!dragState) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const dxPx = mx - dragState.startMouse.x;
  const dyPx = my - dragState.startMouse.y;
  const deltaW = { x: dxPx / camera.zoom, y: dyPx / camera.zoom };

  const sel = getSelectedEntities();
  if (sel.length === 0) return;

  const primary = getPrimarySelected();
  const pivot = computePivotWorld();
  const primaryRot = primary ? primary.transform.rot : 0;

  if (dragState.type.startsWith("move")) {
    let move = { x: 0, y: 0 };

    if (dragState.type === "move-free") {
      move = deltaW;
    } else {
      // axis constrained
      if (gizmoSpace === GizmoSpace.WORLD) {
        if (dragState.type === "move-x") move = { x: deltaW.x, y: 0 };
        if (dragState.type === "move-y") move = { x: 0, y: deltaW.y };
      } else {
        // local axis projection
        const a = angleRad(primaryRot);
        const ux = { x: Math.cos(a), y: Math.sin(a) };
        const uy = { x: -Math.sin(a), y: Math.cos(a) };

        const axis = (dragState.type === "move-x") ? ux : uy;
        const dot = deltaW.x * axis.x + deltaW.y * axis.y;
        move = { x: dot * axis.x, y: dot * axis.y };
      }
    }

    // apply to each selected, based on stored start positions
    const startMap = new Map(dragState.selStart.map(s => [s.id, s]));
    for (const ent of sel) {
      const s = startMap.get(ent.id);
      if (!s) continue;
      let nx = s.x + move.x;
      let ny = s.y + move.y;

      if (ctrlDown) { nx = snap(nx); ny = snap(ny); }

      ent.transform.x = nx;
      ent.transform.y = ny;
    }

    renderInspector();
    saveSceneLocal(true);
    return;
  }

  if (dragState.type === "rotate") {
    const centerS = worldToScreen(pivot.x, pivot.y);
    const a0 = Math.atan2(dragState.startMouse.y - centerS.y, dragState.startMouse.x - centerS.x);
    const a1 = Math.atan2(my - centerS.y, mx - centerS.x);
    let delta = (a1 - a0) * 180 / Math.PI;

    // Ctrl: snap 15°
    if (ctrlDown) delta = Math.round(delta / 15) * 15;

    // rotate EACH around pivot
    const startMap = new Map(dragState.selStart.map(s => [s.id, s]));
    const rad = angleRad(delta);

    for (const ent of sel) {
      const s = startMap.get(ent.id);
      if (!s) continue;

      // rotate position around pivot
      const rx = s.x - dragState.pivotStart.x;
      const ry = s.y - dragState.pivotStart.y;

      const nx = rx * Math.cos(rad) - ry * Math.sin(rad);
      const ny = rx * Math.sin(rad) + ry * Math.cos(rad);

      ent.transform.x = dragState.pivotStart.x + nx;
      ent.transform.y = dragState.pivotStart.y + ny;

      ent.transform.rot = Math.round(s.rot + delta);
    }

    renderInspector();
    saveSceneLocal(true);
    return;
  }
});

window.addEventListener("mouseup", () => {
  if (!dragState) return;
  const label = dragState.type;
  dragState = null;
  endDrag(`Gizmo ${label}`);
  setStatus(`Drag end: ${label}`);
});

// =========================
// Keyboard
// =========================
window.addEventListener("keydown", (e) => {
  if (e.code === "ControlLeft" || e.code === "ControlRight") ctrlDown = true;
  if (e.code === "Space") spaceDown = true;

  if (e.code === "KeyW") setGizmoMode(GizmoMode.MOVE);
  if (e.code === "KeyE") setGizmoMode(GizmoMode.ROTATE);
  if (e.code === "KeyQ") toggleGizmoSpace();

  // Undo/Redo
  if (e.ctrlKey && !e.altKey && e.code === "KeyZ") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
  if (e.ctrlKey && !e.altKey && e.code === "KeyY") {
    e.preventDefault();
    redo();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ControlLeft" || e.code === "ControlRight") ctrlDown = false;
  if (e.code === "Space") spaceDown = false;
});

// =========================
// Canvas loop
// =========================
function loop() {
  if (needsResize) resizeCanvas();

  drawGrid();
  drawEntities();
  drawGizmo();
  updateHUD();

  requestAnimationFrame(loop);
}

// =========================
// Boot
// =========================
(function init() {
  const loaded = loadSceneLocal();
  if (loaded) logConsole("info", "Loaded scene from localStorage.");
  else logConsole("info", "New scene created (default).");

  GRID_SIZE = Number(gridSnapSelect.value);
  saveSceneLocal(true);

  renderHierarchy();
  renderInspector();
  setViewTab("scene");
  setCols(260, 320);

  setStatus("Ready");
  needsResize = true;
  loop();
})();
