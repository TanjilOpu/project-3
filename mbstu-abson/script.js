import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDocs, query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7wiVBHHzaNzdzSrCTPBfG-7CyrJuBtO4",
  authDomain: "mbstu-mess-finder.firebaseapp.com",
  projectId: "mbstu-mess-finder",
  storageBucket: "mbstu-mess-finder.firebasestorage.app",
  messagingSenderId: "565571283956",
  appId: "1:565571283956:web:a1f64bab63adc76afc67a1",
  measurementId: "G-ZCERX114LW"
};

const ADMIN_EMAIL = "tanjil00234@gmail.com";

const EJS_PUBLIC_KEY = "0WTBkn2BFt8OzJItP";

const EJS_SERVICE_ID = "service_kj26sun";

const EJS_TEMPLATE_ID = "template_urzypx9";

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const OWNERS_COL = "owners";

const MESSES_COL = "messes";

let currentOwner = null;

let currentAdmin = false;

let pendingDeleteId = null;

let pendingDeleteType = null;

let pendingOwnerDeleteId = null;

let _currentImages = [];

let _allMesses = [];

let _allOwners = [];

function updateHeader() {
  const ownerLoggedIn = !!currentOwner;
  const adminLoggedIn = !!currentAdmin;
  const anyLoggedIn = ownerLoggedIn || adminLoggedIn;
  document.getElementById("hdr_ownerLogin").style.display = anyLoggedIn ? "none" : "";
  document.getElementById("hdr_admin").style.display = anyLoggedIn ? "none" : "";
  document.getElementById("hdr_register").style.display = anyLoggedIn ? "none" : "";
  document.getElementById("hdr_myProfile").style.display = ownerLoggedIn ? "" : "none";
  document.getElementById("hdr_adminProfile").style.display = adminLoggedIn ? "" : "none";
  document.getElementById("hdr_logout").style.display = anyLoggedIn ? "" : "none";
}

window.updateHeader = updateHeader;

function handleHeaderLogout() {
  if (currentAdmin) logoutAdmin(); else if (currentOwner) logoutOwner();
}

window.handleHeaderLogout = handleHeaderLogout;

function hideLoading() {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = "none";
}

function showPage(name, pushState = true) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-" + name);
  if (target) {
    target.classList.add("active");
    target.classList.remove("page-fade-in");
    void target.offsetWidth;
    target.classList.add("page-fade-in");
  }
  document.getElementById("heroSection").style.display = name === "browse" ? "" : "none";
  if (name === "browse") loadAndRenderMesses();
  if (name === "ownerDashboard") renderOwnerDashboard();
  if (name === "adminDashboard") renderAdminDashboard();
  if (pushState) {
    history.pushState({
      page: name
    }, "", "#" + name);
  }
  window.scrollTo(0, 0);
}

window.showPage = showPage;

window.addEventListener("popstate", function(e) {
  const page = e.state && e.state.page ? e.state.page : "browse";
  if (page === "ownerDashboard" && !currentOwner) {
    showPage("ownerLogin", false);
    return;
  }
  if (page === "adminDashboard" && !currentAdmin) {
    showPage("adminLogin", false);
    return;
  }
  showPage(page, false);
});

function skeletonCardsHTML(count = 6) {
  return Array.from({
    length: count
  }).map(() => `\n    <div class="mess-card skeleton-card">\n      <div class="skeleton-block skeleton-thumb"></div>\n      <div class="card-compact">\n        <div class="skeleton-block skeleton-line" style="width:70%"></div>\n        <div class="skeleton-block skeleton-line" style="width:40%;margin-top:8px"></div>\n        <div class="skeleton-block skeleton-line" style="width:55%;margin-top:14px"></div>\n      </div>\n    </div>\n  `).join("");
}

async function loadAndRenderMesses() {
  document.getElementById("messGrid").innerHTML = skeletonCardsHTML();
  try {
    const q = query(collection(db, MESSES_COL), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    _allMesses = snap.docs.map(d => ({
      firestoreId: d.id,
      ...d.data()
    }));
    renderMesses(_allMesses);
    const heroStat = document.getElementById("heroStatTotal");
    if (heroStat) heroStat.textContent = _allMesses.length;
  } catch (e) {
    console.error(e);
    document.getElementById("messGrid").innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Could not load messes</h3><p>Check your Firebase config or internet connection.</p></div>`;
  }
}

function applyFilters() {
  const type = document.getElementById("f_type").value;
  const loc = document.getElementById("f_location").value;
  const maxRent = parseInt(document.getElementById("f_rent").value) || 0;
  const maxDist = parseInt(document.getElementById("f_distance").value) || 0;
  const minSeats = parseInt(document.getElementById("f_seats").value) || 1;
  const wifi = document.getElementById("f_wifi").value;
  const gas = document.getElementById("f_gas").value;
  const meal = document.getElementById("f_meal").value;
  const single = document.getElementById("f_single").value;
  let filtered = _allMesses.filter(m => {
    if (type && m.type !== type) return false;
    if (loc && m.location !== loc) return false;
    if (maxRent > 0 && m.rent > maxRent) return false;
    if (maxDist > 0 && m.distance > maxDist) return false;
    if (m.seats < minSeats) return false;
    if (wifi && String(m.wifi) !== wifi) return false;
    if (gas && String(m.gas) !== gas) return false;
    if (meal && String(m.meal) !== meal) return false;
    if (single && String(m.single) !== single) return false;
    return true;
  });
  filtered.sort((a, b) => a.distance - b.distance || a.rent - b.rent);
  renderMesses(filtered);
}

window.applyFilters = applyFilters;

function resetFilters() {
  [ "f_type", "f_location", "f_wifi", "f_gas", "f_meal", "f_single" ].forEach(id => document.getElementById(id).value = "");
  [ "f_rent", "f_distance", "f_seats" ].forEach(id => document.getElementById(id).value = "");
  renderMesses(_allMesses);
}

window.resetFilters = resetFilters;

function renderMesses(messes, container = "messGrid", ownerMode = false, adminMode = false) {
  const grid = document.getElementById(container);
  const countEl = document.getElementById("resultsCount");
  if (!grid) return;
  if (countEl && !ownerMode && !adminMode) {
    countEl.innerHTML = `Showing <strong>${messes.length}</strong> of <strong>${_allMesses.length}</strong> listings`;
  }
  if (messes.length === 0) {
    grid.innerHTML = `\n      <div class="empty-state">\n        <div class="icon">🏠</div>\n        <h3>${ownerMode ? "No Listings Yet" : adminMode ? "No Messes Found" : "No Messes Found"}</h3>\n        <p>${ownerMode ? 'Click "+ Add New Mess" to list your first property.' : "Try adjusting your filters or check back later."}</p>\n      </div>`;
    return;
  }
  grid.innerHTML = messes.map(m => {
    const thumbSrc = m.images && m.images.length > 0 ? m.images[0] : m.imageData || null;
    return `\n    <div class="mess-card ${m.type.toLowerCase()} ${adminMode ? "admin-card" : ""}">\n      ${adminMode ? `<div class="admin-card-banner">🛡️ Admin View · Owner: ${esc(m.ownerName || "Unknown")}</div>` : ""}\n      <div class="card-thumb">\n        ${thumbSrc ? `<img src="${thumbSrc}" alt="${esc(m.name)}" loading="lazy">` : `<div class="card-thumb-placeholder">${m.type === "GIRLS" ? "🏠" : "🏢"}</div>`}\n        <span class="card-thumb-type ${m.type.toLowerCase()}">${m.type}</span>\n      </div>\n      <div class="card-compact">\n        <div class="card-top">\n          <div>\n            <div class="card-name">${esc(m.name)}</div>\n            <div class="card-id-text">${esc(m.location)}</div>\n          </div>\n        </div>\n        <div class="card-meta">\n          <span class="card-location-text">\n            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>\n              <circle cx="12" cy="10" r="3"/>\n            </svg>\n            ${esc(m.address)}\n          </span>\n          <span class="distance-chip">📍 ${m.distance}m</span>\n        </div>\n        <div style="margin-top:10px">\n          <div class="card-rent-small">${m.rent.toLocaleString()} <span>BDT/seat/mo</span></div>\n        </div>\n      </div>\n      <div class="card-footer">\n        <span class="seats-info">🛏️ <strong>${m.seats}</strong> seats available (this month)</span>\n        <button class="btn-details" onclick="openDetailModal('${m.firestoreId}')">See Details →</button>\n      </div>\n      ${ownerMode ? `\n      <div class="owner-card-actions">\n        <button class="btn btn-blue btn-sm" onclick="editMess('${m.firestoreId}')">✏️ Edit</button>\n        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${m.firestoreId}', '${esc(m.name)}', false)">🗑️ Delete</button>\n      </div>` : ""}\n      ${adminMode ? `\n      <div class="owner-card-actions">\n        <button class="btn btn-admin btn-sm" onclick="adminEditMess('${m.firestoreId}')">🛡️ Edit</button>\n        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${m.firestoreId}', '${esc(m.name)}', true)">🗑️ Delete</button>\n      </div>` : ""}\n    </div>\n  `;
  }).join("");
}

function openDetailModal(firestoreId) {
  const m = _allMesses.find(x => x.firestoreId === firestoreId);
  if (!m) return;
  const images = m.images && m.images.length > 0 ? m.images : m.imageData ? [ m.imageData ] : [];
  const galleryHTML = images.length > 0 ? `\n    <div class="gallery-wrap">\n      <div class="gallery-main">\n        <img id="galleryMainImg" src="${images[0]}" alt="${esc(m.name)}">\n        ${images.length > 1 ? `\n          <button class="gallery-arrow left" onclick="galleryNav(-1)">&#8249;</button>\n          <button class="gallery-arrow right" onclick="galleryNav(1)">&#8250;</button>\n          <div class="gallery-counter" id="galleryCounter">1 / ${images.length}</div>\n        ` : ""}\n      </div>\n      ${images.length > 1 ? `\n        <div class="gallery-thumbs">\n          ${images.map((src, i) => `\n            <img src="${src}" class="gallery-thumb ${i === 0 ? "active" : ""}"\n              onclick="galleryGoTo(${i})" alt="Photo ${i + 1}">\n          `).join("")}\n        </div>\n      ` : ""}\n    </div>\n  ` : `<div class="modal-img-placeholder">${m.type === "GIRLS" ? "🏩" : "🏠"}</div>`;
  document.getElementById("detailModalContent").innerHTML = `\n    ${galleryHTML}\n    <div class="modal-body">\n      <div class="modal-header">\n        <div>\n          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">\n            <span class="type-badge ${m.type.toLowerCase()}">${m.type}</span>\n            <span style="font-size:0.72rem;color:var(--muted)">${esc(m.location)}</span>\n          </div>\n          <div class="modal-title">${esc(m.name)}</div>\n        </div>\n        <button class="modal-close" onclick="closeDetailModal()">✕</button>\n      </div>\n      <div class="modal-rent">${m.rent.toLocaleString()} <span>BDT / seat / month</span></div>\n      <div class="modal-location">\n        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>\n          <circle cx="12" cy="10" r="3"/>\n        </svg>\n        ${esc(m.address)} &nbsp;·&nbsp; ${esc(m.location)}\n        <span class="distance-chip">📍 ${m.distance}m from MBSTU</span>\n      </div>\n      <div class="detail-section">\n        <div class="detail-section-title">Room Details</div>\n        <div class="detail-grid">\n          <div class="detail-item"><div class="d-label">Building Type</div><div class="d-value">${m.buildingType === "TINSHED" ? "Tin-shed" : "Building"}</div></div>\n          <div class="detail-item"><div class="d-label">People / Room</div><div class="d-value">Max ${m.ppr}</div></div>\n          <div class="detail-item"><div class="d-label">Electricity Lines</div><div class="d-value">${m.elec}</div></div>\n          <div class="detail-item"><div class="d-label">Distance</div><div class="d-value">${m.distance}m</div></div>\n          ${m.single ? `<div class="detail-item"><div class="d-label">Single Seat Cost</div><div class="d-value">${m.singleCost.toLocaleString()} BDT</div></div>` : ""}\n          ${m.meal ? `<div class="detail-item"><div class="d-label">Meals Per Day</div><div class="d-value">${m.mealsDay}</div></div>` : ""}\n        </div>\n      </div>\n      <div class="detail-section">\n        <div class="detail-section-title">Seat Availability</div>\n        <div class="detail-grid">\n          <div class="detail-item"><div class="d-label">This Month · Single Room</div><div class="d-value">${m.seatsSingleThisMonth != null ? m.seatsSingleThisMonth : 0}</div></div>\n          <div class="detail-item"><div class="d-label">This Month · Shared Room</div><div class="d-value">${m.seatsMultiThisMonth != null ? m.seatsMultiThisMonth : m.seats}</div></div>\n          <div class="detail-item"><div class="d-label">Next Month · Single Room</div><div class="d-value">${m.seatsSingleNextMonth != null ? m.seatsSingleNextMonth : 0}</div></div>\n          <div class="detail-item"><div class="d-label">Next Month · Shared Room</div><div class="d-value">${m.seatsMultiNextMonth != null ? m.seatsMultiNextMonth : 0}</div></div>\n        </div>\n      </div>\n      <div class="detail-section">\n        <div class="detail-section-title">Amenities</div>\n        <div class="chips-row">\n          <span class="chip ${m.wifi ? "on" : "off"}">${m.wifi ? "✓" : "✗"} WiFi</span>\n          <span class="chip ${m.gas ? "on" : "off"}">${m.gas ? "✓" : "✗"} Gas</span>\n          <span class="chip ${m.tiled ? "on" : "off"}">${m.tiled ? "✓" : "✗"} Tiled Room</span>\n          <span class="chip ${m.meal ? "on" : "off"}">${m.meal ? "✓ Meals (" + m.mealsDay + "/day)" : "✗ No Meals"}</span>\n          <span class="chip ${m.single ? "on" : "off"}">${m.single ? "✓ Single Seat" : "✗ No Single"}</span>\n        </div>\n      </div>\n      <div class="modal-contact">📞 Contact Owner: <strong>${esc(m.contact)}</strong></div>\n      ${m.mapLink ? `<a href="${esc(m.mapLink)}" target="_blank" rel="noopener" class="btn btn-green btn-sm" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;text-decoration:none">📍 View on Google Maps</a>` : ""}\n      ${m.desc ? `<div class="modal-desc">${esc(m.desc)}</div>` : ""}\n    </div>\n  `;
  window._galleryImages = images;
  window._galleryIndex = 0;
  document.getElementById("detailModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

window.openDetailModal = openDetailModal;

function galleryGoTo(index) {
  const imgs = window._galleryImages || [];
  if (!imgs.length) return;
  window._galleryIndex = index;
  document.getElementById("galleryMainImg").src = imgs[index];
  const counter = document.getElementById("galleryCounter");
  if (counter) counter.textContent = index + 1 + " / " + imgs.length;
  document.querySelectorAll(".gallery-thumb").forEach((t, i) => t.classList.toggle("active", i === index));
}

window.galleryGoTo = galleryGoTo;

function galleryNav(dir) {
  const imgs = window._galleryImages || [];
  galleryGoTo((window._galleryIndex + dir + imgs.length) % imgs.length);
}

window.galleryNav = galleryNav;

function closeDetailModal(e) {
  if (e && e.target !== document.getElementById("detailModal")) return;
  document.getElementById("detailModal").classList.remove("open");
  document.body.style.overflow = "";
}

window.closeDetailModal = closeDetailModal;

async function registerOwner() {
  const name = document.getElementById("reg_name").value.trim();
  const contact = document.getElementById("reg_contact").value.trim();
  const email = document.getElementById("reg_email").value.trim();
  const username = document.getElementById("reg_username").value.trim();
  const password = document.getElementById("reg_password").value;
  const confirm = document.getElementById("reg_confirm").value;
  const errEl = document.getElementById("regError");
  const sucEl = document.getElementById("regSuccess");
  errEl.style.display = "none";
  sucEl.style.display = "none";
  if (!name || !contact || !email || !username || !password) {
    showFormError(errEl, "Please fill all required fields.");
    return;
  }
  if (!email.includes("@") || !email.includes(".")) {
    showFormError(errEl, "Please enter a valid email address.");
    return;
  }
  if (password.length < 6) {
    showFormError(errEl, "Password must be at least 6 characters.");
    return;
  }
  if (password !== confirm) {
    showFormError(errEl, "Passwords do not match.");
    return;
  }
  try {
    const q = query(collection(db, OWNERS_COL), where("username", "==", username.toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      showFormError(errEl, "Username already taken.");
      return;
    }
    await setDoc(doc(db, OWNERS_COL, username.toLowerCase()), {
      name: name,
      contact: contact,
      email: email,
      username: username.toLowerCase(),
      password: btoa(password),
      createdAt: serverTimestamp()
    });
    sucEl.textContent = "Account created! Redirecting to login...";
    sucEl.style.display = "block";
    setTimeout(() => showPage("ownerLogin"), 1500);
  } catch (e) {
    console.error(e);
    showFormError(errEl, "Error creating account. Check your connection.");
  }
}

window.registerOwner = registerOwner;

async function loginOwner() {
  const username = document.getElementById("login_username").value.trim();
  const password = document.getElementById("login_password").value;
  const errEl = document.getElementById("loginError");
  errEl.style.display = "none";
  if (!username || !password) {
    showFormError(errEl, "Please enter username and password.");
    return;
  }
  try {
    const docSnap = await getDocs(query(collection(db, OWNERS_COL), where("username", "==", username.toLowerCase())));
    if (docSnap.empty) {
      showFormError(errEl, "Invalid username or password.");
      return;
    }
    const ownerData = docSnap.docs[0].data();
    if (atob(ownerData.password) !== password) {
      showFormError(errEl, "Invalid username or password.");
      return;
    }
    currentOwner = {
      firestoreId: docSnap.docs[0].id,
      ...ownerData
    };
    localStorage.setItem("mbstu_owner", JSON.stringify(currentOwner));
    updateHeader();
    document.getElementById("ownerNameDisplay").textContent = ownerData.name;
    document.getElementById("ownerContactDisplay").textContent = ownerData.contact || "";
    document.getElementById("ownerEmailDisplay").textContent = ownerData.email || "";
    document.getElementById("login_username").value = "";
    document.getElementById("login_password").value = "";
    showPage("ownerDashboard");
    showToast("Logged in as " + ownerData.name, "success");
  } catch (e) {
    console.error(e);
    showFormError(errEl, "Login error. Check your connection.");
  }
}

window.loginOwner = loginOwner;

function logoutOwner() {
  currentOwner = null;
  localStorage.removeItem("mbstu_owner");
  updateHeader();
  showPage("browse");
  showToast("Logged out successfully", "success");
}

window.logoutOwner = logoutOwner;

async function recoverOwnerAccount() {
  const email = document.getElementById("forgot_email").value.trim();
  const errEl = document.getElementById("forgotError");
  const sucEl = document.getElementById("forgotSuccess");
  const btn = document.getElementById("forgotBtn");
  errEl.style.display = "none";
  sucEl.style.display = "none";
  if (!email || !email.includes("@") || !email.includes(".")) {
    showFormError(errEl, "Please enter a valid email address.");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Searching...";
  try {
    const q = query(collection(db, OWNERS_COL), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) {
      showFormError(errEl, "No account found with that email address.");
      return;
    }
    const ownerData = snap.docs[0].data();
    const password = atob(ownerData.password);
    btn.textContent = "Sending email...";
    emailjs.init(EJS_PUBLIC_KEY);
    await emailjs.send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, {
      to_email: ownerData.email,
      to_name: ownerData.name,
      subject: "Your MBSTU Abason Account Details",
      message: `Hello ${ownerData.name},\n\nHere are your MBSTU Abason login details:\n\nUsername: ${ownerData.username}\nPassword: ${password}\n\nIf you did not request this, you can ignore this email.`
    });
    sucEl.textContent = "✓ Your username and password have been sent to your email!";
    sucEl.style.display = "block";
    document.getElementById("forgot_email").value = "";
    showToast("Account details sent to your email!", "success");
  } catch (e) {
    console.error(e);
    showFormError(errEl, "Something went wrong. Check your connection and try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send My Account Details";
  }
}

window.recoverOwnerAccount = recoverOwnerAccount;

async function loginAdmin() {
  const email = document.getElementById("admin_username").value.trim();
  const password = document.getElementById("admin_password").value;
  const errEl = document.getElementById("adminLoginError");
  errEl.style.display = "none";
  if (!email || !password) {
    showFormError(errEl, "Please enter the admin email and password.");
    return;
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (cred.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      showFormError(errEl, "This account is not authorized as admin.");
      return;
    }
    document.getElementById("admin_username").value = "";
    document.getElementById("admin_password").value = "";
    showPage("adminDashboard");
    showToast("Welcome, Admin!", "success");
  } catch (e) {
    console.error(e);
    showFormError(errEl, "Invalid admin credentials.");
  }
}

window.loginAdmin = loginAdmin;

async function logoutAdmin() {
  await signOut(auth);
  showPage("browse");
  showToast("Admin logged out", "success");
}

window.logoutAdmin = logoutAdmin;

async function renderAdminDashboard() {
  if (!currentAdmin) {
    showPage("adminLogin");
    return;
  }
  const messSnap = await getDocs(query(collection(db, MESSES_COL), orderBy("createdAt", "desc")));
  _allMesses = messSnap.docs.map(d => ({
    firestoreId: d.id,
    ...d.data()
  }));
  const ownerSnap = await getDocs(collection(db, OWNERS_COL));
  _allOwners = ownerSnap.docs.map(d => ({
    firestoreId: d.id,
    ...d.data()
  }));
  document.getElementById("adminStats").innerHTML = `\n    <div class="stat-card"><div class="num">${_allMesses.length}</div><div class="lbl">Total Messes</div></div>\n    <div class="stat-card"><div class="num">${_allOwners.length}</div><div class="lbl">Total Owners</div></div>\n    <div class="stat-card"><div class="num">${_allMesses.filter(m => m.type === "BOYS").length}</div><div class="lbl">Boys Messes</div></div>\n    <div class="stat-card"><div class="num">${_allMesses.filter(m => m.type === "GIRLS").length}</div><div class="lbl">Girls Messes</div></div>\n  `;
  renderMesses(_allMesses, "adminMessGrid", false, true);
  renderOwnersTable();
}

function switchAdminTab(tabName, btn) {
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("tab-allMesses").style.display = tabName === "allMesses" ? "" : "none";
  document.getElementById("tab-allOwners").style.display = tabName === "allOwners" ? "" : "none";
}

window.switchAdminTab = switchAdminTab;

function adminSearchMesses() {
  const q = document.getElementById("adminSearchInput").value.toLowerCase();
  const filtered = _allMesses.filter(m => m.name.toLowerCase().includes(q) || m.ownerName && m.ownerName.toLowerCase().includes(q) || m.location.toLowerCase().includes(q) || m.address.toLowerCase().includes(q));
  renderMesses(filtered, "adminMessGrid", false, true);
}

window.adminSearchMesses = adminSearchMesses;

function renderOwnersTable() {
  const tbody = document.getElementById("ownersTableBody");
  const countEl = document.getElementById("broadcastCount");
  if (!tbody) return;
  const withEmail = _allOwners.filter(o => o.email);
  if (countEl) countEl.textContent = `${withEmail.length} of ${_allOwners.length} owners have email`;
  if (_allOwners.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">No owners registered yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = _allOwners.map(o => {
    const listingCount = _allMesses.filter(m => m.ownerId === o.firestoreId).length;
    return `\n      <tr>\n        <td>${esc(o.name)}</td>\n        <td><span class="username-badge">${esc(o.username)}</span></td>\n        <td>${esc(o.contact)}</td>\n        <td>${o.email ? `<span class="email-badge">${esc(o.email)}</span>` : `<span style="color:var(--muted);font-size:0.78rem">No email</span>`}\n        </td>\n        <td><span class="listing-count">${listingCount}</span></td>\n        <td style="display:flex;gap:6px;flex-wrap:wrap">\n          ${o.email ? `<button class="btn btn-admin btn-sm" onclick="sendSingleEmail('${esc(o.email)}', '${esc(o.name)}')">📧 Email</button>` : ""}\n          <button class="btn btn-danger btn-sm" onclick="openOwnerDeleteModal('${o.firestoreId}', '${esc(o.name)}')">🗑️ Remove</button>\n        </td>\n      </tr>\n    `;
  }).join("");
}

function adminEditMess(firestoreId) {
  const m = _allMesses.find(x => x.firestoreId === firestoreId);
  if (!m) {
    showToast("Could not find listing.", "error");
    return;
  }
  document.getElementById("amf_editId").value = m.firestoreId;
  document.getElementById("amf_name").value = m.name;
  document.getElementById("amf_type").value = m.type;
  document.getElementById("amf_location").value = m.location;
  document.getElementById("amf_address").value = m.address;
  document.getElementById("amf_distance").value = m.distance;
  document.getElementById("amf_rent").value = m.rent;
  document.getElementById("amf_buildingtype").value = m.buildingType || "BUILDING";
  document.getElementById("amf_seats_single_this").value = m.seatsSingleThisMonth || 0;
  document.getElementById("amf_seats_multi_this").value = m.seatsMultiThisMonth != null ? m.seatsMultiThisMonth : m.seats || 0;
  document.getElementById("amf_seats_single_next").value = m.seatsSingleNextMonth || 0;
  document.getElementById("amf_seats_multi_next").value = m.seatsMultiNextMonth || 0;
  document.getElementById("amf_ppr").value = m.ppr;
  document.getElementById("amf_elec").value = m.elec;
  document.getElementById("amf_wifi").value = String(m.wifi);
  document.getElementById("amf_gas").value = String(m.gas);
  document.getElementById("amf_tiled").value = String(m.tiled);
  document.getElementById("amf_meal").value = String(m.meal);
  document.getElementById("amf_mealsday").value = m.mealsDay;
  document.getElementById("amf_single").value = String(m.single);
  document.getElementById("amf_singlecost").value = m.singleCost;
  document.getElementById("amf_maplink").value = m.mapLink || "";
  document.getElementById("amf_desc").value = m.desc || "";
  document.getElementById("adminMessFormTitle").textContent = "🛡️ Edit: " + m.name;
  toggleAdminMealInput();
  toggleAdminSingleInput();
  showPage("adminEditMess");
}

window.adminEditMess = adminEditMess;

async function adminSaveMess() {
  if (!currentAdmin) return;
  const errEl = document.getElementById("adminMessFormError");
  const saveBtn = document.getElementById("adminSaveBtn");
  errEl.style.display = "none";
  const firestoreId = document.getElementById("amf_editId").value.trim();
  const name = document.getElementById("amf_name").value.trim();
  const address = document.getElementById("amf_address").value.trim();
  const rent = parseInt(document.getElementById("amf_rent").value) || 0;
  const seatsSingleThisMonth = parseInt(document.getElementById("amf_seats_single_this").value) || 0;
  const seatsMultiThisMonth = parseInt(document.getElementById("amf_seats_multi_this").value) || 0;
  const seatsSingleNextMonth = parseInt(document.getElementById("amf_seats_single_next").value) || 0;
  const seatsMultiNextMonth = parseInt(document.getElementById("amf_seats_multi_next").value) || 0;
  const seats = seatsSingleThisMonth + seatsMultiThisMonth;
  if (!firestoreId || !name || !address || rent < 1) {
    showFormError(errEl, "Please fill all required fields.");
    return;
  }
  const original = _allMesses.find(x => x.firestoreId === firestoreId);
  const updatedMess = {
    ...original,
    name: name,
    type: document.getElementById("amf_type").value,
    location: document.getElementById("amf_location").value,
    address: address,
    distance: parseInt(document.getElementById("amf_distance").value) || 0,
    rent: rent,
    buildingType: document.getElementById("amf_buildingtype").value,
    seats: seats,
    seatsSingleThisMonth: seatsSingleThisMonth,
    seatsMultiThisMonth: seatsMultiThisMonth,
    seatsSingleNextMonth: seatsSingleNextMonth,
    seatsMultiNextMonth: seatsMultiNextMonth,
    ppr: parseInt(document.getElementById("amf_ppr").value) || 2,
    elec: parseInt(document.getElementById("amf_elec").value) || 1,
    wifi: document.getElementById("amf_wifi").value === "true",
    gas: document.getElementById("amf_gas").value === "true",
    tiled: document.getElementById("amf_tiled").value === "true",
    meal: document.getElementById("amf_meal").value === "true",
    mealsDay: parseInt(document.getElementById("amf_mealsday").value) || 0,
    single: document.getElementById("amf_single").value === "true",
    singleCost: parseInt(document.getElementById("amf_singlecost").value) || 0,
    mapLink: document.getElementById("amf_maplink").value.trim(),
    desc: document.getElementById("amf_desc").value.trim(),
    lastEditedByAdmin: true,
    adminEditedAt: serverTimestamp()
  };
  delete updatedMess.firestoreId;
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  try {
    await setDoc(doc(db, MESSES_COL, firestoreId), updatedMess);
    showToast("Mess updated by Admin!", "success");
    showPage("adminDashboard");
  } catch (e) {
    console.error(e);
    showToast("Error saving. Check connection.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "🛡️ Save Changes";
  }
}

window.adminSaveMess = adminSaveMess;

async function renderOwnerDashboard() {
  if (!currentOwner) {
    showPage("ownerLogin");
    return;
  }
  document.getElementById("ownerNameDisplay").textContent = currentOwner.name || "";
  document.getElementById("ownerContactDisplay").textContent = currentOwner.contact || "";
  document.getElementById("ownerEmailDisplay").textContent = currentOwner.email || "No email set";
  const editSec = document.getElementById("editProfileSection");
  if (editSec) editSec.style.display = "none";
  const q = query(collection(db, MESSES_COL), where("ownerId", "==", currentOwner.firestoreId));
  const snap = await getDocs(q);
  const myMesses = snap.docs.map(d => ({
    firestoreId: d.id,
    ...d.data()
  }));
  myMesses.forEach(m => {
    const idx = _allMesses.findIndex(x => x.firestoreId === m.firestoreId);
    if (idx !== -1) _allMesses[idx] = m; else _allMesses.push(m);
  });
  document.getElementById("ownerStats").innerHTML = `\n    <div class="stat-card"><div class="num">${myMesses.length}</div><div class="lbl">My Listings</div></div>\n    <div class="stat-card"><div class="num">${myMesses.reduce((a, m) => a + m.seats, 0)}</div><div class="lbl">Total Seats</div></div>\n    <div class="stat-card"><div class="num">${myMesses.filter(m => m.type === "BOYS").length}</div><div class="lbl">Boys Messes</div></div>\n    <div class="stat-card"><div class="num">${myMesses.filter(m => m.type === "GIRLS").length}</div><div class="lbl">Girls Messes</div></div>\n  `;
  renderMesses(myMesses, "ownerMessGrid", true);
}

function switchOwnerTab(tabName, btn, skipClear = false) {
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("tab-myListings").style.display = tabName === "myListings" ? "" : "none";
  document.getElementById("tab-addMess").style.display = tabName === "addMess" ? "" : "none";
  if (tabName === "addMess" && !skipClear) {
    clearMessForm();
    document.getElementById("messFormTitle").textContent = "Add New Mess / Sublet";
  }
}

window.switchOwnerTab = switchOwnerTab;

function toggleEditProfile() {
  const sec = document.getElementById("editProfileSection");
  const isHidden = sec.style.display === "none";
  sec.style.display = isHidden ? "block" : "none";
  if (isHidden) loadProfileForm();
}

window.toggleEditProfile = toggleEditProfile;

function loadProfileForm() {
  if (!currentOwner) return;
  document.getElementById("profile_name").value = currentOwner.name || "";
  document.getElementById("profile_contact").value = currentOwner.contact || "";
  document.getElementById("profile_email").value = currentOwner.email || "";
  document.getElementById("profileError").style.display = "none";
  document.getElementById("profileSuccess").style.display = "none";
}

async function saveProfile() {
  if (!currentOwner) return;
  const name = document.getElementById("profile_name").value.trim();
  const contact = document.getElementById("profile_contact").value.trim();
  const email = document.getElementById("profile_email").value.trim();
  const errEl = document.getElementById("profileError");
  const sucEl = document.getElementById("profileSuccess");
  errEl.style.display = "none";
  sucEl.style.display = "none";
  if (!name || !contact || !email) {
    showFormError(errEl, "Please fill all fields.");
    return;
  }
  if (!email.includes("@") || !email.includes(".")) {
    showFormError(errEl, "Please enter a valid email address.");
    return;
  }
  try {
    await setDoc(doc(db, OWNERS_COL, currentOwner.firestoreId), {
      ...currentOwner,
      name: name,
      contact: contact,
      email: email
    }, {
      merge: true
    });
    currentOwner = {
      ...currentOwner,
      name: name,
      contact: contact,
      email: email
    };
    localStorage.setItem("mbstu_owner", JSON.stringify(currentOwner));
    document.getElementById("ownerNameDisplay").textContent = name;
    document.getElementById("ownerContactDisplay").textContent = contact;
    document.getElementById("ownerEmailDisplay").textContent = email;
    sucEl.textContent = "✓ Profile updated successfully!";
    sucEl.style.display = "block";
    showToast("Profile updated!", "success");
    setTimeout(() => {
      document.getElementById("editProfileSection").style.display = "none";
    }, 1200);
  } catch (e) {
    console.error(e);
    showFormError(errEl, "Error updating profile. Check your connection.");
  }
}

window.saveProfile = saveProfile;

async function saveMess() {
  if (!currentOwner) return;
  const errEl = document.getElementById("messFormError");
  const saveBtn = document.getElementById("saveBtn");
  errEl.style.display = "none";
  const name = document.getElementById("mf_name").value.trim();
  const address = document.getElementById("mf_address").value.trim();
  const rent = parseInt(document.getElementById("mf_rent").value) || 0;
  const seatsSingleThisMonth = parseInt(document.getElementById("mf_seats_single_this").value) || 0;
  const seatsMultiThisMonth = parseInt(document.getElementById("mf_seats_multi_this").value) || 0;
  const seatsSingleNextMonth = parseInt(document.getElementById("mf_seats_single_next").value) || 0;
  const seatsMultiNextMonth = parseInt(document.getElementById("mf_seats_multi_next").value) || 0;
  const seats = seatsSingleThisMonth + seatsMultiThisMonth;
  if (!name || !address || rent < 1) {
    showFormError(errEl, "Please fill all required fields (Name, Address, Rent > 0, Seats).");
    return;
  }
  const editIdVal = document.getElementById("mf_editId").value.trim();
  const editId = editIdVal ? editIdVal : null;
  const mess = {
    ownerId: currentOwner.firestoreId,
    ownerName: currentOwner.name,
    name: name,
    type: document.getElementById("mf_type").value,
    location: document.getElementById("mf_location").value,
    address: address,
    distance: parseInt(document.getElementById("mf_distance").value) || 0,
    rent: rent,
    buildingType: document.getElementById("mf_buildingtype").value,
    seats: seats,
    seatsSingleThisMonth: seatsSingleThisMonth,
    seatsMultiThisMonth: seatsMultiThisMonth,
    seatsSingleNextMonth: seatsSingleNextMonth,
    seatsMultiNextMonth: seatsMultiNextMonth,
    ppr: parseInt(document.getElementById("mf_ppr").value) || 2,
    elec: parseInt(document.getElementById("mf_elec").value) || 1,
    wifi: document.getElementById("mf_wifi").value === "true",
    gas: document.getElementById("mf_gas").value === "true",
    tiled: document.getElementById("mf_tiled").value === "true",
    meal: document.getElementById("mf_meal").value === "true",
    mealsDay: parseInt(document.getElementById("mf_mealsday").value) || 0,
    single: document.getElementById("mf_single").value === "true",
    singleCost: parseInt(document.getElementById("mf_singlecost").value) || 0,
    mapLink: document.getElementById("mf_maplink").value.trim(),
    contact: currentOwner.contact,
    desc: document.getElementById("mf_desc").value.trim(),
    images: _currentImages.slice(),
    imageData: _currentImages[0] || "",
    createdAt: serverTimestamp()
  };
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  try {
    if (editId) {
      await setDoc(doc(db, MESSES_COL, editId), mess);
      showToast("Mess updated successfully!", "success");
    } else {
      await addDoc(collection(db, MESSES_COL), mess);
      showToast("Mess added successfully!", "success");
    }
    clearMessForm();
    await renderOwnerDashboard();
    switchOwnerTab("myListings", document.querySelectorAll(".nav-tab")[0]);
  } catch (e) {
    console.error(e);
    showToast("Error saving mess. Check your connection.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Listing";
  }
}

window.saveMess = saveMess;

function editMess(firestoreId) {
  const m = _allMesses.find(x => x.firestoreId === firestoreId);
  if (!m) {
    showToast("Could not find listing.", "error");
    return;
  }
  document.getElementById("mf_editId").value = m.firestoreId;
  document.getElementById("mf_name").value = m.name;
  document.getElementById("mf_type").value = m.type;
  document.getElementById("mf_location").value = m.location;
  document.getElementById("mf_address").value = m.address;
  document.getElementById("mf_distance").value = m.distance;
  document.getElementById("mf_rent").value = m.rent;
  document.getElementById("mf_buildingtype").value = m.buildingType || "BUILDING";
  document.getElementById("mf_seats_single_this").value = m.seatsSingleThisMonth || 0;
  document.getElementById("mf_seats_multi_this").value = m.seatsMultiThisMonth != null ? m.seatsMultiThisMonth : m.seats || 0;
  document.getElementById("mf_seats_single_next").value = m.seatsSingleNextMonth || 0;
  document.getElementById("mf_seats_multi_next").value = m.seatsMultiNextMonth || 0;
  document.getElementById("mf_ppr").value = m.ppr;
  document.getElementById("mf_elec").value = m.elec;
  document.getElementById("mf_wifi").value = String(m.wifi);
  document.getElementById("mf_gas").value = String(m.gas);
  document.getElementById("mf_tiled").value = String(m.tiled);
  document.getElementById("mf_meal").value = String(m.meal);
  document.getElementById("mf_mealsday").value = m.mealsDay;
  document.getElementById("mf_single").value = String(m.single);
  document.getElementById("mf_singlecost").value = m.singleCost;
  document.getElementById("mf_maplink").value = m.mapLink || "";
  document.getElementById("mf_desc").value = m.desc || "";
  _currentImages = m.images && m.images.length > 0 ? m.images.slice() : m.imageData ? [ m.imageData ] : [];
  renderImagePreviews();
  document.getElementById("mf_image_data").value = JSON.stringify(_currentImages);
  document.getElementById("messFormTitle").textContent = "Edit: " + m.name;
  toggleMealInput();
  toggleSingleInput();
  switchOwnerTab("addMess", document.querySelectorAll(".nav-tab")[1], true);
  document.getElementById("tab-addMess").scrollIntoView({
    behavior: "smooth"
  });
}

window.editMess = editMess;

function cancelEdit() {
  clearMessForm();
  switchOwnerTab("myListings", document.querySelectorAll(".nav-tab")[0]);
}

window.cancelEdit = cancelEdit;

function clearMessForm() {
  [ "mf_name", "mf_address", "mf_distance", "mf_rent", "mf_desc", "mf_editId", "mf_maplink" ].forEach(id => document.getElementById(id).value = "");
  [ "mf_seats_single_this", "mf_seats_multi_this", "mf_seats_single_next", "mf_seats_multi_next" ].forEach(id => document.getElementById(id).value = "0");
  document.getElementById("mf_ppr").value = "2";
  document.getElementById("mf_elec").value = "1";
  document.getElementById("mf_mealsday").value = "2";
  document.getElementById("mf_singlecost").value = "0";
  document.getElementById("mf_image_data").value = "";
  _currentImages = [];
  renderImagePreviews();
  [ "mf_type", "mf_location", "mf_wifi", "mf_gas", "mf_tiled", "mf_meal", "mf_single", "mf_buildingtype" ].forEach(id => document.getElementById(id).selectedIndex = 0);
  document.getElementById("messFormError").style.display = "none";
  toggleMealInput();
  toggleSingleInput();
}

function openDeleteModal(firestoreId, name, isAdmin = false) {
  pendingDeleteId = firestoreId;
  pendingDeleteType = isAdmin ? "admin" : "owner";
  document.getElementById("deleteMessName").textContent = name;
  document.getElementById("deleteModalNote").textContent = isAdmin ? "⚠️ Admin delete — This cannot be undone." : "This action cannot be undone.";
  document.getElementById("deleteModal").classList.add("open");
}

window.openDeleteModal = openDeleteModal;

async function confirmDelete() {
  if (!pendingDeleteId) return;
  try {
    await deleteDoc(doc(db, MESSES_COL, pendingDeleteId));
    _allMesses = _allMesses.filter(m => m.firestoreId !== pendingDeleteId);
    closeDeleteModal();
    showToast("Listing deleted.", "success");
    pendingDeleteId = null;
    if (pendingDeleteType === "admin") {
      await renderAdminDashboard();
    } else {
      await renderOwnerDashboard();
    }
    pendingDeleteType = null;
  } catch (e) {
    console.error(e);
    showToast("Error deleting listing.", "error");
  }
}

window.confirmDelete = confirmDelete;

function closeDeleteModal(e) {
  if (e && e.target !== document.getElementById("deleteModal")) return;
  document.getElementById("deleteModal").classList.remove("open");
}

window.closeDeleteModal = closeDeleteModal;

function openOwnerDeleteModal(firestoreId, name) {
  pendingOwnerDeleteId = firestoreId;
  document.getElementById("deleteOwnerName").textContent = name;
  document.getElementById("ownerDeleteModal").classList.add("open");
}

window.openOwnerDeleteModal = openOwnerDeleteModal;

async function confirmOwnerDelete() {
  if (!pendingOwnerDeleteId) return;
  try {
    const ownerMesses = _allMesses.filter(m => m.ownerId === pendingOwnerDeleteId);
    for (const m of ownerMesses) {
      await deleteDoc(doc(db, MESSES_COL, m.firestoreId));
    }
    await deleteDoc(doc(db, OWNERS_COL, pendingOwnerDeleteId));
    closeOwnerDeleteModal();
    showToast("Owner and all their listings removed.", "success");
    pendingOwnerDeleteId = null;
    await renderAdminDashboard();
  } catch (e) {
    console.error(e);
    showToast("Error removing owner.", "error");
  }
}

window.confirmOwnerDelete = confirmOwnerDelete;

function closeOwnerDeleteModal(e) {
  if (e && e.target !== document.getElementById("ownerDeleteModal")) return;
  document.getElementById("ownerDeleteModal").classList.remove("open");
}

window.closeOwnerDeleteModal = closeOwnerDeleteModal;

async function sendBroadcastEmail() {
  if (!currentAdmin) return;
  const subject = document.getElementById("broadcast_subject").value.trim();
  const message = document.getElementById("broadcast_message").value.trim();
  const errEl = document.getElementById("broadcastError");
  const sucEl = document.getElementById("broadcastSuccess");
  const btn = document.getElementById("broadcastBtn");
  errEl.style.display = "none";
  sucEl.style.display = "none";
  if (!subject || !message) {
    showFormError(errEl, "Please fill in subject and message.");
    return;
  }
  const ownersWithEmail = _allOwners.filter(o => o.email);
  if (ownersWithEmail.length === 0) {
    showFormError(errEl, "No owners have registered an email address yet.");
    return;
  }
  btn.disabled = true;
  btn.textContent = `Sending... (0/${ownersWithEmail.length})`;
  emailjs.init(EJS_PUBLIC_KEY);
  let sent = 0, failed = 0;
  for (const owner of ownersWithEmail) {
    try {
      await emailjs.send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, {
        to_email: owner.email,
        to_name: owner.name,
        subject: subject,
        message: message
      });
      sent++;
    } catch (e) {
      console.error("Failed to send to", owner.email, e);
      failed++;
    }
    btn.textContent = `Sending... (${sent + failed}/${ownersWithEmail.length})`;
  }
  btn.disabled = false;
  btn.textContent = "📧 Send to All Owners";
  if (failed === 0) {
    sucEl.textContent = `✓ Email sent successfully to ${sent} owners!`;
    sucEl.style.display = "block";
    document.getElementById("broadcast_subject").value = "";
    document.getElementById("broadcast_message").value = "";
    showToast(`Email sent to ${sent} owners!`, "success");
  } else {
    sucEl.textContent = `Sent: ${sent} ✓   Failed: ${failed} ✗`;
    sucEl.style.display = "block";
  }
}

window.sendBroadcastEmail = sendBroadcastEmail;

async function sendSingleEmail(toEmail, toName) {
  if (!currentAdmin) return;
  const subject = prompt(`Email subject for ${toName}:`, "Please update your mess information");
  if (!subject) return;
  const message = prompt(`Message for ${toName}:`);
  if (!message) return;
  try {
    emailjs.init(EJS_PUBLIC_KEY);
    await emailjs.send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, {
      to_email: toEmail,
      to_name: toName,
      subject: subject,
      message: message
    });
    showToast(`Email sent to ${toName}!`, "success");
  } catch (e) {
    console.error(e);
    showToast("Failed to send email. Check EmailJS setup.", "error");
  }
}

window.sendSingleEmail = sendSingleEmail;

function previewImages(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  const remaining = 6 - _currentImages.length;
  if (remaining <= 0) {
    showToast("Maximum 6 photos allowed.", "error");
    return;
  }
  files.slice(0, remaining).forEach(file => {
    const reader = new FileReader;
    reader.onload = function(e) {
      compressImage(e.target.result, 800, .6, function(compressed) {
        _currentImages.push(compressed);
        renderImagePreviews();
        document.getElementById("mf_image_data").value = JSON.stringify(_currentImages);
      });
    };
    reader.readAsDataURL(file);
  });
  event.target.value = "";
}

window.previewImages = previewImages;

function compressImage(dataUrl, maxWidth, quality, callback) {
  const img = new Image;
  img.onload = function() {
    const canvas = document.createElement("canvas");
    let w = img.width, h = img.height;
    if (w > maxWidth) {
      h = Math.round(h * maxWidth / w);
      w = maxWidth;
    }
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL("image/jpeg", quality));
  };
  img.src = dataUrl;
}

function renderImagePreviews() {
  const grid = document.getElementById("mf_image_preview_grid");
  if (!grid) return;
  grid.innerHTML = _currentImages.map((src, i) => `\n    <div class="img-thumb-wrap">\n      <img src="${src}" class="img-thumb" alt="Photo ${i + 1}">\n      ${i === 0 ? '<div class="img-thumb-badge">Cover</div>' : ""}\n      <button class="img-thumb-remove" onclick="removeImage(${i})" title="Remove">✕</button>\n    </div>\n  `).join("");
}

function removeImage(index) {
  _currentImages.splice(index, 1);
  renderImagePreviews();
  document.getElementById("mf_image_data").value = JSON.stringify(_currentImages);
}

window.removeImage = removeImage;

function toggleMealInput() {
  document.getElementById("mealDayGroup").style.display = document.getElementById("mf_meal").value === "true" ? "" : "none";
}

window.toggleMealInput = toggleMealInput;

function toggleSingleInput() {
  document.getElementById("singleCostGroup").style.display = document.getElementById("mf_single").value === "true" ? "" : "none";
}

window.toggleSingleInput = toggleSingleInput;

function toggleAdminMealInput() {
  document.getElementById("adminMealDayGroup").style.display = document.getElementById("amf_meal").value === "true" ? "" : "none";
}

window.toggleAdminMealInput = toggleAdminMealInput;

function toggleAdminSingleInput() {
  document.getElementById("adminSingleCostGroup").style.display = document.getElementById("amf_single").value === "true" ? "" : "none";
}

window.toggleAdminSingleInput = toggleAdminSingleInput;

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  const showIcon = btn.querySelector(".eye-show");
  const hideIcon = btn.querySelector(".eye-hide");
  if (showIcon) showIcon.style.display = isHidden ? "none" : "block";
  if (hideIcon) hideIcon.style.display = isHidden ? "block" : "none";
}

window.togglePasswordVisibility = togglePasswordVisibility;

function showFormError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem("mbstu_theme", isLight ? "light" : "dark");
  updateThemeKnob(isLight);
}

window.toggleTheme = toggleTheme;

function updateThemeKnob(isLight) {
  const knob = document.getElementById("themeKnob");
  if (knob) knob.textContent = isLight ? "☀️" : "🌙";
}

function initTheme() {
  const saved = localStorage.getItem("mbstu_theme");
  const isLight = saved === "light";
  if (isLight) document.body.classList.add("light");
  updateThemeKnob(isLight);
}

function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = (type === "success" ? "✓ " : "✕ ") + msg;
  t.className = "toast show " + type;
  setTimeout(() => t.classList.remove("show"), 3e3);
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    [ "detailModal", "deleteModal", "ownerDeleteModal" ].forEach(id => {
      document.getElementById(id).classList.remove("open");
    });
    document.body.style.overflow = "";
  }
  if (e.key === "Enter") {
    if (document.getElementById("page-ownerLogin").classList.contains("active")) loginOwner();
    if (document.getElementById("page-adminLogin").classList.contains("active")) loginAdmin();
    if (document.getElementById("page-ownerForgot").classList.contains("active")) recoverOwnerAccount();
  }
});

let _adminAuthResolved = false;

let _resolveAdminAuthReady;

const adminAuthReady = new Promise(resolve => {
  _resolveAdminAuthReady = resolve;
});

onAuthStateChanged(auth, user => {
  currentAdmin = !!(user && user.email === ADMIN_EMAIL);
  updateHeader();
  if (!currentAdmin && document.getElementById("page-adminDashboard").classList.contains("active")) {
    showPage("adminLogin");
  }
  if (!_adminAuthResolved) {
    _adminAuthResolved = true;
    _resolveAdminAuthReady();
  }
});

(async () => {
  initTheme();
  await adminAuthReady;
  const savedOwner = localStorage.getItem("mbstu_owner");
  if (savedOwner) {
    try {
      currentOwner = JSON.parse(savedOwner);
    } catch (e) {
      currentOwner = null;
    }
    if (currentOwner) {
      document.getElementById("ownerNameDisplay").textContent = currentOwner.name || "";
      document.getElementById("ownerContactDisplay").textContent = currentOwner.contact || "";
      document.getElementById("ownerEmailDisplay").textContent = currentOwner.email || "No email set";
    }
  }
  updateHeader();
  await loadAndRenderMesses();
  const hash = window.location.hash.replace("#", "");
  const valid = [ "browse", "ownerLogin", "ownerRegister", "ownerForgot", "ownerDashboard", "adminLogin", "adminDashboard" ];
  if (hash && valid.includes(hash)) {
    if (hash === "ownerDashboard" && !currentOwner) showPage("ownerLogin", false); else if (hash === "adminDashboard" && !currentAdmin) showPage("adminLogin", false); else showPage(hash, false);
  } else {
    showPage("browse", false);
    history.replaceState({
      page: "browse"
    }, "", "#browse");
  }
  hideLoading();
})();