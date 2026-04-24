const API = '';
const TOKEN_KEY = 'fz_admin_token';
let allItems = [];
let pendingDeleteId = null;
let currentFile = null;

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function authHeaders() {
  return { 'Authorization': 'Bearer ' + getToken() };
}

async function doLogin() {
  const pwd = document.getElementById('loginPwd').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('show');
  if (!pwd) return;

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const data = await res.json();
    if (!res.ok) { errEl.classList.add('show'); return; }
    setToken(data.token);
    showAdmin();
  } catch (e) {
    errEl.classList.add('show');
  }
}

function logout() {
  clearToken();
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginPwd').value = '';
}

async function checkAuth() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API}/api/portfolio`, { headers: authHeaders() });
    if (res.ok) showAdmin();
  } catch (e) {}
}

function showAdmin() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'flex';
  loadItems();
}

async function loadItems() {
  document.getElementById('adminItems').innerHTML = '<div class="admin-empty"><div class="loading-spinner"></div></div>';
  try {
    const res = await fetch(`${API}/api/portfolio`);
    const data = await res.json();
    allItems = data.items || [];
    renderAdmin();
  } catch (e) {
    document.getElementById('adminItems').innerHTML = '<div class="admin-empty">Could not load items.</div>';
  }
}

function renderAdmin(query) {
  const count = allItems.length;
  document.getElementById('headerCount').textContent = count + (count === 1 ? ' portfolio piece' : ' portfolio pieces');

  let items = allItems;
  if (query) {
    const q = query.toLowerCase();
    items = allItems.filter(i => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }

  const container = document.getElementById('adminItems');
  if (items.length === 0) {
    container.innerHTML = '<div class="admin-empty">' + (allItems.length === 0 ? 'No portfolio pieces yet. Add your first piece using the form.' : 'No results for that search.') + '</div>';
    return;
  }

  container.innerHTML = items.map((item, i) => `
    <div class="admin-item" style="animation-delay:${i * 0.04}s">
      ${item.is_video
        ? `<div class="admin-thumb-video">▶</div>`
        : `<img class="admin-thumb" src="${item.url}" alt="${escHtml(item.title)}" loading="lazy"/>`}
      <div class="admin-item-info">
        <div class="admin-item-title">${escHtml(item.title)}</div>
        <div class="admin-item-meta">${formatDate(item.created_at)} · ${formatSize(item.file_size)}</div>
        <span class="admin-item-cat">${escHtml(item.category)}</span>
      </div>
      <div class="admin-item-actions">
        <button class="del-btn" onclick="openDeleteModal('${item.id}')" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

function filterAdmin() {
  renderAdmin(document.getElementById('searchInput').value.trim());
}

/* FILE HANDLING */
function dragOver(e) { e.preventDefault(); document.getElementById('dropZone').classList.add('drag'); }
function dragLeave() { document.getElementById('dropZone').classList.remove('drag'); }
function dropFile(e) { e.preventDefault(); dragLeave(); const f = e.dataTransfer.files[0]; if (f) processFile(f); }
function fileSelected(input) { if (input.files[0]) processFile(input.files[0]); }

function processFile(f) {
  currentFile = f;
  document.getElementById('fileName').textContent = f.name;
  document.getElementById('fileSize').textContent = formatSize(f.size);
  const preview = document.getElementById('mediaPreview');
  const url = URL.createObjectURL(f);
  if (f.type.startsWith('image/')) {
    preview.innerHTML = `<img src="${url}" style="width:100%;border-radius:6px;max-height:140px;object-fit:cover;"/>`;
  } else if (f.type.startsWith('video/')) {
    preview.innerHTML = `<video src="${url}" style="width:100%;border-radius:6px;max-height:140px;" muted playsinline></video>`;
  }
  document.getElementById('filePreview').style.display = 'block';
}

function clearFile() {
  currentFile = null;
  document.getElementById('filePreview').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('mediaPreview').innerHTML = '';
}

/* UPLOAD */
async function uploadItem() {
  const title = document.getElementById('fTitle').value.trim();
  const category = document.getElementById('fCategory').value;
  const desc = document.getElementById('fDesc').value.trim();
  if (!title) { showToast('Please enter a title', 'error'); return; }
  if (!category) { showToast('Please select a category', 'error'); return; }
  if (!currentFile) { showToast('Please select a file', 'error'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading…';

  const progress = document.getElementById('uploadProgress');
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  progress.style.display = 'block';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('category', category);
  formData.append('description', desc);
  formData.append('file', currentFile);

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/portfolio`);
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round(e.loaded / e.total * 100);
        fill.style.width = pct + '%';
        label.textContent = pct < 100 ? `Uploading… ${pct}%` : 'Processing…';
      }
    };

    xhr.onload = () => {
      btn.disabled = false;
      btn.textContent = 'Add to portfolio';
      progress.style.display = 'none';
      fill.style.width = '0%';

      if (xhr.status === 201) {
        const data = JSON.parse(xhr.responseText);
        allItems.unshift(data.item);
        renderAdmin();
        resetForm();
        showToast('Portfolio piece added!', 'success');
      } else {
        const err = JSON.parse(xhr.responseText);
        if (xhr.status === 401) { logout(); return; }
        showToast(err.error || 'Upload failed', 'error');
      }
    };

    xhr.onerror = () => {
      btn.disabled = false;
      btn.textContent = 'Add to portfolio';
      progress.style.display = 'none';
      showToast('Upload failed. Check your connection.', 'error');
    };

    xhr.send(formData);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Add to portfolio';
    showToast('Upload failed', 'error');
  }
}

function resetForm() {
  document.getElementById('fTitle').value = '';
  document.getElementById('fCategory').value = '';
  document.getElementById('fDesc').value = '';
  clearFile();
}

/* DELETE */
function openDeleteModal(id) {
  pendingDeleteId = id;
  document.getElementById('deleteModal').style.display = 'flex';
  document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById('deleteModal').style.display = 'none';
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  closeDeleteModal();

  try {
    const res = await fetch(`${API}/api/portfolio/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { showToast('Could not delete item', 'error'); return; }
    allItems = allItems.filter(i => i.id !== id);
    renderAdmin();
    showToast('Deleted successfully', 'success');
  } catch (e) {
    showToast('Delete failed', 'error');
  }
}

/* HELPERS */
function formatDate(str) {
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

document.addEventListener('DOMContentLoaded', checkAuth);
