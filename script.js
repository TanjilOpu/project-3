// ══════════════════════════════════════════════
//  DATA STORE (localStorage)
// ══════════════════════════════════════════════
const OWNERS_KEY = 'mbstu_owners';
const MESSES_KEY = 'mbstu_messes';

function getOwners() {
  try { return JSON.parse(localStorage.getItem(OWNERS_KEY)) || []; } catch { return []; }
}
function savOwners(d) {
  localStorage.setItem(OWNERS_KEY, JSON.stringify(d));
}
function getMesses() {
  try { return JSON.parse(localStorage.getItem(MESSES_KEY)) || []; } catch { return []; }
}
function savMesses(d) {
  try {
    localStorage.setItem(MESSES_KEY, JSON.stringify(d));
    return true;
  } catch (e) {
    showToast('Storage full! Try using smaller or fewer images.', 'error');
    return false;
  }
}

let currentOwner    = null;
let pendingDeleteId = null;
let _currentImages  = [];


// ══════════════════════════════════════════════
//  PAGE ROUTING
// ══════════════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + name);
  if (target) target.classList.add('active');
  document.getElementById('heroSection').style.display = (name === 'browse') ? '' : 'none';
  if (name === 'browse') renderMesses(getMesses());
  if (name === 'ownerDashboard') renderOwnerDashboard();
  window.scrollTo(0, 0);
}


// ══════════════════════════════════════════════
//  BROWSE & FILTER
// ══════════════════════════════════════════════
function applyFilters() {
  const type     = document.getElementById('f_type').value;
  const loc      = document.getElementById('f_location').value;
  const maxRent  = parseInt(document.getElementById('f_rent').value) || 0;
  const maxDist  = parseInt(document.getElementById('f_distance').value) || 0;
  const minSeats = parseInt(document.getElementById('f_seats').value) || 1;
  const wifi     = document.getElementById('f_wifi').value;
  const gas      = document.getElementById('f_gas').value;
  const meal     = document.getElementById('f_meal').value;

  let messes = getMesses().filter(m => {
    if (type && m.type !== type) return false;
    if (loc  && m.location !== loc) return false;
    if (maxRent > 0 && m.rent > maxRent) return false;
    if (maxDist > 0 && m.distance > maxDist) return false;
    if (m.seats < minSeats) return false;
    if (wifi && String(m.wifi) !== wifi) return false;
    if (gas  && String(m.gas)  !== gas)  return false;
    if (meal && String(m.meal) !== meal) return false;
    return true;
  });

  messes.sort((a, b) => (a.distance - b.distance) || (a.rent - b.rent));
  renderMesses(messes);
}

function resetFilters() {
  ['f_type', 'f_location', 'f_wifi', 'f_gas', 'f_meal']
    .forEach(id => document.getElementById(id).value = '');
  ['f_rent', 'f_distance', 'f_seats']
    .forEach(id => document.getElementById(id).value = '');
  renderMesses(getMesses());
}


// ══════════════════════════════════════════════
//  RENDER COMPACT MESS CARDS
// ══════════════════════════════════════════════
function renderMesses(messes, container = 'messGrid', ownerMode = false) {
  const grid    = document.getElementById(container);
  const countEl = document.getElementById('resultsCount');
  if (!grid) return;

  if (countEl && !ownerMode) {
    const total = getMesses().length;
    countEl.innerHTML = `Showing <strong>${messes.length}</strong> of <strong>${total}</strong> listings`;
  }

  if (messes.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏠</div>
        <h3>${ownerMode ? 'No Listings Yet' : 'No Messes Found'}</h3>
        <p>${ownerMode ? 'Click "+ Add New Mess" to list your first property.' : 'Try adjusting your filters or check back later.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = messes.map(m => `
    <div class="mess-card ${m.type.toLowerCase()}">
      <div class="card-compact">
        <div class="card-top">
          <div>
            <div class="card-name">${esc(m.name)}</div>
            <div class="card-id-text">ID: ${m.id} · ${esc(m.location)}</div>
          </div>
          <span class="type-badge ${m.type.toLowerCase()}">${m.type}</span>
        </div>
        <div class="card-meta">
          <span class="card-location-text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            ${esc(m.address)}
          </span>
          <span class="distance-chip">📍 ${m.distance}m</span>
        </div>
        <div style="margin-top:10px">
          <div class="card-rent-small">${m.rent.toLocaleString()} <span>BDT/seat/mo</span></div>
        </div>
      </div>
      <div class="card-footer">
        <span class="seats-info">🪑 <strong>${m.seats}</strong> seats available</span>
        <button class="btn-details" onclick="openDetailModal(${m.id})">See Details →</button>
      </div>
      ${ownerMode ? `
      <div class="owner-card-actions">
        <button class="btn btn-blue btn-sm" onclick="editMess(${m.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${m.id}, '${esc(m.name)}')">🗑️ Delete</button>
      </div>` : ''}
    </div>
  `).join('');
}


// ══════════════════════════════════════════════
//  DETAIL MODAL
// ══════════════════════════════════════════════
function openDetailModal(id) {
  const m = getMesses().find(x => x.id === id);
  if (!m) return;

  const images = (m.images && m.images.length > 0)
    ? m.images
    : (m.imageData ? [m.imageData] : []);

  const galleryHTML = images.length > 0 ? `
    <div class="gallery-wrap">
      <div class="gallery-main">
        <img id="galleryMainImg" src="${images[0]}" alt="${esc(m.name)}">
        ${images.length > 1 ? `
          <button class="gallery-arrow left" onclick="galleryNav(-1)">&#8249;</button>
          <button class="gallery-arrow right" onclick="galleryNav(1)">&#8250;</button>
          <div class="gallery-counter" id="galleryCounter">1 / ${images.length}</div>
        ` : ''}
      </div>
      ${images.length > 1 ? `
        <div class="gallery-thumbs">
          ${images.map((src, i) => `
            <img src="${src}" class="gallery-thumb ${i === 0 ? 'active' : ''}"
              onclick="galleryGoTo(${i})" alt="Photo ${i + 1}">
          `).join('')}
        </div>
      ` : ''}
    </div>
  ` : `<div class="modal-img-placeholder">${m.type === 'GIRLS' ? '🏩' : '🏠'}</div>`;

  document.getElementById('detailModalContent').innerHTML = `
    ${galleryHTML}
    <div class="modal-body">
      <div class="modal-header">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="type-badge ${m.type.toLowerCase()}">${m.type}</span>
            <span style="font-size:0.72rem;color:var(--muted)">ID: ${m.id}</span>
          </div>
          <div class="modal-title">${esc(m.name)}</div>
        </div>
        <button class="modal-close" onclick="closeDetailModal()">✕</button>
      </div>
      <div class="modal-rent">${m.rent.toLocaleString()} <span>BDT / seat / month</span></div>
      <div class="modal-location">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        ${esc(m.address)} &nbsp;·&nbsp; ${esc(m.location)}
        <span class="distance-chip">📍 ${m.distance}m from MBSTU</span>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Room Details</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="d-label">Available Seats</div><div class="d-value">${m.seats}</div></div>
          <div class="detail-item"><div class="d-label">People / Room</div><div class="d-value">Max ${m.ppr}</div></div>
          <div class="detail-item"><div class="d-label">Electricity Lines</div><div class="d-value">${m.elec}</div></div>
          <div class="detail-item"><div class="d-label">Distance</div><div class="d-value">${m.distance}m</div></div>
          ${m.single ? `<div class="detail-item"><div class="d-label">Single Seat Cost</div><div class="d-value">${m.singleCost.toLocaleString()} BDT</div></div>` : ''}
          ${m.meal   ? `<div class="detail-item"><div class="d-label">Meals Per Day</div><div class="d-value">${m.mealsDay}</div></div>` : ''}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Amenities</div>
        <div class="chips-row">
          <span class="chip ${m.wifi   ? 'on' : 'off'}">${m.wifi   ? '✓' : '✗'} WiFi</span>
          <span class="chip ${m.gas    ? 'on' : 'off'}">${m.gas    ? '✓' : '✗'} Gas</span>
          <span class="chip ${m.tiled  ? 'on' : 'off'}">${m.tiled  ? '✓' : '✗'} Tiled Room</span>
          <span class="chip ${m.meal   ? 'on' : 'off'}">${m.meal   ? '✓ Meals (' + m.mealsDay + '/day)' : '✗ No Meals'}</span>
          <span class="chip ${m.single ? 'on' : 'off'}">${m.single ? '✓ Single Seat' : '✗ No Single'}</span>
        </div>
      </div>
      <div class="modal-contact">
        📞 Contact Owner: <strong>${esc(m.contact)}</strong>
      </div>
      ${m.desc ? `<div class="modal-desc">${esc(m.desc)}</div>` : ''}
    </div>
  `;

  window._galleryImages = images;
  window._galleryIndex  = 0;
  document.getElementById('detailModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function galleryGoTo(index) {
  const imgs = window._galleryImages || [];
  if (!imgs.length) return;
  window._galleryIndex = index;
  document.getElementById('galleryMainImg').src = imgs[index];
  const counter = document.getElementById('galleryCounter');
  if (counter) counter.textContent = (index + 1) + ' / ' + imgs.length;
  document.querySelectorAll('.gallery-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === index);
  });
}

function galleryNav(dir) {
  const imgs = window._galleryImages || [];
  galleryGoTo((window._galleryIndex + dir + imgs.length) % imgs.length);
}

function closeDetailModal(e) {
  if (e && e.target !== document.getElementById('detailModal')) return;
  document.getElementById('detailModal').classList.remove('open');
  document.body.style.overflow = '';
}


// ══════════════════════════════════════════════
//  OWNER AUTH
// ══════════════════════════════════════════════
function registerOwner() {
  const name     = document.getElementById('reg_name').value.trim();
  const contact  = document.getElementById('reg_contact').value.trim();
  const username = document.getElementById('reg_username').value.trim();
  const password = document.getElementById('reg_password').value;
  const confirm  = document.getElementById('reg_confirm').value;
  const errEl    = document.getElementById('regError');
  const sucEl    = document.getElementById('regSuccess');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!name || !contact || !username || !password) {
    showFormError(errEl, 'Please fill all required fields.'); return;
  }
  if (password.length < 6) {
    showFormError(errEl, 'Password must be at least 6 characters.'); return;
  }
  if (password !== confirm) {
    showFormError(errEl, 'Passwords do not match.'); return;
  }
  const owners = getOwners();
  if (owners.find(o => o.username.toLowerCase() === username.toLowerCase())) {
    showFormError(errEl, 'Username already taken. Please choose another.'); return;
  }
  owners.push({ id: Date.now(), name, contact, username, password: btoa(password) });
  savOwners(owners);
  sucEl.textContent = 'Account created! Redirecting to login...';
  sucEl.style.display = 'block';
  setTimeout(() => showPage('ownerLogin'), 1500);
}

function loginOwner() {
  const username = document.getElementById('login_username').value.trim();
  const password = document.getElementById('login_password').value;
  const errEl    = document.getElementById('loginError');
  errEl.style.display = 'none';

  const owner = getOwners().find(o =>
    o.username.toLowerCase() === username.toLowerCase() && atob(o.password) === password
  );
  if (!owner) { showFormError(errEl, 'Invalid username or password.'); return; }

  currentOwner = owner;
  document.getElementById('ownerNameDisplay').textContent    = 'Welcome, ' + owner.name;
  document.getElementById('ownerContactDisplay').textContent = owner.contact;
  showPage('ownerDashboard');
  showToast('Logged in as ' + owner.name, 'success');
  document.getElementById('login_username').value = '';
  document.getElementById('login_password').value = '';
}

function logoutOwner() {
  currentOwner = null;
  showPage('browse');
  showToast('Logged out successfully', 'success');
}


// ══════════════════════════════════════════════
//  OWNER DASHBOARD
// ══════════════════════════════════════════════
function renderOwnerDashboard() {
  if (!currentOwner) { showPage('ownerLogin'); return; }

  const myMesses = getMesses().filter(m => m.ownerId === currentOwner.id);
  document.getElementById('ownerStats').innerHTML = `
    <div class="stat-card"><div class="num">${myMesses.length}</div><div class="lbl">My Listings</div></div>
    <div class="stat-card"><div class="num">${myMesses.reduce((a, m) => a + m.seats, 0)}</div><div class="lbl">Total Seats</div></div>
    <div class="stat-card"><div class="num">${myMesses.filter(m => m.type === 'BOYS').length}</div><div class="lbl">Boys Messes</div></div>
    <div class="stat-card"><div class="num">${myMesses.filter(m => m.type === 'GIRLS').length}</div><div class="lbl">Girls Messes</div></div>
  `;
  renderMesses(myMesses, 'ownerMessGrid', true);
}

function switchOwnerTab(tabName, btn, skipClear = false) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-myListings').style.display = tabName === 'myListings' ? '' : 'none';
  document.getElementById('tab-addMess').style.display    = tabName === 'addMess'    ? '' : 'none';
  if (tabName === 'addMess' && !skipClear) {
    clearMessForm();
    document.getElementById('messFormTitle').textContent = 'Add New Mess / Sublet';
  }
}


// ══════════════════════════════════════════════
//  MESS CRUD
// ══════════════════════════════════════════════
function saveMess() {
  if (!currentOwner) return;

  const errEl = document.getElementById('messFormError');
  errEl.style.display = 'none';

  const name    = document.getElementById('mf_name').value.trim();
  const address = document.getElementById('mf_address').value.trim();
  const rent    = parseInt(document.getElementById('mf_rent').value) || 0;
  const seats   = parseInt(document.getElementById('mf_seats').value);

  if (!name || !address || rent < 1 || isNaN(seats)) {
    showFormError(errEl, 'Please fill all required fields (Name, Address, Rent > 0, Seats).');
    return;
  }

  const editIdVal = document.getElementById('mf_editId').value.trim();
  const editId    = editIdVal ? parseInt(editIdVal) : 0;

  const mess = {
    id:         editId || Date.now(),
    ownerId:    currentOwner.id,
    name,
    type:       document.getElementById('mf_type').value,
    location:   document.getElementById('mf_location').value,
    address,
    distance:   parseInt(document.getElementById('mf_distance').value) || 0,
    rent,
    seats,
    ppr:        parseInt(document.getElementById('mf_ppr').value) || 2,
    elec:       parseInt(document.getElementById('mf_elec').value) || 1,
    wifi:       document.getElementById('mf_wifi').value === 'true',
    gas:        document.getElementById('mf_gas').value === 'true',
    tiled:      document.getElementById('mf_tiled').value === 'true',
    meal:       document.getElementById('mf_meal').value === 'true',
    mealsDay:   parseInt(document.getElementById('mf_mealsday').value) || 0,
    single:     document.getElementById('mf_single').value === 'true',
    singleCost: parseInt(document.getElementById('mf_singlecost').value) || 0,
    contact:    currentOwner.contact,
    desc:       document.getElementById('mf_desc').value.trim(),
    images:     _currentImages.slice(),
    imageData:  _currentImages[0] || '',
  };

  const messes = getMesses();

  if (editId) {
    const idx = messes.findIndex(m => m.id === editId);
    if (idx !== -1) messes[idx] = mess;
    if (savMesses(messes)) {
      showToast('Mess updated successfully!', 'success');
      clearMessForm();
      renderOwnerDashboard();
      switchOwnerTab('myListings', document.querySelectorAll('.nav-tab')[0]);
    }
  } else {
    messes.push(mess);
    if (savMesses(messes)) {
      showToast('Mess added successfully!', 'success');
      clearMessForm();
      renderOwnerDashboard();
      switchOwnerTab('myListings', document.querySelectorAll('.nav-tab')[0]);
    }
  }
}

function editMess(id) {
  const m = getMesses().find(x => x.id === id);
  if (!m) return;

  document.getElementById('mf_editId').value     = m.id;
  document.getElementById('mf_name').value       = m.name;
  document.getElementById('mf_type').value       = m.type;
  document.getElementById('mf_location').value   = m.location;
  document.getElementById('mf_address').value    = m.address;
  document.getElementById('mf_distance').value   = m.distance;
  document.getElementById('mf_rent').value       = m.rent;
  document.getElementById('mf_seats').value      = m.seats;
  document.getElementById('mf_ppr').value        = m.ppr;
  document.getElementById('mf_elec').value       = m.elec;
  document.getElementById('mf_wifi').value       = String(m.wifi);
  document.getElementById('mf_gas').value        = String(m.gas);
  document.getElementById('mf_tiled').value      = String(m.tiled);
  document.getElementById('mf_meal').value       = String(m.meal);
  document.getElementById('mf_mealsday').value   = m.mealsDay;
  document.getElementById('mf_single').value     = String(m.single);
  document.getElementById('mf_singlecost').value = m.singleCost;
  document.getElementById('mf_desc').value       = m.desc || '';

  _currentImages = (m.images && m.images.length > 0) ? m.images.slice() : (m.imageData ? [m.imageData] : []);
  renderImagePreviews();
  document.getElementById('mf_image_data').value = JSON.stringify(_currentImages);

  document.getElementById('messFormTitle').textContent = 'Edit: ' + m.name;
  toggleMealInput();
  toggleSingleInput();
  switchOwnerTab('addMess', document.querySelectorAll('.nav-tab')[1], true);
  document.getElementById('tab-addMess').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  clearMessForm();
  switchOwnerTab('myListings', document.querySelectorAll('.nav-tab')[0]);
}

function clearMessForm() {
  ['mf_name', 'mf_address', 'mf_distance', 'mf_rent', 'mf_seats', 'mf_desc', 'mf_editId']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('mf_ppr').value        = '2';
  document.getElementById('mf_elec').value       = '1';
  document.getElementById('mf_mealsday').value   = '2';
  document.getElementById('mf_singlecost').value = '0';
  document.getElementById('mf_image_data').value = '';
  _currentImages = [];
  renderImagePreviews();
  ['mf_type', 'mf_location', 'mf_wifi', 'mf_gas', 'mf_tiled', 'mf_meal', 'mf_single']
    .forEach(id => document.getElementById(id).selectedIndex = 0);
  document.getElementById('messFormError').style.display = 'none';
  toggleMealInput();
  toggleSingleInput();
}

function openDeleteModal(id, name) {
  pendingDeleteId = id;
  document.getElementById('deleteMessName').textContent = name;
  document.getElementById('deleteModal').classList.add('open');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  savMesses(getMesses().filter(m => m.id !== pendingDeleteId));
  closeDeleteModal();
  renderOwnerDashboard();
  showToast('Listing deleted.', 'success');
  pendingDeleteId = null;
}

function closeDeleteModal(e) {
  if (e && e.target !== document.getElementById('deleteModal')) return;
  document.getElementById('deleteModal').classList.remove('open');
}


// ══════════════════════════════════════════════
//  IMAGE UPLOAD — multi, compressed
// ══════════════════════════════════════════════
function previewImages(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const remaining = 6 - _currentImages.length;
  if (remaining <= 0) { showToast('Maximum 6 photos allowed.', 'error'); return; }
  const toLoad = files.slice(0, remaining);

  toLoad.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      compressImage(e.target.result, 800, 0.6, function(compressed) {
        _currentImages.push(compressed);
        renderImagePreviews();
        document.getElementById('mf_image_data').value = JSON.stringify(_currentImages);
      });
    };
    reader.readAsDataURL(file);
  });

  event.target.value = '';
}

function compressImage(dataUrl, maxWidth, quality, callback) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    let w = img.width, h = img.height;
    if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = dataUrl;
}

function renderImagePreviews() {
  const grid = document.getElementById('mf_image_preview_grid');
  if (!grid) return;
  grid.innerHTML = _currentImages.map((src, i) => `
    <div class="img-thumb-wrap">
      <img src="${src}" class="img-thumb" alt="Photo ${i + 1}">
      ${i === 0 ? '<div class="img-thumb-badge">Cover</div>' : ''}
      <button class="img-thumb-remove" onclick="removeImage(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

function removeImage(index) {
  _currentImages.splice(index, 1);
  renderImagePreviews();
  document.getElementById('mf_image_data').value = JSON.stringify(_currentImages);
}


// ══════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════
function toggleMealInput() {
  document.getElementById('mealDayGroup').style.display =
    document.getElementById('mf_meal').value === 'true' ? '' : 'none';
}

function toggleSingleInput() {
  document.getElementById('singleCostGroup').style.display =
    document.getElementById('mf_single').value === 'true' ? '' : 'none';
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3000);
}


// ══════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('detailModal').classList.remove('open');
    document.getElementById('deleteModal').classList.remove('open');
    document.body.style.overflow = '';
  }
  if (e.key === 'Enter' && document.getElementById('page-ownerLogin').classList.contains('active')) {
    loginOwner();
  }
});


// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
showPage('browse');