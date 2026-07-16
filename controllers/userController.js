const User = require('../models/User');
const bcrypt = require('bcrypt');

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
    
    // In a real production app, changing an email should require re-verification.
    // For this phase, we'll simply update it.
    await User.updateProfile(req.userId, username, email);
    
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
    
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.password) {
      return res.status(400).json({ message: 'Password changes are only available for local accounts.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect current password' });

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // This method increments token_version automatically, logging out other devices
    await User.updatePassword(user.id, hashedNewPassword);

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
