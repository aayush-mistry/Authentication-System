const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');

const emptyStore = {
  nextId: 1,
  users: []
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
  return raw.trim() ? JSON.parse(raw) : { ...emptyStore };
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

  static async create(username, email, hashedPassword, otpHash, otpExpiresAt) {
    const store = await readStore();

    const user = {
      id: store.nextId,
      username,
      email,
      password: hashedPassword,
      is_verified: false,
      otp: otpHash,
      otp_expires_at: otpExpiresAt,
      token_version: 0,
      profile_picture: 'default-avatar.png',
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
    user.otp = null;
    user.otp_expires_at = null;
    await writeStore(store);
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
