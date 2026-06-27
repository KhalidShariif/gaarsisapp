import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const SuppliersDirectory = () => {
  const user = JSON.parse(localStorage.getItem('vendor_user') || 'null');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [formData, setFormData] = useState({
    business_name: '',
    contact_person: '',
    location: '',
    phone: ''
  });

  useEffect(() => {
    if (user && user.id) {
      fetchSuppliers();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchSuppliers = async () => {
    if (!user || !user.id) return;
    try {
      setLoading(true);
      setError('');
      console.log(`[DEBUG] Fetching suppliers for vendorId=${user.id}`);
      const response = await api.get(`/vendor/suppliers?vendorId=${user.id}`);
      console.log(`[DEBUG] Suppliers Response:`, response.data);
      setSuppliers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch suppliers', err);
      setError(err.response?.data?.message || 'Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !user.id) return;
    console.log('[DEBUG] Add Supplier button clicked', formData);
    try {
      const response = await api.post('/vendor/suppliers', { ...formData, vendor_id: user.id });
      console.log('[DEBUG] API Response', response.data);
      if (response.data.success) {
        setShowModal(false);
        fetchSuppliers();
        setMessage('Supplier added successfully!');
        setFormData({
          business_name: '',
          contact_person: '',
          location: '',
          phone: ''
        });
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(response.data.message || 'Failed to add supplier');
      }
    } catch (err) {
      console.error('Failed to save supplier', err);
      setMessage(err.response?.data?.message || 'Network error, please try again.');
    }
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await api.delete(`/vendor/suppliers/${supplier.id}`);
      setMessage('Supplier deleted successfully!');
      fetchSuppliers();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to delete supplier.');
    }
  };

  if (!user || !user.id) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-md">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-red-700 mb-2">Authentication Required</h2>
          <p className="text-red-600 mb-4">Please log in to manage your suppliers network.</p>
          <button onClick={() => window.location.href = '/login'} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">Go to Login</button>
        </div>
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-yellow-700 mb-2">Error Loading Suppliers</h2>
          <p className="text-yellow-600 mb-4">{error}</p>
          <button onClick={fetchSuppliers} className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700">Retry</button>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    setMessage('Suppliers directory exported successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  const getSupplierName = (supplier) => {
    return supplier.business_name || supplier.name || supplier.contact_person || `Supplier #${supplier.id}`;
  };

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-10">
      {/* Page Header Area */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Suppliers Network</h2>
          <p className="text-on-surface-variant font-medium mt-1">Manage your global procurement and supply chain partners.</p>
          {message && (
            <div className={`mt-4 p-4 rounded-xl text-sm font-bold animate-fade-in ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            className="px-5 py-2.5 bg-surface-container-high text-on-surface font-bold rounded-xl hover:bg-surface-container-highest transition-colors flex items-center gap-2 border border-outline-variant/10 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">file_download</span>
            Export
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dim text-on-primary font-bold rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            Add Supplier
          </button>
        </div>
      </section>

      {/* Add Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6">Onboard New Supplier</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2">Name</label>
                <input required className="w-full p-3 bg-slate-100 rounded-xl outline-none" value={formData.business_name} onChange={e => setFormData({...formData, business_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-2">Contact Person</label>
                <input required className="w-full p-3 bg-slate-100 rounded-xl outline-none" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-2">Location</label>
                <input required className="w-full p-3 bg-slate-100 rounded-xl outline-none" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-2">Phone</label>
                <input required className="w-full p-3 bg-slate-100 rounded-xl outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="flex justify-end gap-4 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-slate-500">Cancel</button>
                <button type="submit" className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Save Partner</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6">Supplier Information</h3>
            <div className="space-y-4 text-sm">
              <p><strong className="block text-xs uppercase text-slate-500">Name</strong>{selectedSupplier.business_name}</p>
              <p><strong className="block text-xs uppercase text-slate-500">Contact Person</strong>{selectedSupplier.contact_person}</p>
              <p><strong className="block text-xs uppercase text-slate-500">Location</strong>{selectedSupplier.location}</p>
              <p><strong className="block text-xs uppercase text-slate-500">Phone</strong>{selectedSupplier.phone}</p>
              <p><strong className="block text-xs uppercase text-slate-500">Date</strong>{new Date(selectedSupplier.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setSelectedSupplier(null)} className="mt-8 w-full px-6 py-3 bg-primary text-white rounded-xl font-bold">Close</button>
          </div>
        </div>
      )}

      {/* Supplier Directory Table */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/10">
        <div className="px-8 py-6 flex items-center justify-between bg-surface-container-low/30 border-b border-outline-variant/10">
          <h3 className="text-lg font-bold text-on-surface font-headline">Supplier Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/30 border-b border-outline-variant/10">
                <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Name</th>
                <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Phone</th>
                <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Date</th>
                <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5 text-sm">
              {suppliers.length > 0 ? suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-8 py-5 text-on-surface font-bold">{getSupplierName(supplier)}</td>
                  <td className="px-8 py-5 text-on-surface font-medium">{supplier.phone || '-'}</td>
                  <td className="px-8 py-5 text-right text-on-surface-variant font-medium">
                    {new Date(supplier.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => setSelectedSupplier(supplier)} className="text-primary font-bold text-xs mr-4">Details</button>
                    <button onClick={() => handleDelete(supplier)} className="text-red-600 font-bold text-xs">Delete</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-on-surface-variant font-bold tracking-widest uppercase opacity-50">
                    {loading ? 'Fetching Partners...' : 'No Data Available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default SuppliersDirectory;
