import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  MapPin,
  Search,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  Store,
  TrendingUp,
  AlertCircle,
  ChevronDown
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</h3>
      </div>
      <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

const AdminDeliveryZones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('all');
  const [vendors, setVendors] = useState([]);
  const [message, setMessage] = useState('');
  const [editModal, setEditModal] = useState(null); // zone object or null
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchZones();
    fetchVendors();
  }, []);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/delivery-zones');
      setZones(res.data || []);
    } catch (err) {
      console.error('Failed to fetch zones:', err);
      showMsg('❌ Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get('/admin/vendors');
      setVendors(res.data || []);
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    }
  };

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleToggle = async (zone) => {
    try {
      const res = await api.put(`/admin/delivery-zones/${zone.id}`, {
        is_active: zone.is_active ? 0 : 1,
      });
      if (res.data.success) {
        fetchZones();
        showMsg(`Zone "${zone.zone_name}" ${zone.is_active ? 'disabled' : 'enabled'}`);
      }
    } catch (err) {
      showMsg('❌ Failed to toggle zone');
    }
  };

  const openEdit = (zone) => {
    setEditModal(zone);
    setEditForm({
      zone_name: zone.zone_name,
      delivery_fee: zone.delivery_fee,
      estimated_time: zone.estimated_time || '',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/admin/delivery-zones/${editModal.id}`, editForm);
      if (res.data.success) {
        setEditModal(null);
        fetchZones();
        showMsg('✅ Zone updated successfully!');
      }
    } catch (err) {
      showMsg('❌ Failed to update zone');
    }
  };

  const handleDelete = async (id, zoneName) => {
    if (!window.confirm(`Delete zone "${zoneName}"? This cannot be undone.`)) return;
    try {
      const res = await api.delete(`/admin/delivery-zones/${id}`);
      if (res.data.success) {
        setZones(prev => prev.filter(z => z.id !== id));
        showMsg('✅ Zone deleted');
      }
    } catch (err) {
      showMsg('❌ Failed to delete zone');
    }
  };

  const filtered = zones.filter(z => {
    const matchSearch = z.zone_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (z.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchVendor = filterVendor === 'all' || String(z.vendor_id) === filterVendor;
    return matchSearch && matchVendor;
  });

  const totalZones = zones.length;
  const activeZones = zones.filter(z => z.is_active).length;
  const avgFee = zones.length > 0
    ? (zones.reduce((s, z) => s + parseFloat(z.delivery_fee || 0), 0) / zones.length)
    : 0;
  const uniqueVendors = [...new Set(zones.map(z => z.vendor_id))].length;

  return (
    <div className="p-8 space-y-8 min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <MapPin size={18} className="text-white" />
            </div>
            Delivery Zones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Oversee all vendor delivery zones and fee configurations system-wide.
          </p>
        </div>
        {message && (
          <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
            message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Zones" value={totalZones} icon={MapPin} colorClass="bg-indigo-500" />
        <StatCard title="Active Zones" value={activeZones} icon={ToggleRight} colorClass="bg-green-500" />
        <StatCard title="Avg. Fee" value={`$${avgFee.toFixed(2)}`} icon={DollarSign} colorClass="bg-amber-500" />
        <StatCard title="Vendors Configured" value={uniqueVendors} icon={Store} colorClass="bg-purple-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search zone name or vendor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div className="relative">
          <select
            value={filterVendor}
            onChange={e => setFilterVendor(e.target.value)}
            className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none cursor-pointer"
          >
            <option value="all">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={String(v.id)}>
                {v.business_name || v.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Zone</th>
              <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor</th>
              <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fee</th>
              <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Est. Time</th>
              <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="py-4 px-6 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {loading ? (
              <tr>
                <td colSpan="6" className="py-16 text-center text-slate-400 font-semibold">
                  Loading zones...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <AlertCircle size={36} />
                    <p className="font-semibold">No zones found</p>
                    <p className="text-xs">Try adjusting your search or filter</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(zone => (
                <tr key={zone.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <MapPin size={14} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{zone.zone_name}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">ID: {zone.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <Store size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {zone.vendor_name || `Vendor #${zone.vendor_id}`}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-base font-bold text-green-600">
                      ${parseFloat(zone.delivery_fee).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={13} />
                      <span>{zone.estimated_time || '—'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleToggle(zone)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                        zone.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {zone.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                      {zone.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(zone)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(zone.id, zone.zone_name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Edit Zone</h3>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase mb-2 text-slate-500 tracking-widest">Zone Name</label>
                <input
                  required
                  className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30"
                  value={editForm.zone_name}
                  onChange={e => setEditForm({ ...editForm, zone_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-2 text-green-600 tracking-widest">Delivery Fee ($)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl outline-none font-bold text-green-700 focus:ring-2 focus:ring-green-300"
                  value={editForm.delivery_fee}
                  onChange={e => setEditForm({ ...editForm, delivery_fee: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-2 text-slate-500 tracking-widest">Estimated Time</label>
                <input
                  placeholder="e.g. 20-30 min"
                  className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none font-semibold text-slate-900 dark:text-white"
                  value={editForm.estimated_time}
                  onChange={e => setEditForm({ ...editForm, estimated_time: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-transform"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeliveryZones;
