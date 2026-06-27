import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Boxes, 
  ClipboardList, 
  Truck, 
  Users, 
  Handshake, 
  BarChart3, 
  MessageSquare,
  Tag,
  Settings,
  LogOut,
  MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import VendorAvatar from './VendorAvatar';
import { useVendorProfile } from '../hooks/useVendorProfile';
import { getVendorDisplayName } from '../utils/vendorIdentity';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Products', path: '/products_management', icon: Package },
  { name: 'Purchases', path: '/purchases_history', icon: ShoppingCart },
  { name: 'Inventory', path: '/inventory_management', icon: Boxes },
  { name: 'Orders', path: '/orders_list', icon: ClipboardList },
  { name: 'Deliveries', path: '/delivery_tracking', icon: Truck },
  { name: 'Drivers', path: '/drivers_fleet_management', icon: Users },
  { name: 'Suppliers', path: '/suppliers_directory', icon: Handshake },
  { name: 'Reports', path: '/reports_analytics', icon: BarChart3 },
  { name: 'Reviews', path: '/customer_reviews', icon: MessageSquare },
  { name: 'Zones', path: '/delivery_zones', icon: MapPin },
  { name: 'Offers', path: '/offers_promotions', icon: Tag },
  { name: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const { vendor } = useVendorProfile();
  const vendorName = getVendorDisplayName(vendor);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('vendor_token');
      localStorage.removeItem('vendor_user');
      navigate('/login');
    }
  };

  return (
    <aside className="w-64 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col h-screen sticky top-0 font-body">
      {/* Logo Area */}
      <div className="h-20 flex items-center px-8">
        <div>
          <h1 className="text-xl font-bold font-headline text-primary-dim">VendorPortal</h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-70">Management Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto w-full no-scrollbar">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-primary/5 text-primary font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <item.icon
                        size={18}
                        className={isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}
                      />
                      <span className="text-sm tracking-wide">{item.name}</span>
                    </div>
                    {/* Active Indicator (Right Dot) */}
                    {isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile/Bottom Action */}
      <div className="p-4 border-t border-outline-variant/10">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors group">
          <VendorAvatar vendor={vendor} size="sm" className="!w-9 !h-9" />
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-on-surface truncate">{vendorName}</p>
            <p className="text-[10px] text-on-surface-variant font-medium truncate">Vendor Account</p>
          </div>
          <button 
            onClick={handleLogout}
            title="Logout"
            className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
