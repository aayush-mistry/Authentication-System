const crypto = require('crypto');
const bcrypt = require('bcrypt');
const Security = require('../models/Security');
const User = require('../models/User');
const sendEmail = require('../utils/email');
const { buildRequestContext } = require('../utils/requestContext');

const RISK_THRESHOLD = Number(process.env.LOGIN_RISK_THRESHOLD || 80);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = () => crypto.randomBytes(32).toString('hex');

const formatLocation = (location = {}) => {
  return [location.city, location.state, location.country].filter((item) => item && item !== 'Unknown').join(', ') || 'Unknown';
};

const riskLevel = (score) => {
  if (score >= 71) return 'High';
  if (score >= 31) return 'Medium';
  return 'Low';
};

const haversineKm = (a, b) => {
  if (!a?.latitude || !a?.longitude || !b?.latitude || !b?.longitude) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
};

const calculateRisk = async (userId, context) => {
  const priorLogins = await Security.recentSuccessfulLogins(userId, 20);
  const knownDevice = await Security.findDevice(userId, context.fingerprint);
  const failedAttempts = await Security.recentFailedAttempts(userId, context.ipAddress);
  const reasons = [];
  let score = 0;

  const hasSeen = (field, value) => priorLogins.some((login) => login[field] === value);
  const hasSeenLocation = (field, value) => priorLogins.some((login) => login.location?.[field] === value);

  if (!knownDevice) {
    score += 25;
    reasons.push('New device');
  }
  if (context.ipAddress !== 'unknown' && !hasSeen('ipAddress', context.ipAddress)) {
    score += 15;
    reasons.push('New IP address');
  }
  if (!hasSeen('browser', context.browser)) {
    score += 10;
    reasons.push('New browser');
  }
  if (!hasSeen('operatingSystem', context.operatingSystem)) {
    score += 10;
    reasons.push('New operating system');
  }
  if (context.location.country !== 'Unknown' && !hasSeenLocation('country', context.location.country)) {
    score += 20;
    reasons.push('New country');
  }
  if (context.location.state !== 'Unknown' && !hasSeenLocation('state', context.location.state)) {
    score += 10;
    reasons.push('New state or region');
  }
  if (context.location.city !== 'Unknown' && !hasSeenLocation('city', context.location.city)) {
    score += 10;
    reasons.push('New city');
  }
  if (failedAttempts.length >= 3) {
    score += 20;
    reasons.push('Multiple failed login attempts');
  }

  const currentHour = new Date().getHours();
  if (currentHour < 5 || currentHour > 23) {
    score += 10;
    reasons.push('Unusual login time');
  }

  const lastLogin = priorLogins[0];
  if (lastLogin) {
    const distance = haversineKm(lastLogin.location, context.location);
    const minutes = Math.max(1, (Date.now() - new Date(lastLogin.timestamp).getTime()) / 60000);
    if (distance && distance / (minutes / 60) > 900) {
      score += 40;
      reasons.push('Impossible travel detected');
    }
  }

  score = Math.min(100, score);
  return {
    score,
    level: riskLevel(score),
    reasons: reasons.length ? reasons : ['Known login pattern'],
    requiresVerification: score >= RISK_THRESHOLD
  };
};

const createLoginRecord = async ({ userId, context, method, status, risk, deviceId }) => {
  return Security.addLogin({
    userId: userId ? Number(userId) : null,
    browser: context.browser,
    operatingSystem: context.operatingSystem,
    deviceType: context.deviceType,
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
    location: context.location,
    platform: context.platform,
    loginMethod: method,
    status,
    riskScore: risk?.score || 0,
    riskLevel: risk?.level || 'Low',
    riskReasons: risk?.reasons || [],
    deviceId: deviceId || null
  });
};

const createAuditLog = async ({ userId, context, eventType, metadata = {} }) => {
  return Security.addAuditLog({
    userId: userId ? Number(userId) : null,
    eventType,
    ipAddress: context.ipAddress,
    browser: context.browser,
    operatingSystem: context.operatingSystem,
    device: context.deviceType,
    location: context.location,
    metadata
  });
};

const sendSecurityEmail = async ({ user, context, subject, intro, risk, actionToken }) => {
  const trustUrl = actionToken ? `${appBaseUrl}/api/security/email-action/${actionToken}/trust` : null;
  const secureUrl = actionToken ? `${appBaseUrl}/api/security/email-action/${actionToken}/secure` : null;
  const details = [
    intro,
    '',
    `Login Time: ${new Date().toLocaleString()}`,
    `Browser: ${context.browser}`,
    `Operating System: ${context.operatingSystem}`,
    `Device Type: ${context.deviceType}`,
    `IP Address: ${context.ipAddress}`,
    `Approximate Location: ${formatLocation(context.location)}`,
    risk ? `Risk Level: ${risk.level} (${risk.score}%)` : null,
    '',
    trustUrl ? `Yes, This Was Me: ${trustUrl}` : null,
    secureUrl ? `No, Secure My Account: ${secureUrl}` : null
  ].filter(Boolean).join('\n');

  try {
    await sendEmail({ email: user.email, subject, message: details });
  } catch (error) {
    console.error('Security email failed:', error.message);
  }
};

const handleSuccessfulLogin = async ({ req, user, method = 'Password', deferSession = false }) => {
  const context = buildRequestContext(req);
  const risk = await calculateRisk(user.id, context);
  const existingDevice = await Security.findDevice(user.id, context.fingerprint);
  const device = await Security.upsertDevice(user.id, context, existingDevice?.status || 'pending');
  const actionTokenValue = generateToken();

  await Security.createActionToken({
    token: actionTokenValue,
    userId: user.id,
    deviceId: device.id,
    actionType: 'login_review'
  });

  if (!existingDevice) {
    await sendSecurityEmail({
      user,
      context,
      subject: 'New device login detected',
      intro: 'A login from a new device was detected on your account.',
      risk,
      actionToken: actionTokenValue
    });
    await createAuditLog({ userId: user.id, context, eventType: 'New Device Login', metadata: { deviceId: device.id } });
  }

  if (risk.level !== 'Low') {
    const event = await Security.addSuspiciousEvent({
      userId: user.id,
      deviceId: device.id,
      riskScore: risk.score,
      riskLevel: risk.level,
      reasons: risk.reasons,
      context
    });
    await sendSecurityEmail({
      user,
      context,
      subject: `${risk.level} risk login detected`,
      intro: 'We detected a login that differs from your usual activity.',
      risk,
      actionToken: actionTokenValue
    });
    await createAuditLog({ userId: user.id, context, eventType: 'Suspicious Login', metadata: { eventId: event.id, risk } });
  }

  if (risk.requiresVerification && deferSession) {
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const challenge = await Security.createChallenge({
      userId: user.id,
      method,
      otpHash,
      context,
      risk,
      deviceId: device.id,
      tokenVersion: user.token_version
    });

    await sendEmail({
      email: user.email,
      subject: 'Additional verification required',
      message: `Your login verification OTP is: ${otp}. It expires in 10 minutes.`
    });

    return {
      context,
      risk,
      device,
      challenge,
      requiresAdditionalVerification: true
    };
  }

  await createLoginRecord({ userId: user.id, context, method, status: 'Success', risk, deviceId: device.id });
  await createAuditLog({ userId: user.id, context, eventType: method === 'Password' ? 'Login' : 'Social Login', metadata: { method, risk } });

  return {
    context,
    risk,
    device,
    requiresAdditionalVerification: false,
    notice: !existingDevice ? {
      title: 'New Device Login Detected',
      browser: context.browser,
      operatingSystem: context.operatingSystem,
      deviceType: context.deviceType,
      location: formatLocation(context.location),
      time: new Date().toISOString(),
      deviceId: device.id
    } : null
  };
};

const recordFailedLogin = async ({ req, userId = null, method = 'Password', reason = 'Invalid credentials' }) => {
  const context = buildRequestContext(req);
  await createLoginRecord({
    userId,
    context,
    method,
    status: 'Failed',
    risk: { score: 0, level: 'Low', reasons: [reason] }
  });
  await createAuditLog({ userId, context, eventType: 'Failed Login', metadata: { method, reason } });
};

const verifyChallenge = async ({ challengeId, otp }) => {
  const challenge = await Security.findChallenge(challengeId);
  if (!challenge || challenge.verified || new Date(challenge.expiresAt).getTime() < Date.now()) {
    return { ok: false, message: 'Verification expired. Please log in again.' };
  }

  const isMatch = await bcrypt.compare(String(otp), challenge.otpHash);
  if (!isMatch) return { ok: false, message: 'Invalid verification code.' };

  await Security.markChallengeVerified(challengeId);
  await createLoginRecord({
    userId: challenge.userId,
    context: challenge.context,
    method: challenge.method,
    status: 'Success',
    risk: challenge.risk,
    deviceId: challenge.deviceId
  });
  await createAuditLog({
    userId: challenge.userId,
    context: challenge.context,
    eventType: 'Risk Verification Passed',
    metadata: { challengeId }
  });

  return { ok: true, challenge };
};

const buildSecuritySummary = async (userId) => {
  const [logins, devices, suspicious] = await Promise.all([
    Security.listLogins(userId),
    Security.listDevices(userId),
    Security.listSuspiciousEvents(userId)
  ]);
  const successful = logins.filter((login) => login.status === 'Success');
  const failed = logins.filter((login) => login.status === 'Failed');
  const latestRisk = successful[0]?.riskScore || 0;

  return {
    totalLogins: logins.length,
    successfulLogins: successful.length,
    failedLogins: failed.length,
    activeDevices: devices.length,
    trustedDevices: devices.filter((device) => device.status === 'trusted').length,
    suspiciousLogins: suspicious.length,
    securityRiskScore: latestRisk
  };
};

const buildAnalytics = async (userId) => {
  const logins = await Security.listLogins(userId);
  const byDate = {};
  const byHour = {};
  const byBrowser = {};
  const byDevice = {};

  logins.forEach((login) => {
    const date = login.timestamp.slice(0, 10);
    const hour = new Date(login.timestamp).getHours();
    byDate[date] ||= { date, total: 0, success: 0, failed: 0 };
    byDate[date].total += 1;
    if (login.status === 'Success') byDate[date].success += 1;
    if (login.status === 'Failed') byDate[date].failed += 1;
    byHour[hour] = (byHour[hour] || 0) + 1;
    byBrowser[login.browser] = (byBrowser[login.browser] || 0) + 1;
    byDevice[login.deviceType] = (byDevice[login.deviceType] || 0) + 1;
  });

  const maxEntry = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const mostActiveDay = Object.values(byDate).sort((a, b) => b.total - a.total)[0]?.date || 'N/A';

  return {
    heatmap: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
    mostActiveDay,
    mostActiveHour: maxEntry(byHour),
    mostUsedBrowser: maxEntry(byBrowser),
    mostUsedDevice: maxEntry(byDevice),
    totalLoginCount: logins.length,
    failedLoginCount: logins.filter((login) => login.status === 'Failed').length,
    successfulLoginCount: logins.filter((login) => login.status === 'Success').length
  };
};

const secureAccountFromEmail = async (tokenValue) => {
  const token = await Security.useActionToken(tokenValue);
  if (!token) return { ok: false, message: 'This security link is invalid or expired.' };

  await User.incrementTokenVersion(token.userId);
  await Security.addSuspiciousEvent({
    userId: token.userId,
    deviceId: token.deviceId,
    riskScore: 100,
    riskLevel: 'High',
    reasons: ['User reported unauthorized login from email action'],
    context: {}
  });
  await Security.addAuditLog({
    userId: token.userId,
    eventType: 'Account Secured',
    ipAddress: 'email-action',
    browser: 'Unknown',
    operatingSystem: 'Unknown',
    device: 'Unknown',
    location: {},
    metadata: { tokenId: token.id }
  });
  return { ok: true, message: 'Your account has been secured. All sessions were revoked. Please reset your password.' };
};

const trustDeviceFromEmail = async (tokenValue) => {
  const token = await Security.useActionToken(tokenValue);
  if (!token) return { ok: false, message: 'This security link is invalid or expired.' };
  await Security.updateDevice(token.userId, token.deviceId, { status: 'trusted' });
  return { ok: true, message: 'Device trusted successfully.' };
};

module.exports = {
  buildRequestContext,
  calculateRisk,
  createAuditLog,
  recordFailedLogin,
  handleSuccessfulLogin,
  verifyChallenge,
  buildSecuritySummary,
  buildAnalytics,
  secureAccountFromEmail,
  trustDeviceFromEmail,
  formatLocation
};
