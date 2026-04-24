/* ── State ─────────────────────────────────────────────────────── */
let allItems      = [];
let currentFilter = 'all';
let currentFile   = null;
let token         = localStorage.getItem('fz_token') || null;

/* ── Helpers ───────────────────────────────────────────────────── */
const API = (path) => CONFIG.API_BASE + path;

async function apiFetch(path, options = {}) {
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(API(path), { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════ */
/* PUBLIC SIDE                                                      */
/* ═══════════════════════════════════════════════════════════════ */

async function loadPublicPortfolio() {
  try {
    allItems = await apiFetch('/api/portfolio');
    renderFilterBar();
    renderGrid();
  } catch (e) {
    document.getElementById('portfolioGrid').innerHTML =
      `<div class="empty-state"><p>Could not load portfolio.<br><small>${e.message}</small></p></div>`;
  }
}

function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  bar.querySelectorAll('[data-cat]').forEach(b => b.remove());

  const cats = [...new Set(allItems.map(i => i.category))];
  const insertBefore = document.getElementById('filterCount');

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (currentFilter === cat ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.onclick = () => { currentFilter = cat; setFilterActive(btn); renderGrid(); };
    bar.insertBefore(btn, insertBefore);
  });
}

function setFilterActive(activeBtn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
}

function renderGrid() {
  const grid = document.getElementById('portfolioGrid');
  const filtered = currentFilter === 'all' ? allItems : allItems.filter(i => i.category === currentFilter);
  document.getElementById('filterCount').textContent = filtered.length + (filtered.length === 1 ? ' piece' : ' pieces');

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="10" width="36" height="28" rx="4" stroke="#B4B2A9" stroke-width="1.5"/>
        <path d="M6 18h36" stroke="#B4B2A9" stroke-width="1.5"/>
        <circle cx="24" cy="30" r="4" stroke="#B4B2A9" stroke-width="1.5"/>
      </svg>
      <p>${allItems.length === 0 ? 'Portfolio coming soon.' : 'No items in this category.'}</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="p-card" onclick="openLightbox(${item.id})" role="button" tabindex="0" aria-label="${item.title}">
      ${item.is_video
        ? `<video class="card-media" src="${CONFIG.API_BASE}${item.file_url}" muted playsinline preload="metadata"></video>`
        : `<img class="card-media" src="${CONFIG.API_BASE}${item.file_url}" alt="${item.title}" loading="lazy"/>`}
      <div class="card-body">
        <div class="card-category">${item.category}</div>
        <div class="card-title">${item.title}</div>
        ${item.description ? `<div class="card-desc">${item.description.substring(0,90)}${item.description.length>90?'…':''}</div>` : ''}
        <span class="card-badge">${item.is_video ? 'Video' : 'Image'}</span>
      </div>
    </div>
  `).join('');
}

/* ── Lightbox ───────────────────────────────────────────────────── */
function openLightbox(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('lbCategory').textContent = item.category;
  document.getElementById('lbTitle').textContent = item.title;
  document.getElementById('lbDesc').textContent = item.description || '';
  document.getElementById('lbMedia').innerHTML = item.is_video
    ? `<video class="lb-video" src="${CONFIG.API_BASE}${item.file_url}" controls autoplay muted></video>`
    : `<img class="lb-media" src="${CONFIG.API_BASE}${item.file_url}" alt="${item.title}"/>`;
  document.getElementById('lightboxOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  if (!e || e.target === document.getElementById('lightboxOverlay') || e.currentTarget.classList.contains('lb-close')) {
    document.getElementById('lightboxOverlay').classList.remove('open');
    document.getElementById('lbMedia').innerHTML = '';
    document.body.style.overflow = '';
  }
}

/* filter All button */
document.getElementById('filterAll').onclick = function () {
  currentFilter = 'all';
  setFilterActive(this);
  renderGrid();
};

/* ═══════════════════════════════════════════════════════════════ */
/* AUTH                                                             */
/* ═══════════════════════════════════════════════════════════════ */

function openLogin() {
  document.getElementById('loginOverlay').classList.add('open');
  document.getElementById('loginPwd').value = '';
  document.getElementById('loginError').textContent = '';
  setTimeout(() => document.getElementById('loginPwd').focus(), 100);
}

function closeLogin() {
  document.getElementById('loginOverlay').classList.remove('open');
}

async function doLogin() {
  const pwd = document.getElementById('loginPwd').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: pwd })
    });
    token = data.token;
    localStorage.setItem('fz_token', token);
    closeLogin();
    showAdminView();
  } catch (e) {
    errEl.textContent = 'Incorrect password. Try again.';
    document.getElementById('loginPwd').value = '';
  }
}

function logout() {
  token = null;
  localStorage.removeItem('fz_token');
  showPublicView();
}

/* ═══════════════════════════════════════════════════════════════ */
/* VIEW SWITCHING                                                   */
/* ═══════════════════════════════════════════════════════════════ */

function showAdminView() {
  document.getElementById('publicView').classList.add('hidden');
  document.getElementById('adminView').classList.remove('hidden');
  loadAdminItems();
}

function showPublicView() {
  document.getElementById('adminView').classList.add('hidden');
  document.getElementById('publicView').classList.remove('hidden');
  loadPublicPortfolio();
}

/* ═══════════════════════════════════════════════════════════════ */
/* ADMIN SIDE                                                       */
/* ═══════════════════════════════════════════════════════════════ */

async function loadAdminItems() {
  try {
    const items = await apiFetch('/api/portfolio');
    renderAdminList(items);
  } catch (e) {
    showToast('Failed to load items: ' + e.message, 'error');
  }
}

function renderAdminList(items) {
  document.getElementById('adminCount').textContent = items.length + ' items';
  document.getElementById('adminHeaderCount').textContent = items.length + ' pieces';
  const container = document.getElementById('adminItems');
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--stone);font-size:14px;">No portfolio pieces yet.</div>';
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="admin-item" id="admin-item-${item.id}">
      ${item.is_video
        ? `<div class="admin-thumb-ph">▶</div>`
        : `<img class="admin-thumb" src="${CONFIG.API_BASE}${item.file_url}" alt="${item.title}" loading="lazy"/>`}
      <div class="admin-item-info">
        <div class="admin-item-title">${item.title}</div>
        <div class="admin-item-meta">${item.category} · ${fmt(item.created_at)}</div>
      </div>
      <div class="admin-item-actions">
        <button class="del-btn" onclick="deleteItem(${item.id}, '${item.title.replace(/'/g,"\\'")}')}" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

async function deleteItem(id, title) {
  if (!confirm(`Delete "${title}"?\n\nThis will permanently remove the file and cannot be undone.`)) return;
  try {
    await apiFetch('/api/portfolio/' + id, { method: 'DELETE' });
    document.getElementById('admin-item-' + id)?.remove();
    allItems = allItems.filter(i => i.id !== id);
    const remaining = document.querySelectorAll('.admin-item').length;
    document.getElementById('adminCount').textContent = remaining + ' items';
    document.getElementById('adminHeaderCount').textContent = remaining + ' pieces';
    if (remaining === 0) {
      document.getElementById('adminItems').innerHTML = '<div style="text-align:center;padding:3rem;color:var(--stone);font-size:14px;">No portfolio pieces yet.</div>';
    }
    showToast('Deleted successfully');
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

/* ── File drop / select ─────────────────────────────────────────── */
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) processFile(f);
});
dropZone.addEventListener('click', () => document.getElementById('fileInput').click());

document.getElementById('fileInput').addEventListener('change', function () {
  if (this.files[0]) processFile(this.files[0]);
});

function processFile(f) {
  const allowed = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/webm','video/x-msvideo'];
  if (!allowed.includes(f.type)) { showToast('Only images and videos allowed', 'error'); return; }
  currentFile = f;
  const sizeMB = (f.size / 1024 / 1024).toFixed(1);
  document.getElementById('fileName').textContent = f.name + ' (' + sizeMB + ' MB)';
  document.getElementById('filePreview').classList.remove('hidden');
}

function clearFile() {
  currentFile = null;
  document.getElementById('filePreview').classList.add('hidden');
  document.getElementById('fileInput').value = '';
}

/* ── Submit ─────────────────────────────────────────────────────── */
async function addItem() {
  const title    = document.getElementById('f-title').value.trim();
  const category = document.getElementById('f-category').value;
  const desc     = document.getElementById('f-desc').value.trim();

  if (!title)    { showToast('Please add a title', 'error');       return; }
  if (!category) { showToast('Please select a category', 'error'); return; }
  if (!currentFile) { showToast('Please upload a file', 'error'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';

  try {
    const fd = new FormData();
    fd.append('file', currentFile);
    fd.append('title', title);
    fd.append('category', category);
    fd.append('description', desc);

    await apiFetch('/api/portfolio', { method: 'POST', body: fd });
    resetForm();
    loadAdminItems();
    showToast('Portfolio piece added!');
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Add to portfolio';
  }
}

function resetForm() {
  document.getElementById('f-title').value    = '';
  document.getElementById('f-category').value = '';
  document.getElementById('f-desc').value     = '';
  clearFile();
}

/* ── Keyboard esc ───────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'Enter' && document.getElementById('loginOverlay').classList.contains('open')) doLogin();
});

/* ── Init ───────────────────────────────────────────────────────── */
loadPublicPortfolio();
