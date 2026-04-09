const AUTH_KEYS = {
  isLoggedIn: "skIsLoggedIn",
  username: "skUsername",
};

const API_BASE = "/api";

const navLinks = document.querySelectorAll(".page-link");
const logoutOverlay = document.getElementById("logoutOverlay");

const upcomingEventsTable = document.getElementById("upcomingEventsTable");
const doneEventsTable = document.getElementById("doneEventsTable");

const eventForm = document.getElementById("eventForm");
const eventName = document.getElementById("eventName");
const eventPlace = document.getElementById("eventPlace");
const eventDate = document.getElementById("eventDate");
const eventTime = document.getElementById("eventTime");
const eventType = document.getElementById("eventType");
const eventTypeCustom = document.getElementById("eventTypeCustom");
const eventNotes = document.getElementById("eventNotes");
const clearEventFormButton = document.getElementById("clearEventForm");
const refreshEventsButton = document.getElementById("refreshEvents");
const clearDoneEventsButton = document.getElementById("clearDoneEvents");
const addEventButton = document.getElementById("addEventBtn");
const eventFormOverlay = document.getElementById("eventFormOverlay");
const closeEventFormButton = document.getElementById("closeEventForm");
const otherEventType = document.getElementById("otherEventType");

const today = new Date();
let editingEventId = null;
let events = [];

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
    window.location.pathname.split("/").pop() || "events.html";

  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href")?.split("/").pop();
    link.classList.toggle("active", linkPage === currentPage);
  });
}

function toggleEventOtherField() {
  if (!eventType || !otherEventType) return;

  const isOther = eventType.value === "other";
  otherEventType.style.display = isOther ? "block" : "none";

  if (!isOther && eventTypeCustom) {
    eventTypeCustom.value = "";
  }
}

function clearEventForm() {
  if (!eventForm || !eventDate || !eventTime) return;

  editingEventId = null;
  eventForm.reset();
  eventDate.value = today.toISOString().slice(0, 10);
  eventTime.value = "09:00";

  if (eventNotes) eventNotes.value = "";
  if (eventTypeCustom) eventTypeCustom.value = "";

  toggleEventOtherField();
}

function showEventForm() {
  if (!eventFormOverlay) return;
  eventFormOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEventForm() {
  if (!eventFormOverlay) return;
  eventFormOverlay.classList.add("hidden");
  document.body.style.overflow = "";
  clearEventForm();
}

function getComparableDate(event, now) {
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

function renderEventTables() {
  if (!upcomingEventsTable || !doneEventsTable) return;

  const now = new Date();

  const upcoming = events
    .filter((event) => !event.done)
    .filter((event) => {
      if (event.type === "birthday") return true;
      return new Date(`${event.date}T${event.time}`) > now;
    })
    .sort((a, b) => getComparableDate(a, now) - getComparableDate(b, now));

  const done = events
    .filter((event) => event.done)
    .sort(
      (a, b) =>
        new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`),
    );

  if (!upcoming.length) {
    upcomingEventsTable.innerHTML =
      '<tr><td colspan="7" style="color: var(--muted);">No upcoming events yet.</td></tr>';
  } else {
    upcomingEventsTable.innerHTML = upcoming
      .map((event) => {
        let eventDateDisplay;
        let actionButtons;

        if (event.type === "birthday") {
          eventDateDisplay = getComparableDate(event, now).toLocaleDateString(
            undefined,
            {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            },
          );

          actionButtons = `<button type="button" class="small-button secondary" onclick="editEvent(${event.id})">Edit</button>`;
        } else {
          eventDateDisplay = new Date(event.date).toLocaleDateString(
            undefined,
            {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            },
          );

          actionButtons =
            `<button type="button" class="small-button secondary" onclick="editEvent(${event.id})">Edit</button>` +
            `<button type="button" class="small-button" onclick="completeEvent(${event.id})">Mark done</button>`;
        }

        return `<tr>
          <td>${escapeHtml(event.name)}</td>
          <td>${eventDateDisplay}</td>
          <td>${escapeHtml(event.time || "--")}</td>
          <td>${escapeHtml(event.place || "--")}</td>
          <td>${escapeHtml(event.type || "--")}</td>
          <td>${escapeHtml(event.status || "Scheduled")}</td>
          <td class="table-actions">${actionButtons}</td>
        </tr>`;
      })
      .join("");
  }

  if (!done.length) {
    doneEventsTable.innerHTML =
      '<tr><td colspan="6" style="color: var(--muted);">No completed events yet.</td></tr>';
  } else {
    doneEventsTable.innerHTML = done
      .map((event) => {
        const eventDateDisplay = new Date(event.date).toLocaleDateString(
          undefined,
          {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        );

        return `<tr>
          <td>${escapeHtml(event.name)}</td>
          <td>${eventDateDisplay}</td>
          <td>${escapeHtml(event.time || "--")}</td>
          <td>${escapeHtml(event.place || "--")}</td>
          <td>${escapeHtml(event.type || "--")}</td>
          <td>${escapeHtml(event.notes || "--")}</td>
        </tr>`;
      })
      .join("");
  }
}

async function loadEvents() {
  const payload = await apiRequest("/events");
  events = payload.events || [];
}

async function refreshEvents() {
  try {
    await loadEvents();
    renderEventTables();
  } catch (error) {
    alert(error.message || "Unable to load events.");
  }
}

async function completeEvent(eventId) {
  try {
    await apiRequest(`/events/${eventId}/complete`, { method: "PATCH" });
    await refreshEvents();
  } catch (error) {
    alert(error.message || "Unable to complete event.");
  }
}

async function clearDoneEvents() {
  const canClear = confirm(
    "Are you sure you want to clear all done events? This action cannot be undone.",
  );

  if (!canClear) return;

  try {
    await apiRequest("/events/done", { method: "DELETE" });
    await refreshEvents();
  } catch (error) {
    alert(error.message || "Unable to clear completed events.");
  }
}

function editEvent(eventId) {
  if (
    !eventForm ||
    !eventName ||
    !eventPlace ||
    !eventDate ||
    !eventTime ||
    !eventType ||
    !eventNotes
  ) {
    return;
  }

  const event = events.find((item) => item.id === eventId);
  if (!event) return;

  editingEventId = eventId;
  eventName.value = event.name;
  eventPlace.value = event.place;
  eventDate.value = event.date;
  eventTime.value = event.time;

  const knownTypes = [
    "meeting",
    "scholarship",
    "training",
    "activity",
    "birthday",
    "other",
  ];

  if (knownTypes.includes(event.type)) {
    eventType.value = event.type;
    eventTypeCustom.value = event.type === "other" ? event.type : "";
  } else {
    eventType.value = "other";
    eventTypeCustom.value = event.type;
  }

  eventNotes.value = event.notes || "";
  toggleEventOtherField();
  showEventForm();
}

window.editEvent = editEvent;
window.completeEvent = completeEvent;

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
clearEventForm();
refreshEvents();

if (eventType) {
  eventType.addEventListener("change", toggleEventOtherField);
}

if (addEventButton) {
  addEventButton.addEventListener("click", showEventForm);
}

if (closeEventFormButton) {
  closeEventFormButton.addEventListener("click", closeEventForm);
}

if (refreshEventsButton) {
  refreshEventsButton.addEventListener("click", () => {
    refreshEvents();
  });
}

if (clearDoneEventsButton) {
  clearDoneEventsButton.addEventListener("click", () => {
    clearDoneEvents();
  });
}

if (clearEventFormButton) {
  clearEventFormButton.addEventListener("click", clearEventForm);
}

if (eventForm) {
  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!eventName || !eventPlace || !eventDate || !eventTime || !eventType) {
      return;
    }

    const name = eventName.value.trim();
    const place = eventPlace.value.trim();
    const date = eventDate.value;
    const time = eventTime.value;
    const type =
      eventType.value === "other"
        ? eventTypeCustom.value.trim() || "Other"
        : eventType.value;
    const notesText = eventNotes?.value.trim() || "";

    if (!name || !place || !date || !time || !type) return;

    const payload = { name, place, date, time, type, notes: notesText };

    try {
      if (editingEventId) {
        await apiRequest(`/events/${editingEventId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      clearEventForm();
      closeEventForm();
      await refreshEvents();
    } catch (error) {
      alert(error.message || "Unable to save event.");
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
