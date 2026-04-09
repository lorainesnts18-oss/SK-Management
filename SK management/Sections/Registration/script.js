const API_BASE = "/api";
const MIN_PASSWORD_LENGTH = 6;

const registrationForm = document.getElementById("registrationForm");
const fullNameInput = document.getElementById("fullName");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const feedbackMessage = document.getElementById("feedbackMessage");
const submitButton = registrationForm?.querySelector("button[type='submit']");

function buildSectionUrl(targetPath) {
  if (window.location.protocol === "file:") {
    return new URL(`../${targetPath}`, window.location.href).href;
  }

  return `/Sections/${targetPath.replace(/^\/+/, "")}`;
}

function showFeedback(message, type = "error") {
  if (!feedbackMessage) return;

  feedbackMessage.textContent = message;
  feedbackMessage.classList.remove("hidden", "error", "success");
  feedbackMessage.classList.add(type === "success" ? "success" : "error");
}

function clearFeedback() {
  if (!feedbackMessage) return;

  feedbackMessage.textContent = "";
  feedbackMessage.classList.remove("error", "success");
  feedbackMessage.classList.add("hidden");
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

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (window.location.protocol === "file:") {
      showFeedback(
        "Please run npm start and open the app through http://127.0.0.1:3000.",
      );
      return;
    }

    const fullName = fullNameInput?.value.trim() || "";
    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";

    if (!username || !password || !confirmPassword) {
      showFeedback("Please complete all required fields.");
      return;
    }

    if (username.length < 3) {
      showFeedback("Username must be at least 3 characters long.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      showFeedback(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      showFeedback("Password and confirm password do not match.");
      return;
    }

    clearFeedback();
    if (submitButton) submitButton.disabled = true;

    try {
      await apiRequest("/register", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          username,
          password,
        }),
      });

      registrationForm.reset();
      showFeedback(
        "Registration successful. Redirecting to login...",
        "success",
      );

      window.setTimeout(() => {
        window.location.assign(buildSectionUrl("Login/login.html"));
      }, 1200);
    } catch (error) {
      showFeedback(error.message || "Unable to register account.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
