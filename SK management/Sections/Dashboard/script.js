const AUTH_KEYS = {
  isLoggedIn: "skIsLoggedIn",
  username: "skUsername",
};

const API_BASE = "/api";

const navLinks = document.querySelectorAll(".page-link");
const logoutOverlay = document.getElementById("logoutOverlay");
const updatesList = document.getElementById("updatesList");
const changesList = document.getElementById("changesList");
const remindersList = document.getElementById("remindersList");
const dashboardTotalEvents = document.getElementById("dashboardTotalEvents");
const quickNoteForm = document.getElementById("quickNoteForm");
const quickNoteType = document.getElementById("quickNoteType");
const quickNoteText = document.getElementById("quickNoteText");
const resetDashboardNotesButton = document.getElementById(
  "resetDashboardNotes",
);

let events = [];
let notes = [];

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
    window.location.pathname.split("/").pop() || "dashboard.html";

  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href")?.split("/").pop();
    link.classList.toggle("active", linkPage === currentPage);
  });
}

function getTimeRemaining(eventDateTime) {
  const now = new Date();
  const targetTime = new Date(eventDateTime);
  const diff = targetTime - now;

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function toComparableDate(event, now) {
  if (event.type !== "birthday") {
    return new Date(`${event.date}T${event.time}`);
  }

  const birthday = new Date(event.date);
  const year = now.getFullYear();
  let nextBirthday = new Date(year, birthday.getMonth(), birthday.getDate());

  if (nextBirthday < now) {
    nextBirthday = new Date(year + 1, birthday.getMonth(), birthday.getDate());
  }

  return nextBirthday;
}

function getUpcomingEventsReminders() {
  const now = new Date();

  const upcoming = events
    .filter((event) => !event.done)
    .filter((event) => toComparableDate(event, now) > now)
    .sort((a, b) => toComparableDate(a, now) - toComparableDate(b, now))
    .slice(0, 3);

  return upcoming
    .map((event) => {
      const eventDateTime = toComparableDate(event, now);
      const timeRemaining = getTimeRemaining(eventDateTime);

      if (!timeRemaining) return null;

      return `<div class="item"><span><strong>Event in ${timeRemaining}</strong> ${escapeHtml(event.name)} at ${escapeHtml(event.place)}</span></div>`;
    })
    .filter(Boolean);
}

function updateDashboardCounter() {
  if (!dashboardTotalEvents) return;
  const upcoming = events.filter((event) => !event.done);
  dashboardTotalEvents.textContent = `${upcoming.length} Upcoming`;
}

function renderNoteList(type, label, emptyText) {
  const bucket = notes.filter((note) => note.type === type);

  if (!bucket.length) {
    return `<div class="item">${emptyText}</div>`;
  }

  return bucket
    .map(
      (note) =>
        `<div class="item"><span><strong>${label}</strong>${escapeHtml(note.text)}</span><button type="button" class="small-button danger" onclick="deleteNote(${note.id})">Delete</button></div>`,
    )
    .join("");
}

function renderNotes() {
  if (!updatesList || !changesList || !remindersList) return;

  updatesList.innerHTML = renderNoteList("update", "Update", "No updates yet.");
  changesList.innerHTML = renderNoteList("change", "Change", "No changes yet.");

  const upcomingReminders = getUpcomingEventsReminders();
  const userReminders = notes
    .filter((note) => note.type === "reminder")
    .map(
      (note) =>
        `<div class="item"><span><strong>Reminder</strong>${escapeHtml(note.text)}</span><button type="button" class="small-button danger" onclick="deleteNote(${note.id})">Delete</button></div>`,
    );

  const allReminders = [...upcomingReminders, ...userReminders];
  remindersList.innerHTML = allReminders.length
    ? allReminders.join("")
    : '<div class="item">No reminders yet.</div>';
}

async function loadState() {
  const [eventsPayload, notesPayload] = await Promise.all([
    apiRequest("/events"),
    apiRequest("/notes"),
  ]);

  events = eventsPayload.events || [];
  notes = notesPayload.notes || [];
}

async function refreshDashboard() {
  try {
    await loadState();
    renderNotes();
    updateDashboardCounter();
  } catch (error) {
    console.error(error);
  }
}

async function deleteNote(noteId) {
  try {
    await apiRequest(`/notes/${noteId}`, { method: "DELETE" });
    await refreshDashboard();
  } catch (error) {
    alert(error.message || "Unable to delete note.");
  }
}

window.deleteNote = deleteNote;

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
refreshDashboard();

if (quickNoteForm) {
  quickNoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const type = quickNoteType?.value || "update";
    const text = quickNoteText?.value.trim();

    if (!text) return;

    try {
      await apiRequest("/notes", {
        method: "POST",
        body: JSON.stringify({ type, text }),
      });

      if (quickNoteText) quickNoteText.value = "";
      await refreshDashboard();
    } catch (error) {
      alert(error.message || "Unable to save note.");
    }
  });
}

if (resetDashboardNotesButton) {
  resetDashboardNotesButton.addEventListener("click", async () => {
    try {
      await apiRequest("/notes", { method: "DELETE" });
      await refreshDashboard();
    } catch (error) {
      alert(error.message || "Unable to reset notes.");
    }
  });
}

if (logoutOverlay) {
  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
  document
    .getElementById("continueBtn")
    ?.addEventListener("click", closeLogout);
}

if (remindersList) {
  setInterval(() => {
    refreshDashboard();
  }, 60000);
}

// Mobile menu toggle
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");

if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  // Close sidebar when clicking outside
  document.addEventListener("click", (e) => {
    if (
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });

  // Close sidebar on nav link click (mobile)
  sidebar.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        sidebar.classList.remove("open");
      }
    });
  });
}
