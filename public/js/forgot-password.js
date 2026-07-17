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

  toast.append(icon, text);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

const forgotForm = document.getElementById('forgot-form');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const email = document.getElementById('email').value.trim().toLowerCase();

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        localStorage.setItem('resetEmail', email);
        showToast(data.message || 'If an account exists, a password reset OTP has been sent.', 'success');
        setTimeout(() => {
          window.location.href = 'reset-password.html';
        }, 900);
      } else {
        showToast(data.message || 'Unable to send reset OTP.', 'error');
      }
    } catch (err) {
      showToast('Network Error', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}
