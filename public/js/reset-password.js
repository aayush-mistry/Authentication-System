const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('i');
  icon.className = `fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast-close';
  closeButton.setAttribute('aria-label', 'Dismiss notification');
  closeButton.innerHTML = '<i class="fas fa-xmark" aria-hidden="true"></i>';

  const dismissToast = () => {
    toast.style.animation = 'fadeOut 0.25s forwards';
    setTimeout(() => toast.remove(), 250);
  };

  closeButton.addEventListener('click', dismissToast);
  toast.append(icon, text, closeButton);
  container.appendChild(toast);
  setTimeout(dismissToast, 4500);
};

const togglePassword = (inputId, btn) => {
  const input = document.getElementById(inputId);
  if (!input || !btn) return;

  const icon = btn.querySelector('i');
  if (!icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
    btn.setAttribute('aria-label', 'Hide password');
    btn.setAttribute('title', 'Hide password');
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
    btn.setAttribute('aria-label', 'Show password');
    btn.setAttribute('title', 'Show password');
  }
};

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    togglePassword(button.dataset.passwordToggle, button);
  });
});

const email = localStorage.getItem('resetEmail');
if (!email) window.location.href = 'forgot-password.html';

const resetForm = document.getElementById('reset-form');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const commonPasswordWarning = document.getElementById('common-password-warning');
const commonPasswordSuggestions = document.getElementById('common-password-suggestions');

const updateConfirmPasswordFeedback = () => {
  const feedback = document.getElementById('confirm-feedback');
  if (!feedback || !newPasswordInput || !confirmPasswordInput) return;

  if (!confirmPasswordInput.value) {
    feedback.textContent = '';
    feedback.className = 'feedback-text';
    return;
  }

  const matches = confirmPasswordInput.value === newPasswordInput.value;
  feedback.textContent = matches ? 'Passwords match' : 'Passwords do not match';
  feedback.className = `feedback-text ${matches ? 'success' : 'error'}`;
};

const updateCommonPasswordFeedback = () => {
  if (!window.passwordPolicy) return false;

  const isCommon = window.passwordPolicy.setCommonPasswordWarning({
    passwordInput: newPasswordInput,
    warningBox: commonPasswordWarning,
    suggestionsContainer: commonPasswordSuggestions
  });

  updateConfirmPasswordFeedback();
  return isCommon;
};

if (window.passwordPolicy) {
  window.passwordPolicy.loadCommonPasswordList().then(updateCommonPasswordFeedback);
}

if (newPasswordInput) newPasswordInput.addEventListener('input', updateCommonPasswordFeedback);
if (confirmPasswordInput) confirmPasswordInput.addEventListener('input', updateConfirmPasswordFeedback);

if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');

    if (newPasswordInput.value !== confirmPasswordInput.value) {
      showToast('Passwords do not match.', 'error');
      updateConfirmPasswordFeedback();
      return;
    }

    if (window.passwordPolicy && window.passwordPolicy.isCommonPassword(newPasswordInput.value)) {
      showToast(window.passwordPolicy.COMMON_PASSWORD_MESSAGE, 'error');
      updateCommonPasswordFeedback();
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;

    const payload = {
      email,
      otp: document.getElementById('otp').value,
      newPassword: newPasswordInput.value,
      confirmPassword: confirmPasswordInput.value
    };

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showToast('Password reset successfully. Please login.', 'success');
        localStorage.removeItem('resetEmail');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1200);
      } else {
        showToast(data.message || 'Failed to reset password. OTP may be invalid.', 'error');
      }
    } catch (err) {
      showToast('Network Error', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}
