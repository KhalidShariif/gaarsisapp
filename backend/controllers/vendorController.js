const VendorModel = require('../models/vendorModel');
const NotificationModel = require('../models/notificationModel');
const CustomerModel = require('../models/customerModel');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class VendorController {

  /**
   * Resolves the correct vendors.id from the JWT.
   * The vendor login JWT stores vendors.id directly as req.user.id (NOT users.id).
   * So we can use req.user.id directly. We only do a user_id lookup as a fallback
   * in case the token was issued with a users.id instead.
   */
  static async resolveVendorId(req) {
    const tokenId = req.user?.id;
    const queryId = req.query.vendorId;

    console.log(`[VENDOR] resolveVendorId - token id: ${tokenId}, query vendorId: ${queryId}, role: ${req.user?.role}`);

    // The vendor JWT is signed with vendor.id directly, so tokenId IS the vendor_id.
    // Verify it exists in vendors table to be safe.
    if (tokenId) {
      const [direct] = await db.query('SELECT id FROM vendors WHERE id = ?', [tokenId]);
      if (direct.length > 0) {
        console.log(`[VENDOR] Resolved vendor_id=${tokenId} directly from token`);
        return tokenId;
      }

      // Fallback: maybe token has users.id — try looking up via user_id
      const [byUser] = await db.query('SELECT id FROM vendors WHERE user_id = ?', [tokenId]);
      if (byUser.length > 0) {
        console.log(`[VENDOR] Resolved vendor_id=${byUser[0].id} from user_id lookup`);
        return byUser[0].id;
      }
    }

    // Last resort: query param
    if (queryId) {
      console.log(`[VENDOR] Using query param vendorId=${queryId}`);
      return Number(queryId);
    }

    console.warn('[VENDOR] Could not resolve vendor_id');
    const err = new Error('Unauthorized: Vendor ID could not be resolved.');
    err.statusCode = 401;
    throw err;
  }

  // ─── PRODUCTS ────────────────────────────────────────────────────────────────

  static async getProducts(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getProducts - vendor_id=${vendorId}`);
    try {
      const products = await VendorModel.getProducts(vendorId);
      console.log(`[VENDOR] getProducts - found ${products.length} products`);
      res.json(products);
    } catch (error) {
      console.error('Vendor Get Products Error:', error);
      res.status(500).json({ message: 'Failed to fetch products' });
    }
  }

  static async createProduct(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const productData = { ...req.body, vendor_id: vendorId };
      if (req.file) {
        productData.image_url = `/uploads/products/${req.file.filename}`;
      }

      // Validate selling_price > 0
      const sellingPrice = parseFloat(productData.selling_price);
      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        return res.status(400).json({ success: false, message: 'Product price must be greater than zero.' });
      }

      // Validate is_active vs stock
      const is_active = req.body.is_active === 'true' || req.body.is_active === '1' || req.body.is_active === 1 || req.body.is_active === true || req.body.is_active === undefined;
      const stock_quantity = parseInt(req.body.stock_quantity || req.body.stock || 0, 10);
      
      if (is_active && stock_quantity < 0) {
        return res.status(400).json({ success: false, message: 'Cannot enable a product with invalid stock.' });
      }

      productData.is_active = is_active;
      productData.stock_quantity = stock_quantity;

      const productId = await VendorModel.createProduct(productData);
      res.status(201).json({ success: true, message: 'Product created successfully', productId });
    } catch (error) {
      console.error('Vendor Create Product Error:', error);
      res.status(500).json({ success: false, message: 'Failed to create product' });
    }
  }

  static async updateProduct(req, res) {
    const { id } = req.params;
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const productData = { ...req.body };
      if (req.file) {
        productData.image_url = `/uploads/products/${req.file.filename}`;
      }

      // Validate selling_price > 0 if provided
      if (productData.selling_price !== undefined) {
        const sellingPrice = parseFloat(productData.selling_price);
        if (isNaN(sellingPrice) || sellingPrice <= 0) {
          return res.status(400).json({ success: false, message: 'Product price must be greater than zero.' });
        }
      }

      // Validate is_active vs stock
      if (productData.is_active !== undefined) {
        const is_active = productData.is_active === 'true' || productData.is_active === '1' || productData.is_active === 1 || productData.is_active === true;
        productData.is_active = is_active;
        if (is_active) {
          // Fetch current stock from database
          const [rows] = await db.query(
            `SELECT COALESCE(i.stock, p.stock_quantity, 0) AS stock
             FROM products p
             LEFT JOIN inventory i ON p.id = i.product_id
             WHERE p.id = ? AND p.vendor_id = ?`,
            [id, vendorId]
          );
          if (rows.length > 0) {
            const currentStock = parseInt(rows[0].stock, 10);
            if (currentStock < 0) {
              return res.status(400).json({ success: false, message: 'Cannot enable a product with invalid stock.' });
            }
          }
        }
      }

      const success = await VendorModel.updateProduct(id, vendorId, productData);
      if (success) {
        const io = req.app.get('io');
        if (io) io.emit('inventory-updated', { vendor_id: vendorId, product_id: Number(id) });
        res.json({ success: true, message: 'Product updated successfully' });
      } else {
        res.status(404).json({ success: false, message: 'Product not found' });
      }
    } catch (error) {
      console.error('Vendor Update Product Error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product' });
    }
  }

  static async deleteProduct(req, res) {
    const { id } = req.params;
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const result = await VendorModel.deleteProduct(id, vendorId);
      if (result.status === 'not_found') {
        return res.status(404).json({ success: false, message: 'Product not found or not yours' });
      }
      res.json({ success: true, archived: result.status === 'archived', message: `Product ${result.status}` });
    } catch (error) {
      console.error('Vendor Delete Product Error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
  }

  static async getCategories(req, res) {
    try {
      const categories = await VendorModel.getCategories();
      res.json(categories);
    } catch (error) {
      console.error('Vendor Get Categories Error:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  }

  // ─── ORDERS ──────────────────────────────────────────────────────────────────

  static async getOrders(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getOrders - vendor_id=${vendorId}`);
    try {
      const orders = await VendorModel.getOrders(vendorId);
      console.log(`[VENDOR] getOrders - found ${orders.length} orders`);
      res.json(orders);
    } catch (error) {
      console.error('Vendor Get Orders Error:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  }

  static async acceptOrder(req, res) {
    const { id } = req.params;
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] acceptOrder - order_id=${id} vendor_id=${vendorId}`);
    try {
      const success = await VendorModel.acceptOrder(id, vendorId);
      if (success) {
        const [rows] = await db.query(
          `SELECT c.id as customer_id, u.id as user_id, o.id as order_id, o.vendor_id
           FROM orders o
           JOIN customers c ON o.customer_id = c.id
           JOIN users u ON c.user_id = u.id
           WHERE o.id = ? AND o.vendor_id = ?`,
          [id, vendorId]
        );
        if (rows.length > 0) {
          const io = req.app.get('io');
          await NotificationModel.createAndSendCustomerNotification({
            customerId: rows[0].customer_id,
            userId: rows[0].user_id,
            vendorId: rows[0].vendor_id,
            orderId: rows[0].order_id,
            title: 'Order accepted',
            message: `Your order #${rows[0].order_id} has been accepted by the vendor.`,
            type: 'order_accepted',
            io,
          });
        }
        res.json({ success: true, message: 'Order accepted successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Order not found or not pending' });
      }
    } catch (error) {
      console.error('Vendor Accept Order Error:', error);
      res.status(500).json({ success: false, message: 'Failed to accept order' });
    }
  }

  static async updateOrderStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const success = await VendorModel.updateOrderStatus(id, vendorId, status);
      if (success) {
        res.json({ success: true, message: `Order status updated to ${status}` });
      } else {
        res.status(404).json({ success: false, message: 'Order not found' });
      }
    } catch (error) {
      console.error('Vendor Update Order Status Error:', error);
      res.status(500).json({ message: 'Failed to update order status' });
    }
  }

  // ─── INVENTORY & PURCHASES ───────────────────────────────────────────────────

  static async getInventory(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getInventory - vendor_id=${vendorId}`);
    try {
      const inventory = await VendorModel.getInventory(vendorId);
      console.log(`[VENDOR] getInventory - found ${inventory.length} items`);
      res.json(inventory);
    } catch (error) {
      console.error('Vendor Get Inventory Error:', error);
      res.status(500).json({ message: 'Failed to fetch inventory' });
    }
  }

  static async getPurchases(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getPurchases - vendor_id=${vendorId}`);
    try {
      const purchases = await VendorModel.getPurchases(vendorId);
      console.log(`[VENDOR] getPurchases - found ${purchases.length} purchases`);
      res.json(purchases);
    } catch (error) {
      console.error('Vendor Get Purchases Error:', error);
      res.status(500).json({ message: 'Failed to fetch purchases' });
    }
  }

  static async createPurchase(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    const { product_id, quantity, supplier_id, cost_price, selling_price, invoice_number } = req.body;

    if (!product_id || !quantity || !supplier_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields: product_id, quantity, supplier_id' });
    }

    try {
      const calcs = await VendorModel.createPurchase(vendorId, {
        product_id, quantity, supplier_id, cost_price, selling_price, invoice_number
      });
      const io = req.app.get('io');
      if (io) io.emit('inventory-updated', { vendor_id: vendorId, product_id: Number(product_id) });
      res.status(201).json({
        success: true,
        message: 'Purchase recorded and profit calculated',
        data: calcs
      });
    } catch (error) {
      console.error('Vendor Create Purchase Error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to create purchase' });
    }
  }

  // ─── SUPPLIERS ───────────────────────────────────────────────────────────────

  static async getSuppliers(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getSuppliers - vendor_id=${vendorId}`);
    try {
      const suppliers = await VendorModel.getSuppliers(vendorId);
      console.log(`[VENDOR] getSuppliers - found ${suppliers.length} suppliers`);
      res.json(suppliers);
    } catch (error) {
      console.error('Vendor Get Suppliers Error:', error);
      res.status(500).json({ message: 'Failed to fetch suppliers' });
    }
  }

  static async createSupplier(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const supplierId = await VendorModel.createSupplier(vendorId, req.body);
      res.status(201).json({ success: true, message: 'Supplier created successfully', supplierId });
    } catch (error) {
      console.error('Vendor Create Supplier Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Failed to create supplier'
      });
    }
  }

  static async deleteSupplier(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const deleted = await VendorModel.deleteSupplier(vendorId, req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Supplier not found.' });
      res.json({ success: true, message: 'Supplier deleted safely.' });
    } catch (error) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to delete supplier.' });
    }
  }

  // ─── DELIVERIES ──────────────────────────────────────────────────────────────

  static async getDeliveriesTracking(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getDeliveriesTracking - vendor_id=${vendorId}`);
    try {
      const DriverModel = require('../models/driverModel');
      await DriverModel.ensurePresenceSchema();
      const [rows] = await db.query(`
        SELECT d.id as delivery_id, o.id as order_id, d.status,
               CONCAT(dr.first_name, ' ', dr.last_name) as driver_name, u_dr.phone as driver_phone,
               dr.current_lat as driver_latitude, dr.current_lng as driver_longitude,
               IF(dr.is_online = 1 AND dr.last_seen >= DATE_SUB(NOW(), INTERVAL 30 SECOND), 1, 0) as driver_is_online,
               dr.last_seen as driver_last_seen,
               COALESCE(c.first_name, u_cust.username, 'Customer') as customer_name,
               COALESCE(u_cust.phone, 'No phone') as customer_phone,
               COALESCE(a.address_line, 'No address') as customer_address,
               a.latitude as customer_latitude, a.longitude as customer_longitude,
               v.latitude as vendor_latitude, v.longitude as vendor_longitude
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        JOIN customers c ON o.customer_id = c.id
        JOIN users u_cust ON c.user_id = u_cust.id
        JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN drivers dr ON d.driver_id = dr.id
        LEFT JOIN users u_dr ON dr.user_id = u_dr.id
        LEFT JOIN addresses a ON o.address_id = a.id
        WHERE o.vendor_id = ? AND d.status IN ('assigned', 'accepted', 'picked_up', 'on_the_way', 'driver assigned', 'on the way')
      `, [vendorId]);

      console.log(`[VENDOR] getDeliveriesTracking - found ${rows.length} active deliveries`);

      const trackingData = rows.map(r => ({
        delivery_id: r.delivery_id,
        order_id: r.order_id,
        driver_name: r.driver_name || 'Unassigned Driver',
        driver_phone: r.driver_phone || 'No phone',
        driver_is_online: Boolean(r.driver_is_online),
        driver_last_seen: r.driver_last_seen,
        driver_latitude: r.driver_latitude ? parseFloat(r.driver_latitude) : 2.0469,
        driver_longitude: r.driver_longitude ? parseFloat(r.driver_longitude) : 45.3182,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_address: r.customer_address,
        customer_latitude: r.customer_latitude ? parseFloat(r.customer_latitude) : 2.0480,
        customer_longitude: r.customer_longitude ? parseFloat(r.customer_longitude) : 45.3200,
        vendor_latitude: r.vendor_latitude ? parseFloat(r.vendor_latitude) : 2.0450,
        vendor_longitude: r.vendor_longitude ? parseFloat(r.vendor_longitude) : 45.3150,
        status: r.status === 'driver assigned' ? 'assigned' : (r.status === 'on the way' ? 'on_the_way' : r.status)
      }));

      res.json(trackingData);
    } catch (error) {
      console.error('Vendor Get Deliveries Tracking Error:', error);
      res.status(500).json({ message: 'Failed to fetch deliveries tracking' });
    }
  }

  static async getDeliveries(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getDeliveries - vendor_id=${vendorId}`);
    try {
      const [rows] = await db.query(`
        SELECT d.*, o.total_amount, o.status as order_status, o.distance_km, o.delivery_fee,
               o.payment_method, o.created_at as order_created_at,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), u.username, 'Customer') as customer_name,
               u.phone as customer_phone,
               COALESCE(a.address_line, 'No address') as customer_address,
               dr.first_name as driver_first_name, dr.last_name as driver_last_name,
               u_dr.phone as driver_phone,
               dr.vehicle_type, dr.plate_number as license_plate, dr.is_online, dr.last_seen
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        JOIN customers c ON o.customer_id = c.id
        JOIN users u ON c.user_id = u.id
        LEFT JOIN drivers dr ON d.driver_id = dr.id
        LEFT JOIN users u_dr ON dr.user_id = u_dr.id
        LEFT JOIN addresses a ON o.address_id = a.id
        WHERE o.vendor_id = ?
        ORDER BY d.created_at DESC
      `, [vendorId]);
      console.log(`[VENDOR] getDeliveries - found ${rows.length} deliveries`);
      res.json(rows);
    } catch (error) {
      console.error('Vendor Get Deliveries Error:', error);
      // Try simpler query if joins fail (no deliveries table data yet)
      res.json([]);
    }
  }

  // ─── DRIVERS ─────────────────────────────────────────────────────────────────

  static async getDrivers(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getDrivers - vendor_id=${vendorId}`);
    try {
      const DriverModel = require('../models/driverModel');
      const drivers = await DriverModel.getAllAvailableDrivers(vendorId);
      console.log(`[VENDOR] getDrivers - found ${drivers.length} drivers`);
      res.json(drivers);
    } catch (error) {
      console.error('Vendor Get Drivers Error:', error);
      res.status(500).json({ message: 'Failed to fetch drivers' });
    }
  }

  static async createDriver(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    const { 
      username, email, phone, first_name, last_name, vehicle_type, plate_number,
      address, dob, emergency_contact_name, emergency_contact_phone, guardian_name, guardian_phone,
      sponsor_name, sponsor_phone, sponsor_address
    } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
      const crypto = require('crypto');
      const { assertEmailConfigured, verifyEmailTransport, sendInitialPassword } = require('../utils/emailService');
      await verifyEmailTransport();
      const DriverModel = require('../models/driverModel');
      const initialPassword = crypto.randomBytes(18).toString('base64url');
      const password_hash = await bcrypt.hash(initialPassword, 12);
      const driverId = await DriverModel.createDriver({
        username, email, phone, password_hash,
        first_name, last_name, vehicle_type, plate_number,
        vendor_id: vendorId,
        address, dob, emergency_contact_name, emergency_contact_phone, guardian_name, guardian_phone,
        sponsor_name, sponsor_phone, sponsor_address
      });

      let emailSent = false;
      try {
        assertEmailConfigured();
        await sendInitialPassword({ email, name: `${first_name || ''} ${last_name || ''}`.trim(), password: initialPassword });
        emailSent = true;
      } catch (emailErr) {
        console.warn('[WARN] SMTP not configured — initial driver password logged below:');
        console.warn(`[DRIVER EMAIL] Initial-password delivery failed for driver ${driverId}.`);
      }

      res.status(201).json({ 
        success: true, 
        message: 'Driver created successfully', 
        driverId,
        initialPassword: undefined,
        emailSent
      });
    } catch (error) {
      console.error('Vendor Create Driver Error:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to create driver' });
    }
  }

  static async assignDriver(req, res) {
    const { orderId } = req.params;
    const { driverId } = req.body;
    const vendorId = await VendorController.resolveVendorId(req);

    try {
      const [order] = await db.query('SELECT id FROM orders WHERE id = ? AND vendor_id = ?', [orderId, vendorId]);
      if (order.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found for this vendor' });
      }
      const DriverModel = require('../models/driverModel');
      await DriverModel.assignDriverToOrder(orderId, driverId);
      const [rows] = await db.query(
        `SELECT c.id as customer_id, u.id as user_id, o.id as order_id, o.vendor_id,
                COALESCE(CONCAT(dr.first_name, ' ', dr.last_name), dr.first_name, 'your driver') as driver_name
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         LEFT JOIN drivers dr ON dr.id = ?
         WHERE o.id = ?`,
        [driverId, orderId]
      );
      if (rows.length > 0) {
        const driverName = rows[0].driver_name || 'Your driver';
        const io = req.app.get('io');
        await NotificationModel.createAndSendCustomerNotification({
          customerId: rows[0].customer_id,
          userId: rows[0].user_id,
          vendorId: rows[0].vendor_id,
          orderId: rows[0].order_id,
          title: 'Driver assigned to your order',
          message: `${driverName} has been assigned to your order #${rows[0].order_id}.`,
          type: 'driver_assigned',
          io,
        });
      }
      res.json({ success: true, message: 'Driver assigned successfully' });
    } catch (error) {
      console.error('Vendor Assign Driver Error:', error);
      res.status(500).json({ success: false, message: 'Failed to assign driver' });
    }
  }

  static async getOrderRejections(req, res) {
    const { orderId } = req.params;
    try {
      const DriverModel = require('../models/driverModel');
      const rejections = await DriverModel.getRejectionHistory(orderId);
      res.json({ success: true, orderId: Number(orderId), rejections });
    } catch (error) {
      console.error('Get Order Rejections Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch rejection history' });
    }
  }

  // ─── DASHBOARD & REPORTS ─────────────────────────────────────────────────────

  static async getDashboardStats(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getDashboardStats - vendor_id=${vendorId}`);

    try {
      const stats = await VendorModel.getStats(vendorId);
      const orders = await VendorModel.getOrders(vendorId);

      const dashboardData = {
        ...stats,
        recent_orders: orders.slice(0, 5)
      };

      console.log(`[VENDOR] getDashboardStats - response:`, JSON.stringify(dashboardData));
      res.json({ success: true, data: dashboardData });
    } catch (error) {
      console.error('Vendor Get Stats Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' });
    }
  }

  static async getNotifications(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      res.json(await VendorModel.getVendorNotifications(vendorId));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendor notifications.' });
    }
  }

  static async markNotificationRead(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const updated = await VendorModel.markVendorNotificationRead(vendorId, req.params.id);
      if (!updated) return res.status(404).json({ message: 'Notification not found.' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update notification.' });
    }
  }

  static async getReports(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    console.log(`[VENDOR] getReports - vendor_id=${vendorId}`);
    try {
      const stats = await VendorModel.getStats(vendorId);
      const [sales] = await db.query(`
        SELECT DATE(created_at) as date, SUM(total_amount) as amount
        FROM orders
        WHERE vendor_id = ? AND LOWER(status) = 'delivered'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [vendorId]);

      res.json({ summary: stats, sales_chart: sales });
    } catch (error) {
      console.error('Vendor Get Reports Error:', error);
      res.status(500).json({ message: 'Failed to fetch reports' });
    }
  }

  static async getSalesSummary(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const summary = await VendorModel.getSalesSummary(vendorId);
      res.json(summary);
    } catch (error) {
      console.error('Get Sales Summary Error:', error);
      res.status(500).json({ message: 'Failed to fetch sales summary.' });
    }
  }

  static async getCommissions(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const commissions = await VendorModel.getCommissions(vendorId);
      res.json(commissions);
    } catch (error) {
      console.error('Get Vendor Commissions Error:', error);
      res.status(500).json({ message: 'Failed to fetch commissions.' });
    }
  }

  static async getLpgMonitoring(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      res.json(await VendorModel.getLpgMonitoring(vendorId));
    } catch (error) {
      console.error('Get LPG Monitoring Error:', error);
      res.status(500).json({ message: 'Failed to fetch LPG monitoring.' });
    }
  }

  static async updateCustomerLpgLevel(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const level = await VendorModel.updateCustomerLpgLevel(vendorId, req.params.customerId, req.body);
      const io = req.app.get('io');
      if (io) {
        io.to(`vendor-${vendorId}`).emit('lpg-level-updated', level);
        io.to(`customer-${req.params.customerId}`).emit('lpg-level-updated', level);
      }
      res.json({ success: true, level });
    } catch (error) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update LPG level.' });
    }
  }

  // ─── PROFILE ─────────────────────────────────────────────────────────────────

  static async getProfile(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const vendor = await VendorModel.getProfile(vendorId);
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      res.json({ success: true, vendor });
    } catch (error) {
      console.error('Vendor Get Profile Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
  }

  static async getSettings(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const settings = await VendorModel.getSettings(vendorId);
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Vendor Get Settings Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
  }

  static async updateSettings(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const settings = await VendorModel.updateSettings(vendorId, req.body || {});
      res.json({ success: true, message: 'Settings saved successfully', settings });
    } catch (error) {
      console.error('Vendor Update Settings Error:', error);
      res.status(500).json({ success: false, message: 'Failed to save settings' });
    }
  }

  static async updatePassword(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    try {
      await VendorModel.updatePassword(vendorId, current_password, new_password);
      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
      const message = error.message || 'Failed to update password.';
      const status = message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('not found') ? 400 : 500;
      if (status === 400) {
        console.log('[VENDOR] Password Update Validation:', message);
      } else {
        console.error('Vendor Password Update Error:', error);
      }
      res.status(status).json({ success: false, message });
    }
  }

  static async getReviews(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const data = await VendorModel.getReviews(vendorId);
      res.json({ success: true, ...data });
    } catch (error) {
      console.error('Vendor Get Reviews Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
    }
  }

  static async getOffers(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const data = await VendorModel.getOffers(vendorId);
      res.json({ success: true, ...data });
    } catch (error) {
      console.error('Vendor Get Offers Error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch offers.' });
    }
  }

  static async createOffer(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const offerId = await VendorModel.createOffer(vendorId, req.body);
      const io = req.app.get('io');
      const [vendorRows] = await db.query(
        'SELECT COALESCE(business_name, name, "your station") AS vendor_name FROM vendors WHERE id = ?',
        [vendorId]
      );
      const vendorName = vendorRows[0]?.vendor_name || 'your station';
      const discountValue = Number(req.body.discount_percentage ?? req.body.discount_value ?? 0);
      const rawOfferTitle = (req.body.name || req.body.title || req.body.product_name || 'a new offer').toString().trim();
      const discountLabel = Number.isFinite(discountValue) && discountValue > 0
        ? `${Number.isInteger(discountValue) ? discountValue : discountValue.toFixed(1).replace(/\.0$/, '')}% OFF`
        : null;
      const offerTitle = rawOfferTitle || 'a new offer';
      const offerDisplayName = discountLabel && !offerTitle.toLowerCase().includes('off')
        ? `${discountLabel} ${offerTitle}`
        : offerTitle;
      const notificationTitle = '🔥 New Vendor Offer';
      const notificationMessage = `${vendorName} is offering ${offerDisplayName}.`;
      const pushBody = `Get ${offerDisplayName} at ${vendorName}.`;

      try {
        const targets = await CustomerModel.getOfferNotificationTargets(vendorId);
        await NotificationModel.notifyOfferTargets(
          targets,
          notificationTitle,
          notificationMessage,
          'offer_created',
          {
            vendorId,
            offerId,
            io,
            pushTitle: notificationTitle,
            pushBody,
            vendorName,
          }
        );
      } catch (notificationError) {
        console.error('Failed to notify customers about offer:', notificationError);
      }
      res.status(201).json({ success: true, message: 'Offer created successfully.', offerId });
    } catch (error) {
      console.error('Vendor Create Offer Error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to create offer.' });
    }
  }

  static async updateProfile(req, res) {
    const { vendorId } = req.params;
    try {
      const success = await VendorModel.updateProfile(vendorId, req.body);
      if (success) {
        const vendor = await VendorModel.getProfile(vendorId);
        res.json({ success: true, message: 'Profile updated successfully', vendor });
      } else {
        res.status(404).json({ success: false, message: 'Vendor not found' });
      }
    } catch (error) {
      console.error('Vendor Update Profile Error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  }

  static async uploadLogo(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const logoPath = `/uploads/vendor-logos/${req.file.filename}`;
      await db.query('UPDATE vendors SET logo = ?, logo_url = ? WHERE id = ?', [logoPath, logoPath, vendorId]);
      const vendor = await VendorModel.getProfile(vendorId);
      res.json({ success: true, logo: logoPath, logo_url: logoPath, vendor });
    } catch (error) {
      console.error('Vendor Upload Logo Error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload logo' });
    }
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────────

  static async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
      const vendor = await VendorModel.findByEmail(email);
      if (!vendor) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, vendor.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Token stores vendor.id (NOT users.id) so resolveVendorId works correctly
      const token = jwt.sign(
        { id: vendor.id, role: 'vendor', email: vendor.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      // Update online status for vendor specifically in vendors table (in case user_id is null)
      await db.query('UPDATE vendors SET is_online = 1, last_seen = NOW(), last_login = NOW() WHERE id = ?', [vendor.id]);
      
      let effectiveUserId = vendor.user_id;
      
      // Auto-link if user_id is null but matching user email exists
      if (!effectiveUserId) {
        const [matchingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [vendor.email]);
        if (matchingUsers.length > 0) {
          effectiveUserId = matchingUsers[0].id;
          await db.query('UPDATE vendors SET user_id = ? WHERE id = ?', [effectiveUserId, vendor.id]);
          console.log(`[VENDOR] Auto-linked vendor ${vendor.id} to user ${effectiveUserId} via email ${vendor.email}`);
        }
      }

      // Update online status for vendor's user if linked
      if (effectiveUserId) {
        await db.query('UPDATE users SET is_online = 1, last_seen = NOW(), last_login = NOW() WHERE id = ?', [effectiveUserId]);
        console.log(`DEBUG LOGIN: login user id = ${effectiveUserId}, is_online updated result = 1, last_seen value = NOW()`);
        
        // Also fire notification
        try {
          await db.query(
            'INSERT INTO admin_notifications (title, message, type) VALUES (?, ?, ?)',
            ['User Online', `${vendor.business_name || vendor.name} (vendor) is now online`, 'user_online']
          );
        } catch (nErr) { console.error('Notification error:', nErr); }
      } else {
        // Still fire notification even if no user_id
        try {
          await db.query(
            'INSERT INTO admin_notifications (title, message, type) VALUES (?, ?, ?)',
            ['User Online', `${vendor.business_name || vendor.name} (vendor) is now online`, 'user_online']
          );
        } catch (nErr) { console.error('Notification error:', nErr); }
      }

      const profile = await VendorModel.getProfile(vendor.id);
      console.log(`[VENDOR] login - vendor "${vendor.business_name || vendor.name}" logged in, vendor.id=${vendor.id}`);

      let mustChangePassword = false;
      try {
        const [userRows] = await db.query(
          'SELECT must_change_password FROM users WHERE id = ? OR email = ?',
          [vendor.user_id || 0, vendor.email]
        );
        if (userRows.length > 0) {
          mustChangePassword = Boolean(userRows[0].must_change_password);
        }
      } catch (dbErr) {
        console.error('Failed to query must_change_password status', dbErr);
      }

      res.json({
        token,
        must_change_password: mustChangePassword,
        vendor: profile || {
          id: vendor.id,
          name: vendor.name || vendor.business_name,
          business_name: vendor.business_name || vendor.name,
          email: vendor.email,
          logo: vendor.logo || vendor.logo_url || '',
          logo_url: vendor.logo || vendor.logo_url || ''
        }
      });
    } catch (error) {
      console.error('Vendor Login Error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  }

  // ─── DELIVERY ZONES ─────────────────────────────────────────────────────────

  static async getDeliveryZones(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const [zones] = await db.query(
        'SELECT * FROM vendor_delivery_zones WHERE vendor_id = ? ORDER BY zone_name ASC',
        [vendorId]
      );
      res.json(zones);
    } catch (error) {
      console.error('[VENDOR] Get Delivery Zones Error:', error);
      res.status(500).json({ message: 'Failed to fetch delivery zones' });
    }
  }

  static async createDeliveryZone(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    const { zone_name, delivery_fee, estimated_time, is_active } = req.body;

    if (!zone_name || zone_name.trim() === '') {
      return res.status(400).json({ message: 'Zone name is required.' });
    }

    const fee = parseFloat(delivery_fee);
    if (isNaN(fee) || fee < 0) {
      return res.status(400).json({ message: 'Delivery fee must be a valid number greater than or equal to 0.' });
    }

    const estTime = estimated_time || '25 mins';
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    try {
      const [result] = await db.query(
        'INSERT INTO vendor_delivery_zones (vendor_id, zone_name, delivery_fee, estimated_time, is_active) VALUES (?, ?, ?, ?, ?)',
        [vendorId, zone_name.trim(), fee, estTime, active]
      );
      res.status(201).json({
        message: 'Delivery zone created successfully.',
        zoneId: result.insertId
      });
    } catch (error) {
      console.error('[VENDOR] Create Delivery Zone Error:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'This delivery zone is already defined for your station.' });
      }
      res.status(500).json({ message: 'Failed to create delivery zone' });
    }
  }

  static async updateDeliveryZone(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    const zoneId = req.params.id;
    const { zone_name, delivery_fee, estimated_time, is_active } = req.body;

    if (!zone_name || zone_name.trim() === '') {
      return res.status(400).json({ message: 'Zone name is required.' });
    }

    const fee = parseFloat(delivery_fee);
    if (isNaN(fee) || fee < 0) {
      return res.status(400).json({ message: 'Delivery fee must be a valid number greater than or equal to 0.' });
    }

    const estTime = estimated_time || '25 mins';
    const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    try {
      // First verify the zone belongs to this vendor
      const [existing] = await db.query(
        'SELECT id FROM vendor_delivery_zones WHERE id = ? AND vendor_id = ?',
        [zoneId, vendorId]
      );

      if (existing.length === 0) {
        return res.status(404).json({ message: 'Delivery zone not found or unauthorized.' });
      }

      await db.query(
        'UPDATE vendor_delivery_zones SET zone_name = ?, delivery_fee = ?, estimated_time = ?, is_active = ? WHERE id = ?',
        [zone_name.trim(), fee, estTime, active, zoneId]
      );

      res.json({ message: 'Delivery zone updated successfully.' });
    } catch (error) {
      console.error('[VENDOR] Update Delivery Zone Error:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'A delivery zone with this name already exists for your station.' });
      }
      res.status(500).json({ message: 'Failed to update delivery zone' });
    }
  }

  static async deleteDeliveryZone(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    const zoneId = req.params.id;

    try {
      // Verify ownership
      const [existing] = await db.query(
        'SELECT id FROM vendor_delivery_zones WHERE id = ? AND vendor_id = ?',
        [zoneId, vendorId]
      );

      if (existing.length === 0) {
        return res.status(404).json({ message: 'Delivery zone not found or unauthorized.' });
      }

      await db.query('DELETE FROM vendor_delivery_zones WHERE id = ?', [zoneId]);
      res.json({ message: 'Delivery zone deleted successfully.' });
    } catch (error) {
      console.error('[VENDOR] Delete Delivery Zone Error:', error);
      res.status(500).json({ message: 'Failed to delete delivery zone' });
    }
  }

  // ─── OFFERS / PROMOTIONS ─────────────────────────────────────────────────────

  static async getOffers(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const data = await VendorModel.getOffers(vendorId);
      res.json(data);
    } catch (error) {
      console.error('[VENDOR] Get Offers Error:', error);
      res.status(500).json({ message: 'Failed to fetch offers' });
    }
  }

  static async createOffer(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const offerId = await VendorModel.createOffer(vendorId, req.body);
      const io = req.app.get('io');
      const [vendorRows] = await db.query(
        'SELECT COALESCE(business_name, name, "your station") AS vendor_name FROM vendors WHERE id = ?',
        [vendorId]
      );
      const vendorName = vendorRows[0]?.vendor_name || 'your station';
      const discountValue = Number(req.body.discount_percentage ?? req.body.discount_value ?? 0);
      const rawOfferTitle = (req.body.name || req.body.title || req.body.product_name || 'a new offer').toString().trim();
      const discountLabel = Number.isFinite(discountValue) && discountValue > 0
        ? `${Number.isInteger(discountValue) ? discountValue : discountValue.toFixed(1).replace(/\.0$/, '')}% OFF`
        : null;
      const offerTitle = rawOfferTitle || 'a new offer';
      const offerDisplayName = discountLabel && !offerTitle.toLowerCase().includes('off')
        ? `${discountLabel} ${offerTitle}`
        : offerTitle;
      const notificationTitle = 'New Vendor Offer';
      const notificationMessage = `${vendorName} is offering ${offerDisplayName}.`;
      const pushBody = `Get ${offerDisplayName} at ${vendorName}.`;

      try {
        const targets = await CustomerModel.getOfferNotificationTargets(vendorId);
        await NotificationModel.notifyOfferTargets(
          targets,
          notificationTitle,
          notificationMessage,
          'offer_created',
          {
            vendorId,
            offerId,
            io,
            pushTitle: notificationTitle,
            pushBody,
            vendorName,
          }
        );
      } catch (notificationError) {
        console.error('[VENDOR] Failed to notify customers about offer:', notificationError);
      }

      res.status(201).json({ success: true, message: 'Offer created successfully', offerId });
    } catch (error) {
      const message = error.message || 'Failed to create offer';
      const isValidationError = ['required', 'between', 'select one product', 'does not belong'].some((part) =>
        message.toLowerCase().includes(part)
      );
      if (isValidationError) {
        console.log('[VENDOR] Create Offer Validation:', message);
      } else {
        console.error('[VENDOR] Create Offer Error:', error);
      }
      const status = isValidationError ? 400 : 500;
      res.status(status).json({ success: false, message });
    }
  }

  static async updateOffer(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const offerId  = req.params.id;
      const updated  = await VendorModel.updateOffer(vendorId, offerId, req.body);

      if (!updated) return res.status(404).json({ message: 'Offer not found or unauthorized' });

      const io = req.app.get('io');
      if (io) io.emit('offer-updated', { vendor_id: vendorId, offer_id: offerId });

      res.json({ success: true, message: 'Offer updated successfully' });
    } catch (error) {
      const message = error.message || 'Failed to update offer';
      const isValidationError = ['required', 'between', 'select one product', 'does not belong'].some((part) =>
        message.toLowerCase().includes(part)
      );
      if (isValidationError) {
        console.log('[VENDOR] Update Offer Validation:', message);
      } else {
        console.error('[VENDOR] Update Offer Error:', error);
      }
      const status = isValidationError ? 400 : 500;
      res.status(status).json({ success: false, message });
    }
  }

  static async deleteOffer(req, res) {
    const vendorId = await VendorController.resolveVendorId(req);
    try {
      const offerId  = req.params.id;
      const deleted  = await VendorModel.deleteOffer(vendorId, offerId);

      if (!deleted) return res.status(404).json({ message: 'Offer not found or unauthorized' });

      const io = req.app.get('io');
      if (io) io.emit('offer-deleted', { vendor_id: vendorId, offer_id: offerId });

      res.json({ message: 'Offer deleted successfully' });
    } catch (error) {
      console.error('[VENDOR] Delete Offer Error:', error);
      res.status(500).json({ message: 'Failed to delete offer' });
    }
  }

  // ─── REPORTS / ANALYTICS ─────────────────────────────────────────────────────

  static async getReports(req, res) {
    try {
      const vendorId = await VendorController.resolveVendorId(req);

      // Summary: overall stats
      const [[summary]] = await db.query(
        `SELECT
           COUNT(o.id)                                              AS total_orders,
           COALESCE(SUM(CASE WHEN o.status='delivered' THEN 1 END), 0) AS completed_orders,
           COALESCE(SUM(CASE WHEN o.status='cancelled' THEN 1 END), 0) AS cancelled_orders,
           COALESCE(SUM(o.total_amount), 0)                        AS total_sales,
           COALESCE(SUM(o.vendor_net_amount), 0)                   AS net_sales,
           COALESCE(SUM(o.admin_commission), 0)                    AS total_commission,
           COUNT(DISTINCT o.customer_id)                           AS unique_customers,
           COALESCE(SUM(d.payout), 0)                              AS total_delivery_fees
         FROM orders o
         LEFT JOIN deliveries d ON d.order_id = o.id
         WHERE o.vendor_id = ?`,
        [vendorId]
      );

      // Sales chart (last 30 days)
      const [salesChart] = await db.query(
        `SELECT DATE(o.created_at) AS date, COALESCE(SUM(o.total_amount), 0) AS amount
         FROM orders o
         WHERE o.vendor_id = ? AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(o.created_at)
         ORDER BY date ASC`,
        [vendorId]
      );

      // Top selling products
      const [topProducts] = await db.query(
        `SELECT p.name, SUM(oi.quantity) AS total_qty, SUM(oi.subtotal) AS total_revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE o.vendor_id = ?
         GROUP BY oi.product_id, p.name
         ORDER BY total_qty DESC
         LIMIT 5`,
        [vendorId]
      );

      res.json({ summary, sales_chart: salesChart, top_products: topProducts });
    } catch (error) {
      console.error('[VENDOR] getReports Error:', error);
      res.status(500).json({ message: 'Failed to fetch reports' });
    }
  }

  static async getDailyReport(req, res) {
    try {
      const vendorId = await VendorController.resolveVendorId(req);
      const date = req.query.date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const [[summary]] = await db.query(
        `SELECT
           COUNT(o.id)                                                          AS total_orders,
           COALESCE(SUM(CASE WHEN o.status='delivered' THEN 1 END), 0)         AS completed_deliveries,
           COALESCE(SUM(CASE WHEN o.status='cancelled' THEN 1 END), 0)         AS cancelled_orders,
           COALESCE(SUM(o.total_amount), 0)                                     AS total_sales,
           COALESCE(SUM(o.vendor_net_amount), 0)                                AS total_revenue,
           COALESCE(SUM(d.payout), 0)                                           AS total_delivery_fees,
           COUNT(DISTINCT o.customer_id)                                        AS customer_count
         FROM orders o
         LEFT JOIN deliveries d ON d.order_id = o.id
         WHERE o.vendor_id = ? AND DATE(o.created_at) = ?`,
        [vendorId, date]
      );

      // Hourly breakdown
      const [hourlyChart] = await db.query(
        `SELECT HOUR(o.created_at) AS hour,
                COUNT(o.id) AS orders,
                COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o
         WHERE o.vendor_id = ? AND DATE(o.created_at) = ?
         GROUP BY HOUR(o.created_at)
         ORDER BY hour ASC`,
        [vendorId, date]
      );

      // Top products today
      const [topProducts] = await db.query(
        `SELECT p.name, SUM(oi.quantity) AS total_qty, SUM(oi.subtotal) AS total_revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE o.vendor_id = ? AND DATE(o.created_at) = ?
         GROUP BY oi.product_id, p.name
         ORDER BY total_qty DESC
         LIMIT 5`,
        [vendorId, date]
      );

      // Discount usage (if offers applied via orders)
      const [[discountData]] = await db.query(
        `SELECT COUNT(DISTINCT o.id) AS orders_with_discount,
                COALESCE(SUM(o.total_amount * 0), 0) AS total_discounts
         FROM orders o
         WHERE o.vendor_id = ? AND DATE(o.created_at) = ?`,
        [vendorId, date]
      );

      res.json({ date, summary, hourly_chart: hourlyChart, top_products: topProducts, discount_data: discountData });
    } catch (error) {
      console.error('[VENDOR] getDailyReport Error:', error);
      res.status(500).json({ message: 'Failed to fetch daily report' });
    }
  }

  static async getWeeklyReport(req, res) {
    try {
      const vendorId = await VendorController.resolveVendorId(req);
      // Start of this week (Monday)
      const weekStart = req.query.week_start || (() => {
        const d = new Date();
        const day = d.getDay(); // 0 = Sunday
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d.toISOString().slice(0, 10);
      })();

      // This week stats
      const [[thisWeek]] = await db.query(
        `SELECT
           COUNT(o.id)                                                         AS total_orders,
           COALESCE(SUM(o.total_amount), 0)                                    AS total_revenue,
           COALESCE(SUM(CASE WHEN o.status='delivered' THEN 1 END), 0)        AS completed_orders,
           COALESCE(SUM(CASE WHEN o.status='cancelled' THEN 1 END), 0)        AS cancelled_orders,
           COUNT(DISTINCT o.customer_id)                                       AS customer_count,
           COALESCE(SUM(d.payout), 0)                                          AS total_delivery_fees
         FROM orders o
         LEFT JOIN deliveries d ON d.order_id = o.id
         WHERE o.vendor_id = ? AND DATE(o.created_at) >= ? AND DATE(o.created_at) < DATE_ADD(?, INTERVAL 7 DAY)`,
        [vendorId, weekStart, weekStart]
      );

      // Previous week stats
      const [[prevWeek]] = await db.query(
        `SELECT
           COUNT(o.id)             AS total_orders,
           COALESCE(SUM(o.total_amount), 0) AS total_revenue
         FROM orders o
         WHERE o.vendor_id = ? AND DATE(o.created_at) >= DATE_SUB(?, INTERVAL 7 DAY) AND DATE(o.created_at) < ?`,
        [vendorId, weekStart, weekStart]
      );

      // Daily breakdown for this week
      const [dailyChart] = await db.query(
        `SELECT DAYNAME(o.created_at) AS day_name, DATE(o.created_at) AS date,
                COUNT(o.id) AS orders, COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o
         WHERE o.vendor_id = ? AND DATE(o.created_at) >= ? AND DATE(o.created_at) < DATE_ADD(?, INTERVAL 7 DAY)
         GROUP BY DATE(o.created_at), DAYNAME(o.created_at)
         ORDER BY date ASC`,
        [vendorId, weekStart, weekStart]
      );

      // Best selling day
      const [[bestDay]] = await db.query(
        `SELECT DAYNAME(o.created_at) AS day_name, COUNT(o.id) AS orders, SUM(o.total_amount) AS revenue
         FROM orders o
         WHERE o.vendor_id = ? AND DATE(o.created_at) >= ? AND DATE(o.created_at) < DATE_ADD(?, INTERVAL 7 DAY)
         GROUP BY DAYNAME(o.created_at)
         ORDER BY revenue DESC
         LIMIT 1`,
        [vendorId, weekStart, weekStart]
      );

      // Revenue growth %
      const revenueGrowth = prevWeek.total_revenue > 0
        ? (((thisWeek.total_revenue - prevWeek.total_revenue) / prevWeek.total_revenue) * 100).toFixed(1)
        : null;

      res.json({
        week_start: weekStart,
        this_week: thisWeek,
        prev_week: prevWeek,
        revenue_growth: revenueGrowth,
        best_day: bestDay || null,
        daily_chart: dailyChart,
      });
    } catch (error) {
      console.error('[VENDOR] getWeeklyReport Error:', error);
      res.status(500).json({ message: 'Failed to fetch weekly report' });
    }
  }

  static async getMonthlyReport(req, res) {
    try {
      const vendorId = await VendorController.resolveVendorId(req);
      const now = new Date();
      const year = parseInt(req.query.year) || now.getFullYear();
      const month = parseInt(req.query.month) || (now.getMonth() + 1);

      // This month stats
      const [[thisMonth]] = await db.query(
        `SELECT
           COUNT(o.id)                                                         AS total_orders,
           COALESCE(SUM(o.total_amount), 0)                                    AS total_revenue,
           COALESCE(SUM(o.vendor_net_amount), 0)                               AS net_revenue,
           COALESCE(SUM(CASE WHEN o.status='delivered' THEN 1 END), 0)        AS completed_deliveries,
           COALESCE(SUM(CASE WHEN o.status='cancelled' THEN 1 END), 0)        AS cancelled_orders,
           COUNT(DISTINCT o.customer_id)                                       AS customer_count,
           COALESCE(SUM(d.payout), 0)                                          AS total_delivery_fees
         FROM orders o
         LEFT JOIN deliveries d ON d.order_id = o.id
         WHERE o.vendor_id = ? AND YEAR(o.created_at) = ? AND MONTH(o.created_at) = ?`,
        [vendorId, year, month]
      );

      // Previous month for comparison
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const [[prevMonthData]] = await db.query(
        `SELECT COALESCE(SUM(o.total_amount), 0) AS total_revenue, COUNT(o.id) AS total_orders
         FROM orders o
         WHERE o.vendor_id = ? AND YEAR(o.created_at) = ? AND MONTH(o.created_at) = ?`,
        [vendorId, prevYear, prevMonth]
      );

      // Daily breakdown for the month
      const [dailyChart] = await db.query(
        `SELECT DATE(o.created_at) AS date, COUNT(o.id) AS orders, COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM orders o
         WHERE o.vendor_id = ? AND YEAR(o.created_at) = ? AND MONTH(o.created_at) = ?
         GROUP BY DATE(o.created_at)
         ORDER BY date ASC`,
        [vendorId, year, month]
      );

      // Top products this month
      const [topProducts] = await db.query(
        `SELECT p.name, SUM(oi.quantity) AS total_qty, SUM(oi.subtotal) AS total_revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE o.vendor_id = ? AND YEAR(o.created_at) = ? AND MONTH(o.created_at) = ?
         GROUP BY oi.product_id, p.name
         ORDER BY total_revenue DESC
         LIMIT 8`,
        [vendorId, year, month]
      );

      // Revenue growth %
      const revenueGrowth = prevMonthData.total_revenue > 0
        ? (((thisMonth.total_revenue - prevMonthData.total_revenue) / prevMonthData.total_revenue) * 100).toFixed(1)
        : null;

      // Orders growth %
      const ordersGrowth = prevMonthData.total_orders > 0
        ? (((thisMonth.total_orders - prevMonthData.total_orders) / prevMonthData.total_orders) * 100).toFixed(1)
        : null;

      res.json({
        year, month,
        this_month: thisMonth,
        prev_month: prevMonthData,
        revenue_growth: revenueGrowth,
        orders_growth: ordersGrowth,
        daily_chart: dailyChart,
        top_products: topProducts,
      });
    } catch (error) {
      console.error('[VENDOR] getMonthlyReport Error:', error);
      res.status(500).json({ message: 'Failed to fetch monthly report' });
    }
  }

  // ─── AUTH / REGISTRATION ─────────────────────────────────────────────────────

  static async register(req, res) {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    try {
      const existingVendor = await VendorModel.findByEmail(email);
      if (existingVendor) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const vendorId = await VendorModel.registerVendor({
        name, email,
        password: hashedPassword,
        phone,
        contact_name: req.body.contact_name,
        address: req.body.address,
        business_types: req.body.business_types
      });
      res.status(201).json({ message: 'Vendor registered successfully', vendorId });
    } catch (error) {
      console.error('Vendor Register Error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  }

}

module.exports = VendorController;
