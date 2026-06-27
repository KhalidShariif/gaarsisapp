import React from 'react';
import api from '../utils/api';
import { 
  Save, 
  RefreshCw, 
  Shield, 
  Bell, 
  Smartphone, 
  Globe, 
  CreditCard,
  Mail,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

const SettingGroup = ({ title, description, children }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
      <h4 className="font-bold text-slate-900 dark:text-white">{title}</h4>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </div>
    <div className="p-6 space-y-6">
      {children}
    </div>
  </div>
);

const SettingItem = ({ label, description, children, icon: Icon }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
    <div className="flex items-start gap-4 max-w-md">
      {Icon && (
        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 mt-1">
          <Icon size={20} />
        </div>
      )}
      <div>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
);

const SettingsPage = () => {
  const [settings, setSettings] = React.useState({
    app_name: 'SwiftFuel',
    support_email: 'support@swiftfuel.com',
    payout_frequency: 'weekly',
    min_payout_amount: '50',
    tax_rate: '10',
    session_timeout: '1 Hour',
    two_factor_auth: 'false',
    email_notifications: 'true',
    browser_push: 'true'
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('general');

  const fetchSettings = React.useCallback(async () => {
    try {
      const response = await api.get('/admin/settings');
      const data = response.data;
      setSettings(prev => {
        const settingsObj = { ...prev };
        data.forEach(s => settingsObj[s.setting_key] = s.setting_value);
        return settingsObj;
      });
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/admin/settings', { settings });
      alert('Settings synchronized with production database successfully!');
      fetchSettings();
    } catch (err) {
      console.error('Save error', err);
      alert(err.response?.data?.message || 'Network error during synchronization.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Configuration...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all relative ${
                activeTab === tab.id ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white font-bold rounded-lg shadow-md hover:bg-primary-700 transition-all text-sm uppercase tracking-wider disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          {saving ? 'Syncing...' : 'Save'}
        </button>
      </div>

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'general' && (
          <SettingGroup title="General Configuration" description="Manage your platform's basic identity and contact information.">
            <SettingItem 
              label="Application Name" 
              description="The name of your platform displayed in the admin panel and customer emails."
              icon={Globe}
            >
              <input 
                type="text" 
                value={settings.app_name} 
                onChange={(e) => updateSetting('app_name', e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 w-64 transition-colors"
              />
            </SettingItem>
            <SettingItem 
              label="Support Email" 
              description="This email will be used for all customer support inquiries and system notifications."
              icon={Mail}
            >
              <input 
                type="email" 
                value={settings.support_email} 
                onChange={(e) => updateSetting('support_email', e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 w-64 transition-colors"
              />
            </SettingItem>
          </SettingGroup>
        )}

        {activeTab === 'payments' && (
          <SettingGroup title="Payment & Payouts" description="Configure currency, tax rates, and vendor payout schedules.">
            <SettingItem 
              label="Payout Frequency" 
              description="How often vendors are automatically paid for their completed orders."
              icon={RefreshCw}
            >
              <select 
                value={settings.payout_frequency} 
                onChange={(e) => updateSetting('payout_frequency', e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 w-64 transition-colors cursor-pointer"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </SettingItem>
            <SettingItem 
              label="Minimum Payout" 
              description="The minimum balance a vendor must have before a payout is initiated."
              icon={CreditCard}
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm font-bold">$</span>
                <input 
                  type="number" 
                  value={settings.min_payout_amount} 
                  onChange={(e) => updateSetting('min_payout_amount', e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 w-64 transition-colors"
                />
              </div>
            </SettingItem>
            <SettingItem 
              label="Platform Tax Rate (%)" 
              description="Percentage taken from each transaction as platform service fee."
              icon={Smartphone}
            >
              <input 
                type="number" 
                step="0.1"
                value={settings.tax_rate} 
                onChange={(e) => updateSetting('tax_rate', e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 w-64 transition-colors"
              />
            </SettingItem>
          </SettingGroup>
        )}

        {activeTab === 'security' && (
          <SettingGroup title="Security & Access" description="Control administrative access and security protocols.">
            <SettingItem 
              label="Admin Session Timeout" 
              description="Inactivity duration before an admin is automatically logged out."
              icon={Lock}
            >
              <select 
                value={settings.session_timeout}
                onChange={(e) => updateSetting('session_timeout', e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 w-64 transition-colors cursor-pointer"
              >
                <option>30 Minutes</option>
                <option>1 Hour</option>
                <option>4 Hours</option>
                <option>8 Hours</option>
              </select>
            </SettingItem>
            <SettingItem 
              label="Two-Factor Authentication" 
              description="Require an additional verification step for all administrative logins."
              icon={Shield}
            >
              <div className="flex items-center gap-3">
                <div 
                  onClick={() => updateSetting('two_factor_auth', settings.two_factor_auth === 'true' ? 'false' : 'true')}
                  className={`w-12 h-6 rounded-full relative cursor-pointer border transition-all ${settings.two_factor_auth === 'true' ? 'bg-primary-600/20 border-primary-500/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.two_factor_auth === 'true' ? 'right-1 bg-primary-500' : 'left-1 bg-slate-500'}`} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${settings.two_factor_auth === 'true' ? 'text-primary-500' : 'text-slate-500'}`}>
                  {settings.two_factor_auth === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </SettingItem>
          </SettingGroup>
        )}

        {activeTab === 'notifications' && (
          <SettingGroup title="System Notifications" description="Configure how the system sends alerts to users and admins.">
            <SettingItem 
              label="Email Notifications" 
              description="Send automated emails for orders, payouts, and system alerts."
              icon={Mail}
            >
              <div className="flex items-center gap-3">
                <div 
                   onClick={() => updateSetting('email_notifications', settings.email_notifications === 'true' ? 'false' : 'true')}
                   className={`w-12 h-6 rounded-full relative cursor-pointer border transition-all ${settings.email_notifications === 'true' ? 'bg-primary-600/20 border-primary-500/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.email_notifications === 'true' ? 'right-1 bg-primary-500' : 'left-1 bg-slate-500'}`} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${settings.email_notifications === 'true' ? 'text-primary-500' : 'text-slate-500'}`}>
                   {settings.email_notifications === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </SettingItem>
            <SettingItem 
              label="Browser Push Alerts" 
              description="Show real-time notifications even when the dashboard is in the background."
              icon={Bell}
            >
               <div className="flex items-center gap-3">
                <div 
                   onClick={() => updateSetting('browser_push', settings.browser_push === 'true' ? 'false' : 'true')}
                   className={`w-12 h-6 rounded-full relative cursor-pointer border transition-all ${settings.browser_push === 'true' ? 'bg-primary-600/20 border-primary-500/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.browser_push === 'true' ? 'right-1 bg-primary-500' : 'left-1 bg-slate-500'}`} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${settings.browser_push === 'true' ? 'text-primary-500' : 'text-slate-500'}`}>
                   {settings.browser_push === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </SettingItem>
          </SettingGroup>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
