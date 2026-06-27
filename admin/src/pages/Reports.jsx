import React from 'react';
import api from '../utils/api';
import { 
  Download, 
  ChevronDown, 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  Star,
  ArrowUpRight,
  BarChart3,
  Timer,
  ShieldCheck,
  Dot
} from 'lucide-react';
import { 
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, CartesianGrid
} from 'recharts';



const MiniStat = ({ label, value, trend, icon: Icon, colorClass }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400">
        <Icon size={20} />
      </div>
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
        {trend}
      </span>
    </div>
    <div>
       <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
       <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h4>
    </div>
  </div>
);

const ReportsPage = () => {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [activePeriod, setActivePeriod] = React.useState('month');
  const [showPeriodDropdown, setShowPeriodDropdown] = React.useState(false);

  const fetchStats = React.useCallback(async (period = activePeriod) => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/stats?period=${period}`);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch reports stats', err);
    } finally {
      setLoading(false);
    }
  }, [activePeriod]);

  React.useEffect(() => {
    fetchStats();
  }, [activePeriod, fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const defaults = {
    revenue: 0,
    newCustomers: 0,
    activeOrders: 0,
    activeDrivers: 0,
    revenueTrends: [],
    efficiencyData: [],
    fuelDistribution: []
  };

  const reportsData = stats ? { ...defaults, ...stats } : defaults;
  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h2>
           <p className="text-sm text-slate-500">Comprehensive overview of platform performance.</p>
        </div>
        <button 
          onClick={() => {
            if (!stats) return alert('No stats to export');
            const headers = ['Metric', 'Value'];
            const rows = [
              ['Total Revenue', reportsData.revenue],
              ['New Customers', reportsData.newCustomers],
              ['Active Orders', reportsData.activeOrders],
              ['Active Drivers', reportsData.activeDrivers]
            ];
            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${new Date().getTime()}.csv`;
            a.click();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors text-sm uppercase tracking-wider"
        >
           <Download size={16} /> Export
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setActiveFilter('all')}
               className={`px-5 py-2.5 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-primary-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-800 dark:text-slate-200'}`}
             >
               All Reports
             </button>
             <button 
               onClick={() => setActiveFilter('financial')}
               className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl border transition-all text-[10px] uppercase tracking-widest group ${activeFilter === 'financial' ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-800 dark:text-slate-200'}`}
             >
                Financial <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
             </button>
             <button 
               onClick={() => setActiveFilter('operations')}
               className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl border transition-all text-[10px] uppercase tracking-widest group ${activeFilter === 'operations' ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-800 dark:text-slate-200'}`}
             >
                Operations <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
             </button>
          </div>
         <div className="flex items-center gap-3 relative">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[3px]">Period:</span>
            <button 
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 text-primary-500 text-[10px] font-bold uppercase tracking-widest hover:text-primary-400 transition-colors"
            >
               {activePeriod === 'today' ? 'Today' : 
                activePeriod === 'week' ? 'Last 7 Days' : 
                activePeriod === 'year' ? 'This Year' : 'Last 30 Days'} 
               <ChevronDown size={14} className={`transition-transform ${showPeriodDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showPeriodDropdown && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'Last 7 Days' },
                  { id: 'month', label: 'Last 30 Days' },
                  { id: 'year', label: 'This Year' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePeriod(p.id);
                      setShowPeriodDropdown(false);
                      setLoading(true);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${activePeriod === p.id ? 'text-primary-500 bg-primary-600/5' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800/50'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
         </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {(activeFilter === 'all' || activeFilter === 'financial') && (
           <MiniStat label="Total Revenue" value={`$${Number(reportsData?.revenue || 0).toLocaleString()}`} trend="Live" icon={TrendingUp} colorClass="bg-success text-success border-success" />
         )}
         {(activeFilter === 'all' || activeFilter === 'financial') && (
           <MiniStat label="Avg Order Value" value={`$${(reportsData?.activeOrders || 0) > 0 ? (Number(reportsData?.revenue || 0) / reportsData.activeOrders).toFixed(2) : '0.00'}`} trend="Live" icon={ArrowUpRight} colorClass="bg-blue-500 text-blue-500 border-blue-500" />
         )}
         {(activeFilter === 'all' || activeFilter === 'operations') && (
           <MiniStat label="Active Orders" value={reportsData?.activeOrders || 0} trend="Live" icon={ShoppingCart} colorClass="bg-orange-500 text-orange-500 border-orange-500" />
         )}
         {(activeFilter === 'all' || activeFilter === 'operations') && (
           <MiniStat label="Active Drivers" value={reportsData?.activeDrivers || 0} trend="Live" icon={Star} colorClass="bg-violet-500 text-violet-500 border-violet-500" />
         )}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Sales Reports */}
         {(activeFilter === 'all' || activeFilter === 'financial') && (
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">Sales Overview</h4>
                <p className="text-xs text-slate-500">Transaction history and daily peaks</p>
              </div>
              <div className="p-6">
                  <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportsData?.revenueTrends || []}>
                           <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#3B82F6" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10}} dy={10} />
                           <YAxis hide />
                           <Tooltip cursor={{fill: '#F8FAFC'}} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
              </div>
           </div>
         )}

         {/* Operations / User Growth */}
         {(activeFilter === 'all' || activeFilter === 'operations') && (
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">{activeFilter === 'operations' ? 'Performance' : 'User Growth'}</h4>
                <p className="text-xs text-slate-500">Operational performance over time</p>
              </div>
              <div className="p-6">
                  <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={activeFilter === 'operations' ? reportsData?.efficiencyData : reportsData?.revenueTrends || []}>
                           <Line type="monotone" dataKey={activeFilter === 'operations' ? 'val' : 'value'} stroke="#3B82F6" strokeWidth={3} dot={{r: 4, fill: '#3B82F6'}} />
                           <XAxis dataKey="name" hide />
                           <Tooltip />
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
              </div>
           </div>
         )}
      </div>
    </div>
  );
};

export default ReportsPage;
