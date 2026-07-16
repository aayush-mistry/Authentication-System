const crypto = require('crypto');

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

const getStateSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required to sign OAuth state');
  }
  return process.env.JWT_SECRET;
};

const sign = (value) => {
  return crypto.createHmac('sha256', getStateSecret()).update(value).digest('hex');
};

const createOAuthState = () => {
  const nonce = crypto.randomBytes(24).toString('hex');
  const payload = `${nonce}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
};

const verifyOAuthState = (stateFromQuery, stateFromCookie) => {
  if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
    return false;
  }

  const parts = stateFromQuery.split('.');
  if (parts.length !== 3) return false;

  const [nonce, issuedAt, signature] = parts;
  const payload = `${nonce}.${issuedAt}`;
  const expected = sign(payload);

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  return Date.now() - Number(issuedAt) <= STATE_MAX_AGE_MS;
};

module.exports = {
  createOAuthState,
  verifyOAuthState,
  STATE_MAX_AGE_MS
};
