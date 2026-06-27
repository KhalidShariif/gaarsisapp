import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Phone,
  Store,
  User,
} from 'lucide-react';
import api from '../utils/api';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    contact_name: '',
    address: '',
    business_types: []
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.name || !formData.email || !formData.password || !formData.phone || !formData.contact_name || !formData.address || formData.business_types.length === 0) {
      setError('All fields are required and at least one business type must be selected');
      setLoading(false);
      return;
    }

    try {
      await api.post('/vendor/register', formData);
      navigate('/login');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container font-body flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[440px]">
        {/* Top Visual Accent */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
              <LayoutDashboard size={24} strokeWidth={2.4} aria-hidden="true" />
            </div>
            <span className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">VendorPortal</span>
          </div>
        </div>

        {/* Main Register Card */}
        <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-2xl shadow-black/5 relative overflow-hidden border border-outline-variant/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>

          <header className="mb-10 relative z-10">
            <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Create Account</h1>
            <p className="text-on-surface-variant font-medium text-sm">Join the vendor network.</p>
            {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
          </header>

          <form onSubmit={handleRegister} className="space-y-6 relative z-10">
            {/* Business Name Field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="name">Business Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <Store size={20} aria-hidden="true" />
                </div>
                <input
                  className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  id="name"
                  placeholder="Global Fuels"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  type="text"
                />
              </div>
            </div>

            {/* Contact Name Field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="contact_name">Contact Person</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <User size={20} aria-hidden="true" />
                </div>
                <input
                  className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  id="contact_name"
                  placeholder="Abdirahman Ali"
                  value={formData.contact_name}
                  onChange={handleChange}
                  required
                  type="text"
                />
              </div>
            </div>

            {/* Business Types Field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1">Business Types</label>
              <div className="flex flex-col gap-2 p-3 bg-surface-container-low border border-outline-variant/10 rounded-2xl">
                 {['Petrol Station', 'Gas Depot', 'Spare Parts Shop', 'Car Wash'].map(type => (
                   <label key={type} className="flex items-center gap-2 text-sm text-on-surface cursor-pointer font-medium">
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
                       className="rounded border-outline-variant/30 text-primary focus:ring-primary focus:ring-offset-surface bg-surface-container-high"
                     />
                     {type}
                   </label>
                 ))}
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="email">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <Mail size={20} aria-hidden="true" />
                </div>
                <input
                  className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  id="email"
                  autoComplete="email"
                  placeholder="admin@vendor.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  type="email"
                />
              </div>
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="phone">Phone Number</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <Phone size={20} aria-hidden="true" />
                </div>
                <input
                  className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  id="phone"
                  placeholder="+252 610 000 000"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  type="text"
                />
              </div>
            </div>

            {/* Address Field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="address">Business Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <MapPin size={20} aria-hidden="true" />
                </div>
                <input
                  className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  id="address"
                  placeholder="Mogadishu, Somalia"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  type="text"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="password">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <Lock size={20} aria-hidden="true" />
                </div>
                <input
                  className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  id="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  type="password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button disabled={loading} className="w-full flex justify-center py-4 px-4 rounded-2xl shadow-lg shadow-primary/20 text-sm font-bold text-on-primary bg-primary hover:bg-primary-dim transition-all active:scale-[0.98] disabled:opacity-50" type="submit">
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>

            <div className="text-center mt-4">
              <p className="text-sm font-medium text-on-surface-variant">
                Already have an account? <Link to="/login" className="text-primary hover:underline font-bold">Sign in</Link>
              </p>
            </div>
          </form>

        </div>
      </div>

      {/* Background Decorative */}
      <div className="fixed inset-0 -z-10 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
      </div>
    </div>
  );
};

export default Register;
