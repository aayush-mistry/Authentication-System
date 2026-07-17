const Security = require('../models/Security');
const User = require('../models/User');
const {
  buildSecuritySummary,
  buildAnalytics,
  createAuditLog,
  trustDeviceFromEmail,
  secureAccountFromEmail
} = require('../services/loginSecurityService');
const { buildRequestContext } = require('../utils/requestContext');

const getDevices = async (req, res) => {
  try {
    const devices = await Security.listDevices(req.userId);
    const currentContext = buildRequestContext(req);
    res.json({
      currentFingerprint: currentContext.fingerprint,
      devices: devices.map((device) => ({
        ...device,
        isCurrent: device.fingerprint === currentContext.fingerprint
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load trusted devices.' });
  }
};

const trustDevice = async (req, res) => {
  try {
    const device = await Security.updateDevice(req.userId, req.params.deviceId, { status: 'trusted' });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    await createAuditLog({ userId: req.userId, context: buildRequestContext(req), eventType: 'Device Trusted', metadata: { deviceId: device.id } });
    res.json({ message: 'Device trusted successfully.', device });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to trust device.' });
  }
};

const renameDevice = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ message: 'Device name is required' });
    const device = await Security.updateDevice(req.userId, req.params.deviceId, { name });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    await createAuditLog({ userId: req.userId, context: buildRequestContext(req), eventType: 'Device Renamed', metadata: { deviceId: device.id } });
    res.json({ message: 'Device renamed successfully.', device });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to rename device.' });
  }
};

const removeDevice = async (req, res) => {
  try {
    const removed = await Security.removeDevice(req.userId, req.params.deviceId);
    if (!removed) return res.status(404).json({ message: 'Device not found' });
    await createAuditLog({ userId: req.userId, context: buildRequestContext(req), eventType: 'Device Removed', metadata: { deviceId: req.params.deviceId } });
    res.json({ message: 'Device removed successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to remove device.' });
  }
};

const logoutDevice = async (req, res) => {
  try {
    await User.incrementTokenVersion(req.userId);
    await createAuditLog({ userId: req.userId, context: buildRequestContext(req), eventType: 'Device Logout Requested', metadata: { deviceId: req.params.deviceId } });
    res.json({ message: 'Device logout requested. Existing sessions were revoked.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to logout device.' });
  }
};

const getLoginActivity = async (req, res) => {
  try {
    let logins = await Security.listLogins(req.userId);
    const { search, status, from, to, page = 1, limit = 10 } = req.query;

    if (status && status !== 'All') {
      logins = logins.filter((login) => login.status === status);
    }
    if (from) {
      logins = logins.filter((login) => new Date(login.timestamp) >= new Date(from));
    }
    if (to) {
      logins = logins.filter((login) => new Date(login.timestamp) <= new Date(`${to}T23:59:59`));
    }
    if (search) {
      const term = search.toLowerCase();
      logins = logins.filter((login) => {
        return [
          login.browser,
          login.operatingSystem,
          login.deviceType,
          login.ipAddress,
          login.location?.country,
          login.location?.state,
          login.location?.city,
          login.loginMethod,
          login.status,
          login.riskLevel
        ].some((value) => String(value || '').toLowerCase().includes(term));
      });
    }

    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(50, Math.max(5, Number(limit)));
    const total = logins.length;
    const rows = logins.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

    res.json({ rows, total, page: pageNumber, pages: Math.ceil(total / pageSize) || 1 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load login activity.' });
  }
};

const deleteLoginHistory = async (req, res) => {
  try {
    const removed = await Security.deleteLogin(req.userId, req.params.loginId);
    if (!removed) return res.status(404).json({ message: 'Login entry not found' });
    res.json({ message: 'Login history entry removed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to remove login entry.' });
  }
};

const getSecurityDashboard = async (req, res) => {
  try {
    const [summary, analytics, auditLogs, suspiciousEvents] = await Promise.all([
      buildSecuritySummary(req.userId),
      buildAnalytics(req.userId),
      Security.listAuditLogs(req.userId),
      Security.listSuspiciousEvents(req.userId)
    ]);
    res.json({ summary, analytics, auditLogs: auditLogs.slice(0, 25), suspiciousEvents: suspiciousEvents.slice(0, 25) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to load security dashboard.' });
  }
};

const emailAction = async (req, res) => {
  try {
    const { token, action } = req.params;
    if (!['trust', 'secure'].includes(action)) {
      return res.status(400).send('<h2>Invalid security action</h2>');
    }
    const result = action === 'secure'
      ? await secureAccountFromEmail(token)
      : await trustDeviceFromEmail(token);
    res.send(`<h2>${result.ok ? 'Security action complete' : 'Security action failed'}</h2><p>${result.message}</p>`);
  } catch (error) {
    console.error(error);
    res.status(500).send('<h2>Security action failed</h2><p>Please try again from your account security page.</p>');
  }
};

module.exports = {
  getDevices,
  trustDevice,
  renameDevice,
  removeDevice,
  logoutDevice,
  getLoginActivity,
  deleteLoginHistory,
  getSecurityDashboard,
  emailAction
};
