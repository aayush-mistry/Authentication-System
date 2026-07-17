const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  register,
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
} = require('../controllers/authController');
const {
  startGoogleAuth,
  handleGoogleCallback
} = require('../controllers/googleAuthController');
const {
  startFacebookAuth,
  handleFacebookCallback
} = require('../controllers/facebookAuthController');
const {
  startLinkedInAuth,
  handleLinkedInCallback
} = require('../controllers/linkedinAuthController');

router.get('/check-username', checkUsername);
router.get('/check-email', checkEmail);
router.get('/google', startGoogleAuth);
router.get('/google/callback', handleGoogleCallback);
router.get('/facebook', startFacebookAuth);
router.get('/facebook/callback', handleFacebookCallback);
router.get('/linkedin', startLinkedInAuth);
router.get('/linkedin/callback', handleLinkedInCallback);
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.get('/me', protect, getMe); // Protected route

module.exports = router;
