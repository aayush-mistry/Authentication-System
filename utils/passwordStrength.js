const evaluatePasswordStrength = (password = '') => {
  const checks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    longBonus: password.length > 12
  };

  const baseScore = [
    checks.minLength,
    checks.uppercase,
    checks.lowercase,
    checks.number,
    checks.special
  ].filter(Boolean).length;

  const score = baseScore + (checks.longBonus ? 1 : 0);
  let label = 'Weak';

  if (score >= 6) {
    label = 'Very Strong';
  } else if (score >= 5) {
    label = 'Strong';
  } else if (score >= 3) {
    label = 'Medium';
  }

  return {
    checks,
    score,
    label,
    isAcceptable: baseScore === 5
  };
};

module.exports = { evaluatePasswordStrength };
