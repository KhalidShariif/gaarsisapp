import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import VendorsPage from './pages/Vendors';
import OperationsPage from './pages/Operations';
import PaymentsPage from './pages/Payments';
import ReportsPage from './pages/Reports';
import LoginPage from './pages/Login';
import SettingsPage from './pages/Settings';
import DriversPage from './pages/Drivers';
import AdminDeliveryZones from './pages/DeliveryZones';
import ProductsPage from './pages/Products';
import CommissionReportsPage from './pages/CommissionReports';

import { Navigate, Outlet } from 'react-router-dom';

import api from './utils/api';

const ProtectedRoute = () => {
  const token = localStorage.getItem('admin_token');
  
  React.useEffect(() => {
    if (token) {
      // Send initial heartbeat
      api.patch('/auth/heartbeat').catch(console.error);
      
      // Setup heartbeat interval (every 2 minutes)
      const interval = setInterval(() => {
        api.patch('/auth/heartbeat').catch(console.error);
      }, 120000);
      
      return () => clearInterval(interval);
    }
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

function App() {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="delivery-zones" element={<AdminDeliveryZones />} />
            <Route path="commissions" element={<CommissionReportsPage />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
