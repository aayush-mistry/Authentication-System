const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/email');
const { evaluatePasswordStrength } = require('../utils/passwordStrength');
const { validatePasswordIsNotCommon } = require('../utils/commonPasswordValidator');
const {
  recordFailedLogin,
  handleSuccessfulLogin,
  verifyChallenge,
  createAuditLog
} = require('../services/loginSecurityService');
const { buildRequestContext } = require('../utils/requestContext');

// Helper to generate a 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

const validatePasswordPolicy = (password) => {
  const passwordStrength = evaluatePasswordStrength(password);
  if (!passwordStrength.isAcceptable) {
    return { isValid: false, message: PASSWORD_POLICY_MESSAGE };
  }

  const commonPasswordValidation = validatePasswordIsNotCommon(password);
  if (!commonPasswordValidation.isValid) {
    return commonPasswordValidation;
  }

  return { isValid: true };
};

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
    const cleanUsername = String(username || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check basic email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.isValid) {
      return res.status(400).json({ message: passwordPolicy.message });
    }

    // Check if user exists
    const userByEmail = await User.findByEmail(cleanEmail);
    if (userByEmail) return res.status(400).json({ message: 'Email already exists' });
    
    const userByUsername = await User.findByUsername(cleanUsername);
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
    const userId = await User.create(cleanUsername, cleanEmail, hashedPassword, otpHash, otpExpiresAt);

    // Send OTP via Email. Roll the local insert back if delivery fails.
    try {
      await sendEmail({
        email: cleanEmail,
        subject: 'Verify your email address',
        message: `Your verification OTP is: ${otp}. It expires in 60 seconds.`,
      });
    } catch (emailError) {
      await User.deleteAccount(userId);
      throw emailError;
    }

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
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
    
    const user = await User.findByEmail(String(email).trim().toLowerCase());
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
    await createAuditLog({
      userId: user.id,
      context: buildRequestContext(req),
      eventType: 'OTP Verification'
    });

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
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findByEmail(String(email).trim().toLowerCase());
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    const otpExpiresAt = new Date(Date.now() + 60 * 1000);

    await User.updateOTP(user.id, otpHash, otpExpiresAt);

    await sendEmail({
      email: user.email,
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
    const cleanLoginId = String(loginId || '').trim();

    if (!cleanLoginId || !password) return res.status(400).json({ message: 'Please provide credentials' });

    // Check if email or username
    let user = await User.findByEmail(cleanLoginId);
    if (!user) {
      user = await User.findByUsername(cleanLoginId);
    }

    if (!user) {
      await recordFailedLogin({ req, method: 'Password', reason: 'Unknown account' });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if verified
    if (!user.is_verified) {
      await recordFailedLogin({ req, userId: user.id, method: 'Password', reason: 'Email not verified' });
      return res.status(401).json({ message: 'Please verify your email before logging in.', requiresVerification: true, email: user.email });
    }

    if (!user.password) {
      await recordFailedLogin({ req, userId: user.id, method: 'Password', reason: 'Provider account used password login' });
      return res.status(401).json({ message: `Please continue with ${user.authentication_provider} to access this account.` });
    }

    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordFailedLogin({ req, userId: user.id, method: 'Password', reason: 'Invalid password' });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const security = await handleSuccessfulLogin({ req, user, method: 'Password', deferSession: true });
    if (security.requiresAdditionalVerification) {
      return res.status(202).json({
        message: 'Additional verification required for this login.',
        requiresAdditionalVerification: true,
        challengeId: security.challenge.id,
        risk: security.risk
      });
    }

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
      },
      security: {
        risk: security.risk,
        notice: security.notice
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Verify risk-based login OTP
// @route   POST /api/auth/verify-login-otp
const verifyLoginOtp = async (req, res) => {
  try {
    const { challengeId, otp } = req.body;
    if (!challengeId || !otp) {
      return res.status(400).json({ message: 'Verification code is required.' });
    }

    const result = await verifyChallenge({ challengeId, otp });
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    const user = await User.findById(result.challenge.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    generateTokenAndSetCookie(res, user.id, user.token_version);
    res.status(200).json({ message: 'Login verified successfully.' });
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
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findByEmail(String(email).trim().toLowerCase());
    if (!user) {
      return res.status(200).json({ message: 'If an account exists, a password reset OTP has been sent.' });
    }

    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    const otpExpiresAt = new Date(Date.now() + 60 * 1000);

    await User.updateOTP(user.id, otpHash, otpExpiresAt);

    await sendEmail({
      email: user.email,
      subject: 'Password Reset OTP',
      message: `Your password reset OTP is: ${otp}. It expires in 60 seconds.`,
    });

    res.status(200).json({ message: 'If an account exists, a password reset OTP has been sent.' });
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
    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const passwordPolicy = validatePasswordPolicy(newPassword);
    if (!passwordPolicy.isValid) {
      return res.status(400).json({ message: passwordPolicy.message });
    }

    const user = await User.findByEmail(String(email).trim().toLowerCase());
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.password && await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ message: 'New password must be different from your current password.' });
    }

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
    await createAuditLog({
      userId: user.id,
      context: buildRequestContext(req),
      eventType: 'Password Reset'
    });

    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await createAuditLog({
      userId: req.userId || null,
      context: buildRequestContext(req),
      eventType: 'Logout'
    });
  } catch (error) {
    console.error(error);
  }
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
  verifyLoginOtp,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  checkUsername,
  checkEmail
};
