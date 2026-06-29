import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Layout = () => {
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/users') return 'User Management';
    if (path === '/vendors') return 'Vendor Network';
    if (path === '/drivers') return 'Fleet Management';
    if (path === '/operations') return 'Live Dispatch';
    if (path === '/payments') return 'Financials';
    if (path === '/reports') return 'Analytics';
    if (path === '/settings') return 'System Settings';
    return 'Admin Panel';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 h-full w-[82vw] max-w-xs shadow-2xl">
            <Sidebar isMobile onClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-screen lg:pl-64 transition-all duration-300">
        <Topbar title={getPageTitle()} onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 p-4 pt-24 sm:p-6 sm:pt-28 lg:p-8 lg:pt-28">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
