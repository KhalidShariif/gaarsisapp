import React, { useState, useEffect } from 'react';
import { 
  Banknote, Fuel, Flame, Settings, ClipboardList, Truck, TriangleAlert, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import VendorAvatar from '../components/VendorAvatar';
import { useVendorProfile } from '../hooks/useVendorProfile';
import { getVendorDisplayName } from '../utils/vendorIdentity';

const DashboardOverview = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total_sales: 0,
    total_commission: 0,
    net_sales: 0,
    fuel_stock: 0,
    gas_stock: 0,
    total_inventory: 0,
    pending_orders: 0,
    active_deliveries: 0
  });

  const [user] = useState(() => JSON.parse(localStorage.getItem('vendor_user') || 'null'));
  const { vendor } = useVendorProfile();

  useEffect(() => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setError(null);
        setLoading(true);
        const token = localStorage.getItem('vendor_token') || '';
        
        console.log(`[DEBUG] Dashboard Fetch - URL: ${api.defaults.baseURL}/vendor/stats`);
        console.log(`[DEBUG] Token being used: ${token ? 'PRESENT' : 'MISSING'}`);

        const [statsRes, invRes] = await Promise.all([
          api.get(`/vendor/stats?vendorId=${user.id}`),
          api.get(`/vendor/inventory?vendorId=${user.id}`)
        ]);
        
        console.log(`[DEBUG] Dashboard Stats Response:`, statsRes.data);
        
        setInventory(invRes.data || []);
        
        if (statsRes.data?.success) {
          const d = statsRes.data.data;
          // Safe-parse all numeric fields from DB (they may arrive as strings)
          setStats({
            total_sales:      parseFloat(d.total_sales      || 0),
            total_commission: parseFloat(d.total_commission || 0),
            net_sales:        parseFloat(d.net_sales        || 0),
            fuel_stock:       parseFloat(d.fuel_stock       || 0),
            gas_stock:        parseFloat(d.gas_stock        || 0),
            total_inventory:  parseFloat(d.total_inventory  || 0),
            pending_orders:   Number(d.pending_orders       || 0),
            active_deliveries:Number(d.active_deliveries    || 0),
          });
          if (d.recent_orders) {
            setOrders(d.recent_orders);
          }
        } else {
          console.warn('[DEBUG] Stats API returned success=false:', statsRes.data);
          setError(statsRes.data?.message || 'Failed to load dashboard statistics');
        }
      } catch (err) {
        console.error('[DEBUG] Dashboard fetch failed:', err?.response?.status, err?.response?.data || err.message);
        setError(err.response?.data?.message || 'Network error: Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const pendingOrders = stats.pending_orders || 0;
  const activeDeliveries = stats.active_deliveries || 0;
  const fuelStock = stats.fuel_stock || 0;
  const gasStock = stats.gas_stock || 0;
  
  const recentOrders = orders.slice(0, 3);
  const lowStockItems = inventory.filter(i => Number(i.stock || 0) < Number(i.reorder_level || 10));

  if (!user || !user.id) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-red-50 border border-red-200 rounded-3xl text-center shadow-lg">
        <h2 className="text-2xl font-bold text-red-700 font-headline mb-4">Authentication Required</h2>
        <p className="text-on-surface-variant font-medium mb-6">
          No authenticated vendor session was found. Please sign in to access this page.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-on-surface-variant font-bold uppercase tracking-widest">Loading Dashboard...</div>;
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-red-50 border border-red-200 rounded-3xl text-center shadow-lg animate-fade-in">
        <h2 className="text-2xl font-bold text-red-700 font-headline mb-4">Error Loading Dashboard</h2>
        <p className="text-on-surface-variant font-medium mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="font-body max-w-[1400px] mx-auto space-y-6 pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-headline text-on-surface">Dashboard Overview</h1>
          <p className="text-sm text-on-surface-variant">Real-time performance metrics for your supply chain.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 shadow-sm">
          <VendorAvatar vendor={vendor} size="sm" rounded="rounded-xl" />
          <div>
            <p className="text-sm font-bold text-on-surface">{getVendorDisplayName(vendor)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Vendor Account</p>
          </div>
        </div>
      </div>

      {/* Stats Cards — 6 cards in 2 rows of 3 on large screens */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1 — Total Sales (Gross) */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-primary border border-primary-fixed/50">
              <Banknote size={16} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Gross Sales</p>
            <p className="text-xl font-bold font-headline text-on-surface">${stats.total_sales.toFixed(2)}</p>
            <p className="text-[10px] text-error font-medium uppercase tracking-wider mt-0.5">-${stats.total_commission.toFixed(2)} Fee</p>
          </div>
        </div>
        
        {/* Card 2 — Fuel Stock (Petrol/Diesel) */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Fuel size={16} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Fuel Stock</p>
            <p className="text-xl font-bold font-headline text-blue-700">{Math.round(fuelStock).toLocaleString()}</p>
            <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider mt-0.5">Liters</p>
          </div>
        </div>

        {/* Card 3 — Gas Stock (Gas Cylinder) */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <Flame size={16} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Gas Stock</p>
            <p className="text-xl font-bold font-headline text-orange-600">{Math.round(gasStock).toLocaleString()}</p>
            <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider mt-0.5">Units / KG</p>
          </div>
        </div>

        {/* Card 4 — Net Earnings (Vendor Net) */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <Banknote size={16} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Net Earnings</p>
            <p className="text-xl font-bold font-headline text-green-700">${stats.net_sales.toFixed(2)}</p>
            <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider mt-0.5">After 2% Comm.</p>
          </div>
        </div>

        {/* Card 5 — Pending Orders */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <ClipboardList size={16} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Pending Orders</p>
            <p className="text-xl font-bold font-headline text-on-surface">{pendingOrders}</p>
          </div>
        </div>

        {/* Card 6 — Active Deliveries */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-primary">
              <Truck size={16} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Active Deliveries</p>
            <p className="text-xl font-bold font-headline text-on-surface">{activeDeliveries}</p>
          </div>
        </div>
      </div>

      {/* Bottom Grid (Orders & Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Orders table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-outline-variant/20">
            <h2 className="text-base font-bold font-headline text-on-surface">Recent Orders</h2>
            <button 
              onClick={() => navigate('/orders_list')}
              className="text-on-surface-variant flex items-center gap-1 text-xs font-medium hover:text-on-surface transition-colors"
            >
              View All <span className="text-lg leading-none">&rarr;</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 text-xs font-bold text-on-surface-variant tracking-wider uppercase border-b border-outline-variant/20">
                  <th className="py-4 px-6 font-medium">Order ID</th>
                  <th className="py-4 px-6 font-medium">Customer</th>
                  <th className="py-4 px-6 font-medium">Amount</th>
                  <th className="py-4 px-6 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm text-on-surface divide-y divide-outline-variant/10">
                {recentOrders.length > 0 ? recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="py-4 px-6 font-bold text-primary-dim">#ORD-{(order.id ?? 0).toString().padStart(4, '0')}</td>
                    <td className="py-4 px-6">{order.customer_name ?? 'Unknown'}</td>
                    <td className="py-4 px-6 font-bold">${order.total_amount ?? '0.00'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 font-semibold text-[10px] rounded-full uppercase tracking-wide ${
                        order.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                        order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                        'bg-primary-fixed text-primary-dim'
                      }`}>
                        {order.status ?? 'Pending'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-on-surface-variant font-bold tracking-widest uppercase opacity-50">
                      No Data Available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Alerts Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2 pb-1 border-b border-transparent">
             <TriangleAlert size={20} className="text-error" />
             <h2 className="text-base font-bold font-headline text-on-surface">Stock Alerts</h2>
          </div>
          
          {lowStockItems.length > 0 ? lowStockItems.map((item) => (
            <div key={item.id} className="bg-error-container/20 rounded-xl p-5 border-l-4 border-error mb-4">
              <h3 className="text-xs font-bold text-on-error-container uppercase mb-2">Critical: {item.name ?? 'Unknown'}</h3>
              <p className="text-sm text-on-surface mb-4 leading-relaxed">Stock dropped below {item.reorder_level ?? 100} {item.unit ?? 'Units'} (Current: {item.stock ?? 0}).</p>
              <button 
                onClick={() => navigate('/inventory_management')}
                className="text-xs font-bold text-error uppercase border-b-2 border-error pb-0.5 hover:border-transparent transition-colors"
              >
                Reorder Now
              </button>
            </div>
          )) : (
            <div className="bg-surface-container-high rounded-xl p-5 border-l-4 border-primary-fixed-dim">
              <div className="flex gap-2">
                <div className="mt-0.5"><Info size={16} className="text-primary-dim" /></div>
                <div>
                  <h3 className="text-xs font-bold text-on-surface uppercase mb-2">All Clear</h3>
                  <p className="text-sm text-on-surface mb-2 leading-relaxed">All inventory items are currently above their reorder levels.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
