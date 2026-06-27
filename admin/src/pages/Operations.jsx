import React from 'react';
import api from '../utils/api';
import { 
  Users,
  Store,
  Download,
  MapPin,
  Clock,
  MoreVertical,
  Star,
  Truck,
  Filter,
  Search,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { filterMockData } from '../utils/filterMockData';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default leaflet icon issue with Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createDriverIcon = (isOnline) => L.divIcon({
  className: '',
  html: `
    <div style="
      width: 38px; height: 38px;
      background: ${isOnline ? '#10B981' : '#475569'};
      border: 3px solid ${isOnline ? '#34D399' : '#64748B'};
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 15px ${isOnline ? 'rgba(16,185,129,0.4)' : 'rgba(0,0,0,0.3)'};
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -22],
});

const LiveMap = ({ drivers: _drivers }) => {
  const [driverLocations, setDriverLocations] = React.useState([]);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchLocations = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await api.get('/admin/driver-locations');
      setDriverLocations(filterMockData(res.data || []));
    } catch {
      setDriverLocations([]);
    } finally {
      setLastRefresh(new Date());
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 15000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm mt-8">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Live Driver Map
          </h3>
          <p className="text-xs text-slate-500">
            {driverLocations.length} drivers visible · Updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-success">
              <div className="w-1.5 h-1.5 rounded-full bg-success" /> Online
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Offline
            </span>
          </div>
          <button
            onClick={fetchLocations}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-primary-600 transition-colors"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <div style={{ height: '400px' }}>
        <MapContainer
          center={[2.0469, 45.3182]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {driverLocations.map(driver => {
            const lat = parseFloat(driver.current_latitude ?? driver.current_lat ?? driver.lat);
            const lng = parseFloat(driver.current_longitude ?? driver.current_lng ?? driver.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return (
              <Marker
                key={driver.id}
                position={[lat, lng]}
                icon={createDriverIcon(driver.is_online)}
              >
                <Popup>
                  <div className="p-2">
                    <p className="font-bold text-sm">{driver.first_name || driver.username}</p>
                    <p className={`text-[10px] font-bold uppercase ${driver.is_online ? 'text-success' : 'text-slate-400'}`}>
                      {driver.is_online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

const OrderCard = ({ name, type, eta, status, id, iconClass, onAssign }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-center justify-between gap-4 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 ${iconClass} rounded-lg flex items-center justify-center text-primary-600`}>
        <Truck size={24} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h5 className="font-bold text-slate-900 dark:text-white">{name}</h5>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
            status === 'ON_THE_WAY' ? 'bg-blue-100 text-blue-600' : 
            status === 'DELIVERED' ? 'bg-success/10 text-success' :
            'bg-slate-100 text-slate-500'
          }`}>{status}</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
           <span className="flex items-center gap-1"><MapPin size={12} /> {type}</span>
           <span className="flex items-center gap-1"><Clock size={12} /> {eta}</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-slate-400">#{id}</span>
      <div className="flex gap-1">
        {status === 'CONFIRMED' || status === 'PENDING' ? (
          <button 
            onClick={onAssign}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary-700 transition-colors"
          >
            Assign
          </button>
        ) : null}
        <button className="p-2 text-slate-400 hover:text-primary-600">
          <MoreVertical size={16} />
        </button>
      </div>
    </div>
  </div>
);

const DriverCard = ({ name, type, rating, status, img, onAssign }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold">
            {img ? <img src={img} className="w-full h-full rounded-lg object-cover" /> : (name || '?').charAt(0)}
          </div>
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
            status === 'ONLINE' ? 'bg-success' : 'bg-slate-400'
          }`} />
        </div>
        <div>
          <h6 className="font-bold text-slate-900 dark:text-white text-xs">{name}</h6>
          <p className="text-[10px] text-slate-500 uppercase font-bold">{type}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-amber-500">
        <Star size={10} className="fill-amber-500" />
        <span className="text-[10px] font-bold">{rating}</span>
      </div>
    </div>
    <div className="flex items-center justify-between">
      <span className={`text-[10px] font-bold uppercase ${status === 'ONLINE' ? 'text-success' : 'text-slate-400'}`}>
        {status}
      </span>
      <button onClick={onAssign} className="text-[10px] font-bold text-primary-600 hover:underline">
        ASSIGN
      </button>
    </div>
  </div>
);

const OperationsPage = () => {
  const [orders, setOrders] = React.useState([]);
  const [drivers, setDrivers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [orderSearch, setOrderSearch] = React.useState('');
  const [driverSearch, setDriverSearch] = React.useState('');
  const [showNewOrderModal, setShowNewOrderModal] = React.useState(false);
  const [newOrderData, setNewOrderData] = React.useState({
    customer_id: '',
    vendor_id: '',
    total_amount: '',
    delivery_address: ''
  });

  const [stats, setStats] = React.useState(null);

  const fetchData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [ordersRes, driversRes, statsRes] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/admin/users?role=driver'),
        api.get('/admin/stats')
      ]);

      setOrders(filterMockData(ordersRes.data || []));
      setDrivers(filterMockData(driversRes.data || []));
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch operations data', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData(true);
    // Poll every 15 seconds for operations
    const interval = setInterval(() => fetchData(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAssignDriver = async (orderId) => {
    const driverId = window.prompt("Enter Driver ID:");
    if (!driverId) return;

    try {
      await api.patch(`/admin/orders/${orderId}/assign`, { driverId });
      alert("Assigned successfully!");
      fetchData(false);
    } catch (err) {
      console.error("Assign driver error", err);
      alert("Failed to assign driver.");
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status });
      fetchData(false);
    } catch (err) {
      console.error("Status update error", err);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/orders', newOrderData);
      alert("Order created!");
      setShowNewOrderModal(false);
      fetchData(false);
    } catch (err) {
      console.error("Create order error", err);
      alert("Failed to create order.");
    }
  };

  if (loading && !orders.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Synchronizing Fleet & Orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Stats Row */}
      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Active Orders</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{stats?.activeOrders || 0}</h3>
            <Truck size={16} className="text-primary-600 mb-1" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Live Drivers</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{stats?.onlineDrivers || 0}</h3>
            <MapPin size={16} className="text-success mb-1" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Vendors</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{stats?.totalVendors || 0}</h3>
            <Store size={16} className="text-warning mb-1" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Customers</p>
          <div className="flex items-end justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{stats?.newCustomers || 0}</h3>
            <Users size={16} className="text-primary-600 mb-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Col: Orders */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Active Dispatch</h3>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Monitoring {orders.length} shipments</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pl-9 pr-4 text-xs w-48"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto no-scrollbar pr-2">
              {(orders || []).filter(o => 
                (o.vendor_name || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                (o.id || '').toString().includes(orderSearch)
              ).length > 0 ? (
                (orders || []).filter(o => 
                  (o.vendor_name || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
                  (o.id || '').toString().includes(orderSearch)
                ).map((order) => (
                  <div key={order.id} className="relative group">
                    <OrderCard 
                      name={order.vendor_name || 'Vendor'} 
                      type={order.fuel_type || 'Fuel'} 
                      eta={new Date(order.created_at).toLocaleTimeString()} 
                      status={order.status?.toUpperCase() || 'UNKNOWN'} 
                      id={`#ORD-${order.id.toString().padStart(4, '0')}`} 
                      iconClass="bg-primary-600/10" 
                      onAssign={() => handleAssignDriver(order.id)}
                    />
                    <div className="absolute right-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                       {['Processing', 'In Transit', 'Delivered', 'Cancelled'].map(s => (
                         <button 
                          key={s}
                          onClick={() => handleUpdateOrderStatus(order.id, s)}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[8px] font-bold uppercase rounded hover:bg-primary-500 hover:text-white transition-all border border-slate-200 dark:border-slate-700"
                         >
                           {s}
                         </button>
                       ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-slate-600 font-bold uppercase tracking-[3px] bg-slate-50 dark:bg-slate-900/20 rounded-3xl border border-slate-200 dark:border-slate-800/40">
                  {loading ? 'Refreshing...' : 'No Active Dispatch Orders'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Drivers */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Live Fleet</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                  {(drivers || []).filter(d => d.is_online).length} online
                </p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pl-9 pr-4 text-xs w-24"
                />
              </div>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
              {(drivers || []).filter(d => (d.name || d.username || '').toLowerCase().includes(driverSearch.toLowerCase())).length > 0 ? (
                (drivers || []).filter(d => (d.name || d.username || '').toLowerCase().includes(driverSearch.toLowerCase())).map((driver) => (
                  <DriverCard 
                    key={driver.id}
                    name={driver.name || driver.username} 
                    type={driver.vehicle_type || 'Truck'} 
                    rating={driver.driver_rating ? parseFloat(driver.driver_rating).toFixed(1) : '5.0'}
                    status={driver.is_online ? 'ONLINE' : 'OFFLINE'} 
                    img={driver.profile_picture || null} 
                    onAssign={() => {
                      const orderId = window.prompt(`Enter Order ID:`);
                      if (orderId) {
                         const cleanId = orderId.replace('#ORD-', '').replace(/^0+/, '');
                         api.patch(`/admin/orders/${cleanId}/assign`, { driverId: driver.id })
                           .then(() => { alert('Assigned!'); fetchData(false); })
                           .catch(() => alert('Failed.'));
                      }
                    }}
                  />
                ))
              ) : (
                <div className="py-6 text-center text-slate-600 font-bold uppercase tracking-widest">
                  No Active Fleet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Live Map */}
      <LiveMap drivers={drivers} />

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-[40px] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-manrope">Dispatch New Order</h3>
              <form onSubmit={handleCreateOrder} className="space-y-5">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Customer ID</label>
                    <input required className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white" value={newOrderData.customer_id} onChange={e => setNewOrderData({...newOrderData, customer_id: e.target.value})} placeholder="e.g. 1" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Vendor ID</label>
                    <input required className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white" value={newOrderData.vendor_id} onChange={e => setNewOrderData({...newOrderData, vendor_id: e.target.value})} placeholder="e.g. 1" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Amount ($)</label>
                    <input required type="number" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white" value={newOrderData.total_amount} onChange={e => setNewOrderData({...newOrderData, total_amount: e.target.value})} placeholder="0.00" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Delivery Address</label>
                    <textarea required className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white h-24" value={newOrderData.delivery_address} onChange={e => setNewOrderData({...newOrderData, delivery_address: e.target.value})} placeholder="Destination details..." />
                 </div>
                 <div className="flex justify-end gap-4 mt-8">
                    <button type="button" onClick={() => setShowNewOrderModal(false)} className="px-6 py-3 text-slate-500 font-bold text-sm uppercase">Cancel</button>
                    <button type="submit" className="px-8 py-3 bg-primary-600 text-white font-bold rounded-2xl shadow-lg">Confirm Dispatch</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default OperationsPage;
