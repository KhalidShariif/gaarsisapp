const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/login', AuthController.login);
router.get('/google/config', AuthController.googleConfig);
router.post('/google', AuthController.googleLogin);
router.post('/logout', authenticateToken, AuthController.logout);
router.patch('/heartbeat', authenticateToken, AuthController.heartbeat);
router.put('/change-password', authenticateToken, AuthController.changePassword);

module.exports = router;
