const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getProfile,
  updateProfile,
  changePassword,
  logoutAll,
  deleteAccount
} = require('../controllers/userController');

// All user routes are protected!
router.use(protect);

router.get('/profile', getProfile);
router.put('/update', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout-all', logoutAll);
router.delete('/delete', deleteAccount);

module.exports = router;
