const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getDevices,
  trustDevice,
  renameDevice,
  removeDevice,
  logoutDevice,
  getLoginActivity,
  deleteLoginHistory,
  getSecurityDashboard,
  emailAction
} = require('../controllers/securityController');

router.get('/email-action/:token/:action', emailAction);

router.use(protect);

router.get('/dashboard', getSecurityDashboard);
router.get('/devices', getDevices);
router.patch('/devices/:deviceId/trust', trustDevice);
router.patch('/devices/:deviceId/rename', renameDevice);
router.post('/devices/:deviceId/logout', logoutDevice);
router.delete('/devices/:deviceId', removeDevice);
router.get('/activity', getLoginActivity);
router.delete('/activity/:loginId', deleteLoginHistory);

module.exports = router;
