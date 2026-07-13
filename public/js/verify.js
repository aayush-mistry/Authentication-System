// Toast System
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

// State
let timeLeft = 60;
let timerId = null;
const email = localStorage.getItem('verifyEmail'); // Set during registration

if (!email) {
  showToast('No email found. Redirecting to login...', 'error');
  setTimeout(() => window.location.href = 'login.html', 2000);
}

// Timer Logic
const timerDisplay = document.getElementById('timer-display');
const resendBtn = document.getElementById('resend-btn');
const verifyBtn = document.getElementById('verify-btn');
const otpInput = document.getElementById('otp');

const startTimer = () => {
  timeLeft = 60;
  resendBtn.style.display = 'none';
  timerDisplay.className = '';
  otpInput.disabled = false;
  verifyBtn.disabled = false;

  clearInterval(timerId);
  timerId = setInterval(() => {
    timeLeft--;
    const seconds = timeLeft < 10 ? `0${timeLeft}` : timeLeft;
    timerDisplay.textContent = `00:${seconds}`;

    if (timeLeft <= 0) {
      clearInterval(timerId);
      timerDisplay.textContent = 'OTP EXPIRED';
      timerDisplay.className = 'otp-expired';
      resendBtn.style.display = 'block';
      otpInput.disabled = true;
      verifyBtn.disabled = true;
    }
  }, 1000);
};

// Start timer on load
if (email) startTimer();

// Verify Submission
const verifyForm = document.getElementById('verify-form');
if (verifyForm) {
  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    verifyBtn.classList.add('loading');
    verifyBtn.disabled = true;

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpInput.value })
      });
      const data = await res.json();

      if (res.ok) {
        clearInterval(timerId);
        showToast('Email verified successfully! You can now log in.', 'success');
        localStorage.removeItem('verifyEmail'); // clear it
        setTimeout(() => window.location.href = 'login.html', 2000);
      } else {
        showToast(data.message, 'error');
        verifyBtn.classList.remove('loading');
        verifyBtn.disabled = false;
      }
    } catch (err) {
      showToast('Network error', 'error');
      verifyBtn.classList.remove('loading');
      verifyBtn.disabled = false;
    }
  });
}

// Resend OTP
if (resendBtn) {
  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (res.ok) {
        showToast('A new OTP has been sent to your email.', 'success');
        startTimer(); // Restart the timer
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      resendBtn.disabled = false;
      resendBtn.textContent = 'Resend OTP';
    }
  });
}
