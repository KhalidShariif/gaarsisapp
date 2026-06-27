import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Package, AlertTriangle, Edit3, X, Save, ChevronDown, ChevronUp } from 'lucide-react';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'error' | 'inactive' | 'ok'
  const [editModal, setEditModal] = useState(null); // product being edited
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'vendor_name', dir: 'asc' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/products');
      setProducts(res.data);
    } catch (err) {
      setError('Failed to load products.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (product) => {
    setEditModal(product);
    setEditForm({
      name: product.name || '',
      selling_price: product.selling_price || '',
      is_active: product.is_active !== undefined ? Boolean(product.is_active) : true,
      description: product.description || '',
      stock_quantity: product.stock ?? '',
    });
    setMessage('');
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditForm({});
  };

  const handleSave = async () => {
    const price = parseFloat(editForm.selling_price);
    if (isNaN(price) || price <= 0) {
      setMessage('❌ Product price must be greater than zero.');
      return;
    }
    try {
      setSaving(true);
      const res = await api.put(`/admin/products/${editModal.id}`, {
        name: editForm.name,
        selling_price: price,
        is_active: editForm.is_active ? 1 : 0,
        description: editForm.description,
        stock_quantity: editForm.stock_quantity,
      });
      if (res.data.success) {
        setMessage('✅ Product updated successfully.');
        fetchProducts();
        setTimeout(() => {
          setMessage('');
          closeEditModal();
        }, 1200);
      } else {
        setMessage(`❌ ${res.data.message || 'Update failed.'}`);
      }
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.message || 'Failed to save product.'}`);
    } finally {
      setSaving(false);
    }
  };

  const hasPricingError = (p) => !p.selling_price || parseFloat(p.selling_price) <= 0;
  const hasStockError = (p) => p.stock !== undefined && parseInt(p.stock) <= 0;

  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.vendor_name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'error' && hasPricingError(p)) ||
      (filterStatus === 'inactive' && !p.is_active) ||
      (filterStatus === 'ok' && !hasPricingError(p) && p.is_active);

    return matchesSearch && matchesFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortConfig.key] ?? '';
    const bVal = b[sortConfig.key] ?? '';
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortConfig.dir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const SortIcon = ({ col }) =>
    sortConfig.key === col
      ? sortConfig.dir === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />
      : null;

  const pricingErrors = products.filter(hasPricingError).length;
  const inactiveCount = products.filter((p) => !p.is_active).length;

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-bold text-on-surface tracking-tight flex items-center gap-3">
            <Package size={28} className="text-primary-400" />
            Products Oversight
          </h2>
          <p className="text-on-surface-variant font-medium mt-1">
            Monitor all vendor products. Highlight and fix pricing errors.
          </p>
        </div>
        {/* Stats badges */}
        <div className="flex gap-3 flex-wrap">
          <div className="px-4 py-2 bg-slate-800 rounded-xl text-sm font-bold text-white">
            {products.length} Total
          </div>
          {pricingErrors > 0 && (
            <div className="px-4 py-2 bg-red-900/40 border border-red-700/40 rounded-xl text-sm font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle size={14} />
              {pricingErrors} Pricing Error{pricingErrors !== 1 ? 's' : ''}
            </div>
          )}
          {inactiveCount > 0 && (
            <div className="px-4 py-2 bg-slate-700/40 rounded-xl text-sm font-bold text-slate-400">
              {inactiveCount} Inactive
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name, vendor, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-xl outline-none text-sm border border-slate-700 focus:border-primary-500 transition-colors"
        />
        <div className="flex gap-2">
          {[
            { val: 'all', label: 'All' },
            { val: 'error', label: '⚠ Pricing Error' },
            { val: 'inactive', label: 'Inactive' },
            { val: 'ok', label: 'Active & Valid' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                filterStatus === val
                  ? 'bg-primary-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700/30 rounded-xl text-red-400 font-bold text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                {[
                  { key: 'name', label: 'Product' },
                  { key: 'vendor_name', label: 'Vendor' },
                  { key: 'category', label: 'Category' },
                  { key: 'selling_price', label: 'Price' },
                  { key: 'stock', label: 'Stock' },
                  { key: 'is_active', label: 'Status' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="py-4 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-white transition-colors select-none"
                  >
                    {label}
                    <SortIcon col={key} />
                  </th>
                ))}
                <th className="py-4 px-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-500 font-bold">
                    Loading products...
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-500 font-bold">
                    No products found.
                  </td>
                </tr>
              ) : (
                sorted.map((p) => {
                  const isPricingError = hasPricingError(p);
                  const isStockError = hasStockError(p);
                  const price = parseFloat(p.selling_price) || 0;
                  const stock = parseInt(p.stock) ?? 0;

                  return (
                    <tr
                      key={p.id}
                      className={`group transition-colors ${
                        isPricingError
                          ? 'bg-red-900/10 hover:bg-red-900/20 border-l-2 border-l-red-600'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Product Name */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">ID: {p.id}</div>
                      </td>
                      {/* Vendor */}
                      <td className="py-4 px-5 text-slate-300 font-medium">{p.vendor_name || '—'}</td>
                      {/* Category */}
                      <td className="py-4 px-5">
                        <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold uppercase">
                          {p.category || '—'}
                        </span>
                      </td>
                      {/* Price */}
                      <td className="py-4 px-5">
                        {isPricingError ? (
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 font-bold">${price.toFixed(2)}</span>
                            <span className="px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 text-[9px] font-bold uppercase border border-red-700/40">
                              Pricing Error
                            </span>
                          </div>
                        ) : (
                          <span className="text-green-400 font-bold">${price.toFixed(2)}</span>
                        )}
                      </td>
                      {/* Stock */}
                      <td className="py-4 px-5">
                        <span className={`font-bold ${isStockError ? 'text-red-400' : 'text-slate-300'}`}>
                          {stock} {p.unit || ''}
                          {isStockError && (
                            <span className="ml-1 text-[9px] text-red-400 font-bold uppercase">(Out)</span>
                          )}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="py-4 px-5">
                        {isPricingError ? (
                          <span className="px-2 py-1 rounded-full bg-red-900/30 text-red-400 text-[10px] font-bold uppercase border border-red-700/30">
                            Error
                          </span>
                        ) : p.is_active ? (
                          <span className="px-2 py-1 rounded-full bg-green-900/30 text-green-400 text-[10px] font-bold uppercase border border-green-700/30">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-slate-700/50 text-slate-400 text-[10px] font-bold uppercase">
                            Inactive
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-slate-700 transition-colors"
                          title="Edit product"
                        >
                          <Edit3 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Edit Product</h3>
              <button onClick={closeEditModal} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-bold ${
                message.startsWith('✅') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
              }`}>
                {message}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Product Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-800 text-white rounded-xl outline-none border border-slate-700 focus:border-primary-500 transition-colors"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Selling Price ($) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={`w-full px-4 py-3 rounded-xl outline-none border transition-colors font-bold ${
                    editForm.selling_price && parseFloat(editForm.selling_price) <= 0
                      ? 'bg-red-900/20 border-red-600 text-red-400'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-primary-500'
                  }`}
                  value={editForm.selling_price}
                  onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
                />
                {editForm.selling_price && parseFloat(editForm.selling_price) <= 0 && (
                  <p className="text-red-400 text-xs font-bold mt-1">⚠ Price must be greater than zero.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 bg-slate-800 text-white rounded-xl outline-none border border-slate-700 focus:border-primary-500 transition-colors"
                  value={editForm.stock_quantity}
                  onChange={(e) => setEditForm({ ...editForm, stock_quantity: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="admin-product-active"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-primary rounded"
                />
                <label htmlFor="admin-product-active" className="text-sm font-bold text-white cursor-pointer">
                  Product Active (visible to customers)
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 text-white rounded-xl outline-none border border-slate-700 focus:border-primary-500 transition-colors resize-none text-sm"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditModal}
                className="flex-1 py-3 font-bold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
