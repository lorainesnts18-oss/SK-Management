const STORAGE_KEYS = {
  isLoggedIn: "skIsLoggedIn",
  username: "skUsername",
};

const API_BASE = "/api";

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const loginButton = loginForm?.querySelector("button[type='submit']");

function buildAppUrl(targetPath) {
  if (window.location.protocol === "file:") {
    return new URL(`../${targetPath}`, window.location.href).href;
  }

  return `/Sections/${targetPath.replace(/^\/+/, "")}`;
}

function redirectToDashboard() {
  window.location.assign(buildAppUrl("Dashboard/dashboard.html"));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responseBody.message || "Unable to process request.");
  }

  return responseBody;
}

function showError(message) {
  if (!errorMessage) return;

  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function clearError() {
  if (!errorMessage) return;

  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

if (localStorage.getItem(STORAGE_KEYS.isLoggedIn) === "true") {
  redirectToDashboard();
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (window.location.protocol === "file:") {
      showError(
        "Please run npm start and open the app through http://127.0.0.1:3000.",
      );
      return;
    }

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value.trim() || "";

    if (!username || !password) {
      showError("Please enter both username and password.");
      return;
    }

    clearError();
    if (loginButton) loginButton.disabled = true;

    try {
      const response = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem(STORAGE_KEYS.isLoggedIn, "true");
      localStorage.setItem(
        STORAGE_KEYS.username,
        response.user?.username || username,
      );

      redirectToDashboard();
    } catch (error) {
      showError(error.message || "Login failed. Please try again.");
    } finally {
      if (loginButton) loginButton.disabled = false;
    }
  });
}
