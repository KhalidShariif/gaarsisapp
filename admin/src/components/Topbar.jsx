import React from 'react';
import { Search, Bell, Settings, Users, Store, ClipboardList, Moon, Sun, Menu, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const Topbar = ({ title, onMenuClick }) => {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [showResults, setShowResults] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [isDark, setIsDark] = React.useState(document.documentElement.classList.contains('dark'));
  
  // Notifications State
  const [notifications, setNotifications] = React.useState([]);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const playAlarm = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.log('Audio not allowed yet', e);
    }
  };

  const fetchNotifications = async (initial = false) => {
    try {
      const response = await api.get('/admin/notifications');
      const newNotifs = response.data || [];
      
      setNotifications(prev => {
        if (!initial) {
          const prevUnread = prev.filter(n => !n.is_read).map(n => n.id);
          const currentUnread = newNotifs.filter(n => !n.is_read);
          
          // Find completely new notifications not in prevUnread
          const newlyAdded = currentUnread.filter(n => !prevUnread.includes(n.id));
          
          if (newlyAdded.length > 0) {
            playAlarm();
            setToast(newlyAdded[0].message);
            setTimeout(() => setToast(null), 5000);
          }
        }
        return newNotifs;
      });
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  React.useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => fetchNotifications(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/admin/notifications/mark-all-read');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 1) {
        setSearching(true);
        try {
          const response = await api.get(`/admin/search?q=${query}`);
          setResults(response.data || []);
          setShowResults(true);
        } catch (err) {
          console.error('Search error', err);
          setResults([]);
        } finally {
          setSearching(false);
        }
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <header className="h-16 sm:h-20 fixed top-0 right-0 left-0 lg:left-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/40 z-40 px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>
        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        <div className="relative group w-[320px] hidden md:block">
          <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searching ? 'text-primary-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`} />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length > 1 && setShowResults(true)}
            placeholder="Quick search..." 
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2 pl-12 pr-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all"
          />

          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                {results.map((result, idx) => (
                  <button
                    key={`${result.type}-${result.id}-${idx}`}
                    onClick={() => {
                      const path = result.type === 'user' ? '/users' : result.type === 'vendor' ? '/vendors' : '/operations';
                      navigate(path);
                      setShowResults(false);
                      setQuery('');
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 text-left"
                  >
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-slate-500">
                      {result.type === 'user' ? <Users size={16} /> : result.type === 'vendor' ? <Store size={16} /> : <ClipboardList size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{result.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{result.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[10px] text-primary-600 font-bold uppercase hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => !n.is_read && markAsRead(n.id)}
                        className={`px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer transition-colors ${!n.is_read ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <p className={`text-xs ${!n.is_read ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(n.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2" />
          
          <button onClick={() => navigate('/settings')} className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Admin</p>
              <p className="text-[10px] text-slate-500 uppercase leading-tight">Super User</p>
            </div>
            <Settings size={16} className="text-slate-400 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in z-50">
          <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 dark:text-primary-600">
            <User size={16} />
          </div>
          <p className="text-sm font-bold">{toast}</p>
        </div>
      )}
    </header>
  );
};

export default Topbar;
