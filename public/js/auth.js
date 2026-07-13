// Toast Notification System
const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
  toast.innerHTML = `${icon} <span>${message}</span>`;
  
  container.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// Toggle Password Visibility
const togglePassword = (inputId, btn) => {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
};

// Helper: Debounce function to limit API calls while typing
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/* =========================================
   LIVE USERNAME & EMAIL VALIDATION
========================================= */

const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');

if (usernameInput) {
  usernameInput.addEventListener('input', debounce(async (e) => {
    const username = e.target.value.trim();
    const icon = document.getElementById('username-icon');
    const feedback = document.getElementById('username-feedback');
    const suggestionsDiv = document.getElementById('username-suggestions');
    
    if (username.length < 3) {
      icon.className = 'input-status fas';
      feedback.textContent = '';
      suggestionsDiv.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(`/api/auth/check-username?username=${username}`);
      const data = await res.json();

      if (data.available) {
        icon.className = 'input-status fas fa-check-circle success';
        feedback.textContent = 'Username is available!';
        feedback.className = 'feedback-text success';
        suggestionsDiv.innerHTML = '';
      } else {
        icon.className = 'input-status fas fa-times-circle error';
        feedback.textContent = 'Username already exists.';
        feedback.className = 'feedback-text error';
        
        // Render Suggestions
        suggestionsDiv.innerHTML = '<span style="font-size: 0.75rem; width: 100%; color: var(--text-muted)">Try these:</span>';
        data.suggestions.forEach(sugg => {
          const badge = document.createElement('span');
          badge.className = 'suggestion-badge';
          badge.textContent = sugg;
          badge.onclick = () => {
            usernameInput.value = sugg;
            // trigger input event to re-validate
            usernameInput.dispatchEvent(new Event('input'));
          };
          suggestionsDiv.appendChild(badge);
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, 500));
}

if (emailInput) {
  emailInput.addEventListener('input', debounce(async (e) => {
    const email = e.target.value.trim();
    const icon = document.getElementById('email-icon');
    const feedback = document.getElementById('email-feedback');
    
    // Basic email regex
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      icon.className = 'input-status fas fa-times-circle error';
      feedback.textContent = 'Invalid email format';
      feedback.className = 'feedback-text error';
      return;
    }

    try {
      const res = await fetch(`/api/auth/check-email?email=${email}`);
      const data = await res.json();

      if (data.available) {
        icon.className = 'input-status fas fa-check-circle success';
        feedback.textContent = 'Email is available!';
        feedback.className = 'feedback-text success';
      } else {
        icon.className = 'input-status fas fa-times-circle error';
        feedback.textContent = 'Already Registered';
        feedback.className = 'feedback-text error';
      }
    } catch (err) {
      console.error(err);
    }
  }, 500));
}

/* =========================================
   PASSWORD STRENGTH CHECKER
========================================= */

const passwordInput = document.getElementById('password');
if (passwordInput) {
  passwordInput.addEventListener('input', (e) => {
    const password = e.target.value;
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');
    const suggestionBox = document.getElementById('suggestion-box');
    const suggestedPasswordSpan = document.getElementById('suggested-password');

    if (!password) {
      strengthBar.className = 'strength-bar';
      strengthText.textContent = '';
      suggestionBox.style.display = 'none';
      return;
    }

    // Regex Checks
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    let strength = 0;
    if (isLongEnough) strength += 1;
    if (hasLower && hasUpper) strength += 1;
    if (hasNumber) strength += 1;
    if (hasSpecial) strength += 1;

    strengthBar.className = 'strength-bar';
    if (strength <= 1 || password.length < 8) {
      strengthBar.classList.add('strength-weak');
      strengthText.textContent = 'Weak';
      strengthText.style.color = 'var(--error)';
    } else if (strength === 2) {
      strengthBar.classList.add('strength-medium');
      strengthText.textContent = 'Medium';
      strengthText.style.color = 'var(--warning)';
    } else if (strength === 3) {
      strengthBar.classList.add('strength-strong');
      strengthText.textContent = 'Strong';
      strengthText.style.color = 'var(--success)';
    } else if (strength >= 4) {
      strengthBar.classList.add('strength-very-strong');
      strengthText.textContent = 'Very Strong';
      strengthText.style.color = 'var(--primary-color)';
    }

    // Suggest strong password if weak/medium
    if (strength <= 2) {
      const generated = generateStrongPassword();
      suggestedPasswordSpan.textContent = generated;
      suggestionBox.style.display = 'block';
    } else {
      suggestionBox.style.display = 'none';
    }
  });
}

// Generate a random strong password
const generateStrongPassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let pass = "";
  // Ensure at least one of each required type
  pass += "A"; // Upper
  pass += "a"; // Lower
  pass += "1"; // Number
  pass += "@"; // Special
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Shuffle it (simple shuffle)
  return pass.split('').sort(() => 0.5 - Math.random()).join('');
};

// Use Suggested Password
const useSuggestionBtn = document.getElementById('use-suggestion-btn');
if (useSuggestionBtn) {
  useSuggestionBtn.addEventListener('click', () => {
    const suggested = document.getElementById('suggested-password').textContent;
    document.getElementById('password').value = suggested;
    document.getElementById('confirmPassword').value = suggested;
    document.getElementById('password').dispatchEvent(new Event('input')); // update meter
  });
}

/* =========================================
   REGISTRATION SUBMIT
========================================= */

const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    
    // Basic frontend check
    if (document.getElementById('password').value !== document.getElementById('confirmPassword').value) {
      document.getElementById('confirm-feedback').textContent = "Passwords do not match";
      document.getElementById('confirm-feedback').className = "feedback-text error";
      return;
    } else {
      document.getElementById('confirm-feedback').textContent = "";
    }

    // Set loading state
    btn.classList.add('loading');
    btn.disabled = true;

    const payload = {
      username: document.getElementById('username').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      confirmPassword: document.getElementById('confirmPassword').value,
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showToast('Registration successful! Redirecting...', 'success');
        // Store email temporarily in localStorage to pre-fill the OTP page
        localStorage.setItem('verifyEmail', payload.email);
        setTimeout(() => {
          window.location.href = 'verify.html';
        }, 1500);
      } else {
        showToast(data.message || 'Registration failed', 'error');
      }
    } catch (err) {
      showToast('A network error occurred.', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}
