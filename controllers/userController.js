const User = require('../models/User');
const bcrypt = require('bcrypt');
const { createAuditLog } = require('../services/loginSecurityService');
const { buildRequestContext } = require('../utils/requestContext');
const { evaluatePasswordStrength } = require('../utils/passwordStrength');
const { validatePasswordIsNotCommon } = require('../utils/commonPasswordValidator');

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

const validatePasswordPolicy = (password) => {
  const strength = evaluatePasswordStrength(password);
  if (!strength.isAcceptable) return { isValid: false, message: PASSWORD_POLICY_MESSAGE };
  const common = validatePasswordIsNotCommon(password);
  if (!common.isValid) return common;
  return { isValid: true };
};

// @desc    Get user profile
// @route   GET /api/user/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      is_verified: user.is_verified,
      email_verified: user.email_verified,
      authentication_provider: user.authentication_provider,
      provider_id: user.provider_id,
      profile_picture: user.profile_picture,
      created_at: user.created_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update profile (username, email)
// @route   PUT /api/user/update
const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const cleanUsername = String(username || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    }

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // In a real production app, changing an email should require re-verification.
    // For this phase, we'll simply update it.
    const existing = await User.findById(req.userId);
    if (!existing) return res.status(404).json({ message: 'User not found' });

    await User.updateProfile(req.userId, cleanUsername, cleanEmail);
    await createAuditLog({
      userId: req.userId,
      context: buildRequestContext(req),
      eventType: 'Email Changed',
      metadata: { email: cleanEmail }
    });
    
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error(error);
    // Handle MySQL unique constraint errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Username or Email already taken' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Change Password & Logout other devices
// @route   PUT /api/user/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.password) {
      return res.status(400).json({ message: 'Password changes are only available for local accounts.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect current password' });
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ message: 'New password must be different from your current password.' });
    }

    const passwordPolicy = validatePasswordPolicy(newPassword);
    if (!passwordPolicy.isValid) {
      return res.status(400).json({ message: passwordPolicy.message });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // This method increments token_version automatically, logging out other devices
    await User.updatePassword(user.id, hashedNewPassword);
    await createAuditLog({
      userId: req.userId,
      context: buildRequestContext(req),
      eventType: 'Password Changed'
    });

    res.status(200).json({ message: 'Password changed successfully. Other devices logged out.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Logout from all devices (Increment token version)
// @route   POST /api/user/logout-all
const logoutAll = async (req, res) => {
  try {
    await User.incrementTokenVersion(req.userId);
    await createAuditLog({
      userId: req.userId,
      context: buildRequestContext(req),
      eventType: 'Logout All Devices'
    });
    
    // Clear current cookie too
    res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
    
    res.status(200).json({ message: 'Successfully logged out from all devices.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete Account
// @route   DELETE /api/user/delete
const deleteAccount = async (req, res) => {
  try {
    await User.deleteAccount(req.userId);
    await createAuditLog({
      userId: req.userId,
      context: buildRequestContext(req),
      eventType: 'Account Deleted'
    });
    res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  logoutAll,
  deleteAccount
};
