const express = require('express');
const router = express.Router();
const VendorController = require('../controllers/vendorController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only JPEG, JPG, PNG and WebP images are allowed'));
  }
});

const fs = require('fs');
fs.mkdirSync('uploads/vendor-logos/', { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/vendor-logos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadLogo = multer({ 
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only JPEG, JPG, PNG and WebP images are allowed'));
  }
});

router.get('/products', authenticateToken, VendorController.getProducts);
router.post('/products', authenticateToken, upload.single('image'), VendorController.createProduct);
router.put('/products/:id', authenticateToken, upload.single('image'), VendorController.updateProduct);
router.delete('/products/:id', authenticateToken, VendorController.deleteProduct);
router.get('/categories', VendorController.getCategories);
router.get('/orders', authenticateToken, VendorController.getOrders);
router.get('/stats', authenticateToken, VendorController.getDashboardStats);
router.get('/notifications', authenticateToken, VendorController.getNotifications);
router.patch('/notifications/:id/read', authenticateToken, VendorController.markNotificationRead);
router.patch('/orders/:id/accept', authenticateToken, VendorController.acceptOrder);
router.put('/orders/:id/status', authenticateToken, VendorController.updateOrderStatus);
router.get('/suppliers', authenticateToken, VendorController.getSuppliers);
router.post('/suppliers', authenticateToken, VendorController.createSupplier);
router.delete('/suppliers/:id', authenticateToken, VendorController.deleteSupplier);
router.get('/purchases', authenticateToken, VendorController.getPurchases);
router.get('/inventory', authenticateToken, VendorController.getInventory);
router.get('/deliveries/tracking', authenticateToken, VendorController.getDeliveriesTracking);
router.get('/deliveries', authenticateToken, VendorController.getDeliveries);
router.get('/reports/daily', authenticateToken, VendorController.getDailyReport);
router.get('/reports/weekly', authenticateToken, VendorController.getWeeklyReport);
router.get('/reports/monthly', authenticateToken, VendorController.getMonthlyReport);
router.get('/reports', authenticateToken, VendorController.getReports);
router.get('/reviews', authenticateToken, VendorController.getReviews);
router.get('/offers', authenticateToken, VendorController.getOffers);
router.post('/offers', authenticateToken, VendorController.createOffer);
router.put('/offers/:id', authenticateToken, VendorController.updateOffer);
router.delete('/offers/:id', authenticateToken, VendorController.deleteOffer);
router.post('/purchase', authenticateToken, VendorController.createPurchase);
router.post('/login', VendorController.login);
router.post('/forgot-password', VendorController.forgotPassword);
router.post('/register', VendorController.register);
router.get('/profile', authenticateToken, VendorController.getProfile);
router.put('/profile/:vendorId', authenticateToken, VendorController.updateProfile);
router.get('/settings', authenticateToken, VendorController.getSettings);
router.put('/settings', authenticateToken, VendorController.updateSettings);
router.put('/security/password', authenticateToken, VendorController.updatePassword);

router.post('/upload-logo', authenticateToken, uploadLogo.single('logo'), VendorController.uploadLogo);

// Driver management
router.get('/drivers', authenticateToken, VendorController.getDrivers);
router.post('/drivers', authenticateToken, VendorController.createDriver);
router.post('/orders/:orderId/assign-driver', authenticateToken, VendorController.assignDriver);
router.get('/orders/:orderId/rejections', authenticateToken, VendorController.getOrderRejections);
router.get('/sales/summary', authenticateToken, VendorController.getSalesSummary);
router.get('/commissions', authenticateToken, VendorController.getCommissions);
router.get('/lpg-monitoring', authenticateToken, VendorController.getLpgMonitoring);
router.put('/lpg-monitoring/customers/:customerId', authenticateToken, VendorController.updateCustomerLpgLevel);

// Delivery Zones
router.post('/delivery-zones', authenticateToken, VendorController.createDeliveryZone);
router.get('/delivery-zones', authenticateToken, VendorController.getDeliveryZones);
router.put('/delivery-zones/:id', authenticateToken, VendorController.updateDeliveryZone);
router.delete('/delivery-zones/:id', authenticateToken, VendorController.deleteDeliveryZone);

module.exports = router;
