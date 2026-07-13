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

// Dark Mode Toggle
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
  // Check local storage
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }

  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark');
      themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      localStorage.setItem('theme', 'light');
      themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
  });
}

// Fetch Profile Data on Load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/user/profile');
    if (!res.ok) {
      if (res.status === 401) {
        // Not logged in or token expired
        window.location.href = 'login.html';
      }
      return;
    }
    const user = await res.json();
    
    // Populate Dashboard
    document.getElementById('display-name').textContent = user.username;
    document.getElementById('profile-username').value = user.username;
    document.getElementById('profile-email').value = user.email;
    
  } catch (err) {
    console.error('Failed to load profile', err);
  }
});

// Update Profile
const profileForm = document.getElementById('profile-form');
if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('update-profile-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    const username = document.getElementById('profile-username').value;
    const email = document.getElementById('profile-email').value;

    try {
      const res = await fetch('/api/user/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
      });
      const data = await res.json();
      
      if (res.ok) {
        showToast(data.message, 'success');
        document.getElementById('display-name').textContent = username;
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

// Change Password
const passwordForm = document.getElementById('password-form');
if (passwordForm) {
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('update-password-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;

    try {
      const res = await fetch('/api/user/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      
      if (res.ok) {
        showToast(data.message, 'success');
        passwordForm.reset();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

// Global Logout (Logout of all devices)
const logoutAllBtn = document.getElementById('logout-all-btn');
if (logoutAllBtn) {
  logoutAllBtn.addEventListener('click', async () => {
    if(!confirm("Are you sure you want to log out of ALL devices?")) return;
    
    logoutAllBtn.classList.add('loading');
    try {
      await fetch('/api/user/logout-all', { method: 'POST' });
      window.location.href = 'login.html';
    } catch (err) {
      showToast('Network error', 'error');
      logoutAllBtn.classList.remove('loading');
    }
  });
}

// Standard Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = 'login.html';
    } catch (err) {
      console.error(err);
    }
  });
}

// Delete Account
const deleteAccountBtn = document.getElementById('delete-account-btn');
if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', async () => {
    if(!confirm("WARNING: This will permanently delete your account. Are you absolutely sure?")) return;
    
    deleteAccountBtn.classList.add('loading');
    try {
      await fetch('/api/user/delete', { method: 'DELETE' });
      window.location.href = 'register.html';
    } catch (err) {
      showToast('Network error', 'error');
      deleteAccountBtn.classList.remove('loading');
    }
  });
}
