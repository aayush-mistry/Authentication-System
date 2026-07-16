const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');

const emptyStore = {
  nextId: 1,
  users: []
};

const normalizeUser = (user) => {
  if (!user) return user;

  user.authentication_provider = user.authentication_provider || 'Local';
  user.provider_id = user.provider_id || null;
  user.profile_picture = user.profile_picture || 'default-avatar.png';
  user.email_verified = typeof user.email_verified === 'boolean' ? user.email_verified : Boolean(user.is_verified);
  user.is_verified = typeof user.is_verified === 'boolean' ? user.is_verified : Boolean(user.email_verified);
  user.token_version = Number.isInteger(user.token_version) ? user.token_version : 0;

  return user;
};

const ensureStore = async () => {
  try {
    await fs.access(usersFile);
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(usersFile, JSON.stringify(emptyStore, null, 2));
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(usersFile, 'utf8');
  const store = raw.trim() ? JSON.parse(raw) : { ...emptyStore };
  store.users = (store.users || []).map(normalizeUser);
  store.nextId = store.nextId || 1;
  return store;
};

const writeStore = async (store) => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(usersFile, JSON.stringify(store, null, 2));
};

const withoutPasswordCopy = (user) => {
  return user ? { ...user } : undefined;
};

class User {
  static async findByEmail(email) {
    const store = await readStore();
    const user = store.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
    return withoutPasswordCopy(user);
  }

  static async findByUsername(username) {
    const store = await readStore();
    const user = store.users.find((item) => item.username.toLowerCase() === username.toLowerCase());
    return withoutPasswordCopy(user);
  }

  static async findById(id) {
    const store = await readStore();
    const user = store.users.find((item) => item.id === Number(id));
    return withoutPasswordCopy(user);
  }

  static async findByProvider(authenticationProvider, providerId) {
    const store = await readStore();
    const user = store.users.find((item) => {
      return item.authentication_provider === authenticationProvider && item.provider_id === providerId;
    });
    return withoutPasswordCopy(user);
  }

  static async create(username, email, hashedPassword, otpHash, otpExpiresAt) {
    const store = await readStore();

    const user = {
      id: store.nextId,
      username,
      email,
      password: hashedPassword,
      is_verified: false,
      authentication_provider: 'Local',
      provider_id: null,
      otp: otpHash,
      otp_expires_at: otpExpiresAt,
      token_version: 0,
      profile_picture: 'default-avatar.png',
      email_verified: false,
      created_at: new Date().toISOString()
    };

    store.nextId += 1;
    store.users.push(user);
    await writeStore(store);

    return user.id;
  }

  static async updateOTP(userId, otpHash, otpExpiresAt) {
    const store = await readStore();
    const user = store.users.find((item) => item.id === Number(userId));
    if (!user) return;

    user.otp = otpHash;
    user.otp_expires_at = otpExpiresAt;
    await writeStore(store);
  }

  static async verifyUser(userId) {
    const store = await readStore();
    const user = store.users.find((item) => item.id === Number(userId));
    if (!user) return;

    user.is_verified = true;
    user.email_verified = true;
    user.otp = null;
    user.otp_expires_at = null;
    await writeStore(store);
  }

  static async createOAuthUser({ username, email, authenticationProvider, providerId, profilePicture, emailVerified }) {
    const store = await readStore();

    const duplicate = store.users.find((item) => {
      return item.email.toLowerCase() === email.toLowerCase() || item.username.toLowerCase() === username.toLowerCase();
    });

    if (duplicate) {
      const error = new Error('Username or email already exists');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }

    const user = {
      id: store.nextId,
      username,
      email,
      password: null,
      is_verified: Boolean(emailVerified),
      authentication_provider: authenticationProvider,
      provider_id: providerId,
      otp: null,
      otp_expires_at: null,
      token_version: 0,
      profile_picture: profilePicture || 'default-avatar.png',
      email_verified: Boolean(emailVerified),
      created_at: new Date().toISOString()
    };

    store.nextId += 1;
    store.users.push(user);
    await writeStore(store);

    return user;
  }

  static async linkOAuthProvider(userId, { authenticationProvider, providerId, profilePicture, emailVerified }) {
    const store = await readStore();
    const user = store.users.find((item) => item.id === Number(userId));
    if (!user) return undefined;

    user.authentication_provider = authenticationProvider;
    user.provider_id = providerId;
    user.profile_picture = profilePicture || user.profile_picture || 'default-avatar.png';
    user.email_verified = Boolean(emailVerified || user.email_verified);
    user.is_verified = Boolean(emailVerified || user.is_verified);
    user.otp = null;
    user.otp_expires_at = null;

    await writeStore(store);
    return withoutPasswordCopy(user);
  }

  static async updatePassword(userId, newHashedPassword) {
    const store = await readStore();
    const user = store.users.find((item) => item.id === Number(userId));
    if (!user) return;

    user.password = newHashedPassword;
    user.otp = null;
    user.otp_expires_at = null;
    user.token_version += 1;
    await writeStore(store);
  }

  static async incrementTokenVersion(userId) {
    const store = await readStore();
    const user = store.users.find((item) => item.id === Number(userId));
    if (!user) return;

    user.token_version += 1;
    await writeStore(store);
  }

  static async updateProfile(userId, username, email) {
    const store = await readStore();
    const existing = store.users.find((item) => item.id === Number(userId));
    if (!existing) return;

    const duplicate = store.users.find((item) => {
      if (item.id === Number(userId)) return false;
      return item.username.toLowerCase() === username.toLowerCase() || item.email.toLowerCase() === email.toLowerCase();
    });

    if (duplicate) {
      const error = new Error('Username or email already exists');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }

    existing.username = username;
    existing.email = email;
    await writeStore(store);
  }

  static async deleteAccount(userId) {
    const store = await readStore();
    store.users = store.users.filter((item) => item.id !== Number(userId));
    await writeStore(store);
  }
}

module.exports = User;
