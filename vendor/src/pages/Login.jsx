import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Lock, Mail } from 'lucide-react';
import api from '../utils/api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/vendor/login', { email, password });
      
      localStorage.setItem('vendor_token', response.data.token);
      localStorage.setItem('vendor_user', JSON.stringify(response.data.vendor));
      
      if (response.data.must_change_password) {
        localStorage.setItem('vendor_must_change_password', 'true');
        localStorage.setItem('vendor_settings_tab', 'security');
        navigate('/settings');
      } else {
        localStorage.removeItem('vendor_must_change_password');
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Connection error');
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

        {/* Main Login Card */}
        <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-2xl shadow-black/5 relative overflow-hidden border border-outline-variant/10">
          {/* Asymmetric Design Element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          
          <header className="mb-10 relative z-10">
            <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Welcome Back</h1>
            <p className="text-on-surface-variant font-medium text-sm">Access the vendor management suite.</p>
            {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
          </header>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  type="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">Password</label>
                <button type="button" className="text-[10px] font-bold text-primary hover:underline">Forgot?</button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <Lock size={20} aria-hidden="true" />
                </div>
                <input 
                  className="block w-full pl-12 pr-4 py-3.5 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium" 
                  id="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  type="password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button disabled={loading} className="w-full flex justify-center py-4 px-4 rounded-2xl shadow-lg shadow-primary/20 text-sm font-bold text-on-primary bg-primary hover:bg-primary-dim transition-all active:scale-[0.98] disabled:opacity-50" type="submit">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          {/* Footer Section */}
          <footer className="mt-8 pt-6 border-t border-outline-variant/10 text-center relative z-10 space-y-4">
            <p className="text-sm font-medium text-on-surface-variant">
              Don't have an account? <Link to="/register" className="text-primary hover:underline font-bold">Register</Link>
            </p>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Secured Enterprise Access
            </p>
          </footer>
        </div>

        {/* Bottom Links */}
        <div className="mt-10 flex justify-center gap-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
          <a className="hover:text-primary transition-colors" href="#">Privacy</a>
          <a className="hover:text-primary transition-colors" href="#">Terms</a>
          <a className="hover:text-primary transition-colors" href="#">Support</a>
        </div>
      </div>
      
      {/* Background Decorative */}
      <div className="fixed inset-0 -z-10 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
      </div>
    </div>
  );
};

export default Login;
