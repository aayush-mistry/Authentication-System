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
const confirmPasswordInput = document.getElementById('confirmPassword');
const strengthConfig = {
  Weak: { className: 'strength-weak', icon: '🔴', color: 'var(--error)' },
  Medium: { className: 'strength-medium', icon: '🟡', color: 'var(--warning)' },
  Strong: { className: 'strength-strong', icon: '🟢', color: 'var(--success)' },
  'Very Strong': { className: 'strength-very-strong', icon: '💚', color: '#047857' }
};

const evaluatePasswordStrength = (password = '') => {
  const checks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    longBonus: password.length > 12
  };

  const baseScore = [
    checks.minLength,
    checks.uppercase,
    checks.lowercase,
    checks.number,
    checks.special
  ].filter(Boolean).length;
  const score = baseScore + (checks.longBonus ? 1 : 0);

  let label = 'Weak';
  if (score >= 6) label = 'Very Strong';
  else if (score >= 5) label = 'Strong';
  else if (score >= 3) label = 'Medium';

  return { checks, score, label, isAcceptable: baseScore === 5 };
};

const getRandomItem = (items) => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return items[values[0] % items.length];
};

const shuffleSecure = (characters) => {
  const result = [...characters];
  for (let i = result.length - 1; i > 0; i--) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const j = values[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join('');
};

const generateStrongPassword = (length = 14) => {
  const groups = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz',
    '0123456789',
    '!@#$%^&*'
  ];
  const allChars = groups.join('');
  const chars = groups.map((group) => getRandomItem(group));

  while (chars.length < length) {
    chars.push(getRandomItem(allChars));
  }

  return shuffleSecure(chars);
};

const updateRequirements = (checks) => {
  document.querySelectorAll('#password-requirements [data-requirement]').forEach((item) => {
    const requirement = item.dataset.requirement;
    const isMet = Boolean(checks[requirement]);
    item.classList.toggle('met', isMet);
    item.querySelector('.requirement-icon').textContent = isMet ? '✓' : '✗';
  });
};

const renderPasswordSuggestions = () => {
  const suggestionsContainer = document.getElementById('password-suggestions');
  if (!suggestionsContainer) return;

  suggestionsContainer.innerHTML = '';
  Array.from({ length: 3 }, () => generateStrongPassword()).forEach((suggestion) => {
    const row = document.createElement('div');
    row.className = 'password-suggestion';

    const value = document.createElement('code');
    value.textContent = suggestion;

    const useButton = document.createElement('button');
    useButton.type = 'button';
    useButton.className = 'use-password-btn';
    useButton.textContent = 'Use';
    useButton.addEventListener('click', () => {
      passwordInput.value = suggestion;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.focus();
    });

    row.append(value, useButton);
    suggestionsContainer.appendChild(row);
  });
};

const updateConfirmPasswordFeedback = () => {
  if (!confirmPasswordInput || !passwordInput) return;

  const feedback = document.getElementById('confirm-feedback');
  const confirmValue = confirmPasswordInput.value;

  if (!confirmValue) {
    feedback.textContent = '';
    feedback.className = 'feedback-text';
    return;
  }

  const matches = confirmValue === passwordInput.value;
  feedback.textContent = matches ? '✅ Passwords Match' : '❌ Passwords Do Not Match';
  feedback.className = `feedback-text ${matches ? 'success' : 'error'}`;
};

const updatePasswordStrengthUI = () => {
  if (!passwordInput) return evaluatePasswordStrength('');

  const password = passwordInput.value;
  const strengthBar = document.getElementById('strength-bar');
  const strengthText = document.getElementById('strength-text');
  const suggestionBox = document.getElementById('suggestion-box');
  const result = evaluatePasswordStrength(password);
  const config = strengthConfig[result.label];

  strengthBar.className = 'strength-bar';
  updateRequirements(result.checks);

  if (!password) {
    strengthText.textContent = '';
    suggestionBox.style.display = 'none';
    updateConfirmPasswordFeedback();
    return result;
  }

  strengthBar.classList.add(config.className);
  strengthText.textContent = `${config.icon} ${result.label}`;
  strengthText.style.color = config.color;

  if (result.label === 'Weak' || result.label === 'Medium') {
    renderPasswordSuggestions();
    suggestionBox.style.display = 'block';
  } else {
    suggestionBox.style.display = 'none';
  }

  updateConfirmPasswordFeedback();
  return result;
};

if (passwordInput) {
  passwordInput.addEventListener('input', updatePasswordStrengthUI);
}

if (confirmPasswordInput) {
  confirmPasswordInput.addEventListener('input', updateConfirmPasswordFeedback);
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

    const strengthResult = updatePasswordStrengthUI();
    if (!strengthResult.isAcceptable) {
      showToast('Use at least 8 characters with uppercase, lowercase, number, and special character.', 'error');
      return;
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
