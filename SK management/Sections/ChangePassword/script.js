const API_BASE = "/api";
const MIN_PASSWORD_LENGTH = 6;

const changePasswordForm = document.getElementById("changePasswordForm");
const usernameInput = document.getElementById("username");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const feedbackMessage = document.getElementById("feedbackMessage");
const submitButton = changePasswordForm?.querySelector("button[type='submit']");

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

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (window.location.protocol === "file:") {
      showFeedback(
        "Please run npm start and open the app through http://127.0.0.1:3000.",
      );
      return;
    }

    const username = usernameInput?.value.trim() || "";
    const currentPassword = currentPasswordInput?.value || "";
    const newPassword = newPasswordInput?.value || "";
    const confirmNewPassword = confirmNewPasswordInput?.value || "";

    if (!username || !currentPassword || !newPassword || !confirmNewPassword) {
      showFeedback("Please complete all fields.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      showFeedback(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showFeedback("New password and confirm password do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      showFeedback(
        "New password must be different from your current password.",
      );
      return;
    }

    clearFeedback();
    if (submitButton) submitButton.disabled = true;

    try {
      await apiRequest("/change-password", {
        method: "POST",
        body: JSON.stringify({
          username,
          currentPassword,
          newPassword,
        }),
      });

      changePasswordForm.reset();
      showFeedback(
        "Password changed successfully. Redirecting to login...",
        "success",
      );

      window.setTimeout(() => {
        window.location.assign(buildSectionUrl("Login/login.html"));
      }, 1400);
    } catch (error) {
      showFeedback(error.message || "Unable to change password.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
