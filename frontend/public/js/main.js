const API = '';
let allItems = [];
let currentFilter = 'all';

async function loadPortfolio() {
  const grid = document.getElementById('portfolioGrid');
  grid.innerHTML = '<div class="page-loader"><div class="loading-spinner"></div></div>';
  try {
    const res = await fetch(`${API}/api/portfolio`);
    const data = await res.json();
    allItems = data.items || [];
    buildFilters();
    renderGrid();
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>Could not load portfolio. Please try again later.</p></div>';
  }
}

function buildFilters() {
  const bar = document.getElementById('filterBar');
  bar.querySelectorAll('[data-cat]').forEach(b => b.remove());
  const cats = [...new Set(allItems.map(i => i.category))];
  const countEl = document.getElementById('filterCount');
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (currentFilter === cat ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.onclick = () => { currentFilter = cat; setActiveFilter(btn); renderGrid(); };
    bar.insertBefore(btn, countEl);
  });
}

function setActiveFilter(el) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function renderGrid() {
  const grid = document.getElementById('portfolioGrid');
  const filtered = currentFilter === 'all' ? allItems : allItems.filter(i => i.category === currentFilter);
  document.getElementById('filterCount').textContent = filtered.length + (filtered.length === 1 ? ' piece' : ' pieces');

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="28" rx="4" stroke="#B4B2A9" stroke-width="1.5"/><path d="M6 18h36" stroke="#B4B2A9" stroke-width="1.5"/><circle cx="24" cy="30" r="4" stroke="#B4B2A9" stroke-width="1.5"/></svg>
      <p>${allItems.length === 0 ? 'Portfolio coming soon.' : 'No items in this category.'}</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map((item, i) => `
    <div class="p-card" style="animation-delay:${i * 0.05}s" onclick="openLightbox('${item.id}')">
      ${item.is_video
        ? `<video class="card-media" src="${item.url}" muted playsinline preload="metadata"></video>`
        : `<img class="card-media" src="${item.url}" alt="${escHtml(item.title)}" loading="lazy"/>`}
      <div class="card-body">
        <div class="card-category">${escHtml(item.category)}</div>
        <div class="card-title">${escHtml(item.title)}</div>
        ${item.description ? `<div class="card-desc">${escHtml(item.description.substring(0,90))}${item.description.length > 90 ? '…' : ''}</div>` : ''}
        <span class="card-badge">${item.is_video ? 'Video' : 'Image'}</span>
      </div>
    </div>
  `).join('');
}

function openLightbox(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('lbCategory').textContent = item.category;
  document.getElementById('lbTitle').textContent = item.title;
  document.getElementById('lbDesc').textContent = item.description || '';
  document.getElementById('lbDate').textContent = new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('lbMedia').innerHTML = item.is_video
    ? `<video class="lightbox-video" src="${item.url}" controls autoplay muted style="max-height:480px"></video>`
    : `<img class="lightbox-media" src="${item.url}" alt="${escHtml(item.title)}"/>`;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  if (!e || e.target === document.getElementById('lightbox') || e.currentTarget.id === 'lbClose') {
    document.getElementById('lightbox').classList.remove('open');
    document.getElementById('lbMedia').innerHTML = '';
    document.body.style.overflow = '';
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', loadPortfolio);
document.getElementById('filterAll').onclick = function() { currentFilter = 'all'; setActiveFilter(this); renderGrid(); };
