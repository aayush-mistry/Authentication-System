const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const securityFile = path.join(dataDir, 'security.json');

const emptyStore = {
  nextDeviceId: 1,
  nextLoginId: 1,
  nextAuditId: 1,
  nextSuspiciousId: 1,
  nextChallengeId: 1,
  nextActionTokenId: 1,
  devices: [],
  loginHistory: [],
  auditLogs: [],
  suspiciousEvents: [],
  challenges: [],
  actionTokens: []
};

const ensureStore = async () => {
  try {
    await fs.access(securityFile);
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(securityFile, JSON.stringify(emptyStore, null, 2));
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(securityFile, 'utf8');
  return raw.trim() ? { ...emptyStore, ...JSON.parse(raw) } : { ...emptyStore };
};

const writeStore = async (store) => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(securityFile, JSON.stringify(store, null, 2));
};

const byUser = (userId) => (item) => Number(item.userId) === Number(userId);

class Security {
  static async findDevice(userId, fingerprint) {
    const store = await readStore();
    return store.devices.find((device) => Number(device.userId) === Number(userId) && device.fingerprint === fingerprint);
  }

  static async upsertDevice(userId, context, status = 'pending') {
    const store = await readStore();
    const now = new Date().toISOString();
    let device = store.devices.find((item) => Number(item.userId) === Number(userId) && item.fingerprint === context.fingerprint);

    if (device) {
      device.lastActive = now;
      device.ipAddress = context.ipAddress;
      device.location = context.location;
      device.userAgent = context.userAgent;
    } else {
      device = {
        id: store.nextDeviceId++,
        userId: Number(userId),
        fingerprint: context.fingerprint,
        name: `${context.browser} on ${context.operatingSystem}`,
        browser: context.browser,
        operatingSystem: context.operatingSystem,
        deviceType: context.deviceType,
        platform: context.platform,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        location: context.location,
        status,
        firstLogin: now,
        lastActive: now,
        createdAt: now
      };
      store.devices.push(device);
    }

    await writeStore(store);
    return device;
  }

  static async listDevices(userId) {
    const store = await readStore();
    return store.devices.filter(byUser(userId)).sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
  }

  static async updateDevice(userId, deviceId, updates) {
    const store = await readStore();
    const device = store.devices.find((item) => Number(item.userId) === Number(userId) && Number(item.id) === Number(deviceId));
    if (!device) return undefined;
    Object.assign(device, updates, { updatedAt: new Date().toISOString() });
    await writeStore(store);
    return device;
  }

  static async removeDevice(userId, deviceId) {
    const store = await readStore();
    const before = store.devices.length;
    store.devices = store.devices.filter((item) => !(Number(item.userId) === Number(userId) && Number(item.id) === Number(deviceId)));
    await writeStore(store);
    return store.devices.length < before;
  }

  static async addLogin(record) {
    const store = await readStore();
    const login = {
      id: store.nextLoginId++,
      timestamp: new Date().toISOString(),
      ...record
    };
    store.loginHistory.push(login);
    await writeStore(store);
    return login;
  }

  static async listLogins(userId) {
    const store = await readStore();
    return store.loginHistory.filter(byUser(userId)).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static async recentSuccessfulLogins(userId, limit = 10) {
    const logins = await this.listLogins(userId);
    return logins.filter((login) => login.status === 'Success').slice(0, limit);
  }

  static async recentFailedAttempts(userId, ipAddress, minutes = 30) {
    const store = await readStore();
    const cutoff = Date.now() - minutes * 60 * 1000;
    return store.loginHistory.filter((login) => {
      return Number(login.userId) === Number(userId)
        && login.status === 'Failed'
        && login.ipAddress === ipAddress
        && new Date(login.timestamp).getTime() >= cutoff;
    });
  }

  static async addAuditLog(record) {
    const store = await readStore();
    const audit = {
      id: store.nextAuditId++,
      timestamp: new Date().toISOString(),
      ...record
    };
    store.auditLogs.push(audit);
    await writeStore(store);
    return audit;
  }

  static async listAuditLogs(userId) {
    const store = await readStore();
    return store.auditLogs.filter(byUser(userId)).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static async addSuspiciousEvent(record) {
    const store = await readStore();
    const event = {
      id: store.nextSuspiciousId++,
      timestamp: new Date().toISOString(),
      status: 'open',
      ...record
    };
    store.suspiciousEvents.push(event);
    await writeStore(store);
    return event;
  }

  static async listSuspiciousEvents(userId) {
    const store = await readStore();
    return store.suspiciousEvents.filter(byUser(userId)).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static async createChallenge(record) {
    const store = await readStore();
    const challenge = {
      id: store.nextChallengeId++,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false,
      ...record
    };
    store.challenges.push(challenge);
    await writeStore(store);
    return challenge;
  }

  static async findChallenge(challengeId) {
    const store = await readStore();
    return store.challenges.find((challenge) => Number(challenge.id) === Number(challengeId));
  }

  static async markChallengeVerified(challengeId) {
    const store = await readStore();
    const challenge = store.challenges.find((item) => Number(item.id) === Number(challengeId));
    if (!challenge) return undefined;
    challenge.verified = true;
    challenge.verifiedAt = new Date().toISOString();
    await writeStore(store);
    return challenge;
  }

  static async createActionToken(record) {
    const store = await readStore();
    const token = {
      id: store.nextActionTokenId++,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      usedAt: null,
      ...record
    };
    store.actionTokens.push(token);
    await writeStore(store);
    return token;
  }

  static async useActionToken(tokenValue) {
    const store = await readStore();
    const token = store.actionTokens.find((item) => item.token === tokenValue);
    if (!token || token.usedAt || new Date(token.expiresAt).getTime() < Date.now()) return undefined;
    token.usedAt = new Date().toISOString();
    await writeStore(store);
    return token;
  }

  static async deleteLogin(userId, loginId) {
    const store = await readStore();
    const before = store.loginHistory.length;
    store.loginHistory = store.loginHistory.filter((item) => !(Number(item.userId) === Number(userId) && Number(item.id) === Number(loginId)));
    await writeStore(store);
    return store.loginHistory.length < before;
  }
}

module.exports = Security;
