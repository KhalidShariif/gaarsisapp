import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Layout = () => {
  const mustChangePassword = localStorage.getItem('vendor_must_change_password') === 'true';
  const location = useLocation();

  if (mustChangePassword && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Topbar />
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-8 py-8 no-scrollbar bg-[#fcfcfd]">
          {mustChangePassword && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold animate-pulse">
              ⚠️ Safety Action Required: You are using an auto-generated temporary password. You must change your password in the Security tab before you can access other sections.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
