import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import DashboardOverview from './pages/DashboardOverview';

// Stub imports for other pages to avoid breaking
import CustomerReviews from './pages/CustomerReviews';
import DeliveryTracking from './pages/DeliveryTracking';
import DriversFleetManagement from './pages/DriversFleetManagement';
import InventoryManagement from './pages/InventoryManagement';
import Login from './pages/Login';
import Register from './pages/Register';
import OffersPromotions from './pages/OffersPromotions';
import OrdersList from './pages/OrdersList';
import ProductsManagement from './pages/ProductsManagement';
import PurchasesHistory from './pages/PurchasesHistory';
import ReportsAnalytics from './pages/ReportsAnalytics';
import Settings from './pages/Settings';
import SuppliersDirectory from './pages/SuppliersDirectory';
import DeliveryZones from './pages/DeliveryZones';

import { Navigate, Outlet } from 'react-router-dom';

import api from './utils/api';

const ProtectedRoute = () => {
  const token = localStorage.getItem('vendor_token');
  
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
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardOverview />} />
            <Route path='customer_reviews' element={<CustomerReviews />} />
            <Route path='delivery_tracking' element={<DeliveryTracking />} />
            <Route path='drivers_fleet_management' element={<DriversFleetManagement />} />
            <Route path='inventory_management' element={<InventoryManagement />} />
            <Route path='offers_promotions' element={<OffersPromotions />} />
            <Route path='orders_list' element={<OrdersList />} />
            <Route path='products_management' element={<ProductsManagement />} />
            <Route path='purchases_history' element={<PurchasesHistory />} />
            <Route path='reports_analytics' element={<ReportsAnalytics />} />
            <Route path='settings' element={<Settings />} />
            <Route path='suppliers_directory' element={<SuppliersDirectory />} />
            <Route path='delivery_zones' element={<DeliveryZones />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
