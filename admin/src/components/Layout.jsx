import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Layout = () => {
  const location = useLocation();
  
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
      <Sidebar />
      <div className="flex flex-col min-h-screen pl-64 transition-all duration-300">
        <Topbar title={getPageTitle()} />
        <main className="flex-1 p-8 pt-28">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
