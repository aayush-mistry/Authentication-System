const COMMON_PASSWORD_MESSAGE = 'This password is too common and can be easily guessed. Please choose a stronger password.';

const fallbackCommonPasswords = [
  '123456',
  '12345678',
  '123456789',
  'password',
  'password123',
  'admin',
  'admin123',
  'administrator',
  'qwerty',
  'qwerty123',
  'abc123',
  'welcome',
  'letmein',
  'football',
  'monkey',
  'dragon',
  'baseball',
  'login',
  'master',
  'hello123',
  'iloveyou',
  '111111',
  '000000',
  'pass@123',
  'test123'
];

const normalizeCommonPassword = (password = '') => String(password).trim().toLowerCase();

const passwordPolicyState = {
  commonPasswords: new Set(fallbackCommonPasswords.map(normalizeCommonPassword)),
  loaded: false
};

const loadCommonPasswordList = async () => {
  if (passwordPolicyState.loaded) return passwordPolicyState.commonPasswords;

  try {
    const response = await fetch('/data/commonPasswords.json', { cache: 'force-cache' });
    if (response.ok) {
      const passwords = await response.json();
      passwordPolicyState.commonPasswords = new Set(passwords.map(normalizeCommonPassword));
    }
  } catch (error) {
    console.warn('Using fallback common password list.');
  } finally {
    passwordPolicyState.loaded = true;
  }

  return passwordPolicyState.commonPasswords;
};

const isCommonPassword = (password = '') => {
  return passwordPolicyState.commonPasswords.has(normalizeCommonPassword(password));
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

const generateSecurePassword = (length = 14) => {
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

const createPasswordSuggestionRow = (suggestion, targetInput) => {
  const row = document.createElement('div');
  row.className = 'password-suggestion';

  const value = document.createElement('code');
  value.textContent = suggestion;

  const useButton = document.createElement('button');
  useButton.type = 'button';
  useButton.className = 'use-password-btn';
  useButton.textContent = 'Use';
  useButton.addEventListener('click', () => {
    targetInput.value = suggestion;
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.focus();
  });

  row.append(value, useButton);
  return row;
};

const renderSecurePasswordSuggestions = (container, targetInput) => {
  if (!container || !targetInput) return;

  container.innerHTML = '';
  Array.from({ length: 3 }, () => generateSecurePassword()).forEach((suggestion) => {
    container.appendChild(createPasswordSuggestionRow(suggestion, targetInput));
  });
};

const setCommonPasswordWarning = ({ passwordInput, warningBox, suggestionsContainer }) => {
  if (!passwordInput || !warningBox) return false;

  const isCommon = Boolean(passwordInput.value) && isCommonPassword(passwordInput.value);
  warningBox.style.display = isCommon ? 'block' : 'none';

  if (isCommon) {
    renderSecurePasswordSuggestions(suggestionsContainer, passwordInput);
  }

  return isCommon;
};

window.passwordPolicy = {
  COMMON_PASSWORD_MESSAGE,
  loadCommonPasswordList,
  isCommonPassword,
  setCommonPasswordWarning,
  renderSecurePasswordSuggestions,
  generateSecurePassword
};
