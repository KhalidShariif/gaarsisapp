const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// POST /api/payment/hurmood/create - requires customer to be authenticated
router.post('/hurmood/create', authenticateToken, PaymentController.createPaymentRequest);

// POST /api/payment/hurmood/callback - public payment provider webhook (no auth)
router.post('/hurmood/callback', PaymentController.handlePaymentCallback);

// GET /api/payment/status/:transactionId - requires authentication to check status
router.get('/status/:transactionId', authenticateToken, PaymentController.getPaymentStatus);

module.exports = router;
