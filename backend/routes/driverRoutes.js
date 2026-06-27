const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const DriverController = require('../controllers/driverController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Multer Config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/drivers/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'driver-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Public routes
router.post('/login', DriverController.login);

// Protected routes
router.post('/upload-profile-image', authenticateToken, upload.single('image'), DriverController.uploadProfileImage);
router.get('/profile', authenticateToken, DriverController.getProfile);
router.get('/stats', authenticateToken, DriverController.getDashboardStats);
router.get('/deliveries', authenticateToken, DriverController.getDeliveries);
router.get('/deliveries/:id', authenticateToken, DriverController.getDeliveryDetails);
router.get('/earnings', authenticateToken, DriverController.getEarnings);
router.get('/transactions', authenticateToken, DriverController.getTransactions);
router.patch('/deliveries/:id/status', authenticateToken, DriverController.updateDeliveryStatus);
router.patch('/deliveries/:id/accept', authenticateToken, DriverController.acceptDelivery);
router.patch('/deliveries/:id/reject', authenticateToken, DriverController.rejectDelivery);
router.patch('/deliveries/:id/pickup', authenticateToken, DriverController.pickupDelivery);
router.patch('/delivery/:id/pickup', authenticateToken, DriverController.pickupDelivery);
router.patch('/deliveries/:id/on-the-way', authenticateToken, DriverController.onTheWayDelivery);
router.patch('/deliveries/:id/delivered', authenticateToken, DriverController.deliveredDelivery);
router.patch('/deliveries/:id/failed', authenticateToken, DriverController.failedDelivery);
router.patch('/deliveries/:id/location', authenticateToken, DriverController.updateLiveLocation);
router.patch('/location', authenticateToken, DriverController.updateLiveLocationGlobal);
router.put('/location', authenticateToken, DriverController.updateLiveLocationGlobal);
router.patch('/deliveries/:id/arrived', authenticateToken, DriverController.markArrived);
router.post('/deliveries/:id/verify-code', authenticateToken, DriverController.verifyCode);
router.post('/deliveries/:id/upload-proof', authenticateToken, DriverController.uploadProof);
router.patch('/online-status', authenticateToken, DriverController.toggleOnlineStatus);

module.exports = router;
