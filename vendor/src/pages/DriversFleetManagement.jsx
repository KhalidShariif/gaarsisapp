import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const DriversFleetManagement = () => {
  const user = JSON.parse(localStorage.getItem('vendor_user') || 'null');
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone: '',
    vehicle_type: 'Motorcycle',
    plate_number: '',
    address: '',
    dob: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    guardian_name: '',
    guardian_phone: '',
    guarantor_name: '',
    guarantor_phone: '',
    guarantor_address: ''
  });
  const [message, setMessage] = useState('');

  const fetchDrivers = async () => {
    if (!user || !user.id) return;
    try {
      setError('');
      console.log(`[DEBUG] Fetching drivers for vendorId=${user.id}`);
      const response = await api.get(`/vendor/drivers?vendorId=${user.id}`);
      console.log(`[DEBUG] Drivers Response:`, response.data);
      setDrivers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch drivers', err);
      setError(err.response?.data?.message || 'Failed to load drivers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.id) {
      fetchDrivers();
    } else {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !user.id) return;
    try {
      console.log(`[DEBUG] Onboarding driver for vendorId=${user.id}`);
      const response = await api.post('/vendor/drivers', { ...formData, vendor_id: user.id });
      console.log(`[DEBUG] Onboard Response:`, response.data);
      if (response.data.success) {
        setShowModal(false);
        fetchDrivers();
        setFormData({
          first_name: '', last_name: '', email: '', username: '', phone: '',
          vehicle_type: 'Motorcycle', plate_number: '',
          address: '', dob: '',
          emergency_contact_name: '', emergency_contact_phone: '',
          guardian_name: '', guardian_phone: '',
          guarantor_name: '', guarantor_phone: '', guarantor_address: ''
        });
        setMessage('Driver onboarded successfully! Credentials sent via email.');
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (err) {
      console.error('Onboarding error', err);
      setMessage(`❌ ${err.response?.data?.message || 'Failed to onboard driver. Please check inputs.'}`);
    }
  };

  if (!user || !user.id) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-md">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-red-700 mb-2">Authentication Required</h2>
          <p className="text-red-600 mb-4">Please log in to manage your driver fleet.</p>
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
          <h2 className="text-xl font-bold text-yellow-700 mb-2">Error Loading Drivers</h2>
          <p className="text-yellow-600 mb-4">{error}</p>
          <button onClick={fetchDrivers} className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-10">
      {/* Page Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold font-headline text-on-surface tracking-tight">Delivery Personnel</h2>
          <p className="text-on-surface-variant max-w-lg leading-relaxed font-medium">Oversee your fleet, monitor real-time availability, and optimize dispatch efficiency.</p>
          {message && (
            <div className={`mt-4 p-4 rounded-xl text-sm font-bold ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dim text-on-primary rounded-xl font-bold shadow-sm transition-all shadow-primary-container"
        >
          <span className="material-symbols-outlined">add</span>
          Onboard New Driver
        </button>
      </section>

      {/* Stats Bento */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-1 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Total Drivers</p>
          <h3 className="text-3xl font-headline font-bold text-primary">{drivers.length}</h3>
        </div>
        <div className="col-span-1 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Online Now</p>
          <h3 className="text-3xl font-headline font-bold text-on-surface">{drivers.filter(d => d.is_online).length}</h3>
        </div>
        <div className="col-span-2 bg-primary p-6 rounded-2xl border border-primary/20 relative overflow-hidden text-on-primary shadow-md">
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-on-primary/70 uppercase tracking-widest mb-4">Fleet Status</p>
            <h3 className="text-3xl font-headline font-bold">Managed Delivery Fleet</h3>
            <p className="mt-2 text-sm text-on-primary/80 font-medium">All drivers are verified and linked to your vendor account.</p>
          </div>
          <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-9xl text-white/10 opacity-30">verified</span>
        </div>
      </section>

      {/* Drivers List */}
      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-outline-variant/5 bg-surface-container-low/50 flex justify-between items-center">
          <h3 className="text-lg font-headline font-bold text-on-surface">Personnel Fleet</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-8 py-4 text-[10px] uppercase font-bold text-on-surface-variant">Driver Name</th>
                <th className="px-8 py-4 text-[10px] uppercase font-bold text-on-surface-variant">Contact</th>
                <th className="px-8 py-4 text-[10px] uppercase font-bold text-on-surface-variant">Vehicle</th>
                <th className="px-8 py-4 text-[10px] uppercase font-bold text-on-surface-variant">Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5 text-sm">
              {drivers.length > 0 ? drivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="font-bold text-on-surface">{driver.first_name} {driver.last_name}</div>
                    <div className="text-xs text-on-surface-variant">@{driver.username || 'N/A'}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-on-surface">{driver.phone}</div>
                    <div className="text-xs text-on-surface-variant">{driver.email}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-on-surface font-medium">{driver.vehicle_type}</div>
                    <div className="text-xs text-on-surface-variant">{driver.license_number || 'No Plate'}</div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${driver.is_online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {driver.is_online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-primary hover:underline font-bold text-xs">Edit</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-on-surface-variant font-bold tracking-widest uppercase opacity-50">
                    {loading ? 'Loading Drivers...' : 'No Drivers Onboarded'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Onboarding Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="px-8 py-6 bg-primary text-on-primary flex justify-between items-center shrink-0">
              <h3 className="text-xl font-headline font-bold">Onboard New Driver</h3>
              <button onClick={() => setShowModal(false)} className="material-symbols-outlined hover:bg-white/20 p-2 rounded-full transition-colors">close</button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-xs font-medium">
                🔒 Security Notice: Passwords are auto-generated for security. Please ensure all contact information provided is accurate for verification purposes.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">First Name</label>
                  <input required name="first_name" value={formData.first_name} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. Abdi" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Last Name</label>
                  <input required name="last_name" value={formData.last_name} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. Farah" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Email Address</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" placeholder="driver@fueldirect.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Username</label>
                  <input required name="username" value={formData.username} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" placeholder="abdi_driver" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Phone Number</label>
                  <input required name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" placeholder="+252 ..." />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Vehicle Type</label>
                  <select name="vehicle_type" value={formData.vehicle_type} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none">
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="TukTuk">TukTuk (Bajaj)</option>
                    <option value="Pickup Truck">Pickup Truck</option>
                    <option value="Fuel Tanker (Small)">Fuel Tanker (Small)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Personal Address</label>
                  <input required name="address" value={formData.address} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. Wadajir, Mogadishu" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Date of Birth</label>
                  <input required type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Emergency Contact Name</label>
                  <input required name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Emergency Contact Phone</label>
                  <input required name="emergency_contact_phone" value={formData.emergency_contact_phone} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Guardian Name</label>
                  <input required name="guardian_name" value={formData.guardian_name} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Guardian Phone</label>
                  <input required name="guardian_phone" value={formData.guardian_phone} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Guarantor Name</label>
                  <input required name="guarantor_name" value={formData.guarantor_name} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Guarantor Phone</label>
                  <input required name="guarantor_phone" value={formData.guarantor_phone} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Guarantor Address</label>
                <input required name="guarantor_address" value={formData.guarantor_address} onChange={handleInputChange} className="w-full bg-surface-container-high px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-2xl font-bold hover:bg-primary-dim transition-all shadow-lg shadow-primary-container">
                  Complete Driver Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriversFleetManagement;
