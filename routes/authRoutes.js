const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  checkUsername,
  checkEmail
} = require('../controllers/authController');

router.get('/check-username', checkUsername);
router.get('/check-email', checkEmail);
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.get('/me', protect, getMe); // Protected route

module.exports = router;
