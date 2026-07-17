const fs = require('fs');
const path = require('path');

const commonPasswordsPath = path.join(__dirname, '..', 'public', 'data', 'commonPasswords.json');
const COMMON_PASSWORD_MESSAGE = 'This password is too common and can be easily guessed. Please choose a stronger password.';

const normalizePassword = (password = '') => String(password).trim().toLowerCase();

const loadCommonPasswords = () => {
  const raw = fs.readFileSync(commonPasswordsPath, 'utf8');
  return new Set(JSON.parse(raw).map(normalizePassword));
};

const commonPasswords = loadCommonPasswords();

const isCommonPassword = (password = '') => {
  return commonPasswords.has(normalizePassword(password));
};

const validatePasswordIsNotCommon = (password = '') => {
  if (!isCommonPassword(password)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    message: COMMON_PASSWORD_MESSAGE
  };
};

module.exports = {
  COMMON_PASSWORD_MESSAGE,
  isCommonPassword,
  validatePasswordIsNotCommon
};
