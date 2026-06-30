import React from 'react';
import api from '../utils/api';
import { 
  Store, 
  MapPin, 
  Star, 
  MoreVertical, 
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Package,
  Plus,
  Download,
  Filter,
  ArrowUpDown,
  Search,
  Trash2,
  Edit2,
  CheckCircle,
  KeyRound
} from 'lucide-react';
import { filterMockData } from '../utils/filterMockData';

const VendorStatCard = ({ title, value, icon: Icon, trendValue, colorClass }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</h3>
      </div>
      <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}>
        {React.createElement(Icon, { size: 20, className: 'text-white' })}
      </div>
    </div>
    <div className={`flex items-center gap-1 text-[10px] font-bold text-success`}>
      <TrendingUp size={12} />
      {trendValue} 
      <span className="text-slate-500 font-normal ml-1">Live data</span>
    </div>
  </div>
);

const VendorsPage = () => {
  const [vendors, setVendors] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('All Vendors');
  const [selectedVendor, setSelectedVendor] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingVendor, setEditingVendor] = React.useState(null);

  const filteredVendors = React.useMemo(() => {
    let filtered = vendors || [];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(v => (v.display_name || v.business_name || v.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    // Tab filter
    if (activeTab === 'Fuel Stations') {
      filtered = filtered.filter(v => {
        const typeStr = Array.isArray(v.business_types) ? v.business_types.join(' ') : (v.business_type || '');
        return typeStr.toLowerCase().includes('petrol') || typeStr.toLowerCase().includes('gas') || typeStr.toLowerCase().includes('fuel');
      });
    } else if (activeTab === 'Shops & Retail') {
      filtered = filtered.filter(v => {
        const typeStr = Array.isArray(v.business_types) ? v.business_types.join(' ') : (v.business_type || '');
        return !typeStr.toLowerCase().includes('petrol') && !typeStr.toLowerCase().includes('gas') && !typeStr.toLowerCase().includes('fuel') && typeStr.trim() !== '';
      });
    }
    
    return filtered;
  }, [vendors, searchTerm, activeTab]);

  const [formData, setFormData] = React.useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    username: '',
    address: '',
    city: '',
    district: '',
    latitude: '',
    longitude: '',
    business_types: [],
    verification_status: 'pending'
  });

  const handleExport = () => {
    console.log('DEBUG: Export Vendors Clicked');
    if (vendors.length === 0) {
      alert('No data to export');
      return;
    }
    const headers = ['ID', 'Business Name', 'Email', 'Address', 'Status', 'Rating'];
    const csvRows = vendors.map(v => [
      v.id,
      v.display_name || v.business_name || v.name,
      v.email,
      v.address,
      v.status,
      v.rating
    ].join(','));
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendors_export_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('DEBUG: Export Complete');
  };

  const handleOnboard = async (e) => {
    e.preventDefault();
    if (formData.business_types.length === 0) {
      alert("Please select at least one business type.");
      return;
    }
    console.log('DEBUG: Creating vendor with payload:', formData);
    try {
      await api.post('/admin/vendors', formData);
      setShowModal(false);
      setFormData({ 
        business_name: '', contact_name: '', email: '', phone: '', username: '', 
        address: '', city: '', district: '', latitude: '', longitude: '', business_types: [], verification_status: 'pending' 
      });
      fetchVendors();
      alert('Vendor onboarded successfully! Credentials sent via email.');
    } catch (err) {
      console.error('Failed to onboard vendor', err);
      alert(err.response?.data?.message || 'Failed to onboard vendor');
    }
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const apiUrl = '/admin/vendors';
      console.log('DEBUG Vendors: API URL =>', apiUrl);
      const response = await api.get(apiUrl);
      const data = filterMockData(response.data);
      console.log('DEBUG Vendors: response body =>', response.data);
      console.log('DEBUG Vendors: vendor count =>', data.length);
      if (data.length > 0) console.log('DEBUG Vendors: first vendor =>', data[0]);
      setVendors(data);
    } catch (err) {
      console.error('Failed to fetch vendors', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchVendors();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleVerifyVendor = async (vendorId, newStatus) => {
    try {
      const response = await api.patch(`/admin/vendors/${vendorId}/verify`, { status: newStatus });
      alert(response.data.message || 'Vendor verified successfully!');
      fetchVendors();
    } catch (err) {
      console.error('Failed to update vendor status', err);
      alert('Error updating status: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditVendor = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      business_name: vendor.business_name || vendor.name || '',
      contact_name: vendor.contact_name || '',
      email: vendor.email,
      phone: vendor.phone,
      username: vendor.username || '',
      password: '',
      address: vendor.address || '',
      city: vendor.city || '',
      district: vendor.district || '',
      latitude: vendor.latitude || '',
      longitude: vendor.longitude || '',
      business_types: vendor.business_types || [vendor.business_type].filter(Boolean),
      verification_status: vendor.status
    });
    setShowEditModal(true);
  };

  const handleUpdateVendor = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/vendors/${editingVendor.id}`, formData);
      alert('Vendor profile updated.');
      setShowEditModal(false);
      fetchVendors();
    } catch (err) {
      console.error('Update vendor error', err);
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/admin/vendors/${vendorId}`);
      alert('Vendor deleted.');
      fetchVendors();
    } catch (err) {
      console.error('Delete vendor error', err);
    }
  };

  const handleResetPassword = async (vendor) => {
    if (!window.confirm(`Reset password for ${vendor.display_name || vendor.business_name || vendor.name || 'this vendor'}?`)) return;
    try {
      const response = await api.post(`/admin/vendors/${vendor.id}/reset-password`);
      const tempPassword = response.data?.temporaryPassword;
      alert(tempPassword
        ? `${response.data.message}\n\nTemporary password: ${tempPassword}`
        : (response.data.message || 'Password reset email sent.'));
    } catch (err) {
      console.error('Reset vendor password error', err);
      alert(err.response?.data?.message || 'Failed to reset vendor password.');
    }
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'verified': return 'text-success bg-success/10';
      case 'pending': return 'text-warning bg-warning/10';
      case 'suspended': return 'text-danger bg-danger/10';
      case 'rejected': return 'text-danger bg-danger/10';
      default: return 'text-slate-500 bg-slate-500/10';
    }
  };

  return (
    <div className="space-y-10">
      {/* Onboard Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[40px] p-10 shadow-2xl">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-manrope">Onboard New Vendor</h3>
              <form onSubmit={handleOnboard} className="space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Business Name</label>
                      <input 
                        required
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="e.g. SomGas Station"
                        value={formData.business_name}
                        onChange={e => setFormData({...formData, business_name: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Owner Name</label>
                      <input 
                        required
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="Owner Name"
                        value={formData.contact_name}
                        onChange={e => setFormData({...formData, contact_name: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Username</label>
                      <input 
                        required
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="vendor_user"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2 flex items-end">
                     <p className="text-xs text-slate-500 pb-1">🔒 A secure password will be auto-generated and emailed.</p>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Email</label>
                      <input 
                        required
                        type="email"
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="contact@vendor.com"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Phone</label>
                      <input 
                        required
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="+252..."
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Address</label>
                      <input 
                        required
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="Main St, Mogadishu"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">City</label>
                      <input 
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="City"
                        value={formData.city}
                        onChange={e => setFormData({...formData, city: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">District</label>
                      <input 
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="District"
                        value={formData.district}
                        onChange={e => setFormData({...formData, district: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Latitude</label>
                      <input 
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="Lat"
                        value={formData.latitude}
                        onChange={e => setFormData({...formData, latitude: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Longitude</label>
                      <input 
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        placeholder="Lng"
                        value={formData.longitude}
                        onChange={e => setFormData({...formData, longitude: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Business Type</label>
                      <div className="flex flex-col gap-2 p-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl">
                         {['Petrol Station', 'Gas Depot', 'Spare Parts Shop', 'Car Wash'].map(type => (
                           <label key={type} className="flex items-center gap-2 text-sm text-slate-900 dark:text-white cursor-pointer">
                             <input 
                               type="checkbox"
                               checked={formData.business_types.includes(type)}
                               onChange={(e) => {
                                 if (e.target.checked) {
                                   setFormData({...formData, business_types: [...formData.business_types, type]});
                                 } else {
                                   setFormData({...formData, business_types: formData.business_types.filter(t => t !== type)});
                                 }
                               }}
                               className="rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-600 focus:ring-offset-slate-900 bg-slate-50 dark:bg-slate-900/50"
                             />
                             {type}
                           </label>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Status</label>
                      <select
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        value={formData.verification_status}
                        onChange={e => setFormData({...formData, verification_status: e.target.value})}
                      >
                         <option value="pending">Pending</option>
                         <option value="verified">Verified</option>
                         <option value="suspended">Suspended</option>
                      </select>
                   </div>
                 </div>
                 <div className="flex justify-end gap-4 mt-8">
                    <button 
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-8 py-3 text-slate-600 dark:text-slate-400 font-bold text-sm hover:text-slate-900 dark:text-white transition-colors"
                    >
                       Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-10 py-3 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-600/20 hover:bg-primary-500 transition-all"
                    >
                       Start Onboarding
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Vendor Details Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[40px] p-10 shadow-2xl relative">
              <button onClick={() => setSelectedVendor(null)} className="absolute top-6 right-6 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white">✕</button>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-manrope">Vendor Details</h3>
              <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Business Name:</strong> <span className="text-slate-900 dark:text-white text-base">{selectedVendor.name || selectedVendor.business_name}</span></p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Owner Name:</strong> {selectedVendor.contact_name || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Username:</strong> {selectedVendor.username || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Email:</strong> {selectedVendor.email || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Phone:</strong> {selectedVendor.phone || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Address:</strong> {selectedVendor.address || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">City:</strong> {selectedVendor.city || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">District:</strong> {selectedVendor.district || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Coordinates:</strong> {selectedVendor.latitude || 'N/A'}, {selectedVendor.longitude || 'N/A'}</p>
                <p><strong className="text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Type:</strong> {selectedVendor.business_types && selectedVendor.business_types.length > 0 ? selectedVendor.business_types.join(', ') : (selectedVendor.business_type || 'N/A')}</p>
              </div>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Vendors</h2>
          <p className="text-slate-500 text-sm">Oversee partner fuel stations and retail shops.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Download size={16} /> Export
          </button>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-primary-700 transition-colors">
            <Plus size={16} /> Add Vendor
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <VendorStatCard title="Total Vendors" value={(vendors?.length || 0).toLocaleString()} icon={Store} trend="up" trendValue="Live" colorClass="bg-blue-600" />
        <VendorStatCard title="Active Stations" value={(vendors?.filter(v => v.status === 'verified').length || 0).toString()} icon={TrendingUp} trend="up" trendValue="Verified" colorClass="bg-teal-600" />
        <VendorStatCard title="Pending Verification" value={(vendors?.filter(v => v.status === 'pending').length || 0).toString()} icon={ShieldCheck} trend="up" trendValue="Requires action" colorClass="bg-amber-600" />
        <VendorStatCard title="Total Orders" value={(vendors || []).reduce((sum, v) => sum + (parseInt(v.total_orders) || 0), 0).toString()} icon={Package} trend="up" trendValue="All vendors" colorClass="bg-indigo-600" />
      </div>

      {/* List Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex gap-4">
            {['All Vendors', 'Fuel Stations', 'Shops & Retail'].map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === tab ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pl-9 pr-4 text-xs focus:outline-primary-600 w-48"
                />
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredVendors.length > 0 ? (
                filteredVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs">
                          {(v.display_name || v.business_name || v.name || 'V').substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{v.display_name || v.business_name || v.name || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-500">ID: {v.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} />
                        <span className="text-xs truncate max-w-[150px]">
                          {[v.address, v.city, v.district].filter(Boolean).join(', ') || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusStyle(v.status || 'pending')}`}>
                        {v.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                         <Star size={14} className="text-amber-500 fill-amber-500" />
                         <span className="font-bold text-slate-900 dark:text-white">{v.rating || '0.0'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setSelectedVendor(v)} className="p-2 text-slate-400 hover:text-primary-600" title="View Details">
                          <ChevronRight size={14} />
                        </button>
                        {v.verification_status !== 'verified' && (
                          <button onClick={() => handleVerifyVendor(v.id, 'verified')} className="p-2 text-slate-400 hover:text-success" title="Verify Vendor">
                            <CheckCircle size={14} />
                          </button>
                        )}
                        <button onClick={() => handleEditVendor(v)} className="p-2 text-slate-400 hover:text-primary-600" title="Edit Profile">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleResetPassword(v)} className="p-2 text-slate-400 hover:text-amber-600" title="Reset Password">
                          <KeyRound size={14} />
                        </button>
                        <button onClick={() => handleDeleteVendor(v.id)} className="p-2 text-slate-400 hover:text-red-600">
                           <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-10 py-20 text-center text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                    No Data Available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-10 py-6 flex items-center justify-between bg-slate-50 dark:bg-slate-900/20 border-t border-slate-200 dark:border-slate-800/40">
           <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
             Showing <span className="text-slate-600 dark:text-slate-400">{filteredVendors.length}</span> of <span className="text-slate-600 dark:text-slate-400">{vendors.length}</span> vendors
           </p>
           <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">All records loaded</p>
        </div>
      </div>
      {/* Edit Vendor Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[40px] p-10 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-manrope">Update Vendor Profile</h3>
              <form onSubmit={handleUpdateVendor} className="space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Business Name</label>
                      <input 
                        required
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        value={formData.business_name}
                        onChange={e => setFormData({...formData, business_name: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Email</label>
                      <input 
                        required
                        type="email"
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Phone</label>
                      <input 
                        required
                        className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                   </div>
                 </div>
                 <div className="flex justify-end gap-4 mt-8">
                    <button 
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-8 py-3 text-slate-600 dark:text-slate-400 font-bold text-sm hover:text-slate-900 dark:text-white transition-colors"
                    >
                       Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-10 py-3 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-600/20 hover:bg-primary-500 transition-all"
                    >
                       Update Vendor
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default VendorsPage;
