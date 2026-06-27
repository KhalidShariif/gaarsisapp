import React from 'react';
import api from '../utils/api';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Download, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit2, 
  Trash2,
  CheckCircle,
  Truck,
  UserCheck,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Slash
} from 'lucide-react';

const UserStatCard = ({ title, value, icon: Icon, trend, trendValue, colorClass }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</h3>
      </div>
      <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}>
        {React.createElement(Icon, { size: 20, className: 'text-white' })}
      </div>
    </div>
    <div className={`flex items-center gap-1 text-[10px] font-bold ${trend === 'up' ? 'text-success' : 'text-danger'}`}>
      {trend === 'up' ? <ArrowUpRight size={12} /> : <TrendingUp size={12} className="rotate-180" />}
      {trendValue} 
      <span className="text-slate-500 font-normal ml-1">vs last month</span>
    </div>
  </div>
);

const UsersPage = () => {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [showModal, setShowModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [formData, setFormData] = React.useState({
    username: '',
    email: '',
    phone: '',
    role: 'customer'
  });
  const [editingUser, setEditingUser] = React.useState(null);

  const [stats, setStats] = React.useState(null);

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const now = new Date();
    const seen = new Date(lastSeen);
    const diffInMinutes = Math.floor((now - seen) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} h ago`;
    return seen.toLocaleDateString();
  };

  const filteredUsers = React.useMemo(() => {
    return (users || []).filter(u => {
      const displayName = u.business_name || u.name || u.username || '';
      const matchesSearch = (
        displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      // When role-specific data is fetched (vendor), all records match the role
      // For online/offline, filter locally since those come from the all-users fetch
      let matchesRole = true;
      if (roleFilter === 'online') {
        matchesRole = u.is_online === 1;
      } else if (roleFilter === 'offline') {
        matchesRole = u.is_online === 0;
      } else if (roleFilter !== 'all' && !['vendor', 'customer', 'driver', 'admin'].includes(roleFilter)) {
        matchesRole = (u.role || '').toLowerCase() === roleFilter;
      }
      // For role-based filters (vendor/customer/driver/admin), server already filtered
      
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, searchTerm]);

  const fetchUsers = async (role) => {
    try {
      setLoading(true);
      const roleParam = role && role !== 'all' && role !== 'online' && role !== 'offline' ? role : null;
      const apiUrl = roleParam ? `/admin/users?role=${roleParam}` : '/admin/users';
      console.log('DEBUG Users: API URL =>', apiUrl);
      const response = await api.get(apiUrl);
      
      // Handle both { success: true, data: [...] } and direct array [...] responses
      let rawData = [];
      if (Array.isArray(response.data)) {
        rawData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        rawData = response.data.data;
      }
      
      console.log('DEBUG Users: parsed users length =>', rawData.length);
      if (rawData.length > 0) console.log('DEBUG Users: first record =>', rawData[0]);
      
      setUsers(rawData);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  React.useEffect(() => {
    fetchStats();
  }, []);

  // Fetch users whenever roleFilter changes (also fires on initial mount)
  React.useEffect(() => {
    fetchUsers(roleFilter);

    // Refresh user list every 15 seconds to keep online/offline status updated
    const intervalId = setInterval(() => {
      fetchUsers(roleFilter);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [roleFilter]);

  const handleUpdateStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      fetchUsers(roleFilter);
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      password: '' // Don't show password
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/users/${editingUser.id}`, formData);
      alert('User updated successfully!');
      setShowEditModal(false);
      fetchUsers(roleFilter);
    } catch (err) {
      console.error('Update error', err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    console.log(`DEBUG: Attempting to delete user ID: ${userId}`);
    console.log(`DEBUG: API URL: ${api.defaults.baseURL}/admin/users/${userId}`);

    try {
      const response = await api.delete(`/admin/users/${userId}`);
      console.log('DEBUG: Response Status:', response.status);
      console.log('DEBUG: Response Body:', response.data);
      
      alert(response.data.message || 'User deleted successfully.');
      fetchUsers(roleFilter);
    } catch (err) {
      console.error('DELETE ERROR:', err);
      console.log('DEBUG: Error Response Status:', err.response?.status);
      console.log('DEBUG: Error Response Body:', err.response?.data);
      alert(err.response?.data?.message || 'Delete operation failed.');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', formData);
      setShowModal(false);
      setFormData({ username: '', email: '', phone: '', role: 'customer' });
      fetchUsers(roleFilter);
      alert('User created successfully! Credentials sent via email.');
    } catch (err) {
      console.error('Add User Error:', err);
      alert(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleExport = () => {
    console.log('DEBUG: Export Users Clicked');
    if (users.length === 0) {
       alert('No data to export');
       return;
    }
    
    const headers = ['ID', 'Username', 'Email', 'Phone', 'Role', 'Status', 'Joined Date'];
    const csvRows = users.map(u => [
      u.id, 
      u.username, 
      u.email, 
      u.phone, 
      u.role, 
      u.status, 
      new Date(u.created_at).toLocaleDateString()
    ].join(','));
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('DEBUG: Export Complete');
  };

  const getRoleStyle = (role) => {
    switch ((role || '').toUpperCase()) {
      case 'CUSTOMER': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'DRIVER': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'VENDOR': return 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20';
      default: return 'text-slate-900 dark:text-white bg-white/10';
    }
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'active': return 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.3)]';
      case 'suspended': return 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.3)]';
      case 'pending': return 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.3)]';
      default: return 'bg-slate-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  console.log(`DEBUG Users Render: rendered count => ${filteredUsers.length}, current filter => ${roleFilter}`);

  return (
    <div className="space-y-10">
      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl p-8 shadow-xl">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Add New User</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Full Name</label>
                    <input 
                      required
                      className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg py-2 px-3 focus:outline-primary-600"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs font-semibold text-slate-500">Email</label>
                       <input 
                         required
                         type="email"
                         className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg py-2 px-3 focus:outline-primary-600"
                         value={formData.email}
                         onChange={e => setFormData({...formData, email: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-semibold text-slate-500">Phone</label>
                       <input 
                         required
                         className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg py-2 px-3 focus:outline-primary-600"
                         value={formData.phone}
                         onChange={e => setFormData({...formData, phone: e.target.value})}
                       />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Role</label>
                    <select 
                      className="w-full border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg py-2 px-3 focus:outline-primary-600"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                       <option value="customer">Customer</option>
                       <option value="driver">Driver</option>
                       <option value="vendor">Vendor</option>
                    </select>
                 </div>
                 <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 font-medium">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700">Save</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Users</h2>
          <p className="text-slate-500 text-sm">Manage your platform users and their roles.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Download size={16} /> Export
          </button>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-primary-700 transition-colors">
            <UserPlus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <UserStatCard title="Total Users" value={(users?.length || 0).toLocaleString()} icon={UsersIcon} trend="up" trendValue="Live" colorClass="bg-blue-600" />
        <UserStatCard title="Active Drivers" value={(stats?.activeDrivers || 0).toString()} icon={Truck} trend="up" trendValue="Online" colorClass="bg-amber-600" />
        <UserStatCard title="New Registrations" value={(stats?.newUsersWeek || 0).toString()} icon={UserCheck} trend="up" trendValue="7 Days" colorClass="bg-violet-600" />
        <UserStatCard title="Churn Rate" value={stats?.churnRate || "0.0%"} icon={TrendingDown} trend="down" trendValue="Stable" colorClass="bg-rose-600" />
      </div>

      {/* Filter & Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative w-72">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search users..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 pl-10 pr-4 text-sm focus:outline-primary-600"
             />
          </div>
          <div className="flex gap-2">
             <select 
               value={roleFilter}
               onChange={(e) => setRoleFilter(e.target.value)}
               className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold uppercase"
             >
               <option value="all">All Users</option>
               <option value="online">Online</option>
               <option value="offline">Offline</option>
               <option value="customer">Customer</option>
               <option value="driver">Driver</option>
               <option value="vendor">Vendor</option>
               <option value="admin">Admin</option>
             </select>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id || `vendor-${user.vendor_id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs">
                             {(user.business_name || user.username || user.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {user.business_name || user.username || user.name || 'Unknown'}
                            </span>
                            {user.business_name && user.username && (
                              <span className="text-[10px] text-slate-500">{user.username}</span>
                            )}
                            <span className="text-[10px] text-slate-500 uppercase tracking-tighter">ID: {user.id ? user.id : `V-${user.vendor_id}`}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-700 dark:text-slate-300">{user.email || 'N/A'}</p>
                      <p className="text-[10px] text-slate-500">{user.phone || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getRoleStyle(user.role || 'customer')}`}>
                        {user.role || 'Customer'}
                      </span>
                    </td>
                     <td className="px-6 py-4">
                       <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${user.is_online ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-400'}`} />
                            <span className={`text-xs font-bold uppercase ${user.is_online ? 'text-success' : 'text-slate-500'}`}>
                              {user.is_online ? 'Online' : 'Offline'}
                            </span>
                         </div>
                         {!user.is_online && (
                           <span className="text-[9px] text-slate-500 uppercase tracking-tighter">
                             Last seen {formatLastSeen(user.last_seen)}
                           </span>
                         )}
                         <div className="flex items-center gap-1 opacity-60">
                            <span className={`text-[10px] font-bold uppercase tracking-tight ${getStatusColor(user.status || 'active').includes('success') ? 'text-success' : 'text-danger'}`}>
                              • {user.status || 'active'}
                            </span>
                         </div>
                       </div>
                     </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEditUser(user)} disabled={!user.id} className={`p-2 transition-colors ${user.id ? 'text-slate-400 hover:text-primary-600' : 'text-slate-300 cursor-not-allowed'}`} title={!user.id ? 'No user account to edit' : 'Edit User'}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleUpdateStatus(user.id, user.status)} disabled={!user.id} className={`p-2 transition-colors ${!user.id ? 'text-slate-300 cursor-not-allowed' : user.status === 'suspended' ? 'text-success/50 hover:text-success' : 'text-danger/50 hover:text-danger'}`} title={!user.id ? 'No user account to update' : 'Toggle Status'}>
                          {user.status === 'suspended' ? <CheckCircle size={14} /> : <Slash size={14} />}
                        </button>
                        <button onClick={() => handleDeleteUser(user.id)} disabled={!user.id} className={`p-2 transition-colors ${user.id ? 'text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`} title={!user.id ? 'No user account to delete' : 'Delete User'}>
                           <Trash2 size={14} /> 
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="px-10 py-6 flex items-center justify-between bg-slate-50 dark:bg-slate-900/20 border-t border-slate-200 dark:border-slate-800/40">
           <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
             Showing <span className="text-slate-600 dark:text-slate-400">
               {filteredUsers.length}
             </span> of <span className="text-slate-600 dark:text-slate-400">{users.length}</span> users
           </p>
           <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">All records loaded</p>
        </div>
      </div>
      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-[40px] p-10 shadow-2xl">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 font-manrope">Edit Production User</h3>
              <form onSubmit={handleUpdateUser} className="space-y-5">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                    <input 
                      required
                      className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Email</label>
                       <input 
                         required
                         type="email"
                         className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                         value={formData.email}
                         onChange={e => setFormData({...formData, email: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Phone</label>
                       <input 
                         required
                         className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                         value={formData.phone}
                         onChange={e => setFormData({...formData, phone: e.target.value})}
                       />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Role</label>
                    <select 
                      className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 px-5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all appearance-none cursor-pointer"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                       <option value="customer">Customer</option>
                       <option value="driver">Driver</option>
                       <option value="vendor">Vendor</option>
                    </select>
                 </div>
                 <div className="flex justify-end gap-4 mt-8">
                    <button 
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-8 py-3 text-slate-600 dark:text-slate-400 font-bold text-sm hover:text-slate-900 dark:text-white transition-colors"
                    >
                       Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-10 py-3 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-600/20 hover:bg-primary-500 transition-all"
                    >
                       Update Changes
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
