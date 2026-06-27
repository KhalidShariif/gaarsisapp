import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  ClipboardList, 
  Users, 
  Truck,
  ArrowUpRight,
  Dot
} from 'lucide-react';
import { filterMockData } from '../utils/filterMockData';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, colorClass }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:shadow-md transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{title}</span>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
      </div>
      <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
    <div className="flex items-center gap-2">
      {trendValue && trendValue !== '-' && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${trend === 'up' ? 'text-success bg-success/10' : trend === 'down' ? 'text-danger bg-danger/10' : 'text-slate-500 bg-slate-500/10'}`}>
          {trend === 'up' ? <TrendingUp size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : <Dot size={10} />}
          {trendValue}
        </div>
      )}
      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Live Data</span>
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = React.useState({
    revenue: 0,
    revenueTrend: '0%',
    revenueTrendDir: 'up',
    activeOrders: 0,
    ordersTrend: '0%',
    ordersTrendDir: 'up',
    newCustomers: 0,
    activeDrivers: 0,
    recentOrders: [],
    revenueTrends: [],
    fuelDistribution: []
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [activePeriod, setActivePeriod] = React.useState('month');
  const [isDark, setIsDark] = React.useState(document.documentElement.classList.contains('dark'));

  // Listen for theme changes
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const fetchStats = React.useCallback(async (period = activePeriod, showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      console.log(`DEBUG: Calling API /admin/stats?period=${period}`);
      const response = await api.get(`/admin/stats?period=${period}`);
      console.log('DEBUG: Response status:', response.status);
      
      const data = response.data;
      if (data.recentOrders) {
        data.recentOrders = filterMockData(data.recentOrders);
      }
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch stats', err);
      console.log('DEBUG: Backend error details:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Connection to backend failed');
    } finally {
      setLoading(false);
    }
  }, [activePeriod]);

  React.useEffect(() => {
    fetchStats(activePeriod, true);
    
    // Live polling: every 30 seconds
    const interval = setInterval(() => {
      fetchStats(activePeriod, false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [activePeriod, fetchStats]);

  if (loading && !stats.revenueTrends.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Synchronizing Live Data...</p>
      </div>
    );
  }

  if (error && !stats.revenueTrends.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
        <div className="w-16 h-16 bg-danger/10 text-danger rounded-2xl flex items-center justify-center shadow-lg">
           <TrendingDown size={32} />
        </div>
        <div className="space-y-2">
          <h4 className="text-xl font-bold text-white">Data Sync Failed</h4>
          <p className="text-slate-400 text-sm max-w-md mx-auto">{error}. Check your backend connection or credentials.</p>
        </div>
        <button 
          onClick={() => fetchStats(activePeriod, true)}
          className="px-8 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all border border-slate-700"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const chartColors = {
    stroke: '#3B82F6',
    grid: isDark ? '#1E293B' : '#E2E8F0',
    tick: isDark ? '#475569' : '#64748B',
    tooltipBg: isDark ? '#1E293B' : '#FFFFFF',
    tooltipBorder: isDark ? '#334155' : '#E2E8F0',
    tooltipText: isDark ? '#CBD5E1' : '#1E293B'
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`$${(stats.revenue || 0).toLocaleString()}`} icon={CreditCard} trend={stats.revenueTrendDir} trendValue={stats.revenueTrend} colorClass="bg-blue-600" />
        <StatCard title="Total Commission" value={`$${(stats.totalCommission || 0).toLocaleString()}`} icon={ArrowUpRight} trend={null} trendValue="-" colorClass="bg-emerald-600" />
        <StatCard title="Active Orders" value={stats.activeOrders.toString()} icon={ClipboardList} trend={stats.ordersTrendDir} trendValue={stats.ordersTrend} colorClass="bg-indigo-600" />
        <StatCard title="Active Drivers" value={stats.activeDrivers.toString()} icon={Truck} trend={null} trendValue="-" colorClass="bg-amber-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6 items-stretch">
        {/* Revenue Trends */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Revenue Trends</h4>
              <p className="text-xs text-slate-500 mt-1">Net revenue growth last {activePeriod}</p>
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {['today', 'week', 'month', 'year'].map(p => (
                <button 
                  key={p}
                  onClick={() => setActivePeriod(p)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all capitalize ${activePeriod === p ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.revenueTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: chartColors.tick, fontSize: 10}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, borderRadius: '8px', border: `1px solid ${chartColors.tooltipBorder}`, color: chartColors.tooltipText, fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="value" stroke={chartColors.stroke} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col h-full shadow-sm">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Category Distribution</h4>
          <div className="flex-1 flex flex-col justify-center relative min-h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.fuelDistribution || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                  {(stats?.fuelDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: chartColors.tooltipBg, borderRadius: '8px', border: `1px solid ${chartColors.tooltipBorder}`, fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{(stats?.fuelDistribution || []).reduce((acc, curr) => acc + curr.value, 0)}</span>
              <span className="text-[10px] font-medium text-slate-500 uppercase">Orders</span>
            </div>
          </div>
          
          <div className="space-y-2 mt-6">
            {(stats?.fuelDistribution || []).map((fuel) => (
              <div key={fuel.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fuel.color }} />
                  <span className="text-xs text-slate-600 dark:text-slate-400">{fuel.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{fuel.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table Row */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h4>
          <button 
            onClick={() => navigate('/operations')}
            className="text-xs font-semibold text-primary-600 hover:underline"
          >
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {stats?.recentOrders?.length > 0 ? (
                stats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">#{order.id.toString().padStart(5, '0')}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{order.customer_name}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">${order.total_amount}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        ['delivered', 'Delivered'].includes(order.status) ? 'text-success bg-success/10' : 
                        ['pending', 'Pending'].includes(order.status) ? 'text-warning bg-warning/10' : 
                        'text-primary-600 bg-primary-600/10'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-10 py-20 text-center text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                    {loading ? 'Fetching records...' : 'No real orders found in database'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
