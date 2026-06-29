import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Bell, CheckCircle2, Menu, PackageOpen, Truck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import VendorAvatar from './VendorAvatar';
import { useVendorProfile } from '../hooks/useVendorProfile';
import { getVendorDisplayName } from '../utils/vendorIdentity';
import api, { SOCKET_URL } from '../utils/api';

const Topbar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { vendor } = useVendorProfile();
  const vendorName = getVendorDisplayName(vendor);
  const user = useMemo(() => JSON.parse(localStorage.getItem('vendor_user') || 'null'), []);
  const token = localStorage.getItem('vendor_token');
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const previousAlarmKeys = useRef(new Set());
  const alarmSnapshotReady = useRef(false);

  const ringAlarm = useCallback((title, message) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.value = 0.08;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.16);
      }
    } catch {
      // Browser can block audio before user interaction; the visible badge still updates.
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }, []);

  const fetchNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!user?.id) return;
    try {
      if (!silent) setLoadingAlerts(true);
      const [notificationRes, monitoringRes, ordersRes] = await Promise.all([
        api.get('/vendor/notifications'),
        api.get(`/vendor/lpg-monitoring?vendorId=${user.id}`).catch(() => ({ data: null })),
        api.get(`/vendor/orders?vendorId=${user.id}`).catch(() => ({ data: [] })),
      ]);

      const serverNotifications = notificationRes.data || [];
      setNotifications(serverNotifications);

      const monitoring = monitoringRes.data || {};
      const tankAlerts = (monitoring.tanks || [])
        .filter((tank) => Number(tank.low_level_alarm) === 1)
        .map((tank) => ({
          key: `tank-${tank.product_id}`,
          title: 'Low LPG stock',
          message: `${tank.name}: ${Number(tank.liters_remaining || 0).toLocaleString()} liters remaining.`,
          type: 'low_stock',
          created_at: new Date().toISOString(),
        }));

      const customerLpgAlerts = (monitoring.customer_levels || [])
        .filter((level) => Number(level.low_level_alarm) === 1)
        .map((level) => ({
          key: `customer-lpg-${level.customer_id}-${level.product_id || 'default'}`,
          title: 'Customer LPG low',
          message: `${level.customer_name}: ${Number(level.remaining_liters || 0).toLocaleString()} liters remaining.`,
          type: 'lpg_customer_low',
          created_at: new Date().toISOString(),
        }));

      const orderAlerts = (ordersRes.data || [])
        .filter((order) => ['pending', 'pending_payment', 'pending_driver_assignment'].includes(String(order.status || '').toLowerCase()))
        .slice(0, 8)
        .map((order) => ({
          key: `order-${order.id}-${order.status}`,
          title: String(order.status).toLowerCase() === 'pending_driver_assignment' ? 'Assign another driver' : 'Order needs attention',
          message: `Order #${order.id} is ${String(order.status || '').replaceAll('_', ' ')}.`,
          type: 'order_attention',
          created_at: order.created_at || new Date().toISOString(),
        }));

      const nextLiveAlerts = [...tankAlerts, ...customerLpgAlerts, ...orderAlerts];
      const nextKeys = new Set(nextLiveAlerts.map((alert) => alert.key));
      const hasNewAlarm = nextLiveAlerts.some((alert) => !previousAlarmKeys.current.has(alert.key));
      previousAlarmKeys.current = nextKeys;
      setLiveAlerts(nextLiveAlerts);

      if (alarmSnapshotReady.current && hasNewAlarm) {
        const first = nextLiveAlerts[0];
        ringAlarm(first.title, first.message);
      }
      alarmSnapshotReady.current = true;
    } catch (error) {
      console.error('Failed to load vendor alarms', error);
    } finally {
      setLoadingAlerts(false);
    }
  }, [ringAlarm, user?.id]);

  useEffect(() => {
    fetchNotifications({ silent: true });
    const interval = window.setInterval(() => fetchNotifications({ silent: true }), 60000);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.id || !token) return undefined;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnection: true });
    const refreshWithAlarm = (payload = {}) => {
      const title = payload.status === 'rejected' ? 'Driver rejected order' : 'New vendor alert';
      const message = payload.order_id ? `Order #${payload.order_id} needs attention.` : 'Please check your vendor portal.';
      ringAlarm(title, message);
      fetchNotifications({ silent: true });
    };

    socket.on('connect', () => socket.emit('join-vendor-room', user.id));
    socket.on('order-assignment-created', refreshWithAlarm);
    socket.on('order-assignment-overdue', refreshWithAlarm);
    socket.on('assignment-response-overdue', refreshWithAlarm);
    socket.on('driver-rejected-order', refreshWithAlarm);
    socket.on('delivery-status-updated', refreshWithAlarm);
    socket.on('inventory-updated', refreshWithAlarm);
    socket.on('lpg-level-updated', refreshWithAlarm);

    return () => socket.disconnect();
  }, [fetchNotifications, ringAlarm, token, user?.id]);

  const unreadCount = notifications.filter((item) => Number(item.is_read) === 0).length + liveAlerts.length;
  const combinedAlerts = [
    ...liveAlerts.map((alert) => ({ ...alert, is_live: true, id: alert.key })),
    ...notifications,
  ].slice(0, 12);

  const markRead = async (notification) => {
    if (notification.is_live || Number(notification.is_read) === 1) return;
    await api.patch(`/vendor/notifications/${notification.id}/read`);
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: 1 } : item));
  };

  const handleBellClick = () => {
    setIsOpen((value) => !value);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    fetchNotifications({ silent: true });
  };

  const getAlertIcon = (type) => {
    if (String(type || '').includes('stock') || String(type || '').includes('lpg')) return <PackageOpen size={16} />;
    if (String(type || '').includes('delivery') || String(type || '').includes('driver')) return <Truck size={16} />;
    return <Bell size={16} />;
  };

  return (
    <header className="h-16 sm:h-20 bg-surface border-b border-outline-variant/20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-10 font-body">
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
        aria-label="Open navigation"
      >
        <Menu size={22} />
      </button>

      {/* Search Bar */}
      <div className="hidden sm:block flex-1 max-w-xl relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-outline pointer-events-none">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search analytics, orders, or stock..."
          className="block w-full pl-10 pr-3 py-2.5 rounded-xl border-none bg-surface-container-low text-sm placeholder-outline focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors"
        />
      </div>

      {/* Right Tools - Notification & Profile */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 sm:ml-4">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            className="relative p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
            title="Alarms and notifications"
          >
            <Bell size={20} className={unreadCount > 0 ? 'animate-pulse text-primary' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden z-50">
              <div className="px-5 py-4 flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low/40">
                <div>
                  <p className="text-sm font-extrabold text-on-surface">Alarms & Notifications</p>
                  <p className="text-[11px] text-on-surface-variant font-semibold">{unreadCount} needs attention</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-surface-container">
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loadingAlerts && (
                  <div className="px-5 py-4 text-xs font-bold text-on-surface-variant">Loading alarms...</div>
                )}
                {!loadingAlerts && combinedAlerts.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <CheckCircle2 className="mx-auto text-green-500 mb-3" size={34} />
                    <p className="text-sm font-bold text-on-surface">No active alarms</p>
                    <p className="text-xs text-on-surface-variant mt-1">Orders, driver responses, and LPG stock are clear.</p>
                  </div>
                )}
                {combinedAlerts.map((item) => (
                  <button
                    key={`${item.is_live ? 'live' : 'db'}-${item.id}`}
                    onClick={() => markRead(item)}
                    className={`w-full text-left px-5 py-4 border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors ${
                      item.is_live || Number(item.is_read) === 0 ? 'bg-primary/5' : 'bg-white'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${
                        item.is_live || Number(item.is_read) === 0 ? 'bg-primary text-white' : 'bg-slate-100 text-on-surface-variant'
                      }`}>
                        {getAlertIcon(item.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-extrabold text-on-surface truncate">{item.title || 'Vendor Alert'}</p>
                          {(item.is_live || Number(item.is_read) === 0) && (
                            <span className="text-[9px] font-black uppercase text-error">New</span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{item.message}</p>
                        <p className="text-[10px] text-on-surface-variant/70 mt-2 font-bold">
                          {item.is_live ? 'Live alarm' : new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div 
          onClick={() => navigate('/settings')}
          className="flex items-center gap-3 cursor-pointer pl-4 border-l border-outline-variant/20 group hover:bg-surface-container-low p-2 rounded-xl transition-all"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{vendorName}</p>
            <p className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Vendor</p>
          </div>
          <VendorAvatar vendor={vendor} size="sm" className="shadow-sm" />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
