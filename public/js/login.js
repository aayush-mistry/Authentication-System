// Toast Notification System
const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = type === 'success' ? `<i class="fas fa-check-circle"></i> <span>${message}</span>` : `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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

const setOAuthButtonsDisabled = (isDisabled, activeButton = null) => {
  document.querySelectorAll('.oauth-btn').forEach((button) => {
    button.classList.toggle('disabled', isDisabled);
    button.classList.toggle('loading', button === activeButton);
    button.setAttribute('aria-disabled', String(isDisabled));
  });
};

document.addEventListener('DOMContentLoaded', () => {
  bindPasswordToggles();

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('oauth_error');
  const authStatus = params.get('auth');

  if (oauthError) {
    showToast(oauthError, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (authStatus === 'oauth_success') {
    showToast('Social login successful!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  document.querySelectorAll('.oauth-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      if (button.classList.contains('disabled')) {
        event.preventDefault();
        return;
      }

      setOAuthButtonsDisabled(true, button);
    });
  });
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
