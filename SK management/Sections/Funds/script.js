const AUTH_KEYS = {
  isLoggedIn: "skIsLoggedIn",
  username: "skUsername",
};

const API_BASE = "/api";

const navLinks = document.querySelectorAll(".page-link");
const logoutOverlay = document.getElementById("logoutOverlay");

const addFundsButton = document.getElementById("addFundsBtn");
const addFundsOverlay = document.getElementById("addFundsOverlay");
const closeAddFundsButton = document.getElementById("closeAddFunds");

const deductFundsButton = document.getElementById("deductFundsBtn");
const deductFundsOverlay = document.getElementById("deductFundsOverlay");
const closeDeductFundsButton = document.getElementById("closeDeductFunds");

const addFundsForm = document.getElementById("addFundsForm");
const addAmount = document.getElementById("addAmount");
const addCategory = document.getElementById("addCategory");
const addCategoryCustom = document.getElementById("addCategoryCustom");
const addDate = document.getElementById("addDate");

const deductFundsForm = document.getElementById("deductFundsForm");
const deductAmount = document.getElementById("deductAmount");
const deductCategory = document.getElementById("deductCategory");
const deductDetails = document.getElementById("deductDetails");
const deductDate = document.getElementById("deductDate");
const receiptFile = document.getElementById("receiptFile");

const otherAddCategory = document.getElementById("otherAddCategory");
const otherDetails = document.getElementById("otherDetails");
const receiptUpload = document.getElementById("receiptUpload");

const currentBalance = document.getElementById("currentBalance");
const fundsTable = document.getElementById("fundsTable");

const today = new Date();
let funds = [];
let balance = 0;

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
  const currentPage = window.location.pathname.split("/").pop() || "funds.html";

  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href")?.split("/").pop();
    link.classList.toggle("active", linkPage === currentPage);
  });
}

function renderFunds() {
  if (currentBalance) {
    currentBalance.textContent = `PHP ${balance.toFixed(2)}`;
  }

  if (!fundsTable) return;

  if (!funds.length) {
    fundsTable.innerHTML =
      '<tr><td colspan="6" style="color: var(--muted);">No transactions yet.</td></tr>';
    return;
  }

  fundsTable.innerHTML = [...funds]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((transaction) => {
      const dateDisplay = new Date(transaction.date).toLocaleDateString(
        undefined,
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      );

      const amount = Number.parseFloat(transaction.amount || 0);
      const typeDisplay = transaction.type === "add" ? "Addition" : "Deduction";
      const amountDisplay =
        transaction.type === "add"
          ? `+PHP ${amount.toFixed(2)}`
          : `-PHP ${amount.toFixed(2)}`;

      const details =
        transaction.details ||
        (transaction.category === "other" ? "Other" : transaction.category);

      const receipt = transaction.receipt
        ? `<img src="${transaction.receipt}" alt="Receipt" style="max-width: 100px; max-height: 100px;">`
        : "--";

      return `<tr>
        <td>${dateDisplay}</td>
        <td>${typeDisplay}</td>
        <td>${escapeHtml(transaction.category)}</td>
        <td>${amountDisplay}</td>
        <td>${escapeHtml(details)}</td>
        <td>${receipt}</td>
      </tr>`;
    })
    .join("");
}

async function loadFundsState() {
  const payload = await apiRequest("/funds");
  funds = payload.transactions || [];
  balance = Number.parseFloat(payload.balance || 0);
}

async function refreshFunds() {
  try {
    await loadFundsState();
    renderFunds();
  } catch (error) {
    alert(error.message || "Unable to load funds.");
  }
}

function showAddFunds() {
  if (!addFundsOverlay) return;
  addFundsOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeAddFunds() {
  if (!addFundsOverlay) return;
  addFundsOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

function showDeductFunds() {
  if (!deductFundsOverlay) return;
  deductFundsOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeDeductFunds() {
  if (!deductFundsOverlay) return;
  deductFundsOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

function toggleAddOtherField() {
  if (!addCategory || !otherAddCategory || !addCategoryCustom) return;

  const isOther = addCategory.value === "other";
  otherAddCategory.style.display = isOther ? "block" : "none";

  if (!isOther) {
    addCategoryCustom.value = "";
  }
}

function toggleOtherFields() {
  if (
    !deductCategory ||
    !otherDetails ||
    !receiptUpload ||
    !receiptFile ||
    !deductDetails
  ) {
    return;
  }

  const category = deductCategory.value;
  const isOther = category === "other";
  const needsReceipt = category !== "transportation" && category !== "";

  otherDetails.style.display = isOther ? "block" : "none";
  receiptUpload.style.display = needsReceipt ? "block" : "none";
  receiptFile.required = needsReceipt;

  if (!isOther) {
    deductDetails.value = "";
  }

  if (!needsReceipt) {
    receiptFile.value = "";
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
refreshFunds();

if (addDate && !addDate.value) {
  addDate.value = today.toISOString().slice(0, 10);
}

if (deductDate && !deductDate.value) {
  deductDate.value = today.toISOString().slice(0, 10);
}

if (addFundsButton) {
  addFundsButton.addEventListener("click", showAddFunds);
}

if (closeAddFundsButton) {
  closeAddFundsButton.addEventListener("click", closeAddFunds);
}

if (deductFundsButton) {
  deductFundsButton.addEventListener("click", showDeductFunds);
}

if (closeDeductFundsButton) {
  closeDeductFundsButton.addEventListener("click", closeDeductFunds);
}

if (addCategory) {
  addCategory.addEventListener("change", toggleAddOtherField);
}

if (deductCategory) {
  deductCategory.addEventListener("change", toggleOtherFields);
}

if (addFundsForm) {
  addFundsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const amount = Number.parseFloat(addAmount?.value.trim() || "0");
    const category =
      addCategory?.value === "other"
        ? addCategoryCustom?.value.trim() || "Other"
        : addCategory?.value;
    const date = addDate?.value;

    if (!Number.isFinite(amount) || amount <= 0 || !category || !date) {
      alert("Please complete all fields with a valid amount.");
      return;
    }

    try {
      await apiRequest("/funds/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: "add",
          amount,
          category,
          details: "",
          date,
          receipt: null,
        }),
      });

      addFundsForm.reset();
      if (addDate) addDate.value = today.toISOString().slice(0, 10);
      toggleAddOtherField();
      closeAddFunds();
      await refreshFunds();
    } catch (error) {
      alert(error.message || "Unable to add funds.");
    }
  });
}

if (deductFundsForm) {
  deductFundsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const amount = Number.parseFloat(deductAmount?.value.trim() || "0");
    const category = deductCategory?.value;
    const date = deductDate?.value;
    const details = deductDetails?.value.trim() || "";

    if (!Number.isFinite(amount) || amount <= 0 || !category || !date) {
      alert("Please complete all fields with a valid amount.");
      return;
    }

    if (
      category !== "transportation" &&
      receiptFile &&
      receiptFile.files.length === 0
    ) {
      alert("Receipt is required for this category.");
      return;
    }

    let receipt = null;
    if (receiptFile && receiptFile.files.length > 0) {
      receipt = await readFileAsDataURL(receiptFile.files[0]);
    }

    try {
      await apiRequest("/funds/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: "deduct",
          amount,
          category,
          details,
          date,
          receipt,
        }),
      });

      deductFundsForm.reset();
      if (deductDate) deductDate.value = today.toISOString().slice(0, 10);
      toggleOtherFields();
      closeDeductFunds();
      await refreshFunds();
    } catch (error) {
      alert(error.message || "Unable to deduct funds.");
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
