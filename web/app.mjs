import { imageFrame, menuPosition, actionsFor, shareContent, validObjects } from './core.mjs';
import { demos } from './demo-data.mjs';

const $ = id => document.getElementById(id);
const state = { generation: 0, controller: null, objects: [], selected: null, demo: false, prepared: null, imageSize: null, frame: null, result: null, toastTimer: null };
const photo = $('photo'), viewport = $('viewport'), menu = $('context-menu'), dialog = $('result-dialog');

function toast(message) {
  clearTimeout(state.toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  state.toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
}

function begin() {
  state.generation++;
  state.controller?.abort();
  state.controller = null;
  state.objects = [];
  state.selected = null;
  state.demo = false;
  state.prepared = null;
  state.imageSize = null;
  state.result = null;
  if (dialog.open) dialog.close();
  $('error-banner').hidden = true;
  $('demo-badge').hidden = true;
  $('loading').hidden = true;
  $('image-stage').hidden = true;
  $('empty-state').hidden = false;
  $('clear-button').hidden = true;
  $('capture-label').textContent = '拍一张，试试看';
  renderObjects();
  return state.generation;
}

function setBusy(busy, text = '正在理解画面') {
  $('loading').hidden = !busy;
  $('loading-label').textContent = text;
  $('mode-label').textContent = busy ? text : state.demo ? '示例模式' : state.objects.length ? '识别完成' : '等待一张照片';
}

async function displayImage(src, alt, generation) {
  const image = new Image();
  image.src = src;
  await image.decode();
  if (generation !== state.generation) return false;
  state.imageSize = { width: image.naturalWidth, height: image.naturalHeight };
  photo.src = src;
  photo.alt = alt;
  $('image-stage').hidden = false;
  $('empty-state').hidden = true;
  $('clear-button').hidden = false;
  $('capture-label').textContent = '重新拍一张';
  layout();
  return true;
}

function layout() {
  if (!state.imageSize) return;
  state.frame = imageFrame(state.imageSize, { width: viewport.clientWidth, height: viewport.clientHeight });
  Object.assign($('image-stage').style, { left: `${state.frame.x}px`, top: `${state.frame.y}px`, width: `${state.frame.width}px`, height: `${state.frame.height}px` });
  positionMenu();
}
new ResizeObserver(layout).observe(viewport);

function renderObjects() {
  $('boxes').replaceChildren();
  $('object-list').replaceChildren();
  $('object-list').hidden = !state.objects.length;
  $('photo-count').hidden = !state.objects.length;
  $('photo-count').textContent = `${String(state.objects.length).padStart(2, '0')} OBJECT${state.objects.length === 1 ? '' : 'S'}`;
  const sorted = [...state.objects].sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  for (const object of sorted) {
    const button = document.createElement('button');
    button.className = 'object-box';
    button.setAttribute('aria-label', `${object.name}，显示操作菜单`);
    button.setAttribute('aria-pressed', String(state.selected === object.id));
    button.classList.toggle('selected', state.selected === object.id);
    const b = object.box;
    Object.assign(button.style, { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` });
    const label = document.createElement('span');
    label.className = 'box-label';
    label.textContent = object.name;
    button.append(label);
    button.addEventListener('click', () => selectObject(object.id));
    $('boxes').append(button);
  }
  state.objects.forEach((object, index) => {
    const button = document.createElement('button');
    button.className = 'object-chip';
    button.classList.toggle('selected', object.id === state.selected);
    button.setAttribute('aria-pressed', String(object.id === state.selected));
    const number = document.createElement('b'); number.textContent = String(index + 1).padStart(2, '0');
    button.append(number, document.createTextNode(object.name));
    button.addEventListener('click', () => selectObject(object.id));
    $('object-list').append(button);
  });
  renderMenu();
}

function selectObject(id) { state.selected = state.selected === id ? null : id; renderObjects(); }
function renderMenu() {
  const object = state.objects.find(o => o.id === state.selected);
  menu.hidden = !object;
  menu.replaceChildren();
  if (!object) return;
  const title = document.createElement('div'); title.className = 'menu-title'; title.textContent = object.name;
  menu.append(title);
  for (const action of actionsFor(object)) {
    const button = document.createElement('button'); button.className = 'menu-action';
    const symbol = document.createElement('span'); symbol.className = 'action-symbol'; symbol.textContent = action.symbol; symbol.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = action.title;
    const arrow = document.createElement('span'); arrow.className = 'menu-arrow'; arrow.textContent = action.kind === 'copy' ? '' : '↗'; arrow.setAttribute('aria-hidden', 'true');
    button.append(symbol, label, arrow);
    button.addEventListener('click', () => {
      if (action.kind === 'copy') copy(action.content, object.name);
      else if (action.kind === 'share') share(shareContent(object), object.name);
      else showResult(action.title, action.content, object.name);
    });
    menu.append(button);
  }
  positionMenu();
}

function positionMenu() {
  const object = state.objects.find(o => o.id === state.selected), frame = state.frame;
  if (!object || !frame || menu.hidden) return;
  menu.style.width = `${Math.min(238, viewport.clientWidth - 20)}px`;
  const target = { x: frame.x + object.box.x * frame.width, y: frame.y + object.box.y * frame.height, width: object.box.width * frame.width, height: object.box.height * frame.height };
  const origin = menuPosition(target, { width: menu.offsetWidth, height: menu.offsetHeight }, { width: viewport.clientWidth, height: viewport.clientHeight });
  menu.style.left = `${origin.x}px`; menu.style.top = `${origin.y}px`;
}

viewport.addEventListener('click', event => {
  if (!event.target.closest('.object-box, .context-menu')) { state.selected = null; renderObjects(); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.open) { state.selected = null; renderObjects(); } });

async function loadFile(file) {
  if (!file) return;
  const generation = begin();
  setBusy(true, '正在读取照片');
  $('status').textContent = '把照片准备好，马上开始识别。';
  let objectURL;
  try {
    if (file.size > 35 * 1024 * 1024) throw new Error('这张照片太大了，请选择小于 35 MB 的图片。');
    if (!file.type.startsWith('image/')) throw new Error('请选择一张图片。');
    objectURL = URL.createObjectURL(file);
    const image = new Image(); image.src = objectURL;
    try { await image.decode(); } catch { throw new Error('这张照片的格式暂时无法读取，请使用 JPEG 或 PNG 照片。'); }
    if (generation !== state.generation) return;
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL('image/jpeg', .82);
    if (!await displayImage(dataURL, '本次拍摄或选择的照片', generation)) return;
    state.prepared = { mimeType: 'image/jpeg', imageBase64: dataURL.split(',')[1] };
    await analyze(generation);
  } catch (error) { if (generation === state.generation) showError(error.message || '照片暂时无法读取，请重新选择。'); }
  finally { if (objectURL) URL.revokeObjectURL(objectURL); }
}

async function analyze(generation) {
  const controller = new AbortController(); state.controller = controller;
  setBusy(true);
  $('status').textContent = '正在发现画面中的物体…';
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.prepared), signal: controller.signal });
    const result = await response.json();
    if (generation !== state.generation) return;
    if (!response.ok) throw new Error(result.error?.message || '识别服务暂时不可用，请稍后重试。');
    state.objects = validObjects(result.objects);
    renderObjects();
    setBusy(false);
    $('status').textContent = state.objects.length ? `发现 ${state.objects.length} 个物体，点一下物体框。` : '没有发现清晰物体，靠近一点重新拍摄。';
  } catch (error) {
    if (generation !== state.generation) return;
    showError(error.name === 'AbortError' ? '识别等待时间较长，请重试或换一张照片。' : error.message || '暂时无法连接，请检查网络后重试。');
  } finally { clearTimeout(timeout); if (state.controller === controller) state.controller = null; }
}

function showError(message) {
  setBusy(false);
  $('mode-label').textContent = '暂时未能识别';
  $('error-text').textContent = message;
  $('error-banner').hidden = false;
  $('retry-button').hidden = !state.prepared;
  $('status').textContent = '可以重试、换张照片，或体验下方交互示例。';
}

$('retry-button').addEventListener('click', () => {
  if (!state.prepared) return;
  state.controller?.abort();
  state.generation++;
  state.objects = []; state.selected = null;
  $('error-banner').hidden = true;
  renderObjects();
  analyze(state.generation);
});

async function loadDemo(key) {
  const demo = demos[key];
  if (!demo) return;
  const generation = begin();
  try {
    if (!await displayImage(demo.image, demo.alt, generation)) return;
    state.demo = true;
    state.objects = validObjects(demo.objects);
    $('demo-badge').hidden = false;
    $('status').textContent = '点击物体框，或用下方物体名称切换。';
    setBusy(false);
    renderObjects();
  } catch { if (generation === state.generation) showError('示例图片暂时无法读取，请刷新页面后重试。'); }
}
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => loadDemo(button.dataset.demo)));
$('camera-button').addEventListener('click', () => $('camera-input').click());
$('album-button').addEventListener('click', () => $('album-input').click());
for (const id of ['camera-input', 'album-input']) $(id).addEventListener('change', event => { const file = event.target.files?.[0]; event.target.value = ''; loadFile(file); });
$('clear-button').addEventListener('click', () => { begin(); $('mode-label').textContent = '等待一张照片'; $('status').textContent = '现实里的东西，也可以点一下。'; photo.removeAttribute('src'); });

function showResult(title, content, objectName) {
  state.result = { title, content, objectName };
  $('result-object').textContent = objectName;
  $('result-title').textContent = title;
  $('result-text').textContent = content;
  $('result-source').hidden = !state.demo;
  $('manual-copy').hidden = true;
  $('share-note').hidden = true;
  if (!dialog.open) dialog.showModal();
}
$('close-result').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});

async function copy(content, objectName) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) { await navigator.clipboard.writeText(content); toast('已复制到剪贴板'); return; }
  } catch { /* Present selectable text when the browser cannot confirm a copy. */ }
  showResult('复制内容', content, objectName);
  $('share-note').textContent = '浏览器未允许自动复制。请长按或全选下方文字复制。'; $('share-note').hidden = false;
  $('manual-copy').value = content; $('manual-copy').hidden = false; $('manual-copy').focus(); $('manual-copy').select();
}

async function share(content, objectName) {
  const shared = state.demo && !content.startsWith('【交互演示样例 · 人工标注】') ? `【交互演示样例 · 人工标注】\n\n${content}` : content;
  if (navigator.share && window.isSecureContext) {
    try { await navigator.share({ title: objectName, text: shared }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  showResult('分享内容', shared, objectName);
  $('share-note').textContent = '当前浏览器无法打开系统分享面板。可以复制这些内容，再粘贴到你想分享的地方。';
  $('share-note').hidden = false;
}
$('copy-result').addEventListener('click', () => { if (state.result) copy(state.result.content, state.result.objectName); });
$('share-result').addEventListener('click', () => { if (state.result) share(state.result.content, state.result.objectName); });
