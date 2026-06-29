const db = require('../config/db');
const admin = require('firebase-admin');

const CUSTOMER_NOTIFICATION_TYPES = [
  'order_created',
  'order_accepted',
  'order_assigned',
  'driver_assigned',
  'order_picked_up',
  'order_on_the_way',
  'order_delivered',
  'offer_created',
  'offer_updated',
  'payment_success',
  'payment_failed',
  'payment_pending',
];

class NotificationModel {
  static async ensureSchema() {
    if (this._schemaReady) return;

    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        vendor_id INT NULL,
        order_id INT NULL,
        offer_id INT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_customer_created (customer_id, created_at),
        INDEX idx_notifications_customer_read (customer_id, is_read),
        INDEX idx_notifications_vendor (vendor_id),
        INDEX idx_notifications_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_id INT NULL AFTER id');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS vendor_id INT NULL AFTER customer_id');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS order_id INT NULL AFTER vendor_id');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS offer_id INT NULL AFTER order_id');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT "Notification" AFTER offer_id');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT NULL AFTER title');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT "order_created" AFTER message');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER type');
    await db.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_read');
    await db.query('ALTER TABLE notifications MODIFY type VARCHAR(50) NOT NULL').catch(() => {});
    await db.query('ALTER TABLE notifications MODIFY user_id INT NULL').catch(() => {});
    await db.query('ALTER TABLE notifications MODIFY reference_id INT NULL').catch(() => {});

    await db.query(`
      UPDATE notifications n
      JOIN customers c ON c.user_id = n.user_id
      SET n.customer_id = c.id
      WHERE n.customer_id IS NULL
    `).catch(() => {});

    await db.query(`
      UPDATE notifications
      SET order_id = reference_id
      WHERE order_id IS NULL
        AND reference_id IS NOT NULL
        AND type IN (
          'order_created',
          'order_accepted',
          'order_assigned',
          'driver_assigned',
          'order_picked_up',
          'order_on_the_way',
          'order_delivered',
          'payment_success',
          'payment_failed'
        )
    `).catch(() => {});

    await this.dropLegacyNotificationUserColumn();
    await db.query('ALTER TABLE notifications DROP COLUMN IF EXISTS reference_id').catch(() => {});
    this._notificationColumns = null;

    await db.query('ALTER TABLE notifications MODIFY customer_id INT NOT NULL').catch(() => {});
    await db.query('ALTER TABLE notifications ADD CONSTRAINT fk_notifications_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE').catch(() => {});
    await db.query('ALTER TABLE notifications ADD CONSTRAINT fk_notifications_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL').catch(() => {});
    await db.query('ALTER TABLE notifications ADD CONSTRAINT fk_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL').catch(() => {});

    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_customer_created ON notifications (customer_id, created_at)').catch(() => {});
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_customer_read ON notifications (customer_id, is_read)').catch(() => {});
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_vendor ON notifications (vendor_id)').catch(() => {});
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications (order_id)').catch(() => {});
    await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_offer ON notifications (offer_id)').catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS offer_notification_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id INT NOT NULL,
        customer_id INT NOT NULL,
        notification_id INT NULL,
        offer_ids TEXT NULL,
        offer_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_offer_notification_batches_customer_vendor (customer_id, vendor_id, updated_at),
        INDEX idx_offer_notification_batches_notification (notification_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_id INT NULL,
        customer_id INT NULL,
        user_id INT NULL,
        channel ENUM('database', 'socket', 'push') NOT NULL,
        status ENUM('stored', 'emitted', 'sent', 'failed', 'skipped') NOT NULL,
        detail TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notification_logs_notification (notification_id),
        INDEX idx_notification_logs_customer_created (customer_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await db.query('ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS customer_id INT NULL AFTER notification_id');
    await db.query('ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER customer_id');

    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT NULL');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMP NULL DEFAULT NULL');
    this._schemaReady = true;
  }

  static async dropLegacyNotificationUserColumn() {
    try {
      const [foreignKeys] = await db.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'notifications'
          AND COLUMN_NAME = 'user_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      for (const fk of foreignKeys) {
        await db.query(`ALTER TABLE notifications DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``).catch(() => {});
      }

      const [indexes] = await db.query('SHOW INDEX FROM notifications WHERE Column_name = "user_id"');
      const indexNames = [...new Set(indexes.map((index) => index.Key_name).filter((name) => name !== 'PRIMARY'))];
      for (const indexName of indexNames) {
        await db.query(`ALTER TABLE notifications DROP INDEX \`${indexName}\``).catch(() => {});
      }

      await db.query('ALTER TABLE notifications DROP COLUMN IF EXISTS user_id').catch(() => {});
    } catch (error) {
      console.warn('[NOTIFICATIONS] Could not remove legacy user_id column:', error.message);
    }
  }

  static async createAdminNotification(title, message, type) {
    const [result] = await db.query(
      'INSERT INTO admin_notifications (title, message, type) VALUES (?, ?, ?)',
      [title, message, type]
    );
    return result.insertId;
  }

  static async getAdminNotifications(limit = 50) {
    const [rows] = await db.query(
      'SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows;
  }

  static async markAsRead(id) {
    const [result] = await db.query(
      'UPDATE admin_notifications SET is_read = 1 WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async markAllAsRead() {
    const [result] = await db.query(
      'UPDATE admin_notifications SET is_read = 1 WHERE is_read = 0'
    );
    return result.affectedRows;
  }

  static async getCustomerTargetByUserId(userId) {
    const [rows] = await db.query(
      `SELECT c.id AS customer_id, u.id AS user_id
       FROM customers c
       JOIN users u ON c.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  static async getCustomerTargetByCustomerId(customerId) {
    const [rows] = await db.query(
      `SELECT c.id AS customer_id, u.id AS user_id
       FROM customers c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?
       LIMIT 1`,
      [customerId]
    );
    return rows[0] || null;
  }

  static async getAllActiveCustomerTargets() {
    await this.ensureSchema();
    const [rows] = await db.query(
      `SELECT c.id AS customer_id, u.id AS user_id
       FROM customers c
       JOIN users u ON c.user_id = u.id
       WHERE COALESCE(u.status, 'active') = 'active'`
    );
    return rows;
  }

  static async createCustomerNotification({
    customerId,
    userId = null,
    vendorId = null,
    orderId = null,
    offerId = null,
    title,
    message,
    type,
  }) {
    await this.ensureSchema();
    if (!CUSTOMER_NOTIFICATION_TYPES.includes(type)) {
      throw new Error(`Unsupported notification type: ${type}`);
    }

    const resolvedUserId = userId || (await this.getCustomerTargetByCustomerId(customerId))?.user_id || null;
    const existingColumns = await this.getNotificationColumns();
    const columns = ['customer_id', 'vendor_id', 'order_id', 'offer_id', 'title', 'message', 'type'];
    const values = [customerId, vendorId, orderId, offerId, title, message, type];

    if (existingColumns.has('user_id')) {
      columns.push('user_id');
      values.push(resolvedUserId);
    }
    if (existingColumns.has('reference_id')) {
      columns.push('reference_id');
      values.push(orderId || offerId || vendorId || null);
    }

    const placeholders = columns.map(() => '?').join(', ');
    const [result] = await db.query(
      `INSERT INTO notifications (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );
    await this.logNotification(
      result.insertId,
      customerId,
      resolvedUserId,
      'database',
      'stored',
      'Notification stored in database'
    );
    return result.insertId;
  }

  static async getNotificationColumns() {
    if (this._notificationColumns) return this._notificationColumns;

    const [rows] = await db.query('SHOW COLUMNS FROM notifications');
    this._notificationColumns = new Set(rows.map((row) => row.Field));
    return this._notificationColumns;
  }

  static async getCustomerNotifications(customerId, limit = 100) {
    await this.ensureSchema();
    const [rows] = await db.query(
      `SELECT id, customer_id, vendor_id, order_id, offer_id, title, message, type, is_read, created_at
       FROM notifications
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [customerId, limit]
    );
    return rows;
  }

  static async getUnreadCount(customerId) {
    await this.ensureSchema();
    const [rows] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE customer_id = ? AND is_read = 0',
      [customerId]
    );
    return rows?.[0]?.count || 0;
  }

  static async markCustomerNotificationRead(id, customerId) {
    await this.ensureSchema();
    const [result] = await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );
    return result.affectedRows > 0;
  }

  static async markAllCustomerNotificationsRead(customerId) {
    await this.ensureSchema();
    const [result] = await db.query(
      'UPDATE notifications SET is_read = 1 WHERE customer_id = ? AND is_read = 0',
      [customerId]
    );
    return result.affectedRows;
  }

  static async getUserNotifications(userId, limit = 100) {
    const target = await this.getCustomerTargetByUserId(userId);
    if (!target) return [];
    return this.getCustomerNotifications(target.customer_id, limit);
  }

  static async markUserNotificationRead(id, userId) {
    const target = await this.getCustomerTargetByUserId(userId);
    if (!target) return false;
    return this.markCustomerNotificationRead(id, target.customer_id);
  }

  static async markAllUserNotificationsRead(userId) {
    const target = await this.getCustomerTargetByUserId(userId);
    if (!target) return 0;
    return this.markAllCustomerNotificationsRead(target.customer_id);
  }

  static async updateUserFcmToken(userId, token) {
    await this.ensureSchema();
    const [result] = await db.query(
      'UPDATE users SET fcm_token = ?, fcm_token_updated_at = NOW() WHERE id = ?',
      [token, userId]
    );
    return result.affectedRows > 0;
  }

  static async getUserFcmToken(userId) {
    await this.ensureSchema();
    const [rows] = await db.query(
      'SELECT fcm_token FROM users WHERE id = ?',
      [userId]
    );
    return rows?.[0]?.fcm_token || null;
  }

  static getMessaging() {
    if (this._messagingUnavailable) return null;

    try {
      if (!admin.apps.length) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const projectId = process.env.FIREBASE_PROJECT_ID;

        if (serviceAccountJson) {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
            projectId,
          });
        } else {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            ...(projectId ? { projectId } : {}),
          });
        }
      }
      return admin.messaging();
    } catch (error) {
      this._messagingUnavailable = true;
      console.warn('[FCM] Firebase Admin is not configured; push notifications skipped:', error.message);
      return null;
    }
  }

  static async sendPushNotification(notificationId, customerId, userId, title, body, data = {}) {
    if (!userId) {
      await this.logNotification(notificationId, customerId, userId, 'push', 'skipped', 'Customer has no linked user');
      return false;
    }

    const token = await this.getUserFcmToken(userId);
    if (!token) {
      await this.logNotification(notificationId, customerId, userId, 'push', 'skipped', 'User has no FCM token');
      return false;
    }

    const messaging = this.getMessaging();
    if (!messaging) {
      await this.logNotification(notificationId, customerId, userId, 'push', 'skipped', 'Firebase Admin SDK is not configured');
      return false;
    }

    const stringData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = String(value);
      }
      return acc;
    }, {});

    try {
      const responseId = await messaging.send({
        token,
        notification: {
          title,
          body,
        },
        data: {
          ...stringData,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      });
      await this.logNotification(notificationId, customerId, userId, 'push', 'sent', responseId);
      return true;
    } catch (error) {
      await this.logNotification(notificationId, customerId, userId, 'push', 'failed', error.message);
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        await this.updateUserFcmToken(userId, null);
      }
      console.error('[FCM] Notification error:', error);
      return false;
    }
  }

  static async emitNotificationEvent(customerId, userId, payload, io) {
    if (!io) {
      await this.logNotification(payload.id, customerId, userId, 'socket', 'skipped', 'Socket.IO server not available');
      return false;
    }

    io.to(`customer-${customerId}`).emit('notification-created', payload);
    if (userId && Number(userId) !== Number(customerId)) {
      io.to(`customer-${userId}`).emit('notification-created', payload);
    }
    await this.logNotification(payload.id, customerId, userId, 'socket', 'emitted', `notification-created emitted to customer-${customerId}`);
    return true;
  }

  static async logNotification(notificationId, customerId, userId, channel, status, detail = null) {
    try {
      await this.ensureSchema();
      await db.query(
        'INSERT INTO notification_logs (notification_id, customer_id, user_id, channel, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
        [notificationId || null, customerId || null, userId || null, channel, status, detail]
      );
    } catch (error) {
      console.error('[NOTIFICATION LOG] Failed to write log:', error.message);
    }
  }

  static async getNotificationLogs(limit = 100) {
    await this.ensureSchema();
    const [rows] = await db.query(
      `SELECT nl.*, n.title, n.type, n.vendor_id, n.order_id
       FROM notification_logs nl
       LEFT JOIN notifications n ON nl.notification_id = n.id
       ORDER BY nl.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  }

  static async createAndSendCustomerNotification({
    customerId,
    userId,
    vendorId = null,
    orderId = null,
    offerId = null,
    title,
    message,
    type,
    io = null,
    pushTitle = null,
    pushBody = null,
  }) {
    const notificationId = await this.createCustomerNotification({
      customerId,
      userId,
      vendorId,
      orderId,
      offerId,
      title,
      message,
      type,
    });
    const eventPayload = {
      id: notificationId,
      customer_id: customerId,
      vendor_id: vendorId,
      order_id: orderId,
      offer_id: offerId,
      title,
      message,
      type,
      is_read: 0,
      created_at: new Date().toISOString(),
    };
    await this.emitNotificationEvent(customerId, userId, eventPayload, io);
    await this.sendPushNotification(notificationId, customerId, userId, pushTitle || title, pushBody || message, {
      type,
      customer_id: customerId,
      vendor_id: vendorId,
      order_id: orderId,
      offer_id: offerId,
    });
    return notificationId;
  }

  static parseOfferIds(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return String(value)
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item));
    }
  }

  static async createOrUpdateOfferNotification({
    customerId,
    userId,
    vendorId,
    offerId,
    title,
    message,
    type,
    io = null,
    pushTitle = null,
    pushBody = null,
    vendorName = null,
    batchMinutes = 10,
  }) {
    await this.ensureSchema();

    const safeBatchMinutes = Math.max(1, Math.min(Number(batchMinutes) || 10, 60));
    const [batchRows] = await db.query(
      `SELECT *
       FROM offer_notification_batches
       WHERE customer_id = ?
         AND vendor_id = ?
         AND updated_at >= DATE_SUB(NOW(), INTERVAL ${safeBatchMinutes} MINUTE)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [customerId, vendorId]
    );

    if (batchRows.length === 0) {
      const notificationId = await this.createCustomerNotification({
        customerId,
        userId,
        vendorId,
        offerId,
        title,
        message,
        type,
      });

      await db.query(
        `INSERT INTO offer_notification_batches
          (vendor_id, customer_id, notification_id, offer_ids, offer_count)
         VALUES (?, ?, ?, ?, ?)`,
        [vendorId, customerId, notificationId, JSON.stringify([offerId]), 1]
      );

      const eventPayload = {
        id: notificationId,
        customer_id: customerId,
        vendor_id: vendorId,
        order_id: null,
        offer_id: offerId,
        title,
        message,
        type,
        is_read: 0,
        created_at: new Date().toISOString(),
      };
      await this.emitNotificationEvent(customerId, userId, eventPayload, io);
      await this.sendPushNotification(notificationId, customerId, userId, pushTitle || title, pushBody || message, {
        type,
        customer_id: customerId,
        vendor_id: vendorId,
        offer_id: offerId,
      });
      return notificationId;
    }

    const batch = batchRows[0];
    const offerIds = this.parseOfferIds(batch.offer_ids);
    const numericOfferId = Number(offerId);
    if (!offerIds.includes(numericOfferId)) {
      offerIds.push(numericOfferId);
    }

    const offerCount = offerIds.length;
    const groupedTitle = 'New Vendor Offers';
    const groupedMessage = `${vendorName || 'A vendor'} added ${offerCount} new offers. Tap to view the latest deal.`;

    await db.query(
      `UPDATE notifications
       SET offer_id = ?,
           title = ?,
           message = ?,
           type = ?,
           is_read = 0,
           created_at = CURRENT_TIMESTAMP
       WHERE id = ? AND customer_id = ?`,
      [offerId, groupedTitle, groupedMessage, type, batch.notification_id, customerId]
    );

    await db.query(
      `UPDATE offer_notification_batches
       SET offer_ids = ?,
           offer_count = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(offerIds), offerCount, batch.id]
    );

    await this.logNotification(
      batch.notification_id,
      customerId,
      userId,
      'database',
      'stored',
      `Grouped ${offerCount} offers into one notification`
    );

    const eventPayload = {
      id: batch.notification_id,
      customer_id: customerId,
      vendor_id: vendorId,
      order_id: null,
      offer_id: offerId,
      title: groupedTitle,
      message: groupedMessage,
      type,
      is_read: 0,
      created_at: new Date().toISOString(),
    };
    await this.emitNotificationEvent(customerId, userId, eventPayload, io);
    return batch.notification_id;
  }

  static async notifyOfferTargets(targets, title, message, type, options = {}) {
    const audience = Array.isArray(targets) ? targets : [];
    return Promise.allSettled(
      audience.map((target) =>
        this.createOrUpdateOfferNotification({
          customerId: target.customer_id,
          userId: target.user_id,
          vendorId: options.vendorId || null,
          offerId: options.offerId || null,
          title,
          message,
          type,
          io: options.io || null,
          pushTitle: options.pushTitle || null,
          pushBody: options.pushBody || null,
          vendorName: options.vendorName || null,
          batchMinutes: options.batchMinutes || 10,
        }).then((notificationId) => {
          if (options.io) {
            options.io.to(`customer-${target.customer_id}`).emit('offer-created', {
              vendor_id: options.vendorId || null,
              offer_id: options.offerId || null,
              notification_id: notificationId,
              title,
              message,
              reasons: target.reasons || [],
              created_at: new Date().toISOString(),
            });
          }
          return notificationId;
        })
      )
    );
  }

  static async createAndSendUserNotification(userId, title, message, type, referenceId = null, io = null, options = {}) {
    const target = await this.getCustomerTargetByUserId(userId);
    if (!target) {
      throw new Error(`Customer profile not found for user ${userId}`);
    }
    const orderId = options.orderId !== undefined
      ? options.orderId
      : (type.startsWith('order_') || type.startsWith('payment_') || type === 'driver_assigned' ? referenceId : null);
    return this.createAndSendCustomerNotification({
      customerId: target.customer_id,
      userId: target.user_id,
      vendorId: options.vendorId || null,
      orderId,
      offerId: options.offerId || null,
      title,
      message,
      type,
      io,
      pushTitle: options.pushTitle || null,
      pushBody: options.pushBody || null,
    });
  }

  static async notifyAllActiveCustomers(title, message, type, options = {}) {
    const targets = await this.getAllActiveCustomerTargets();
    return Promise.allSettled(
      targets.map((target) =>
        this.createAndSendCustomerNotification({
          customerId: target.customer_id,
          userId: target.user_id,
          vendorId: options.vendorId || null,
          orderId: options.orderId || null,
          offerId: options.offerId || null,
          title,
          message,
          type,
          io: options.io || null,
          pushTitle: options.pushTitle || null,
          pushBody: options.pushBody || null,
        })
      )
    );
  }

  static async notifyMultipleCustomers(title, message, type, referenceId = null, io = null, options = {}) {
    return this.notifyAllActiveCustomers(title, message, type, {
      ...options,
      orderId: options.orderId || (type.startsWith('order_') || type.startsWith('payment_') || type === 'driver_assigned' ? referenceId : null),
      io,
    });
  }
}

module.exports = NotificationModel;
