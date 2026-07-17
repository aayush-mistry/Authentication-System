const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/email');
const { evaluatePasswordStrength } = require('../utils/passwordStrength');
const { validatePasswordIsNotCommon } = require('../utils/commonPasswordValidator');

// Helper to generate a 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper to generate JWT token and set cookie
const generateTokenAndSetCookie = (res, userId, tokenVersion) => {
  const token = jwt.sign({ id: userId, version: tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  res.cookie('token', token, {
    httpOnly: true, // prevents XSS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check basic email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const passwordStrength = evaluatePasswordStrength(password);
    if (!passwordStrength.isAcceptable) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
    }

    const commonPasswordValidation = validatePasswordIsNotCommon(password);
    if (!commonPasswordValidation.isValid) {
      return res.status(400).json({ message: commonPasswordValidation.message });
    }

    // Check if user exists
    const userByEmail = await User.findByEmail(email);
    if (userByEmail) return res.status(400).json({ message: 'Email already exists' });
    
    const userByUsername = await User.findByUsername(username);
    if (userByUsername) return res.status(400).json({ message: 'Username already exists' });

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate & Hash OTP
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, salt);
    // Expires in 60 seconds
    const otpExpiresAt = new Date(Date.now() + 60 * 1000); 

    // Save User
    const userId = await User.create(username, email, hashedPassword, otpHash, otpExpiresAt);

    // Send OTP via Email
    await sendEmail({
      email,
      subject: 'Verify your email address',
      message: `Your verification OTP is: ${otp}. It expires in 60 seconds.`,
    });

    res.status(201).json({ message: 'Registration successful. Please verify your email.', userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Verify OTP for Registration
// @route   POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.is_verified) return res.status(400).json({ message: 'User already verified' });

    // Check if OTP expired
    if (!user.otp_expires_at || new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP Expired' });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp.toString(), user.otp);
    if (!isMatch) return res.status(400).json({ message: 'Invalid OTP' });

    // Update DB
    await User.verifyUser(user.id);

    res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    const otpExpiresAt = new Date(Date.now() + 60 * 1000);

    await User.updateOTP(user.id, otpHash, otpExpiresAt);

    await sendEmail({
      email,
      subject: 'Your New OTP',
      message: `Your new OTP is: ${otp}. It expires in 60 seconds.`,
    });

    res.status(200).json({ message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { loginId, password } = req.body; // loginId can be email or username

    if (!loginId || !password) return res.status(400).json({ message: 'Please provide credentials' });

    // Check if email or username
    let user = await User.findByEmail(loginId);
    if (!user) {
      user = await User.findByUsername(loginId);
    }

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Check if verified
    if (!user.is_verified) {
      return res.status(401).json({ message: 'Please verify your email before logging in.', requiresVerification: true, email: user.email });
    }

    if (!user.password) {
      return res.status(401).json({ message: `Please continue with ${user.authentication_provider} to access this account.` });
    }

    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate token and set cookie
    generateTokenAndSetCookie(res, user.id, user.token_version);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        authentication_provider: user.authentication_provider,
        profile_picture: user.profile_picture
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Forgot Password (Send OTP)
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    const otpExpiresAt = new Date(Date.now() + 60 * 1000);

    await User.updateOTP(user.id, otpHash, otpExpiresAt);

    await sendEmail({
      email,
      subject: 'Password Reset OTP',
      message: `Your password reset OTP is: ${otp}. It expires in 60 seconds.`,
    });

    res.status(200).json({ message: 'Password reset OTP sent to email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const passwordStrength = evaluatePasswordStrength(newPassword);
    if (!passwordStrength.isAcceptable) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
    }

    const commonPasswordValidation = validatePasswordIsNotCommon(newPassword);
    if (!commonPasswordValidation.isValid) {
      return res.status(400).json({ message: commonPasswordValidation.message });
    }

    const user = await User.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check OTP expiration
    if (!user.otp_expires_at || new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP Expired' });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp.toString(), user.otp);
    if (!isMatch) return res.status(400).json({ message: 'Invalid OTP' });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    await User.updatePassword(user.id, newHashedPassword);

    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
const logout = (req, res) => {
  res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Check if username is available (Phase 3)
// @route   GET /api/auth/check-username
const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Username query required' });

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(200).json({ available: true });
    }

    // Generate suggestions if unavailable
    const year = new Date().getFullYear();
    const suggestions = [
      `${username}123`,
      `${username}${year}`,
      `${username}_dev`,
      `${username}07`
    ];
    res.status(200).json({ available: false, suggestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Check if email is available (Phase 3)
// @route   GET /api/auth/check-email
const checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email query required' });

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(200).json({ available: true });
    }
    
    res.status(200).json({ available: false, message: 'Already Registered' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  register,
  generateTokenAndSetCookie,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  checkUsername,
  checkEmail
};
