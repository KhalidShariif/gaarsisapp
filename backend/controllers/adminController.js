const AdminModel = require('../models/adminModel');
const NotificationModel = require('../models/notificationModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const crypto = require('crypto');
const { assertEmailConfigured, verifyEmailTransport, sendInitialPassword, sendPasswordReset } = require('../utils/emailService');

class AdminController {
  static async login(req, res) {
    const { email, password } = req.body;

    try {
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const user = await AdminModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid admin credentials.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid admin credentials.' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      // Set user online
      await AdminModel.updateUserOnlineStatus(user.id, true);
      console.log(`DEBUG LOGIN: admin login user id = ${user.id}, is_online updated result = 1, last_seen value = NOW()`);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ message: 'An error occurred during login.' });
    }
  }

  static async logout(req, res) {
    try {
      const adminId = req.user.id;
      await AdminModel.updateUserOnlineStatus(adminId, false);
      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout Error:', error);
      res.status(500).json({ message: 'An error occurred during logout.' });
    }
  }

  static async getDashboard(req, res) {
    try {
      const { period } = req.query;
      const stats = await AdminModel.getDashboardStats(period || 'month');
      res.json(stats);
    } catch (error) {
      console.error('Dashboard Stats Error:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard statistics.' });
    }
  }

  static async getUsers(req, res) {
    try {
      const { role } = req.query;
      const users = await AdminModel.getAllUsers(role);
      res.json(users);
    } catch (error) {
      console.error('Get Users Error:', error);
      res.status(500).json({ message: 'Failed to fetch users.' });
    }
  }

  static async getVendors(req, res) {
    try {
      const vendors = await AdminModel.getAllVendors();
      console.log('DEBUG: Vendor list API response size:', vendors.length);
      res.json(vendors);
    } catch (error) {
      console.error('Get Vendors Error:', error);
      res.status(500).json({ message: 'Failed to fetch vendors.' });
    }
  }

  static async createVendor(req, res) {
    console.log('DEBUG: Admin Creating Vendor', req.body);
    try {
      await verifyEmailTransport();
      const initialPassword = crypto.randomBytes(18).toString('base64url');
      const vendorId = await AdminModel.createVendor({ ...req.body, password: initialPassword });
      console.log('DEBUG: Vendor Created Successfully', { vendorId });
      // Try to send email; fall back gracefully if SMTP not configured
      let emailSent = false;
      try {
        assertEmailConfigured();
        await sendInitialPassword({ email: req.body.email, name: req.body.business_name, password: initialPassword });
        emailSent = true;
      } catch (emailErr) {
        console.warn('[WARN] SMTP not configured — initial password logged below:');
        console.warn(`[VENDOR EMAIL] Initial-password delivery failed for vendor ${vendorId}.`);
      }
      res.status(201).json({
        message: 'Vendor created successfully',
        vendorId,
        initialPassword: undefined,
        emailSent
      });
    } catch (error) {
      console.error('Create Vendor Error:', error);
      res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Failed to create vendor.' });
    }
  }

  static async getVendorById(req, res) {
    try {
      const vendor = await AdminModel.getVendorById(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      res.json(vendor);
    } catch (error) {
      console.error('Get Vendor By Id Error:', error);
      res.status(500).json({ message: 'Failed to fetch vendor.' });
    }
  }

  static async updateVendor(req, res) {
    try {
      const success = await AdminModel.updateVendor(req.params.id, req.body);
      if (success) {
        res.json({ message: 'Vendor updated successfully.' });
      } else {
        res.status(404).json({ message: 'Vendor not found.' });
      }
    } catch (error) {
      console.error('Update Vendor Error:', error);
      res.status(500).json({ message: 'Failed to update vendor.' });
    }
  }

  static async deleteVendor(req, res) {
    try {
      const deleted = await AdminModel.deleteVendor(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Vendor not found.' });
      res.json({ message: 'Vendor safely deactivated.' });
    } catch (error) {
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to delete vendor.' });
    }
  }

  static async resetVendorPassword(req, res) {
    try {
      const vendorId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({ message: 'Invalid vendor id.' });
      }

      const [vendors] = await db.query(
        `SELECT id, user_id, email, business_name, name
         FROM vendors
         WHERE id = ?
         LIMIT 1`,
        [vendorId]
      );
      if (vendors.length === 0) {
        return res.status(404).json({ message: 'Vendor not found.' });
      }

      const vendor = vendors[0];
      if (!vendor.email) {
        return res.status(400).json({ message: 'Vendor does not have an email address.' });
      }

      const temporaryPassword = crypto.randomBytes(9).toString('base64url');
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      await db.query('UPDATE vendors SET password = ? WHERE id = ?', [passwordHash, vendorId]);
      if (vendor.user_id) {
        await db.query(
          'UPDATE users SET password_hash = ?, must_change_password = 1, password_changed_at = NULL WHERE id = ?',
          [passwordHash, vendor.user_id]
        ).catch(() => {});
      } else {
        await db.query(
          'UPDATE users SET password_hash = ?, must_change_password = 1, password_changed_at = NULL WHERE LOWER(email) = ?',
          [passwordHash, String(vendor.email).toLowerCase()]
        ).catch(() => {});
      }

      let emailSent = false;
      try {
        await sendPasswordReset({
          email: vendor.email,
          name: vendor.business_name || vendor.name || 'Vendor',
          password: temporaryPassword,
        });
        emailSent = true;
      } catch (emailError) {
        console.warn('[ADMIN VENDOR RESET] Email delivery failed:', emailError.message);
      }

      res.json({
        message: emailSent
          ? 'Vendor password reset and emailed successfully.'
          : 'Vendor password reset. Email is not configured, share the temporary password manually.',
        emailSent,
        temporaryPassword: emailSent ? undefined : temporaryPassword,
      });
    } catch (error) {
      console.error('Reset Vendor Password Error:', error);
      res.status(500).json({ message: 'Failed to reset vendor password.' });
    }
  }

  static async getDrivers(req, res) {
    try {
      const drivers = await AdminModel.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      console.error('Get Drivers Error:', error);
      res.status(500).json({ message: 'Failed to fetch drivers.' });
    }
  }

  static async getDriverById(req, res) {
    try {
      const driver = await AdminModel.getDriverById(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      res.json(driver);
    } catch (error) {
      console.error('Get Driver By Id Error:', error);
      res.status(500).json({ message: 'Failed to fetch driver.' });
    }
  }

  static async createDriver(req, res) {
    console.log('DEBUG: Admin Creating Driver', req.body);
    try {
      await verifyEmailTransport();
      const initialPassword = crypto.randomBytes(18).toString('base64url');
      const driverId = await AdminModel.createDriver({ ...req.body, password: initialPassword });
      console.log('DEBUG: Driver Created Successfully', { driverId });
      let emailSent = false;
      try {
        assertEmailConfigured();
        await sendInitialPassword({ email: req.body.email, name: req.body.full_name, password: initialPassword });
        emailSent = true;
      } catch (emailErr) {
        console.warn('[WARN] SMTP not configured — initial password logged below:');
        console.warn(`[DRIVER EMAIL] Initial-password delivery failed for driver ${driverId}.`);
      }
      res.status(201).json({
        message: 'Driver created successfully',
        driverId,
        initialPassword: undefined,
        emailSent
      });
    } catch (error) {
      console.error('Create Driver Error:', error);
      res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Failed to create driver.' });
    }
  }

  static async updateDriver(req, res) {
    try {
      const success = await AdminModel.updateDriver(req.params.id, req.body);
      if (success) {
        res.json({ message: 'Driver updated successfully.' });
      } else {
        res.status(404).json({ message: 'Driver not found.' });
      }
    } catch (error) {
      console.error('Update Driver Error:', error);
      res.status(500).json({ message: 'Failed to update driver.' });
    }
  }
  static async deleteDriver(req, res) {
    try {
      const success = await AdminModel.deleteDriver(req.params.id);
      if (!success) return res.status(404).json({ message: 'Driver not found.' });
      res.json({ message: 'Driver safely deactivated.' });
    } catch (error) {
      console.error('Delete Driver Error:', error);
      res.status(error.statusCode || 500).json({ message: error.message || 'Failed to delete driver.' });
    }
  }
  static async getOrders(req, res) {
    try {
      const orders = await AdminModel.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error('Get Orders Error:', error);
      res.status(500).json({ message: 'Failed to fetch orders.' });
    }
  }

  static async getProducts(req, res) {
    try {
      const products = await AdminModel.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error('Get Products Error:', error);
      res.status(500).json({ message: 'Failed to fetch products.' });
    }
  }

  static async updateProduct(req, res) {
    const { id } = req.params;
    try {
      const success = await AdminModel.updateProduct(id, req.body);
      if (success) {
        res.json({ success: true, message: 'Product updated successfully.' });
      } else {
        res.status(404).json({ success: false, message: 'Product not found.' });
      }
    } catch (error) {
      console.error('Admin Update Product Error:', error);
      if (error.message && error.message.includes('greater than zero')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Failed to update product.' });
    }
  }

  static async getInventory(req, res) {
    try {
      const inventory = await AdminModel.getInventory();
      res.json(inventory);
    } catch (error) {
      console.error('Get Inventory Error:', error);
      res.status(500).json({ message: 'Failed to fetch inventory.' });
    }
  }

  static async getPayments(req, res) {
    try {
      const payments = await AdminModel.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error('Get Payments Error:', error);
      res.status(500).json({ message: 'Failed to fetch payments.' });
    }
  }

  static async updateUserStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const success = await AdminModel.updateUserStatus(id, status);
      if (success) {
        res.json({ message: 'User status updated successfully.' });
      } else {
        res.status(404).json({ message: 'User not found.' });
      }
    } catch (error) {
      console.error('Update User Status Error:', error);
      res.status(500).json({ message: 'Failed to update user status.' });
    }
  }

  static async deleteUser(req, res) {
    const { id } = req.params;
    const adminId = req.user.id; // From auth middleware

    console.log(`DEBUG: Admin ${adminId} attempting to delete User ${id}`);

    try {
      if (parseInt(id) === parseInt(adminId)) {
        return res.status(400).json({ message: 'You cannot delete your own admin account.' });
      }

      const result = await AdminModel.deleteUser(id);
      
      console.log(`DEBUG: Delete Result for User ${id}:`, result);

      if (result.success) {
        res.json({ 
          message: `User ${result.type === 'soft' ? 'soft-deleted' : 'permanently deleted'} successfully.`,
          type: result.type 
        });
      } else {
        res.status(404).json({ message: 'User not found or already deleted.' });
      }
    } catch (error) {
      console.error('DELETE USER ERROR:', error);
      res.status(500).json({ 
        message: 'Internal server error during delete.',
        error: error.message,
        sqlState: error.sqlState
      });
    }
  }

  static async verifyVendor(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const success = await AdminModel.verifyVendor(id, status);
      if (success) {
        res.json({ message: 'Vendor verification updated.' });
      } else {
        res.status(404).json({ message: 'Vendor not found.' });
      }
    } catch (error) {
      console.error('Verify Vendor Error:', error);
      res.status(500).json({ message: 'Failed to update vendor verification.' });
    }
  }

  static async updateOrderStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const success = await AdminModel.updateOrderStatus(id, status);
      if (success) {
        res.json({ message: 'Order status updated.' });
      } else {
        res.status(404).json({ message: 'Order not found.' });
      }
    } catch (error) {
      console.error('Update Order Status Error:', error);
      res.status(500).json({ message: 'Failed to update order status.' });
    }
  }

  static async assignOrderDriver(req, res) {
    const { id } = req.params;
    const { driverId } = req.body;
    try {
      const success = await AdminModel.assignOrderDriver(id, driverId);
      if (success) {
        res.json({ message: 'Driver assigned to order.' });
      } else {
        res.status(404).json({ message: 'Order not found.' });
      }
    } catch (error) {
      console.error('Assign Driver Error:', error);
      res.status(500).json({ message: 'Failed to assign driver.' });
    }
  }

  static async createUser(req, res) {
    const { username, email, role, phone } = req.body;
    console.log('DEBUG: Admin Creating User', { username, email, role });
    try {
      await verifyEmailTransport();
      const initialPassword = crypto.randomBytes(18).toString('base64url');
      const password_hash = await bcrypt.hash(initialPassword, 12);
      const userId = await AdminModel.createUser({
        username,
        email,
        password_hash,
        role: role || 'customer',
        phone
      });
      console.log('DEBUG: User Created Successfully', { userId });
      let emailSent = false;
      try {
        assertEmailConfigured();
        await sendInitialPassword({ email, name: username, password: initialPassword });
        emailSent = true;
      } catch (emailErr) {
        console.warn('[WARN] SMTP not configured — initial password logged below:');
        console.warn(`[USER EMAIL] Initial-password delivery failed for user ${userId}.`);
      }
      res.status(201).json({
        message: 'User created successfully',
        userId,
        initialPassword: undefined,
        emailSent
      });
    } catch (error) {
      console.error('Create User Error:', error);
      res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Failed to create user.' });
    }
  }

  static async getSettings(req, res) {
    try {
      const settings = await AdminModel.getSettings();
      res.json(settings);
    } catch (error) {
      console.error('Get Settings Error:', error);
      res.status(500).json({ message: 'Failed to fetch settings.' });
    }
  }

  static async updateSettings(req, res) {
    const { settings } = req.body; // Expecting an object { key1: value1, key2: value2 }
    try {
      for (const [key, value] of Object.entries(settings)) {
        await AdminModel.updateSetting(key, value);
      }
      res.json({ message: 'Settings updated successfully.' });
    } catch (error) {
      console.error('Update Settings Error:', error);
      res.status(500).json({ message: 'Failed to update settings.' });
    }
  }

  static async search(req, res) {
    const { q } = req.query;
    try {
      const results = await AdminModel.globalSearch(q);
      res.json(results);
    } catch (error) {
      console.error('Search Error:', error);
      res.status(500).json({ message: 'Search failed.' });
    }
  }

  static async getDriverLocations(req, res) {
    try {
      const locations = await AdminModel.getDriverLocations();
      res.json(locations);
    } catch (error) {
      console.error('Driver Locations Error:', error);
      res.status(500).json({ message: 'Failed to fetch driver locations.' });
    }
  }
  static async getCommissions(req, res) {
    try {
      const commissions = await AdminModel.getCommissions();
      res.json(commissions);
    } catch (error) {
      console.error('Get Commissions Error:', error);
      res.status(500).json({ message: 'Failed to fetch commissions.' });
    }
  }

  static async getCommissionsSummary(req, res) {
    try {
      const summary = await AdminModel.getCommissionsSummary();
      res.json(summary);
    } catch (error) {
      console.error('Get Commissions Summary Error:', error);
      res.status(500).json({ message: 'Failed to fetch commissions summary.' });
    }
  }

  static async getVendorCommissions(req, res) {
    const { vendorId } = req.params;
    try {
      const commissions = await AdminModel.getVendorCommissions(vendorId);
      res.json(commissions);
    } catch (error) {
      console.error('Get Vendor Commissions Error:', error);
      res.status(500).json({ message: 'Failed to fetch vendor commissions.' });
    }
  }

  static async reconcilePayments(req, res) {
    try {
      const result = await AdminModel.reconcilePayments();
      res.json({
        success: true,
        message: result.message,
        payments_updated: result.payments_updated,
        commissions_settled: result.commissions_settled
      });
    } catch (error) {
      console.error('Reconcile Payments Error:', error);
      res.status(500).json({ message: 'Failed to reconcile payments.' });
    }
  }

  static async getOrderRejections(req, res) {
    try {
      const DriverModel = require('../models/driverModel');
      const rejections = await DriverModel.getRejectionHistory(req.params.id);
      res.json({ success: true, orderId: Number(req.params.id), rejections });
    } catch (error) {
      console.error('Admin Get Order Rejections Error:', error);
      res.status(500).json({ message: 'Failed to fetch rejection history' });
    }
  }

  // --- Notifications ---
  static async getNotifications(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const notifications = await NotificationModel.getAdminNotifications(limit);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  }

  static async markNotificationRead(req, res) {
    try {
      const { id } = req.params;
      const success = await NotificationModel.markAsRead(id);
      if (success) {
        res.json({ success: true, message: 'Notification marked as read' });
      } else {
        res.status(404).json({ message: 'Notification not found' });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to update notification' });
    }
  }

  static async markAllNotificationsRead(req, res) {
    try {
      const count = await NotificationModel.markAllAsRead();
      res.json({ success: true, message: `${count} notifications marked as read`, count });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Failed to update notifications' });
    }
  }

  static async getNotificationLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 100;
      const logs = await NotificationModel.getNotificationLogs(limit);
      res.json({ success: true, logs });
    } catch (error) {
      console.error('Error fetching notification logs:', error);
      res.status(500).json({ message: 'Failed to fetch notification logs' });
    }
  }

  // ─── DELIVERY ZONES OVERSIGHT ──────────────────────────────────────────────

  static async getAllDeliveryZones(req, res) {
    try {
      const [zones] = await db.query(`
        SELECT z.*, v.business_name as vendor_name 
        FROM vendor_delivery_zones z
        JOIN vendors v ON z.vendor_id = v.id
        ORDER BY v.business_name ASC, z.zone_name ASC
      `);
      res.json(zones);
    } catch (error) {
      console.error('[ADMIN] Get All Delivery Zones Error:', error);
      res.status(500).json({ message: 'Failed to fetch all delivery zones' });
    }
  }

  static async updateDeliveryZone(req, res) {
    const zoneId = req.params.id;
    const { delivery_fee, estimated_time, is_active } = req.body;

    const fee = parseFloat(delivery_fee);
    if (isNaN(fee) || fee < 0) {
      return res.status(400).json({ message: 'Delivery fee must be a valid number greater than or equal to 0.' });
    }

    const estTime = estimated_time || '25 mins';
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    try {
      await db.query(
        'UPDATE vendor_delivery_zones SET delivery_fee = ?, estimated_time = ?, is_active = ? WHERE id = ?',
        [fee, estTime, active, zoneId]
      );
      res.json({ message: 'Delivery zone updated successfully.' });
    } catch (error) {
      console.error('[ADMIN] Update Delivery Zone Error:', error);
      res.status(500).json({ message: 'Failed to update delivery zone' });
    }
  }

  static async deleteDeliveryZone(req, res) {
    const zoneId = req.params.id;
    try {
      await db.query('DELETE FROM vendor_delivery_zones WHERE id = ?', [zoneId]);
      res.json({ message: 'Delivery zone deleted successfully.' });
    } catch (error) {
      console.error('[ADMIN] Delete Delivery Zone Error:', error);
      res.status(500).json({ message: 'Failed to delete delivery zone' });
    }
  }
}

module.exports = AdminController;
