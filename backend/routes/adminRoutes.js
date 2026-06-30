const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticateToken, authorizeAdmin } = require('../middlewares/authMiddleware');

// Public Routes
router.post('/login', AdminController.login);

// Protected Admin Routes
router.use(authenticateToken);
router.use(authorizeAdmin);

router.get('/dashboard', AdminController.getDashboard);
router.get('/stats', AdminController.getDashboard);
router.get('/users', AdminController.getUsers);
router.delete('/users/:id', AdminController.deleteUser);
router.post('/logout', AdminController.logout);
router.get('/vendors', AdminController.getVendors);
router.post('/vendors', AdminController.createVendor);
router.get('/vendors/:id', AdminController.getVendorById);
router.put('/vendors/:id', AdminController.updateVendor);
router.delete('/vendors/:id', AdminController.deleteVendor);
router.post('/vendors/:id/reset-password', AdminController.resetVendorPassword);

router.get('/drivers', AdminController.getDrivers);
router.post('/drivers', AdminController.createDriver);
router.get('/drivers/:id', AdminController.getDriverById);
router.put('/drivers/:id', AdminController.updateDriver);
router.delete('/drivers/:id', AdminController.deleteDriver);

router.get('/orders', AdminController.getOrders);
router.get('/products', AdminController.getProducts);
router.put('/products/:id', AdminController.updateProduct);
router.get('/inventory', AdminController.getInventory);
router.get('/payments', AdminController.getPayments);
router.post('/payments/reconcile', AdminController.reconcilePayments);
router.patch('/users/:id/status', AdminController.updateUserStatus);
router.patch('/vendors/:id/verify', AdminController.verifyVendor);
router.patch('/orders/:id/status', AdminController.updateOrderStatus);
router.patch('/orders/:id/assign', AdminController.assignOrderDriver);
router.get('/orders/:id/rejections', AdminController.getOrderRejections);
router.post('/users', AdminController.createUser);
router.get('/settings', AdminController.getSettings);
router.post('/settings', AdminController.updateSettings);
router.get('/search', AdminController.search);
router.get('/driver-locations', AdminController.getDriverLocations);
router.get('/commissions', AdminController.getCommissions);
router.get('/commissions/summary', AdminController.getCommissionsSummary);
router.get('/vendors/:vendorId/commissions', AdminController.getVendorCommissions);

// Notifications
router.get('/notifications', AdminController.getNotifications);
router.get('/notification-logs', AdminController.getNotificationLogs);
router.patch('/notifications/:id/read', AdminController.markNotificationRead);
router.post('/notifications/mark-all-read', AdminController.markAllNotificationsRead);

// Delivery Zones Oversight
router.get('/delivery-zones', AdminController.getAllDeliveryZones);
router.put('/delivery-zones/:id', AdminController.updateDeliveryZone);
router.delete('/delivery-zones/:id', AdminController.deleteDeliveryZone);

module.exports = router;
