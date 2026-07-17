const state = {
  activityPage: 1,
  activityPages: 1,
  activityRows: [],
  currentDeviceId: null
};

const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (response.status === 401) window.location.href = 'login.html';
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const formatLocation = (location = {}) => {
  return [location.city, location.state, location.country].filter((item) => item && item !== 'Unknown').join(', ') || 'Unknown';
};

const renderSummary = (summary) => {
  const cards = [
    ['Total Logins', summary.totalLogins],
    ['Successful Logins', summary.successfulLogins],
    ['Failed Logins', summary.failedLogins],
    ['Active Devices', summary.activeDevices],
    ['Trusted Devices', summary.trustedDevices],
    ['Suspicious Logins', summary.suspiciousLogins],
    ['Security Risk Score', `${summary.securityRiskScore}%`]
  ];
  document.getElementById('summary-cards').innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join('');
};

const renderHeatmap = (analytics) => {
  document.getElementById('analytics-summary').textContent =
    `Most active: ${analytics.mostActiveDay} at ${analytics.mostActiveHour}:00 · ${analytics.mostUsedBrowser} · ${analytics.mostUsedDevice}`;
  const max = Math.max(1, ...analytics.heatmap.map((day) => day.total));
  document.getElementById('heatmap').innerHTML = analytics.heatmap.map((day) => {
    const intensity = Math.ceil((day.total / max) * 4);
    return `<div class="heat-cell level-${intensity}" title="${day.date}: ${day.total} total, ${day.success} successful, ${day.failed} failed"></div>`;
  }).join('') || '<p class="empty-state">No login activity yet.</p>';
};

const renderDevices = async () => {
  const data = await api('/api/security/devices');
  const list = document.getElementById('devices-list');
  list.classList.remove('loading-skeleton');
  const current = data.devices.find((device) => device.isCurrent);
  state.currentDeviceId = current?.id || null;

  if (current && current.status !== 'trusted') {
    document.getElementById('new-device-card').style.display = 'block';
    document.getElementById('new-device-details').textContent =
      `${current.browser} · ${current.operatingSystem} · ${current.deviceType} · ${formatLocation(current.location)} · ${new Date(current.lastActive).toLocaleString()}`;
  }

  list.innerHTML = data.devices.map((device) => `
    <article class="device-card ${device.isCurrent ? 'current' : ''}">
      <div>
        <h3>${device.name}</h3>
        <p>${device.browser} · ${device.operatingSystem} · ${device.deviceType}</p>
        <p>${device.ipAddress} · ${formatLocation(device.location)}</p>
        <p>First: ${new Date(device.firstLogin).toLocaleString()}<br>Last: ${new Date(device.lastActive).toLocaleString()}</p>
      </div>
      <span class="status-pill ${device.status}">${device.status}</span>
      <div class="security-actions">
        <button class="small-action success" data-trust="${device.id}">Trust</button>
        <button class="small-action" data-rename="${device.id}">Rename</button>
        <button class="small-action" data-logout="${device.id}">Logout</button>
        <button class="small-action danger" data-remove="${device.id}">Remove</button>
      </div>
    </article>
  `).join('') || '<p class="empty-state">No devices yet.</p>';
};

const loadActivity = async () => {
  const params = new URLSearchParams({
    page: state.activityPage,
    search: document.getElementById('activity-search').value,
    status: document.getElementById('filter-status').value,
    from: document.getElementById('filter-from').value,
    to: document.getElementById('filter-to').value
  });
  const data = await api(`/api/security/activity?${params}`);
  state.activityRows = data.rows;
  state.activityPages = data.pages;
  document.getElementById('page-label').textContent = `Page ${data.page} of ${data.pages}`;
  document.getElementById('activity-rows').innerHTML = data.rows.map((row) => `
    <tr>
      <td>${new Date(row.timestamp).toLocaleString()}</td>
      <td>${row.browser}</td>
      <td>${row.operatingSystem}</td>
      <td>${row.deviceType}</td>
      <td>${row.ipAddress}</td>
      <td>${formatLocation(row.location)}</td>
      <td>${row.loginMethod}</td>
      <td><span class="status-pill ${row.status.toLowerCase()}">${row.status}</span></td>
      <td>${row.riskLevel} (${row.riskScore}%)</td>
      <td><button class="small-action danger" data-delete-login="${row.id}">Remove</button></td>
    </tr>
  `).join('') || '<tr><td colspan="10" class="empty-state">No matching login activity.</td></tr>';
};

const renderLists = (dashboard) => {
  document.getElementById('suspicious-list').innerHTML = dashboard.suspiciousEvents.map((event) => `
    <article><strong>${event.riskLevel} · ${event.riskScore}%</strong><span>${new Date(event.timestamp).toLocaleString()} · ${(event.reasons || []).join(', ')}</span></article>
  `).join('') || '<p class="empty-state">No suspicious events.</p>';

  document.getElementById('audit-list').innerHTML = dashboard.auditLogs.map((log) => `
    <article><strong>${log.eventType}</strong><span>${new Date(log.timestamp).toLocaleString()} · ${log.ipAddress}</span></article>
  `).join('') || '<p class="empty-state">No audit logs yet.</p>';
};

const loadDashboard = async () => {
  const dashboard = await api('/api/security/dashboard');
  renderSummary(dashboard.summary);
  renderHeatmap(dashboard.analytics);
  renderLists(dashboard);
};

const exportCsv = () => {
  const header = ['Date', 'Browser', 'OS', 'Device', 'IP', 'Country', 'State', 'City', 'Method', 'Status', 'Risk'];
  const rows = state.activityRows.map((row) => [
    row.timestamp,
    row.browser,
    row.operatingSystem,
    row.deviceType,
    row.ipAddress,
    row.location?.country,
    row.location?.state,
    row.location?.city,
    row.loginMethod,
    row.status,
    `${row.riskLevel} (${row.riskScore}%)`
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = 'login-activity.csv';
  link.click();
  URL.revokeObjectURL(link.href);
};

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  try {
    if (target.dataset.trust) await api(`/api/security/devices/${target.dataset.trust}/trust`, { method: 'PATCH' });
    if (target.dataset.remove && confirm('Remove this device?')) await api(`/api/security/devices/${target.dataset.remove}`, { method: 'DELETE' });
    if (target.dataset.logout) await api(`/api/security/devices/${target.dataset.logout}/logout`, { method: 'POST' });
    if (target.dataset.rename) {
      const name = prompt('Device name');
      if (name) await api(`/api/security/devices/${target.dataset.rename}/rename`, { method: 'PATCH', body: JSON.stringify({ name }) });
    }
    if (target.dataset.deleteLogin && confirm('Remove this login history entry?')) await api(`/api/security/activity/${target.dataset.deleteLogin}`, { method: 'DELETE' });
    if (target.id === 'trust-current-device' && state.currentDeviceId) await api(`/api/security/devices/${state.currentDeviceId}/trust`, { method: 'PATCH' });
    if (target.id === 'review-later') document.getElementById('new-device-card').style.display = 'none';
    if (target.id === 'export-csv') exportCsv();
    await Promise.all([loadDashboard(), renderDevices(), loadActivity()]);
    if (target.id !== 'review-later' && target.id !== 'export-csv') showToast('Security settings updated.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

['activity-search', 'filter-status', 'filter-from', 'filter-to'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    state.activityPage = 1;
    loadActivity();
  });
});

document.getElementById('prev-page').addEventListener('click', () => {
  state.activityPage = Math.max(1, state.activityPage - 1);
  loadActivity();
});

document.getElementById('next-page').addEventListener('click', () => {
  state.activityPage = Math.min(state.activityPages, state.activityPage + 1);
  loadActivity();
});

Promise.all([loadDashboard(), renderDevices(), loadActivity()]).catch((error) => showToast(error.message, 'error'));
