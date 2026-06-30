/* ─────────────────────────────────────────────────────────
   popup.js  –  IDD Token Sync
   ───────────────────────────────────────────────────────── */

let draggedItem = null;
let dragSourceColumn = null;

/* ═══════════════════════ INIT ═══════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();

  /* save main URLs on change */
  document.getElementById('whidd-main-url').addEventListener('input', debounce(() => { saveMainUrls(); updateOriginHint('whidd'); }, 300));
  document.getElementById('iddv2-main-url').addEventListener('input', debounce(() => { saveMainUrls(); updateOriginHint('iddv2'); }, 300));

  /* add-URL buttons */
  document.getElementById('add-to-whidd').addEventListener('click', () => addTarget('whidd'));
  document.getElementById('add-to-iddv2').addEventListener('click', () => addTarget('iddv2'));

  /* Enter in add-input → add to whidd */
  document.getElementById('new-target-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTarget('whidd');
  });

  /* reload toggle */
  const reloadToggle = document.getElementById('reload-toggle');
  chrome.storage.local.get('reloadFirst', (d) => {
    reloadToggle.checked = d.reloadFirst ?? false;
    updateToggleHint(reloadToggle.checked);
  });
  reloadToggle.addEventListener('change', () => {
    chrome.storage.local.set({ reloadFirst: reloadToggle.checked });
    updateToggleHint(reloadToggle.checked);
  });

  /* auto-open toggle */
  const autoOpenToggle = document.getElementById('auto-open-toggle');
  chrome.storage.local.get('autoOpenTab', (d) => {
    autoOpenToggle.checked = d.autoOpenTab ?? false;
    updateAutoOpenHint(autoOpenToggle.checked);
  });
  autoOpenToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoOpenTab: autoOpenToggle.checked });
    updateAutoOpenHint(autoOpenToggle.checked);
  });

  /* submit buttons */
  document.getElementById('set-whidd-token').addEventListener('click', () => setTokens('whidd'));
  document.getElementById('set-iddv2-token').addEventListener('click', () => setTokens('iddv2'));

  /* drag-over / drop / drag-leave on lists */
  document.querySelectorAll('.target-list').forEach(list => {
    list.addEventListener('dragover',  handleDragOver);
    list.addEventListener('drop',      handleDrop);
    list.addEventListener('dragleave', handleDragLeave);
  });
});

/* ═══════════════════════ CONFIG ═══════════════════════ */
function loadConfig() {
  chrome.storage.local.get(['whiddMainUrl', 'iddv2MainUrl', 'whiddTargets', 'iddv2Targets'], (d) => {
    document.getElementById('whidd-main-url').value = d.whiddMainUrl || '';
    document.getElementById('iddv2-main-url').value = d.iddv2MainUrl || '';
    renderTargets('whidd', d.whiddTargets || []);
    renderTargets('iddv2', d.iddv2Targets || []);
    updateOriginHint('whidd');
    updateOriginHint('iddv2');
  });
}

function saveMainUrls() {
  chrome.storage.local.set({
    whiddMainUrl: document.getElementById('whidd-main-url').value.trim(),
    iddv2MainUrl: document.getElementById('iddv2-main-url').value.trim(),
  });
}

function normalizeUrl(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return 'https://' + url;
  return url;
}

function updateOriginHint(column) {
  const raw  = document.getElementById(`${column}-main-url`).value.trim();
  const hint = document.getElementById(`${column}-origin-hint`);
  if (!raw) { hint.innerHTML = ''; return; }
  try {
    const origin = new URL(normalizeUrl(raw)).origin;
    hint.innerHTML = `<span class="oh-label">↳ match tab theo origin:</span> <span class="oh-origin">${escapeHtml(origin)}</span>`;
  } catch {
    hint.innerHTML = `<span style="color:#f87171">⚠ URL không hợp lệ</span>`;
  }
}

function saveTargets() {
  chrome.storage.local.set({
    whiddTargets: getTargetUrls('whidd'),
    iddv2Targets: getTargetUrls('iddv2'),
  });
}

/* ═══════════════════════ TARGET LIST ═══════════════════════ */
function getTargetUrls(column) {
  return Array.from(document.querySelectorAll(`#${column}-targets .target-item`))
    .map(el => el.dataset.url);
}

function renderTargets(column, urls) {
  const container = document.getElementById(`${column}-targets`);
  container.innerHTML = '';
  if (urls.length === 0) {
    showDropHint(container);
  } else {
    urls.forEach(url => appendTargetItem(column, url));
  }
  updateCount(column);
}

function addTarget(column) {
  const input = document.getElementById('new-target-url');
  const url   = input.value.trim();
  if (!url) { input.focus(); return; }

  /* remove from the other column if duplicate */
  const other = column === 'whidd' ? 'iddv2' : 'whidd';
  const dup   = document.querySelector(`#${other}-targets .target-item[data-url="${CSS.escape(url)}"]`);
  if (dup) { dup.remove(); updateCount(other); fixHint(other); }

  /* ignore if already in same column */
  if (!document.querySelector(`#${column}-targets .target-item[data-url="${CSS.escape(url)}"]`)) {
    appendTargetItem(column, url);
    saveTargets();
  }

  input.value = '';
  input.focus();
}

function appendTargetItem(column, url) {
  const container  = document.getElementById(`${column}-targets`);
  const hint       = container.querySelector('.drop-hint');
  if (hint) hint.remove();

  const other    = column === 'whidd' ? 'iddv2' : 'whidd';
  const moveIcon = column === 'whidd' ? '→' : '←';
  const moveTitle = `Move to ${other.toUpperCase()}`;

  const item = document.createElement('div');
  item.className   = 'target-item';
  item.dataset.url = url;
  item.draggable   = true;
  item.innerHTML   = `
    <span class="drag-handle" title="Kéo thả">⠿</span>
    <span class="url-text" title="${escapeAttr(url)}">${escapeHtml(url)}</span>
    <button class="btn-move"   title="${moveTitle}">${moveIcon}</button>
    <button class="btn-remove" title="Xóa">✕</button>
  `;

  /* move button */
  item.querySelector('.btn-move').addEventListener('click', (e) => {
    e.stopPropagation();
    item.remove();
    fixHint(column);
    updateCount(column);
    appendTargetItem(other, url);
    saveTargets();
    updateCount(other);
  });

  /* remove button */
  item.querySelector('.btn-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    item.remove();
    fixHint(column);
    saveTargets();
    updateCount(column);
  });

  /* inline edit on url-text click */
  item.querySelector('.url-text').addEventListener('click', () => startInlineEdit(item, column));

  /* drag events */
  item.addEventListener('dragstart', (e) => {
    draggedItem      = item;
    dragSourceColumn = column;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', url);
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    draggedItem      = null;
    dragSourceColumn = null;
  });

  container.appendChild(item);
  updateCount(column);
}

/* ─── drag & drop handlers ─── */
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const list         = e.currentTarget;
  const targetColumn = list.dataset.column;
  list.classList.remove('drag-over');

  if (!draggedItem) return;
  if (dragSourceColumn === targetColumn) return; // same column → no-op

  const url = draggedItem.dataset.url;
  draggedItem.remove();
  fixHint(dragSourceColumn);
  updateCount(dragSourceColumn);

  appendTargetItem(targetColumn, url);
  saveTargets();
}

/* ─── helpers ─── */
function fixHint(column) {
  const container = document.getElementById(`${column}-targets`);
  if (!container.querySelector('.target-item')) showDropHint(container);
}

function showDropHint(container) {
  const d = document.createElement('div');
  d.className   = 'drop-hint';
  d.textContent = 'Kéo thả URL vào đây hoặc dùng nút + bên dưới';
  container.appendChild(d);
}

function updateCount(column) {
  const count = document.querySelectorAll(`#${column}-targets .target-item`).length;
  document.getElementById(`${column}-count`).textContent = count;
}

/* ═══════════════════════ TOKEN OPERATIONS ═══════════════════════ */
async function setTokens(column) {
  const mainUrl = document.getElementById(`${column}-main-url`).value.trim();
  const targets = getTargetUrls(column);

  if (!mainUrl) {
    showStatus('error', `⚠ Vui lòng nhập Main URL cho ${column.toUpperCase()}`);
    return;
  }
  if (targets.length === 0) {
    showStatus('error', `⚠ Chưa có Target URL nào trong cột ${column.toUpperCase()}`);
    return;
  }

  const btn = document.getElementById(`set-${column}-token`);
  const reloadFirst  = document.getElementById('reload-toggle').checked;
  const autoOpenTab  = document.getElementById('auto-open-toggle').checked;
  btn.disabled = true;
  showStatus('info', reloadFirst
    ? `🔄 Đang reload ${column.toUpperCase()} main tab...`
    : `🔍 Đang lấy iddToken từ ${column.toUpperCase()}...`);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'setTokens',
      column,
      mainUrl,
      targets,
      reloadFirst,
      autoOpenTab,
    });

    if (!response.success) throw new Error(response.error);

    const { successCount, total, errors } = response;
    if (errors.length === 0) {
      const skipPart = skippedCount > 0 ? `, bỏ qua ${skippedCount} (chưa mở)` : '';
      showStatus('success', `✅ Set thành công ${successCount} / ${total}${skipPart}`);
      btn.classList.add('btn-success-flash');
      setTimeout(() => btn.classList.remove('btn-success-flash'), 2200);
    } else {
      const skipPart = skippedCount > 0 ? `, bỏ qua ${skippedCount}` : '';
      const detail = errors.map(e => `${shortUrl(e.url)}: ${e.error}`).join(' | ');
      showStatus('error', `⚠ ${successCount}/${total} thành công${skipPart}. Lỗi: ${detail}`);
    }
  } catch (err) {
    showStatus('error', `❌ ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

/* ═══════════════════════ UTILS ═══════════════════════ */
function showStatus(type, msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className   = `status ${type}`;

  clearTimeout(el._t);
  if (type !== 'info') {
    el._t = setTimeout(() => { el.className = 'status hidden'; }, 5000);
  }
}

function updateToggleHint(on) {
  document.getElementById('reload-hint').textContent = on ? 'on' : 'off';
}

function updateAutoOpenHint(on) {
  document.getElementById('auto-open-hint').textContent = on ? 'on' : 'off';
}

function shortUrl(url) {
  try { return new URL(url).hostname; } catch { return url.slice(0, 30); }
}

/* ═══════════════════════ INLINE EDIT ═══════════════════════ */
function startInlineEdit(item, column) {
  if (item.classList.contains('editing')) return;
  item.classList.add('editing');
  item.draggable = false;

  const currentUrl = item.dataset.url;
  const urlTextEl  = item.querySelector('.url-text');

  const inp = document.createElement('input');
  inp.type      = 'text';
  inp.value     = currentUrl;
  inp.className = 'url-edit-input';
  urlTextEl.replaceWith(inp);
  inp.focus();
  inp.select();

  let done = false;
  function finish(save) {
    if (done) return;
    done = true;
    const newUrl = inp.value.trim() || currentUrl;
    if (save && newUrl !== currentUrl) {
      item.dataset.url = newUrl;
      saveTargets();
    }
    const span = document.createElement('span');
    span.className   = 'url-text';
    span.title       = item.dataset.url;
    span.textContent = item.dataset.url;
    span.addEventListener('click', () => startInlineEdit(item, column));
    inp.replaceWith(span);
    item.classList.remove('editing');
    item.draggable = true;
  }

  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
