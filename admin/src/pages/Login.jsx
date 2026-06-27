import React from 'react';
import { Mail, Lock, Eye, ArrowRight, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const LoginPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = React.useState('admin@fueldirect.com');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/admin/login', { email, password });
      const data = response.data;
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      {/* Login Card */}
      <div className="w-full max-w-[440px] space-y-8">
         <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                 <LayoutDashboard size={24} />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Portal</h2>
              <p className="text-slate-500 mt-2">Secure access for FuelDirect management.</p>
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm py-2 px-4 rounded-lg font-medium">
                {error}
              </div>
            )}
          </div>

         <form onSubmit={handleLogin} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-6">
            <div className="space-y-2">
               <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="email">Email</label>
               <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    id="email"
                    type="email" 
                    required
                    placeholder="admin@fueldirect.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-primary-600 transition-all"
                  />
               </div>
            </div>

            <div className="space-y-2">
               <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="password">Password</label>
                  <button type="button" className="text-xs font-bold text-primary-600 hover:underline">Forgot?</button>
               </div>
               <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    id="password"
                    type={showPassword ? "text" : "password"} 
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-11 pr-11 text-slate-900 dark:text-white focus:outline-none focus:border-primary-600 transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                     <Eye size={18} />
                  </button>
               </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 active:scale-[0.98] transition-all uppercase tracking-widest text-xs disabled:opacity-50 shadow-md"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight size={16} />
            </button>
         </form>

         <div className="flex items-center justify-center gap-2 text-slate-500">
            <ShieldCheck size={16} className="text-success" />
            <p className="text-xs">Secure Admin Access Only</p>
         </div>
      </div>
    </div>
  );
};

export default LoginPage;
