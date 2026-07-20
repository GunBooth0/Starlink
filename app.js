// ===== Starlink — app logic =====
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- DOM ----------
const views = {
  auth: document.getElementById("view-auth"),
  pending: document.getElementById("view-pending"),
  rejected: document.getElementById("view-rejected"),
  app: document.getElementById("view-app")
};

const el = (id) => document.getElementById(id);

const authError = el("auth-error");
const formLogin = el("form-login");
const formSignup = el("form-signup");
const toggleAuthModeBtn = el("toggle-auth-mode");

const roleBadge = el("role-badge");
const btnOwnerPanel = el("btn-owner-panel");
const btnAdminPanel = el("btn-admin-panel");

const categoryListEl = el("category-list");
const siteGridEl = el("site-grid");
const emptyStateEl = el("empty-state");
const contentTitleEl = el("content-title");

const panelOwner = el("panel-owner");
const panelAdmin = el("panel-admin");

// ---------- State ----------
let currentUid = null;
let currentUserData = null;
let unsubUserDoc = null;
let unsubUsers = null;
let unsubCategories = null;
let unsubSites = null;

let allUsers = [];       // only populated for owner
let categories = [];
let sites = [];
let selectedCategoryId = null; // null = "All sites"

// ---------- View switching ----------
function showView(name) {
  Object.entries(views).forEach(([key, node]) => node.classList.toggle("hidden", key !== name));
}

// ---------- Auth mode toggle ----------
let signupMode = false;
toggleAuthModeBtn.addEventListener("click", () => {
  signupMode = !signupMode;
  formLogin.classList.toggle("hidden", signupMode);
  formSignup.classList.toggle("hidden", !signupMode);
  toggleAuthModeBtn.textContent = signupMode
    ? "Already approved? Sign in"
    : "Need an account? Request access";
  authError.classList.add("hidden");
});

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove("hidden");
}

// ---------- Sign in / sign up / sign out ----------
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  try {
    await signInWithEmailAndPassword(auth, el("login-email").value.trim(), el("login-password").value);
  } catch (err) {
    showAuthError(friendlyAuthError(err));
  }
});

formSignup.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  try {
    const cred = await createUserWithEmailAndPassword(
      auth, el("signup-email").value.trim(), el("signup-password").value
    );
    await setDoc(doc(db, "users", cred.user.uid), {
      email: cred.user.email,
      status: "pending",
      role: "member",
      requestedAt: serverTimestamp()
    });
  } catch (err) {
    showAuthError(friendlyAuthError(err));
  }
});

function friendlyAuthError(err) {
  const code = err && err.code ? err.code : "";
  if (code.includes("email-already-in-use")) return "An account with that email already exists.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Email or password is incorrect.";
  }
  return "Something went wrong. Try again.";
}

[el("btn-signout-pending"), el("btn-signout-rejected"), el("btn-signout")].forEach((btn) => {
  btn.addEventListener("click", () => signOut(auth));
});

// ---------- Auth state ----------
onAuthStateChanged(auth, (user) => {
  cleanupListeners();

  if (!user) {
    currentUid = null;
    currentUserData = null;
    showView("auth");
    return;
  }

  currentUid = user.uid;
  unsubUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) {
      // Shouldn't normally happen (doc is created at signup), but handle gracefully.
      showView("pending");
      return;
    }
    currentUserData = snap.data();
    handleUserDataChange();
  }, () => {
    // Read was denied or failed — treat as signed out of the app view.
    showView("pending");
  });
});

function cleanupListeners() {
  [unsubUserDoc, unsubUsers, unsubCategories, unsubSites].forEach((fn) => fn && fn());
  unsubUserDoc = unsubUsers = unsubCategories = unsubSites = null;
}

function handleUserDataChange() {
  const status = currentUserData.status;
  const role = currentUserData.role;

  if (status === "rejected") {
    showView("rejected");
    return;
  }
  if (status !== "approved") {
    showView("pending");
    return;
  }

  showView("app");
  roleBadge.textContent = role.toUpperCase();
  btnOwnerPanel.classList.toggle("hidden", role !== "owner");
  btnAdminPanel.classList.toggle("hidden", role !== "admin" && role !== "owner");
  if (role !== "owner") panelOwner.classList.add("hidden");
  if (role !== "admin" && role !== "owner") panelAdmin.classList.add("hidden");

  if (!unsubCategories) subscribeCategories();
  if (!unsubSites) subscribeSites();
  if (role === "owner" && !unsubUsers) subscribeAllUsers();
}

// ---------- Firestore subscriptions ----------
function subscribeCategories() {
  const q = query(collection(db, "categories"), orderBy("createdAt", "asc"));
  unsubCategories = onSnapshot(q, (snap) => {
    categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSidebar();
    renderSiteGrid();
    renderCategoryManagers();
    populateCategorySelects();
  });
}

function subscribeSites() {
  const q = query(collection(db, "sites"), orderBy("createdAt", "asc"));
  unsubSites = onSnapshot(q, (snap) => {
    sites = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSidebar();
    renderSiteGrid();
    renderSiteManagers();
  });
}

function subscribeAllUsers() {
  unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
    allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderRequests();
    renderCrew();
  });
}

// ---------- Sidebar + site grid ----------
function renderSidebar() {
  categoryListEl.innerHTML = "";

  const allItem = document.createElement("div");
  allItem.className = "orbit-item" + (selectedCategoryId === null ? " active" : "");
  allItem.innerHTML = `<span>All sites</span><span class="orbit-count">${sites.length}</span>`;
  allItem.addEventListener("click", () => { selectedCategoryId = null; renderSidebar(); renderSiteGrid(); });
  categoryListEl.appendChild(allItem);

  categories.forEach((cat) => {
    const count = sites.filter((s) => s.categoryId === cat.id).length;
    const item = document.createElement("div");
    item.className = "orbit-item" + (selectedCategoryId === cat.id ? " active" : "");
    item.innerHTML = `<span>${escapeHtml(cat.name)}</span><span class="orbit-count">${count}</span>`;
    item.addEventListener("click", () => { selectedCategoryId = cat.id; renderSidebar(); renderSiteGrid(); });
    categoryListEl.appendChild(item);
  });
}

function renderSiteGrid() {
  const visibleSites = selectedCategoryId === null
    ? sites
    : sites.filter((s) => s.categoryId === selectedCategoryId);

  const activeCategory = categories.find((c) => c.id === selectedCategoryId);
  contentTitleEl.textContent = activeCategory ? activeCategory.name : "All sites";

  siteGridEl.innerHTML = "";
  emptyStateEl.classList.toggle("hidden", visibleSites.length !== 0);

  visibleSites.forEach((site) => {
    const card = document.createElement("a");
    card.href = site.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.className = "site-card";
    card.innerHTML = `
      <div class="site-card-top">
        <span class="site-card-name">${escapeHtml(site.name)}</span>
        <span class="signal-bars"><span></span><span></span><span></span></span>
      </div>
      <span class="site-card-url">${escapeHtml(site.url)}</span>
    `;
    siteGridEl.appendChild(card);
  });
}

function populateCategorySelects() {
  [el("new-site-category-owner"), el("new-site-category-admin")].forEach((select) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    if (categories.some((c) => c.id === current)) select.value = current;
  });
}

// ---------- Panels open / close / tabs ----------
document.querySelectorAll("[data-close-panel]").forEach((elm) => {
  elm.addEventListener("click", () => {
    panelOwner.classList.add("hidden");
    panelAdmin.classList.add("hidden");
  });
});

btnOwnerPanel.addEventListener("click", () => panelOwner.classList.remove("hidden"));
btnAdminPanel.addEventListener("click", () => panelAdmin.classList.remove("hidden"));

document.querySelectorAll(".panel-tabs").forEach((tabgroup) => {
  const scope = tabgroup.dataset.tabgroup; // "owner" | "admin"
  tabgroup.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabgroup.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      const sheet = tabgroup.closest(".panel-sheet");
      sheet.querySelectorAll(`[data-${scope}-tab-panel]`).forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset[`${scope}TabPanel`] !== btn.dataset.tab);
      });
    });
  });
});

// ---------- Owner: access requests ----------
function renderRequests() {
  const list = el("requests-list");
  const pending = allUsers.filter((u) => u.status === "pending");
  if (pending.length === 0) {
    list.innerHTML = `<div class="empty-note">No pending requests right now.</div>`;
    return;
  }
  list.innerHTML = "";
  pending.forEach((u) => {
    const row = document.createElement("div");
    row.className = "row-item";
    row.innerHTML = `
      <div class="row-main">
        <div class="row-title">${escapeHtml(u.email)}</div>
        <span class="status-tag status-pending">Pending</span>
      </div>
      <div class="row-actions">
        <button class="btn btn-success btn-sm" data-approve="${u.id}">Approve</button>
        <button class="btn btn-danger btn-sm" data-deny="${u.id}">Deny</button>
      </div>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => updateDoc(doc(db, "users", btn.dataset.approve), { status: "approved" }));
  });
  list.querySelectorAll("[data-deny]").forEach((btn) => {
    btn.addEventListener("click", () => updateDoc(doc(db, "users", btn.dataset.deny), { status: "rejected" }));
  });
}

// ---------- Owner: crew ----------
function renderCrew() {
  const list = el("crew-list");
  const crew = allUsers.filter((u) => u.status === "approved");
  if (crew.length === 0) {
    list.innerHTML = `<div class="empty-note">No approved crew yet.</div>`;
    return;
  }
  list.innerHTML = "";
  crew.forEach((u) => {
    const isSelf = u.id === currentUid;
    const row = document.createElement("div");
    row.className = "row-item";
    let actions = "";
    if (u.role === "owner") {
      actions = "";
    } else if (u.role === "admin") {
      actions = `<button class="btn btn-secondary btn-sm" data-demote="${u.id}">Revoke admin</button>
                 <button class="btn btn-danger btn-sm" data-revoke="${u.id}">Revoke access</button>`;
    } else {
      actions = `<button class="btn btn-secondary btn-sm" data-promote="${u.id}">Promote to admin</button>
                 <button class="btn btn-danger btn-sm" data-revoke="${u.id}">Revoke access</button>`;
    }
    row.innerHTML = `
      <div class="row-main">
        <div class="row-title">${escapeHtml(u.email)}${isSelf ? " (you)" : ""}</div>
        <span class="status-tag status-${u.role}">${u.role}</span>
      </div>
      <div class="row-actions">${actions}</div>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-promote]").forEach((btn) => {
    btn.addEventListener("click", () => updateDoc(doc(db, "users", btn.dataset.promote), { role: "admin" }));
  });
  list.querySelectorAll("[data-demote]").forEach((btn) => {
    btn.addEventListener("click", () => updateDoc(doc(db, "users", btn.dataset.demote), { role: "member" }));
  });
  list.querySelectorAll("[data-revoke]").forEach((btn) => {
    btn.addEventListener("click", () => updateDoc(doc(db, "users", btn.dataset.revoke), { status: "rejected", role: "member" }));
  });
}

// ---------- Categories: add + manage (shared by owner & admin) ----------
[["form-add-category-owner", "new-category-name-owner"], ["form-add-category-admin", "new-category-name-admin"]]
  .forEach(([formId, inputId]) => {
    const form = el(formId);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = el(inputId);
      const name = input.value.trim();
      if (!name) return;
      await addDoc(collection(db, "categories"), { name, createdAt: serverTimestamp() });
      input.value = "";
    });
  });

function renderCategoryManagers() {
  [el("owner-category-list"), el("admin-category-list")].forEach((list) => {
    if (!list) return;
    if (categories.length === 0) {
      list.innerHTML = `<div class="empty-note">No categories yet. Add one above.</div>`;
      return;
    }
    list.innerHTML = "";
    categories.forEach((cat) => {
      const count = sites.filter((s) => s.categoryId === cat.id).length;
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <div class="row-main">
          <div class="row-title">${escapeHtml(cat.name)}</div>
          <div class="row-sub">${count} site${count === 1 ? "" : "s"}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-danger btn-sm" data-del-cat="${cat.id}">Remove</button>
        </div>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll("[data-del-cat]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const catId = btn.dataset.delCat;
        const affected = sites.filter((s) => s.categoryId === catId);
        if (affected.length > 0 && !confirm(`This category has ${affected.length} site(s). Remove the category and its sites?`)) return;
        await Promise.all(affected.map((s) => deleteDoc(doc(db, "sites", s.id))));
        await deleteDoc(doc(db, "categories", catId));
      });
    });
  });
}

// ---------- Sites: add + manage (shared by owner & admin) ----------
[
  ["form-add-site-owner", "new-site-category-owner", "new-site-name-owner", "new-site-url-owner"],
  ["form-add-site-admin", "new-site-category-admin", "new-site-name-admin", "new-site-url-admin"]
].forEach(([formId, catId, nameId, urlId]) => {
  const form = el(formId);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (categories.length === 0) {
      alert("Add a category first.");
      return;
    }
    const categoryId = el(catId).value;
    const name = el(nameId).value.trim();
    let url = el(urlId).value.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    await addDoc(collection(db, "sites"), { categoryId, name, url, createdAt: serverTimestamp() });
    el(nameId).value = "";
    el(urlId).value = "";
  });
});

function renderSiteManagers() {
  [el("owner-site-list"), el("admin-site-list")].forEach((list) => {
    if (!list) return;
    if (sites.length === 0) {
      list.innerHTML = `<div class="empty-note">No sites yet. Add one above.</div>`;
      return;
    }
    list.innerHTML = "";
    sites.forEach((site) => {
      const cat = categories.find((c) => c.id === site.categoryId);
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <div class="row-main">
          <div class="row-title">${escapeHtml(site.name)}</div>
          <div class="row-sub">${escapeHtml(cat ? cat.name : "Uncategorized")} · ${escapeHtml(site.url)}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-danger btn-sm" data-del-site="${site.id}">Remove</button>
        </div>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll("[data-del-site]").forEach((btn) => {
      btn.addEventListener("click", () => deleteDoc(doc(db, "sites", btn.dataset.delSite)));
    });
  });
}

// ---------- Utility ----------
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
