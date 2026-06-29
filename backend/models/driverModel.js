const db = require('../config/db');

class DriverModel {
  static async ensurePresenceSchema() {
    try {
      const [columns] = await db.query("SHOW COLUMNS FROM drivers LIKE 'last_seen'");
      if (columns.length === 0) {
        await db.query('ALTER TABLE drivers ADD COLUMN last_seen TIMESTAMP NULL DEFAULT NULL');
      }
    } catch (error) {
      console.warn('[DRIVER PRESENCE] Could not ensure last_seen column:', error.message);
    }
  }

  static async markOnline(driverId) {
    await DriverModel.ensurePresenceSchema();
    await db.query(
      `UPDATE drivers
       SET is_online = 1,
           last_seen = NOW(),
           last_location_update = COALESCE(last_location_update, NOW()),
           status = CASE WHEN status = 'offline' OR status IS NULL THEN 'available' ELSE status END
       WHERE id = ?`,
      [driverId]
    );
    await db.query(
      'UPDATE users SET is_online = 1, last_seen = NOW() WHERE id = (SELECT user_id FROM drivers WHERE id = ?)',
      [driverId]
    );
  }

  static async heartbeat(driverId) {
    await DriverModel.ensurePresenceSchema();
    await db.query(
      `UPDATE drivers
       SET is_online = 1,
           last_seen = NOW(),
           last_location_update = NOW(),
           status = CASE WHEN status = 'offline' OR status IS NULL THEN 'available' ELSE status END
       WHERE id = ?`,
      [driverId]
    );
    await db.query(
      'UPDATE users SET is_online = 1, last_seen = NOW() WHERE id = (SELECT user_id FROM drivers WHERE id = ?)',
      [driverId]
    );
  }

  static async markOffline(driverId) {
    await DriverModel.ensurePresenceSchema();
    await db.query(
      'UPDATE drivers SET is_online = 0, status = "offline", last_seen = NOW() WHERE id = ?',
      [driverId]
    );
    await db.query(
      'UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = (SELECT user_id FROM drivers WHERE id = ?)',
      [driverId]
    );
  }

  static async findByEmail(email) {
    const [rows] = await db.query(
      `SELECT u.*, u.password_hash as password, d.id as driver_id, d.first_name, d.last_name, d.vehicle_type, d.is_online, d.vendor_id, d.profile_image
       FROM users u 
       JOIN drivers d ON u.id = d.user_id 
       WHERE (u.email = ? OR u.username = ?) AND u.role_id = 3`,
      [email, email]
    );
    return rows[0];
  }

  static async createDriver(driverData) {
    const { 
      username, email, phone, password_hash, first_name, last_name, vehicle_type, plate_number, vendor_id,
      address, dob, emergency_contact_name, emergency_contact_phone, guardian_name, guardian_phone,
      sponsor_name, sponsor_phone, sponsor_address
    } = driverData;
    
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Create User
      const [uResult] = await connection.query(
        'INSERT INTO users (username, email, phone, password_hash, role_id, status, must_change_password) VALUES (?, ?, ?, ?, 3, "active", 1)',
        [username || email, email, phone, password_hash]
      );
      const userId = uResult.insertId;

      // 2. Create Driver
      const [dResult] = await connection.query(
        `INSERT INTO drivers (
          user_id, first_name, last_name, vehicle_type, license_number, vendor_id, 
          verification_status, is_online, address, dob, emergency_contact_name, 
          emergency_contact_phone, guardian_name, guardian_phone, sponsor_name, 
          sponsor_phone, sponsor_address
        ) VALUES (?, ?, ?, ?, ?, ?, "verified", 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, first_name, last_name, vehicle_type, plate_number, vendor_id,
          address || null, dob || null, emergency_contact_name || null,
          emergency_contact_phone || null, guardian_name || null, guardian_phone || null,
          sponsor_name || null, sponsor_phone || null, sponsor_address || null
        ]
      );

      await connection.commit();
      return dResult.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT d.*, u.email, u.phone, u.username 
       FROM drivers d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getDashboardStats(driverId) {
    const [rows] = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM deliveries WHERE driver_id = ?) as total_deliveries,
        (SELECT COUNT(*) FROM deliveries WHERE driver_id = ? AND status IN ('assigned', 'accepted', 'picked_up', 'on_the_way')) as active_deliveries,
        (SELECT COUNT(*) FROM deliveries WHERE driver_id = ? AND status = 'delivered') as completed_deliveries,
        (SELECT COUNT(*) FROM deliveries WHERE driver_id = ? AND status = 'failed') as failed_deliveries`,
      [driverId, driverId, driverId, driverId]
    );
    return rows[0];
  }

  static async getDeliveries(driverId) {
    const [rows] = await db.query(
      `SELECT d.*, o.total_amount, o.status as order_status, 
              COALESCE(CONCAT(c.first_name, ' ', c.last_name), u_cust.username, 'Unknown Customer') as customer_name,
              COALESCE(u_cust.phone, 'No phone') as customer_phone,
              COALESCE(v.business_name, v.name, 'Unknown Vendor') as vendor_name, 
              COALESCE(v.address, 'Main Station, Mogadishu') as vendor_address
       FROM deliveries d
       JOIN orders o ON d.order_id = o.id
       JOIN customers c ON o.customer_id = c.id
       JOIN users u_cust ON c.user_id = u_cust.id
       JOIN vendors v ON o.vendor_id = v.id
       WHERE d.driver_id = ?
       ORDER BY d.created_at DESC`,
      [driverId]
    );
    return rows;
  }

  static async getDeliveryById(deliveryId) {
    const [rows] = await db.query(
      `SELECT d.*, o.total_amount, o.status as order_status, o.payment_method, o.created_at as order_date,
              COALESCE(c.first_name, u.username, 'Unknown Customer') as customer_first_name, 
              COALESCE(c.last_name, '') as customer_last_name,
              COALESCE(a.phone, u.phone, 'No phone') as customer_phone, u.email as customer_email,
              COALESCE(a.address_line, cl.address, 'No address') as address_line,
              COALESCE(a.latitude, cl.latitude) as customer_latitude,
              COALESCE(a.longitude, cl.longitude) as customer_longitude,
              a.label as address_label, o.distance_km, o.delivery_fee,
              d.assigned_at, d.responded_at, d.rejection_reason,
              COALESCE(v.business_name, v.name, 'Unknown Vendor') as vendor_name, 
              COALESCE(v.address, 'Main Station, Mogadishu') as vendor_address, 
              v.phone as vendor_phone, v.latitude as vendor_latitude, v.longitude as vendor_longitude,
              COALESCE(dl.latitude, dr.current_latitude, dr.current_lat) as driver_latitude,
              COALESCE(dl.longitude, dr.current_longitude, dr.current_lng) as driver_longitude,
              COALESCE(dl.heading, dr.heading) as driver_heading,
              COALESCE(dl.speed, dr.speed) as driver_speed,
              COALESCE(dl.updated_at, dr.last_location_update) as last_location_update
       FROM deliveries d
       JOIN orders o ON d.order_id = o.id
       JOIN customers c ON o.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       LEFT JOIN addresses a ON o.address_id = a.id
       LEFT JOIN customer_locations cl ON cl.customer_id = c.id AND cl.is_default = 1
       JOIN vendors v ON o.vendor_id = v.id
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN driver_locations dl ON dl.driver_id = dr.id
       WHERE d.id = ?`,
      [deliveryId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    // Fetch order items
    const [items] = await db.query(
      `SELECT oi.*, p.name as product_name, p.unit 
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [row.order_id]
    );
    const [destinations] = await db.query(
      `SELECT id, address_line, phone, latitude, longitude, sequence_no, status
       FROM order_destinations WHERE order_id = ? ORDER BY sequence_no`,
      [row.order_id]
    );

    return {
      id: row.id,
      order_id: row.order_id,
      items: items,
      destinations,
      customer: {
        name: `${row.customer_first_name} ${row.customer_last_name}`.trim(),
        phone: row.customer_phone,
        address: row.address_line,
        latitude: row.customer_latitude,
        longitude: row.customer_longitude
      },
      vendor: {
        name: row.vendor_name,
        address: row.vendor_address,
        latitude: row.vendor_latitude,
        longitude: row.vendor_longitude
      },
      delivery: {
        status: row.status,
        assigned_at: row.assigned_at,
        responded_at: row.responded_at,
        rejection_reason: row.rejection_reason,
        distance_km: row.distance_km,
        delivery_fee: row.delivery_fee,
        driver_latitude: row.driver_latitude,
        driver_longitude: row.driver_longitude,
        driver_heading: row.driver_heading,
        driver_speed: row.driver_speed,
        last_location_update: row.last_location_update
      }
    };
  }

  static async updateStatus(deliveryId, status, rejectionReason = null) {
    // Update delivery status
    let query = 'UPDATE deliveries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    if (status === 'picked_up') {
      query = 'UPDATE deliveries SET status = ?, picked_up_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    }
    if (status === 'arrived') {
      query = 'UPDATE deliveries SET status = ?, arrived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    }
    if (status === 'delivered') {
      query = 'UPDATE deliveries SET status = ?, delivered_at = CURRENT_TIMESTAMP, delivery_code_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    }
    if (status === 'accepted') {
      query = 'UPDATE deliveries SET status = ?, responded_at = CURRENT_TIMESTAMP, rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await db.query(query, [status, deliveryId]);
    } else if (status === 'rejected') {
      query = 'UPDATE deliveries SET status = ?, responded_at = CURRENT_TIMESTAMP, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await db.query(query, [status, rejectionReason, deliveryId]);

      // Save details to delivery_rejections table for auditing history
      try {
        const [deliveryRows] = await db.query('SELECT order_id, driver_id FROM deliveries WHERE id = ?', [deliveryId]);
        if (deliveryRows.length > 0) {
          const { order_id, driver_id } = deliveryRows[0];
          await db.query(
            'INSERT INTO delivery_rejections (delivery_id, order_id, driver_id, rejection_reason, rejected_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [deliveryId, order_id, driver_id, rejectionReason || 'No reason provided']
          );
        }
      } catch (err) {
        console.error('[DATABASE ERROR] Failed to log delivery rejection to history:', err);
      }
    } else {
      await db.query(query, [status, deliveryId]);
    }

    // Sync with order status
    let orderStatus = 'accepted';
    if (status === 'picked_up') orderStatus = 'on the way';
    if (status === 'on_the_way') orderStatus = 'on the way';
    if (status === 'arrived') orderStatus = 'on the way';
    if (status === 'delivered') orderStatus = 'delivered';
    if (status === 'failed') orderStatus = 'cancelled';
    if (status === 'rejected') orderStatus = 'pending_driver_assignment';
    
    const [delivery] = await db.query('SELECT order_id, driver_id, payout FROM deliveries WHERE id = ?', [deliveryId]);
    if (delivery[0]) {
      const orderId = delivery[0].order_id;
      
      if (orderStatus === 'delivered') {
        // Free up driver
        await db.query('UPDATE drivers SET status = "available", is_online = 1 WHERE id = ?', [delivery[0].driver_id]);

        // Calculate commission
        const [orderData] = await db.query('SELECT total_amount, vendor_id FROM orders WHERE id = ?', [orderId]);
        if (orderData[0]) {
          const totalAmount = parseFloat(orderData[0].total_amount);
          const vendorId = orderData[0].vendor_id;
          const commission = totalAmount * 0.02;
          const netAmount = totalAmount - commission;
          
          // Update Order
          await db.query(
            'UPDATE orders SET status = ?, admin_commission = ?, vendor_net_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [orderStatus, commission, netAmount, orderId]
          );

          // Insert into Commissions table
          const [commissionUpdate] = await db.query(
            `UPDATE commissions SET total_amount = ?, commission_rate = 2,
             commission_amount = ?, vendor_net_amount = ? WHERE order_id = ?`,
            [totalAmount, commission, netAmount, orderId]
          );
          if (commissionUpdate.affectedRows === 0) {
            await db.query(
              `INSERT INTO commissions (order_id, vendor_id, total_amount, commission_rate, commission_amount, vendor_net_amount)
               VALUES (?, ?, ?, 2, ?, ?)`,
              [orderId, vendorId, totalAmount, commission, netAmount]
            );
          }
          
          // Driver Earnings
          const deliveryFee = parseFloat(delivery[0].payout) || 0;
          if (deliveryFee > 0) {
            await db.query(
              'INSERT INTO driver_transactions (driver_id, delivery_id, type, amount, description, status) VALUES (?, ?, "earning", ?, "Delivery fee earned", "completed")',
              [delivery[0].driver_id, deliveryId, deliveryFee]
            );
            await db.query(
              'UPDATE drivers SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE id = ?',
              [deliveryFee, delivery[0].driver_id]
            );
          }

          console.log(`[DELIVERY SUCCESS] Order #${orderId} delivered. Total: ${totalAmount}, Commission: ${commission}, Net: ${netAmount}, Driver Earning: ${deliveryFee}`);
        }
      } else {
        if (status === 'rejected') {
          await db.query('UPDATE drivers SET status = "available", is_online = 1 WHERE id = ?', [delivery[0].driver_id]);
          await db.query('UPDATE orders SET driver_id = NULL WHERE id = ?', [orderId]);
        }
        await db.query(
          'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [orderStatus, orderId]
        );
      }
    }
  }

  static async updateOnlineStatus(driverId, isOnline) {
    if (isOnline) {
      await DriverModel.markOnline(driverId);
    } else {
      await DriverModel.markOffline(driverId);
    }
  }

  static async getAllAvailableDrivers(vendorId = null) {
    await DriverModel.ensurePresenceSchema();
    await db.query(`
      UPDATE drivers
      SET is_online = 0, status = 'offline'
      WHERE is_online = 1
        AND (last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL 30 SECOND))
    `);

    // Show drivers assigned to this vendor OR with no vendor (shared pool)
    let query = `
      SELECT d.*,
             u.email, u.phone, u.username,
             IF(d.is_online = 1 AND d.last_seen >= DATE_SUB(NOW(), INTERVAL 30 SECOND), 1, 0) AS is_online
      FROM drivers d 
      LEFT JOIN users u ON d.user_id = u.id
    `;
    const params = [];
    if (vendorId) {
      query += ' WHERE (d.vendor_id = ? OR d.vendor_id IS NULL)';
      params.push(vendorId);
    }
    query += ' ORDER BY d.is_online DESC, d.first_name ASC';
    const [rows] = await db.query(query, params);
    return rows;
  }
  
  static async assignDriverToOrder(orderId, driverId) {
    // Check if delivery already exists
    const [existing] = await db.query('SELECT id FROM deliveries WHERE order_id = ?', [orderId]);
    
    if (existing.length > 0) {
      await db.query(
        'UPDATE deliveries SET driver_id = ?, status = "assigned", assigned_at = CURRENT_TIMESTAMP, responded_at = NULL, rejection_reason = NULL, response_reminder_sent_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?',
        [driverId, orderId]
      );
    } else {
      await db.query(
        'INSERT INTO deliveries (order_id, driver_id, status, payout, assigned_at) VALUES (?, ?, "assigned", 5.00, CURRENT_TIMESTAMP)',
        [orderId, driverId]
      );
    }
    
    // Update order status to 'driver assigned'
    await db.query(
      'UPDATE orders SET status = "driver assigned", updated_at = CURRENT_TIMESTAMP, driver_id = (SELECT user_id FROM drivers WHERE id = ?) WHERE id = ?',
      [driverId, orderId]
    );
  }

  static async updateLocation(driverId, lat, lng) {
    await db.query(
      `UPDATE drivers
       SET current_lat = ?, current_lng = ?,
           current_latitude = ?, current_longitude = ?,
           last_location_update = CURRENT_TIMESTAMP,
           last_seen = NOW(),
           is_online = 1
       WHERE id = ?`,
      [lat, lng, lat, lng, driverId]
    );
  }

  static async verifyOTP(deliveryId, otp, driverId) {
    console.log(`[VERIFY OTP] Checking OTP for deliveryId=${deliveryId}, input_otp=${otp}, input_driverId=${driverId}`);
    const [rows] = await db.query(
      `SELECT o.delivery_otp, d.driver_id, d.status
       FROM orders o 
       JOIN deliveries d ON d.order_id = o.id 
       WHERE d.id = ?`,
      [deliveryId]
    );
    if (rows.length === 0) {
      console.log(`[VERIFY OTP] Delivery not found for id=${deliveryId}`);
      return false;
    }
    
    const delivery = rows[0];
    console.log(`[VERIFY OTP] Database record: db_driver_id=${delivery.driver_id}, db_otp=${delivery.delivery_otp}, db_status=${delivery.status}`);
    
    if (Number(delivery.driver_id) !== Number(driverId)) {
      console.log(`[VERIFY OTP] Driver ID mismatch! db_driver_id=${delivery.driver_id} vs input_driverId=${driverId}`);
      return false;
    }
    
    const terminalStatuses = ['delivered', 'failed', 'rejected'];
    if (terminalStatuses.includes(delivery.status)) {
      console.log(`[VERIFY OTP] Delivery is in terminal status: ${delivery.status}`);
      return false; 
    }
    
    const matches = String(delivery.delivery_otp || '').trim() === String(otp || '').trim();
    console.log(`[VERIFY OTP] Comparison result: matches=${matches}`);
    return matches;
  }

  static async saveProof(deliveryId, imageUrl) {
    await db.query(
      'UPDATE deliveries SET proof_image_url = ? WHERE id = ?',
      [imageUrl, deliveryId]
    );
  }

  static async markArrived(deliveryId) {
    await db.query(
      'UPDATE deliveries SET arrived_at = CURRENT_TIMESTAMP WHERE id = ?',
      [deliveryId]
    );
  }

  static async getRejectionHistory(orderId) {
    const [rows] = await db.query(
      `SELECT dr.*, d.first_name, d.last_name, d.vehicle_type
       FROM delivery_rejections dr
       JOIN drivers d ON dr.driver_id = d.id
       WHERE dr.order_id = ?
       ORDER BY dr.rejected_at DESC`,
      [orderId]
    );
    return rows;
  }
}

module.exports = DriverModel;
