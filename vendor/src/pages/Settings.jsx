import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import VendorAvatar from '../components/VendorAvatar';
import { useVendorProfile } from '../hooks/useVendorProfile';
import { readStoredVendor, storeVendorProfile } from '../utils/vendorIdentity';

const tabs = [
  { key: 'profile', label: 'Vendor Profile' },
  { key: 'business', label: 'Business Info' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'security', label: 'Security' },
];

const defaultSettings = {
  email_notifications: true,
  order_alerts: true,
  delivery_alerts: true,
  inventory_alerts: true,
  promotion_alerts: true,
  security_alerts: true,
  two_factor_enabled: false,
};

const toProfileForm = (vendor = {}) => ({
  business_name: vendor.business_name || vendor.name || '',
  email: vendor.email || '',
  phone: vendor.phone || '',
  contact_name: vendor.contact_name || '',
  address: vendor.address || '',
  city: vendor.city || '',
  district: vendor.district || '',
  business_type: vendor.business_type || '',
  latitude: vendor.latitude || '',
  longitude: vendor.longitude || '',
  logo_url: vendor.logo_url || vendor.logo || '',
  logo: vendor.logo || vendor.logo_url || '',
  is_open: vendor.is_open !== undefined ? Boolean(vendor.is_open) : true,
  opening_time: vendor.opening_time || '06:00',
  closing_time: vendor.closing_time || '23:00',
});

const fieldClass = 'w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium';

const Field = ({ id, label, value, onChange, type = 'text', readOnly = false, placeholder = '', step }) => (
  <div className="space-y-2">
    <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</label>
    <input
      id={id}
      className={`${fieldClass} ${readOnly ? 'opacity-60' : ''}`}
      type={type}
      value={value ?? ''}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      step={step}
    />
  </div>
);

const Toggle = ({ id, title, subtitle, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
    <div>
      <span className="text-sm font-bold text-on-surface block">{title}</span>
      <span className="text-xs text-on-surface-variant font-medium block">{subtitle}</span>
    </div>
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
    </label>
  </div>
);

const Settings = () => {
  const storedUser = readStoredVendor();
  const { vendor, setVendor, loading: profileLoading, refreshVendor } = useVendorProfile();
  const messageTimerRef = useRef(null);
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('vendor_settings_tab');
    return tabs.some((tab) => tab.key === savedTab) ? savedTab : 'profile';
  });
  const [formData, setFormData] = useState(() => toProfileForm(storedUser || {}));
  const [settings, setSettings] = useState(defaultSettings);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const effectiveVendor = useMemo(() => ({ ...(vendor || {}), ...formData }), [vendor, formData]);

  useEffect(() => {
    localStorage.setItem('vendor_settings_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (vendor?.id) {
      setFormData(toProfileForm(vendor));
    }
  }, [vendor]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.get('/vendor/settings');
        if (response.data?.settings) {
          setSettings({ ...defaultSettings, ...response.data.settings });
        }
      } catch (error) {
        console.error('Failed to load vendor settings', error);
        setMessage('Failed to load notification settings.');
      }
    };
    loadSettings();
  }, []);

  const showMessage = (text) => {
    setMessage(text);
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => setMessage(''), 3500);
  };

  const handleChange = (event) => {
    const { id, type, checked, value } = event.target;
    setFormData((prev) => ({ ...prev, [id]: type === 'checkbox' ? checked : value }));
  };

  const handleSettingChange = (event) => {
    const { id, checked } = event.target;
    setSettings((prev) => ({ ...prev, [id]: checked }));
  };

  const handlePasswordChange = (event) => {
    const { id, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [id]: value }));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMessage('Error: Logo size cannot exceed 5MB.');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      showMessage('Error: Only PNG, JPG, JPEG and WebP images are allowed.');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('logo', file);
    setLoading(true);
    try {
      const response = await api.post('/vendor/upload-logo', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Upload failed');

      const updatedVendor = response.data.vendor ? storeVendorProfile(response.data.vendor) : storeVendorProfile({ ...(vendor || {}), logo: response.data.logo, logo_url: response.data.logo_url || response.data.logo });
      setVendor(updatedVendor);
      setFormData(toProfileForm(updatedVendor));
      showMessage('Logo uploaded successfully.');
    } catch (error) {
      console.error('Logo upload error', error);
      showMessage(error.response?.data?.message || error.message || 'Failed to upload logo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const current = readStoredVendor();
    if (!current?.id) return;
    setLoading(true);
    try {
      const payload = {
        ...formData,
        logo: formData.logo_url || formData.logo || '',
        logo_url: formData.logo_url || formData.logo || '',
      };
      const response = await api.put(`/vendor/profile/${current.id}`, payload);
      if (!response.data?.success && response.status !== 200) {
        throw new Error(response.data?.message || 'Update failed');
      }
      const updatedVendor = storeVendorProfile(response.data?.vendor || { ...current, ...payload, name: payload.business_name });
      setVendor(updatedVendor);
      setFormData(toProfileForm(updatedVendor));
      showMessage('Profile updated successfully.');
    } catch (error) {
      console.error('Update profile error', error);
      showMessage(error.response?.data?.message || 'Network error, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const response = await api.put('/vendor/settings', settings);
      if (!response.data?.success) throw new Error(response.data?.message || 'Save failed');
      setSettings({ ...defaultSettings, ...response.data.settings });
      showMessage('Notification settings saved.');
    } catch (error) {
      console.error('Update settings error', error);
      showMessage(error.response?.data?.message || 'Failed to save notification settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showMessage('Error: New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.put('/vendor/security/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Password update failed');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      localStorage.removeItem('vendor_must_change_password');
      showMessage('Password updated successfully.');
    } catch (error) {
      console.error('Update password error', error);
      showMessage(error.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (!storedUser?.id && !localStorage.getItem('vendor_token')) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-red-50 border border-red-200 rounded-3xl text-center shadow-lg">
        <h2 className="text-2xl font-bold text-red-700 font-headline mb-4">Authentication Required</h2>
        <p className="text-on-surface-variant font-medium mb-6">No authenticated vendor session was found. Please sign in to access this page.</p>
        <button onClick={() => window.location.href = '/login'} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
          Go to Login
        </button>
      </div>
    );
  }

  const isSuccess = message.toLowerCase().includes('success') || message.toLowerCase().includes('saved') || message.toLowerCase().includes('uploaded');

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-12">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h2 className="text-3xl font-bold font-headline tracking-tight text-on-surface">Account Settings</h2>
          <p className="text-on-surface-variant font-medium mt-1">Manage your storefront presence, business details, and preferences.</p>
          {message && (
            <div className={`mt-4 p-4 rounded-xl text-sm font-bold ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={refreshVendor}
          className="px-4 py-2 rounded-xl border border-outline-variant/20 text-sm font-bold text-on-surface bg-white hover:bg-surface-container-low"
        >
          Refresh
        </button>
      </header>

      <div className="flex gap-8 border-b border-outline-variant/10 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`pb-4 text-sm font-bold tracking-wide transition-all whitespace-nowrap ${activeTab === tab.key ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-20">
        <div className="lg:col-span-8 space-y-8">
          {profileLoading ? (
            <section className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 shadow-sm text-on-surface-variant font-bold">
              Loading settings...
            </section>
          ) : (
            <>
              {activeTab === 'profile' && (
                <section className="bg-surface-container-lowest rounded-2xl p-8 space-y-8 border border-outline-variant/10 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-on-surface mb-1 font-headline">Public Profile</h3>
                    <p className="text-sm text-on-surface-variant font-medium">This information is displayed to customers on your storefront.</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <VendorAvatar vendor={effectiveVendor} size="lg" rounded="rounded-2xl" className="border-2 border-white shadow-sm" />
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input id="logo_file" type="file" onChange={handleFileChange} accept="image/png, image/jpeg, image/jpg, image/webp" className="hidden" />
                        <button type="button" onClick={() => document.getElementById('logo_file')?.click()} className="bg-primary text-on-primary text-[10px] font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-primary-dim transition-all">
                          Upload Logo
                        </button>
                        <button type="button" onClick={() => setFormData((prev) => ({ ...prev, logo_url: '', logo: '' }))} className="bg-surface-container-high text-on-surface text-[10px] font-bold px-4 py-2 rounded-lg hover:bg-surface-container-highest transition-all">
                          Remove
                        </button>
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-medium">PNG, JPG, JPEG, or WEBP up to 5MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field id="business_name" label="Shop Name" value={formData.business_name} onChange={handleChange} />
                    <Field id="email" label="Contact Email" value={formData.email} onChange={handleChange} type="email" readOnly />
                    <Field id="contact_name" label="Contact Name" value={formData.contact_name} onChange={handleChange} placeholder="Enter contact person name" />
                    <Field id="phone" label="Phone" value={formData.phone} onChange={handleChange} placeholder="Business phone number" />
                    <Field id="logo_url" label="Logo URL" value={formData.logo_url} onChange={handleChange} placeholder="/uploads/vendor-logos/logo.png" />
                    <Field id="business_type" label="Business Type" value={formData.business_type} onChange={handleChange} placeholder="Fuel, Gas, Spare Parts..." />
                  </div>
                </section>
              )}

              {activeTab === 'business' && (
                <section className="bg-surface-container-lowest rounded-2xl p-8 space-y-8 border border-outline-variant/10 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-on-surface mb-1 font-headline">Business Information</h3>
                    <p className="text-sm text-on-surface-variant font-medium">Manage location, address, and operating hours.</p>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="address" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Store Address</label>
                      <textarea id="address" className={fieldClass} rows="2" value={formData.address} onChange={handleChange} placeholder="Enter your business address..." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Field id="city" label="City" value={formData.city} onChange={handleChange} />
                      <Field id="district" label="District" value={formData.district} onChange={handleChange} />
                      <Field id="latitude" label="Latitude" value={formData.latitude} onChange={handleChange} type="number" step="any" placeholder="e.g. 2.0469" />
                      <Field id="longitude" label="Longitude" value={formData.longitude} onChange={handleChange} type="number" step="any" placeholder="e.g. 45.3182" />
                    </div>
                    <Toggle id="is_open" title="Store Open Status" subtitle="Manually toggle your store open or closed." checked={formData.is_open} onChange={handleChange} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Field id="opening_time" label="Opening Time" value={formData.opening_time} onChange={handleChange} type="time" />
                      <Field id="closing_time" label="Closing Time" value={formData.closing_time} onChange={handleChange} type="time" />
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'notifications' && (
                <section className="bg-surface-container-lowest rounded-2xl p-8 space-y-6 border border-outline-variant/10 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-on-surface mb-1 font-headline">Notification Preferences</h3>
                    <p className="text-sm text-on-surface-variant font-medium">Choose which vendor alerts should be sent to your account.</p>
                  </div>
                  <Toggle id="email_notifications" title="Email Notifications" subtitle="Receive important updates by email." checked={settings.email_notifications} onChange={handleSettingChange} />
                  <Toggle id="order_alerts" title="Order Alerts" subtitle="New orders, accepted orders, and customer updates." checked={settings.order_alerts} onChange={handleSettingChange} />
                  <Toggle id="delivery_alerts" title="Delivery Alerts" subtitle="Driver assignment and delivery progress updates." checked={settings.delivery_alerts} onChange={handleSettingChange} />
                  <Toggle id="inventory_alerts" title="Inventory Alerts" subtitle="Low stock and restock reminders." checked={settings.inventory_alerts} onChange={handleSettingChange} />
                  <Toggle id="promotion_alerts" title="Promotion Alerts" subtitle="Offer performance and promotion activity." checked={settings.promotion_alerts} onChange={handleSettingChange} />
                </section>
              )}

              {activeTab === 'security' && (
                <section className="bg-surface-container-lowest rounded-2xl p-8 space-y-8 border border-outline-variant/10 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-on-surface mb-1 font-headline">Security Settings</h3>
                    <p className="text-sm text-on-surface-variant font-medium">Update your password and account security preferences.</p>
                  </div>
                  <div className="space-y-6">
                    <Field id="current_password" label="Current Password" value={passwordForm.current_password} onChange={handlePasswordChange} type="password" />
                    <Field id="new_password" label="New Password" value={passwordForm.new_password} onChange={handlePasswordChange} type="password" />
                    <Field id="confirm_password" label="Confirm New Password" value={passwordForm.confirm_password} onChange={handlePasswordChange} type="password" />
                    <Toggle id="security_alerts" title="Security Alerts" subtitle="Get alerts for password and sign-in changes." checked={settings.security_alerts} onChange={handleSettingChange} />
                    <Toggle id="two_factor_enabled" title="Two-Factor Authentication" subtitle="Store your 2FA preference for this account." checked={settings.two_factor_enabled} onChange={handleSettingChange} />
                  </div>
                </section>
              )}
            </>
          )}

          <div className="flex justify-end gap-3">
            {activeTab === 'notifications' || activeTab === 'security' ? (
              <button onClick={handleSaveSettings} disabled={loading} className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold py-3.5 px-6 rounded-xl transition-all disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            ) : null}
            {activeTab === 'security' ? (
              <button onClick={handleUpdatePassword} disabled={loading} className="bg-primary hover:bg-primary-dim text-on-primary font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                {loading ? 'Saving...' : 'Update Password'}
              </button>
            ) : (
              <button onClick={handleSaveProfile} disabled={loading || profileLoading} className="bg-primary hover:bg-primary-dim text-on-primary font-bold py-3.5 px-10 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-low/50 rounded-2xl p-6 border border-outline-variant/10">
            <div className="flex items-center gap-4 mb-5">
              <VendorAvatar vendor={effectiveVendor} size="md" rounded="rounded-xl" />
              <div>
                <h4 className="font-bold text-on-surface font-headline">{formData.business_name || 'Vendor'}</h4>
                <p className="text-xs text-on-surface-variant font-bold uppercase">{vendor?.verification_status || 'pending'}</p>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
              {formData.address || 'Add your business address so customers can identify your storefront and delivery area.'}
            </p>
          </div>
          <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
            <h4 className="font-bold text-primary mb-2 font-headline">Security Status</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
              {settings.two_factor_enabled ? 'Two-factor authentication preference is enabled.' : 'Two-factor authentication preference is currently disabled.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
