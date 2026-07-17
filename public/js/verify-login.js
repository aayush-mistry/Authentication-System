const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

const challengeId = sessionStorage.getItem('loginChallengeId');
const risk = JSON.parse(sessionStorage.getItem('loginRisk') || 'null');

if (!challengeId) {
  window.location.href = 'login.html';
}

const riskSummary = document.getElementById('risk-summary');
if (risk && riskSummary) {
  riskSummary.style.display = 'block';
  const title = document.createElement('strong');
  title.textContent = `Security Risk: ${risk.score}% (${risk.level})`;
  const details = document.createElement('span');
  details.textContent = (risk.reasons || []).join(', ');
  riskSummary.append(title, details);
}

document.getElementById('risk-verify-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const btn = document.getElementById('verify-login-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/verify-login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId,
        otp: document.getElementById('otp').value
      })
    });
    const data = await response.json();

    if (response.ok) {
      sessionStorage.removeItem('loginChallengeId');
      sessionStorage.removeItem('loginRisk');
      showToast('Login verified. Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 900);
    } else {
      showToast(data.message || 'Verification failed.', 'error');
    }
  } catch (error) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});
