const toastIcons = {
  success: 'fa-check-circle',
  warning: 'fa-triangle-exclamation',
  error: 'fa-exclamation-circle'
};

const normalizeToastType = (type) => {
  return ['success', 'warning', 'error'].includes(type) ? type : 'success';
};

// Toast Notification System
const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastType = normalizeToastType(type);
  const toast = document.createElement('div');
  toast.className = `toast ${toastType}`;
  toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status');

  const icon = document.createElement('i');
  icon.className = `fas ${toastIcons[toastType]}`;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast-close';
  closeButton.setAttribute('aria-label', 'Dismiss notification');

  const closeIcon = document.createElement('i');
  closeIcon.className = 'fas fa-xmark';
  closeIcon.setAttribute('aria-hidden', 'true');
  closeButton.appendChild(closeIcon);

  const dismissToast = () => {
    toast.style.animation = 'fadeOut 0.25s forwards';
    setTimeout(() => toast.remove(), 250);
  };

  closeButton.addEventListener('click', dismissToast);
  toast.append(icon, text, closeButton);
  container.appendChild(toast);
  setTimeout(dismissToast, 4500);
};

// Toggle Password Visibility
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

const bindPasswordToggles = () => {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      togglePassword(button.dataset.passwordToggle, button);
    });
  });
};

const getSocialButtons = () => Array.from(document.querySelectorAll('.oauth-btn'));

const setOAuthButtonsDisabled = (isDisabled, activeButton = null) => {
  getSocialButtons().forEach((button) => {
    const isActive = button === activeButton;
    const label = button.querySelector('.oauth-label');

    if (!button.dataset.defaultLabel && label) {
      button.dataset.defaultLabel = label.textContent;
    }

    button.classList.toggle('disabled', isDisabled);
    button.classList.toggle('loading', isActive);
    button.setAttribute('aria-disabled', String(isDisabled));
    button.tabIndex = isDisabled ? -1 : 0;

    if (label) {
      label.textContent = isActive ? 'Redirecting...' : button.dataset.defaultLabel;
    }
  });
};

const getOAuthErrorType = (message) => {
  const normalized = message.toLowerCase();
  if (normalized.includes('cancel')) return 'warning';
  if (normalized.includes('unavailable') || normalized.includes('not configured')) return 'warning';
  return 'error';
};

const bindSocialLoginButtons = () => {
  getSocialButtons().forEach((button) => {
    const label = button.querySelector('.oauth-label');
    if (label) button.dataset.defaultLabel = label.textContent;

    button.addEventListener('click', (event) => {
      if (button.classList.contains('disabled')) {
        event.preventDefault();
        return;
      }

      setOAuthButtonsDisabled(true, button);
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  bindPasswordToggles();
  bindSocialLoginButtons();

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('oauth_error');
  const authStatus = params.get('auth');
  const accountCreated = params.get('account_created');

  if (oauthError) {
    showToast(oauthError, getOAuthErrorType(oauthError));
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (authStatus === 'oauth_success') {
    showToast(accountCreated === 'true' ? 'Account Created Successfully' : 'Login Successful', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

window.addEventListener('pageshow', () => {
  setOAuthButtonsDisabled(false);
});

// Handle Login Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.classList.add('loading');
    btn.disabled = true;
    setOAuthButtonsDisabled(true);

    const loginId = document.getElementById('loginId').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.requiresAdditionalVerification) {
          sessionStorage.setItem('loginChallengeId', data.challengeId);
          sessionStorage.setItem('loginRisk', JSON.stringify(data.risk || {}));
          showToast('Additional verification required.', 'warning');
          setTimeout(() => {
            window.location.href = 'verify-login.html';
          }, 900);
          return;
        }

        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'index.html'; // Redirect to Dashboard
        }, 1500);
      } else {
        showToast(data.message || 'Login failed', 'error');
        // If unverified, automatically redirect them to verify page
        if (data.requiresVerification && data.email) {
          localStorage.setItem('verifyEmail', data.email);
          setTimeout(() => {
            window.location.href = 'verify.html';
          }, 2000);
        }
      }
    } catch (err) {
      showToast('A network error occurred.', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
      setOAuthButtonsDisabled(false);
    }
  });
}
