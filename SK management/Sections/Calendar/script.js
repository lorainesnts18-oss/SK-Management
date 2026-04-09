const AUTH_KEYS = {
  isLoggedIn: "skIsLoggedIn",
  username: "skUsername",
};

const API_BASE = "/api";

const navLinks = document.querySelectorAll(".page-link");
const logoutOverlay = document.getElementById("logoutOverlay");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const selectedDayEvents = document.getElementById("selectedDayEvents");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthYear = document.getElementById("calendarMonthYear");
const prevMonthButton = document.getElementById("prevMonth");
const nextMonthButton = document.getElementById("nextMonth");

const fixedHolidays = [
  { month: 0, day: 1, name: "New Year's Day" },
  { month: 1, day: 25, name: "EDSA People Power Revolution" },
  { month: 3, day: 9, name: "Araw ng Kagitingan" },
  { month: 4, day: 1, name: "Labor Day" },
  { month: 5, day: 12, name: "Independence Day" },
  { month: 7, day: 21, name: "Ninoy Aquino Day" },
  { month: 10, day: 1, name: "All Saints' Day" },
  { month: 10, day: 2, name: "All Souls' Day" },
  { month: 10, day: 30, name: "Bonifacio Day" },
  { month: 11, day: 8, name: "Immaculate Conception" },
  { month: 11, day: 25, name: "Christmas Day" },
  { month: 11, day: 30, name: "Rizal Day" },
];

const today = new Date();
let calendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = new Date(today);
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
    window.location.pathname.split("/").pop() || "calendar.html";

  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href")?.split("/").pop();
    link.classList.toggle("active", linkPage === currentPage);
  });
}

function getLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEasterSunday(year) {
  const f = Math.floor;
  const g = year % 19;
  const c = f(year / 100);
  const h = (c - f(c / 4) - f((8 * c + 13) / 25) + 19 * g + 15) % 30;
  const i =
    h - f(h / 28) * (1 - f(h / 28) * f(29 / (h + 1)) * f((21 - g) / 11));
  const j = (year + f(year / 4) + i + 2 - c + f(c / 4)) % 7;
  const l = i - j;
  const month = 3 + f((l + 40) / 44);
  const day = l + 28 - 31 * f(month / 4);

  return new Date(year, month - 1, day);
}

function getHolyWeek(year) {
  const easter = getEasterSunday(year);

  const maundy = new Date(easter);
  maundy.setDate(easter.getDate() - 3);

  const friday = new Date(easter);
  friday.setDate(easter.getDate() - 2);

  const saturday = new Date(easter);
  saturday.setDate(easter.getDate() - 1);

  return [
    {
      month: maundy.getMonth(),
      day: maundy.getDate(),
      name: "Maundy Thursday",
    },
    { month: friday.getMonth(), day: friday.getDate(), name: "Good Friday" },
    {
      month: saturday.getMonth(),
      day: saturday.getDate(),
      name: "Black Saturday",
    },
  ];
}

function getAllHolidays(year) {
  return [...fixedHolidays, ...getHolyWeek(year)];
}

function renderSelectedDayEvents() {
  if (!selectedDateLabel || !selectedDayEvents) return;

  selectedDateLabel.textContent = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const isoDate = getLocalISODate(selectedDate);

  const eventsForDay = events
    .filter(
      (event) =>
        event.date === isoDate ||
        (event.type === "birthday" &&
          new Date(event.date).getMonth() === selectedDate.getMonth() &&
          new Date(event.date).getDate() === selectedDate.getDate()),
    )
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const holiday = getAllHolidays(selectedDate.getFullYear()).find(
    (item) =>
      item.month === selectedDate.getMonth() &&
      item.day === selectedDate.getDate(),
  );

  let content = "";

  if (holiday) {
    content += `<li class="item" style="background-color: var(--surface-alt); border-left: 4px solid var(--success); padding-left: 12px;"><strong style="color: var(--success);">${escapeHtml(holiday.name)}</strong><span style="color: var(--muted);">National Holiday</span></li>`;
  }

  if (eventsForDay.length) {
    content += eventsForDay
      .map(
        (event) =>
          `<li class="item"><strong>${escapeHtml(event.name)}</strong><span>${escapeHtml(event.time || "--")} • ${escapeHtml(event.place || "No venue")}</span><span style="color: var(--muted); margin-top: 6px; display: block;">${escapeHtml(event.notes || "No additional notes")}</span></li>`,
      )
      .join("");
  } else if (!holiday) {
    content = '<li class="item">No events scheduled for this day.</li>';
  }

  selectedDayEvents.innerHTML = content;
}

function renderCalendar() {
  if (!calendarGrid || !calendarMonthYear) return;

  const month = calendarDate.getMonth();
  const year = calendarDate.getFullYear();

  calendarMonthYear.textContent = calendarDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidays = getAllHolidays(year);

  calendarGrid.innerHTML = "";

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
    const headerCell = document.createElement("div");
    headerCell.className = "calendar-cell header";
    headerCell.textContent = day;
    calendarGrid.appendChild(headerCell);
  });

  for (let index = 0; index < firstDay; index += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-cell disabled";
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    const isoDate = getLocalISODate(cellDate);

    const hasEvent =
      events.some((event) => event.date === isoDate) ||
      events.some(
        (event) =>
          event.type === "birthday" &&
          new Date(event.date).getMonth() === month &&
          new Date(event.date).getDate() === day,
      );

    const holiday = holidays.find(
      (item) => item.month === month && item.day === day,
    );

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-cell";

    if (hasEvent) cell.classList.add("has-event");
    if (holiday) cell.classList.add("has-holiday");
    if (isoDate === getLocalISODate(today)) cell.classList.add("today");

    cell.innerHTML = `<span>${day}</span><small>${cellDate.toLocaleDateString(undefined, { weekday: "short" })}</small>`;
    cell.addEventListener("click", () => {
      selectedDate = cellDate;
      renderSelectedDayEvents();
    });

    calendarGrid.appendChild(cell);
  }

  renderSelectedDayEvents();
}

async function refreshCalendarData() {
  try {
    const payload = await apiRequest("/events");
    events = payload.events || [];
    renderCalendar();
  } catch (error) {
    console.error(error);
  }
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
refreshCalendarData();

if (prevMonthButton) {
  prevMonthButton.addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
}

if (nextMonthButton) {
  nextMonthButton.addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
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

setInterval(() => {
  refreshCalendarData();
}, 60000);
