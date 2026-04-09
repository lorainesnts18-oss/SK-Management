const AUTH_KEYS = {
  isLoggedIn: "skIsLoggedIn",
  username: "skUsername",
};

const API_BASE = "/api";

const navLinks = document.querySelectorAll(".page-link");
const logoutOverlay = document.getElementById("logoutOverlay");

const chartGrid = document.getElementById("chartGrid");

const addRowOverlay = document.getElementById("addRowOverlay");
const addRowForm = document.getElementById("addRowForm");
const newRowTitle = document.getElementById("newRowTitle");
const newRowDescription = document.getElementById("newRowDescription");
const newRowPhoto = document.getElementById("newRowPhoto");
const cancelAddRowButton = document.getElementById("cancelAddRow");

const addPositionOverlay = document.getElementById("addPositionOverlay");
const addPositionForm = document.getElementById("addPositionForm");
const newPositionTitle = document.getElementById("newPositionTitle");
const newPositionDescription = document.getElementById(
  "newPositionDescription",
);
const newPositionPhoto = document.getElementById("newPositionPhoto");
const cancelAddPositionButton = document.getElementById("cancelAddPosition");

const editPositionOverlay = document.getElementById("editPositionOverlay");
const editPositionForm = document.getElementById("editPositionForm");
const editPositionTitle = document.getElementById("editPositionTitle");
const editPositionDescription = document.getElementById(
  "editPositionDescription",
);
const editPositionPhoto = document.getElementById("editPositionPhoto");
const cancelEditPositionButton = document.getElementById("cancelEditPosition");

const addRowButton = document.getElementById("addRowBtn");
const addPositionButton = document.getElementById("addPositionBtn");

let orgChart = [];
let editingPositionId = null;
let editingPositionPhoto = null;

if (localStorage.getItem(AUTH_KEYS.isLoggedIn) !== "true") {
  window.location.replace("../Login/login.html");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
}

function updateActiveNav() {
  const currentPage =
    window.location.pathname.split("/").pop() || "orgchart.html";

  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href")?.split("/").pop();
    link.classList.toggle("active", linkPage === currentPage);
  });
}

function renderOrgChart() {
  if (!chartGrid) return;

  chartGrid.innerHTML = orgChart
    .map(
      (row) => `
      <div class="chart-row">
        ${row
          .map(
            (position) => `
            <div class="chart-node" data-id="${position.id}">
              ${
                position.photo
                  ? `<img src="${position.photo}" alt="${escapeHtml(position.title)}" class="position-photo" />`
                  : '<div class="photo-placeholder">Photo</div>'
              }
              <h3>${escapeHtml(position.title)}</h3>
              <p>${escapeHtml(position.description)}</p>
              <div style="margin-top: 10px; display: flex; gap: 8px;">
                <button type="button" class="small-button secondary" onclick="editPosition(${position.id})" style="padding: 6px 12px; font-size: 0.8rem;">Edit</button>
                <button type="button" class="small-button danger" onclick="deletePosition(${position.id})" style="padding: 6px 12px; font-size: 0.8rem;">Delete</button>
                ${
                  position.photo
                    ? `<button type="button" class="small-button neutral" onclick="removePhoto(${position.id})" style="padding: 6px 12px; font-size: 0.8rem;">Remove Photo</button>`
                    : ''
                }
              </div>
            </div>
          `,
          )
          .join("")}
      </div>
    `,
    )
    .join("");
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadState() {
  const payload = await apiRequest("/orgchart");
  orgChart = payload.rows || [];
}

async function refreshOrgChart() {
  try {
    await loadState();
    renderOrgChart();
  } catch (error) {
    alert(error.message || "Unable to load organizational chart.");
  }
}

function showAddRow() {
  if (!addRowOverlay) return;
  addRowOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeAddRow() {
  if (!addRowOverlay) return;
  addRowOverlay.classList.add("hidden");
  document.body.style.overflow = "";
  if (addRowForm) addRowForm.reset();
}

function showAddPosition() {
  if (!addPositionOverlay) return;
  addPositionOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeAddPosition() {
  if (!addPositionOverlay) return;
  addPositionOverlay.classList.add("hidden");
  document.body.style.overflow = "";
  if (addPositionForm) addPositionForm.reset();
}

function findPositionById(positionId) {
  for (const row of orgChart) {
    const position = row.find((entry) => entry.id === positionId);
    if (position) return position;
  }

  return null;
}

function editPosition(positionId) {
  if (!editPositionOverlay || !editPositionTitle || !editPositionDescription) {
    return;
  }

  const position = findPositionById(positionId);
  if (!position) return;

  editingPositionId = positionId;
  editingPositionPhoto = position.photo || null;

  editPositionTitle.value = position.title;
  editPositionDescription.value = position.description;
  if (editPositionPhoto) editPositionPhoto.value = "";

  editPositionOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditPosition() {
  if (!editPositionOverlay) return;

  editPositionOverlay.classList.add("hidden");
  document.body.style.overflow = "";

  editingPositionId = null;
  editingPositionPhoto = null;

  if (editPositionForm) editPositionForm.reset();
}

async function deletePosition(positionId) {
  const canDelete = confirm("Are you sure you want to delete this position?");
  if (!canDelete) return;

  try {
    await apiRequest(`/orgchart/positions/${positionId}`, {
      method: "DELETE",
    });
    await refreshOrgChart();
  } catch (error) {
    alert(error.message || "Unable to delete this position.");
  }
}

async function removePhoto(positionId) {
  const canRemove = confirm("Are you sure you want to remove the photo for this position?");
  if (!canRemove) return;

  const position = findPositionById(positionId);
  if (!position) return;

  try {
    await apiRequest(`/orgchart/positions/${positionId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: position.title,
        description: position.description,
        photo: null,
      }),
    });
    await refreshOrgChart();
  } catch (error) {
    alert(error.message || "Unable to remove photo.");
  }
}

window.editPosition = editPosition;
window.deletePosition = deletePosition;

function handleLogout() {
  localStorage.removeItem(AUTH_KEYS.isLoggedIn);
  localStorage.removeItem(AUTH_KEYS.username);

  if (!logoutOverlay) {
    window.location.replace("../Login/login.html");
    return;
  }

  logoutOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLogout() {
  if (logoutOverlay) {
    logoutOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  window.location.replace("../Login/login.html");
}

updateActiveNav();
refreshOrgChart();

if (addRowButton) {
  addRowButton.addEventListener("click", showAddRow);
}

if (addPositionButton) {
  addPositionButton.addEventListener("click", showAddPosition);
}

if (cancelAddRowButton) {
  cancelAddRowButton.addEventListener("click", closeAddRow);
}

if (cancelAddPositionButton) {
  cancelAddPositionButton.addEventListener("click", closeAddPosition);
}

if (cancelEditPositionButton) {
  cancelEditPositionButton.addEventListener("click", closeEditPosition);
}

if (addRowForm) {
  addRowForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = newRowTitle?.value.trim();
    const description = newRowDescription?.value.trim();

    if (!title || !description) return;

    let photo = null;
    if (newRowPhoto && newRowPhoto.files.length > 0) {
      photo = await readFileAsDataURL(newRowPhoto.files[0]);
    }

    try {
      await apiRequest("/orgchart/rows", {
        method: "POST",
        body: JSON.stringify({ title, description, photo }),
      });
      await refreshOrgChart();
      closeAddRow();
    } catch (error) {
      alert(error.message || "Unable to add row.");
    }
  });
}

if (addPositionForm) {
  addPositionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = newPositionTitle?.value.trim();
    const description = newPositionDescription?.value.trim();

    if (!title || !description) return;

    let photo = null;
    if (newPositionPhoto && newPositionPhoto.files.length > 0) {
      photo = await readFileAsDataURL(newPositionPhoto.files[0]);
    }

    const rowIndex = orgChart.length > 0 ? orgChart.length - 1 : 0;

    try {
      await apiRequest("/orgchart/positions", {
        method: "POST",
        body: JSON.stringify({ rowIndex, title, description, photo }),
      });
      await refreshOrgChart();
      closeAddPosition();
    } catch (error) {
      alert(error.message || "Unable to add position.");
    }
  });
}

if (editPositionForm) {
  editPositionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = editPositionTitle?.value.trim();
    const description = editPositionDescription?.value.trim();

    if (!title || !description || !editingPositionId) return;

    let photo = editingPositionPhoto;
    if (editPositionPhoto && editPositionPhoto.files.length > 0) {
      photo = await readFileAsDataURL(editPositionPhoto.files[0]);
    }

    try {
      await apiRequest(`/orgchart/positions/${editingPositionId}`, {
        method: "PUT",
        body: JSON.stringify({ title, description, photo }),
      });
      await refreshOrgChart();
      closeEditPosition();
    } catch (error) {
      alert(error.message || "Unable to update position.");
    }
  });
}

if (logoutOverlay) {
  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
  document
    .getElementById("continueBtn")
    ?.addEventListener("click", closeLogout);
}

// Mobile menu toggle
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  sidebar.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        sidebar.classList.remove("open");
      }
    });
  });
}
