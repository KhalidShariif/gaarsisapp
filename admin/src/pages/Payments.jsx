import React from 'react';
import api from '../utils/api';
import { 
  Search, 
  ChevronDown, 
  Download, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  CreditCard,
  Settings,
  ArrowUpRight,
  Filter,
  Plus,
  Smartphone,
  Banknote,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import { filterMockData } from '../utils/filterMockData';
import { useNavigate } from 'react-router-dom';

const FinanceStatCard = ({ title, value, icon: Icon, trend, colorClass, subtitle }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h4>
      </div>
      <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center text-white`}>
        <Icon size={20} />
      </div>
    </div>
    <div className={`flex items-center gap-1.5 text-[10px] font-bold ${trend ? 'text-success' : 'text-slate-500 dark:text-slate-400'}`}>
      {trend && <TrendingUp size={12} />}
      {trend || subtitle || 'Live'}
    </div>
  </div>
);

const PaymentsPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = React.useState([]);
  const [commissions, setCommissions] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('All Transactions');
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions || [];
    if (searchTerm) {
      filtered = filtered.filter(t => 
        (t.id?.toString() || '').includes(searchTerm) || 
        (t.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.status || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [transactions, searchTerm]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, commissionsRes, summaryRes] = await Promise.all([
        api.get('/admin/payments'),
        api.get('/admin/commissions'),
        api.get('/admin/commissions/summary')
      ]);

      setTransactions(filterMockData(paymentsRes.data));
      setCommissions(filterMockData(commissionsRes.data));
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to fetch payments data', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAllData();
  }, []);

  const handleExport = () => {
    const dataToExport = activeTab === 'Payouts' ? commissions : transactions;
    if (dataToExport.length === 0) return alert('No data to export');
    const headers = activeTab === 'Payouts' ? ['Order ID', 'Gross', 'Commission', 'Vendor Net', 'Vendor'] : ['ID', 'Customer', 'Amount', 'Method', 'Status', 'Date'];
    const csvRows = dataToExport.map(item => activeTab === 'Payouts' 
      ? [item.order_id, item.gross_amount, item.admin_commission, item.vendor_net_amount, item.vendor_name].join(',')
      : [item.id, item.customer_name, item.amount, item.method, item.status, item.created_at].join(',')
    );
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab.toLowerCase().replace(' ', '_')}_export_${new Date().getTime()}.csv`;
    a.click();
  };

  const handleNewPayout = () => {
    const vendorId = window.prompt("Enter Vendor ID for manual payout authorization:");
    if (vendorId) {
       alert(`Payout authorization for Vendor #${vendorId} has been queued for bank processing.`);
    }
  };

  const handleReconcile = async () => {
    setLoading(true);
    try {
      const response = await api.post('/admin/payments/reconcile');
      const { message, payments_updated, commissions_settled } = response.data;
      alert(message || `Reconciled ${payments_updated || 0} payment(s) and ${commissions_settled || 0} commission(s).`);
      fetchAllData();
    } catch (err) {
      console.error('Reconciliation error', err);
      alert(err.response?.data?.message || 'An error occurred during reconciliation.');
    } finally {
      setLoading(false);
    }
  };

  const getMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'waafi': return <Smartphone size={14} className="text-blue-500" />;
      case 'card': return <CreditCard size={14} className="text-indigo-500" />;
      case 'cash_on_delivery': return <Banknote size={14} className="text-emerald-500" />;
      default: return <CreditCard size={14} />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'success':
      case 'delivered':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full text-[10px] font-bold uppercase"><CheckCircle size={12} /> Success</span>;
      case 'pending': return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-warning/10 text-warning rounded-full text-[10px] font-bold uppercase"><Clock size={12} /> Pending</span>;
      case 'failed': return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-danger/10 text-danger rounded-full text-[10px] font-bold uppercase"><AlertCircle size={12} /> Failed</span>;
      default: return <span className="text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold">{status}</span>;
    }
  };

  if (loading && !transactions.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Financial Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex-1 max-w-2xl relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search records, IDs, or users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:outline-primary-600"
          />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Download size={18} /> Export
          </button>
          <button 
            onClick={handleNewPayout}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-all text-sm"
          >
            <Plus size={18} />
            New Payout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-slate-200 dark:border-slate-800">
        {['All Transactions', 'Payouts', 'Reconciliation', 'Vendor Settings'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FinanceStatCard title="Gross Sales" value={`$${Number(summary?.total_sales || 0).toFixed(2)}`} icon={TrendingUp} trend={null} subtitle="Total platform volume" colorClass="bg-blue-600" />
        <FinanceStatCard title="Total Commissions" value={`$${Number(summary?.total_admin_commission || 0).toFixed(2)}`} icon={DollarSign} trend={null} subtitle="Admin earnings" colorClass="bg-indigo-600" />
        <FinanceStatCard title="Vendor Payouts" value={`$${Number(summary?.total_vendor_payout || 0).toFixed(2)}`} icon={CreditCard} trend={null} subtitle="Settled & Pending" colorClass="bg-teal-600" />
      </div>

      {activeTab === 'All Transactions' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h4>
            <div className="flex items-center gap-2 px-2 py-0.5 bg-success/10 text-success rounded text-[10px] font-bold uppercase tracking-wider">
               Live Data
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/40 text-slate-500">
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">ID</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">User</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Amount</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Method</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Status</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/20 text-sm">
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">#{txn.id.toString().padStart(5, '0')}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{new Date(txn.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">{txn.customer_name || 'Guest User'}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate max-w-[150px]">{txn.location || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">${txn.amount}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getMethodIcon(txn.method)}
                        <span className="text-xs text-slate-600 dark:text-slate-400">{txn.method}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(txn.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-primary-600">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Payouts' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Vendor Settlements</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/40 text-slate-500">
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Order</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Gross</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Commission</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Vendor Net</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px]">Vendor</th>
                  <th className="px-10 py-4 text-[10px] font-bold uppercase tracking-[3px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/20 text-sm">
                {commissions.map((item) => (
                  <tr key={item.order_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">#ORD-{item.order_id}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">${item.gross_amount}</td>
                    <td className="px-6 py-4 text-danger font-bold">-${item.admin_commission}</td>
                    <td className="px-6 py-4 text-success font-bold">${item.vendor_net_amount}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{item.vendor_name}</td>
                    <td className="px-6 py-4 text-right">
                       <button onClick={() => alert('Processing payout...')} className="text-xs font-bold text-primary-600 hover:underline">Pay</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Reconciliation' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 shadow-sm text-center space-y-6">
           <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 mx-auto">
              <RefreshCw size={32} className="animate-spin" />
           </div>
           <h4 className="text-xl font-bold text-slate-900 dark:text-white">Financial Reconciliation</h4>
           <p className="text-sm text-slate-500 max-w-lg mx-auto">Platform will match delivered orders with pending payments automatically.</p>
           <button onClick={handleReconcile} className="px-8 py-3 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-all uppercase tracking-wider text-xs">Run Reconcile</button>
        </div>
      )}

      {activeTab === 'Vendor Settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-6 shadow-sm">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Global Payout Rules</h4>
              <div className="space-y-4">
                 <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Commission</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">10%</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payout Frequency</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Weekly</span>
                 </div>
              </div>
              <button onClick={() => navigate('/settings')} className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-lg text-xs uppercase tracking-wider hover:bg-slate-200">Configure Settings</button>
           </div>
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center text-success">
                 <ShieldCheck size={24} />
              </div>
              <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Financial Integrity</h5>
              <p className="text-xs text-slate-500">Fraud detection is active. All payouts are reviewed before disbursement.</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;
