import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Line,
} from 'recharts';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n, decimals = 0) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtMoney = (n) => `$${fmt(n, 2)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const downloadExcel = (filename, rows, sheetName = 'Report') => {
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Auto-size columns based on content
  const colWidths = rows.reduce((acc, row) => {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length;
      acc[i] = Math.max(acc[i] || 10, Math.min(len + 2, 50));
    });
    return acc;
  }, []);
  ws['!cols'] = colWidths.map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Use Blob + named anchor for reliable browser download with correct .xlsx extension
  const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getMonWeekStart = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const KpiCard = ({ label, value, sub, growth, color = 'blue' }) => {
  const colors = {
    blue:   { ring: 'ring-blue-400/30',   icon: 'bg-blue-50 text-blue-600',   badge: 'text-blue-600' },
    green:  { ring: 'ring-emerald-400/30', badge: 'text-emerald-600' },
    amber:  { ring: 'ring-amber-400/30',   icon: 'bg-amber-50 text-amber-600',   badge: 'text-amber-600' },
    rose:   { ring: 'ring-rose-400/30',    icon: 'bg-rose-50 text-rose-600',    badge: 'text-rose-600' },
    violet: { ring: 'ring-violet-400/30',  icon: 'bg-violet-50 text-violet-600', badge: 'text-violet-600' },
  };
  const c = colors[color] || colors.blue;
  const growthNum = growth !== null && growth !== undefined ? parseFloat(growth) : null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ring-1 ${c.ring} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      </div>
      <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</p>
      <div className="flex items-center gap-2">
        {growthNum !== null && (
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
            growthNum >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {growthNum >= 0 ? '+' : '-'}{Math.abs(growthNum)}%
          </span>
        )}
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
};

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-base font-bold text-gray-800">{title}</h3>
    {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
  </div>
);

const ChartCard = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
    <SectionHeader title={title} subtitle={subtitle} />
    {children}
  </div>
);

const EmptyChart = ({ text = 'No data available' }) => (
  <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
    <p className="text-xs font-bold uppercase tracking-widest">{text}</p>
  </div>
);

const ProductTable = ({ products, emptyMsg = 'No products yet' }) => (
  <div className="overflow-hidden rounded-xl border border-gray-100">
    {(!products || products.length === 0) ? (
      <div className="p-8 text-center text-xs text-gray-300 font-bold uppercase tracking-widest">{emptyMsg}</div>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <th className="px-4 py-3 text-left">Product</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-3 font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                {p.name}
              </td>
              <td className="px-4 py-3 text-right text-gray-600 font-medium">{fmt(p.total_qty)}</td>
              <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmtMoney(p.total_revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <p className="text-sm text-rose-600 font-semibold max-w-sm text-center">{message}</p>
    <button
      onClick={onRetry}
      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
    >
      Retry
    </button>
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, moneyKeys = ['revenue', 'amount'] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3 text-xs min-w-[120px]">
      <p className="font-bold text-gray-600 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1 text-gray-500 capitalize">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-bold text-gray-800">
            {moneyKeys.includes(entry.dataKey) ? fmtMoney(entry.value) : fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Tab: Daily ───────────────────────────────────────────────────────────────

const DailyTab = () => {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/vendor/reports/daily?date=${date}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load daily report');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetch(); }, [fetch]);

  const summary = data?.summary || {};
  const hourlyChart = (data?.hourly_chart || []).map(r => ({
    ...r,
    hour: `${String(r.hour).padStart(2, '0')}:00`,
  }));
  const topProducts = data?.top_products || [];

  const handleExport = () => {
    if (!data) return;
    const summaryData = data.summary || {};
    const hourly = data.hourly_chart || [];
    const products = data.top_products || [];

    const rows = [
      ['DAILY REPORT SUMMARY'],
      ['Report Date', date],
      ['Exported At', new Date().toLocaleString()],
      [],
      ['KPI Metrics', 'Value'],
      ['Total Orders', summaryData.total_orders || 0],
      ['Completed Deliveries', summaryData.completed_deliveries || 0],
      ['Cancelled Orders', summaryData.cancelled_orders || 0],
      ['Unique Customers', summaryData.customer_count || 0],
      ['Total Sales', fmtMoney(summaryData.total_sales)],
      ['Net Revenue', fmtMoney(summaryData.total_revenue)],
      ['Total Delivery Fees', fmtMoney(summaryData.total_delivery_fees)],
      ['Average Order Value', fmtMoney(summaryData.total_orders > 0 ? summaryData.total_sales / summaryData.total_orders : 0)],
      [],
      ['HOURLY BREAKDOWN'],
      ['Hour', 'Orders', 'Revenue'],
      ...hourly.map(h => [
        `${String(h.hour).padStart(2, '0')}:00`,
        h.orders || 0,
        fmtMoney(h.revenue)
      ]),
      [],
      ['TOP SELLING PRODUCTS'],
      ['Product Name', 'Quantity Sold', 'Revenue'],
      ...products.map(p => [
        p.name,
        p.total_qty || 0,
        fmtMoney(p.total_revenue)
      ])
    ];

    downloadExcel(`daily-report-${date}.xlsx`, rows, 'Daily Report');
  };

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Date</label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />
        <button
          onClick={() => setDate(todayISO())}
          className="px-4 py-2 text-xs font-bold bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
        >
          Today
        </button>
        <button
          onClick={handleExport}
          disabled={!data}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={fetch} /> : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Orders" value={fmt(summary.total_orders)} color="blue" />
            <KpiCard label="Completed" value={fmt(summary.completed_deliveries)} color="green" />
            <KpiCard label="Cancelled" value={fmt(summary.cancelled_orders)} color="rose" />
            <KpiCard label="Customers" value={fmt(summary.customer_count)} color="violet" />
            <KpiCard label="Total Sales" value={fmtMoney(summary.total_sales)} color="amber" />
            <KpiCard label="Net Revenue" value={fmtMoney(summary.total_revenue)} color="green" />
            <KpiCard label="Delivery Fees" value={fmtMoney(summary.total_delivery_fees)} color="blue" />
            <KpiCard label="Avg. Order" value={fmtMoney(summary.total_orders > 0 ? summary.total_sales / summary.total_orders : 0)} color="violet" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Hourly Revenue" subtitle="Revenue generated per hour">
              <div className="h-56">
                {hourlyChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyChart}>
                      <defs>
                        <linearGradient id="gradRevDay" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip moneyKeys={['revenue']} />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradRevDay)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart text="No hourly data" />}
              </div>
            </ChartCard>

            <ChartCard title="Hourly Orders" subtitle="Orders placed per hour">
              <div className="h-56">
                {hourlyChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyChart} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip moneyKeys={[]} />} />
                      <Bar dataKey="orders" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart text="No hourly data" />}
              </div>
            </ChartCard>
          </div>

          {/* Top products */}
          <ChartCard title="Top Selling Products Today" subtitle={`Best performers on ${date}`}>
            <ProductTable products={topProducts} emptyMsg="No orders today" />
          </ChartCard>
        </>
      )}
    </div>
  );
};

// ─── Tab: Weekly ──────────────────────────────────────────────────────────────

const WeeklyTab = () => {
  const [weekStart, setWeekStart] = useState(getMonWeekStart());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/vendor/reports/weekly?week_start=${weekStart}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load weekly report');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetch(); }, [fetch]);

  const tw = data?.this_week || {};
  const pw = data?.prev_week || {};
  const dailyChart = (data?.daily_chart || []).map(r => ({
    ...r,
    day: r.day_name?.slice(0, 3) || r.date,
  }));
  const bestDay = data?.best_day;
  const revenueGrowth = data?.revenue_growth;

  const handleExport = () => {
    if (!data) return;
    const twData = data.this_week || {};
    const pwData = data.prev_week || {};
    const daily = data.daily_chart || [];
    const bestD = data.best_day || {};

    const rows = [
      ['WEEKLY REPORT SUMMARY'],
      ['Week Starting', weekStart],
      ['Exported At', new Date().toLocaleString()],
      [],
      ['KPI Metrics', 'This Week', 'Previous Week', 'Comparison/Details'],
      ['Total Orders', twData.total_orders || 0, pwData.total_orders || 0, ''],
      ['Total Revenue', fmtMoney(twData.total_revenue), fmtMoney(pwData.total_revenue), data.revenue_growth ? `${data.revenue_growth}% growth` : 'N/A'],
      ['Completed Orders', twData.completed_orders || 0, '', ''],
      ['Cancelled Orders', twData.cancelled_orders || 0, '', ''],
      ['Unique Customers', twData.customer_count || 0, '', ''],
      ['Delivery Fees Paid', fmtMoney(twData.total_delivery_fees), '', ''],
      ['Best Selling Day', bestD.day_name || '—', '', bestD.revenue ? `${fmtMoney(bestD.revenue)} revenue` : ''],
      ['Avg Daily Revenue', fmtMoney(daily.length > 0 ? twData.total_revenue / daily.length : 0), '', ''],
      [],
      ['DAILY BREAKDOWN'],
      ['Day', 'Date', 'Orders', 'Revenue'],
      ...daily.map(d => [
        d.day_name || '',
        d.date || '',
        d.orders || 0,
        fmtMoney(d.revenue)
      ])
    ];

    downloadExcel(`weekly-report-${weekStart}.xlsx`, rows, 'Weekly Report');
  };

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Week Starting</label>
        <input
          type="date"
          value={weekStart}
          max={todayISO()}
          onChange={(e) => setWeekStart(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />
        <button
          onClick={() => setWeekStart(getMonWeekStart())}
          className="px-4 py-2 text-xs font-bold bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
        >
          This Week
        </button>
        <button
          onClick={handleExport}
          disabled={!data}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={fetch} /> : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Orders This Week" value={fmt(tw.total_orders)} sub={`vs ${fmt(pw.total_orders)} prev`} color="blue" />
            <KpiCard label="Revenue" value={fmtMoney(tw.total_revenue)} growth={revenueGrowth} sub="vs prev week" color="green" />
            <KpiCard label="Completed" value={fmt(tw.completed_orders)} color="green" />
            <KpiCard label="Cancelled" value={fmt(tw.cancelled_orders)} color="rose" />
            <KpiCard label="Customers" value={fmt(tw.customer_count)} color="violet" />
            <KpiCard label="Delivery Fees" value={fmtMoney(tw.total_delivery_fees)} color="blue" />
            {bestDay && (
              <KpiCard label="Best Day" value={bestDay.day_name || '—'} sub={`${fmtMoney(bestDay.revenue)} revenue`} color="amber" />
            )}
            <KpiCard label="Avg Daily Revenue"
              value={fmtMoney(dailyChart.length > 0 ? tw.total_revenue / dailyChart.length : 0)} color="violet" />
          </div>

          {/* Comparison chart: this week vs prev */}
          <ChartCard title="Revenue vs Previous Week" subtitle="Day-by-day revenue comparison">
            <div className="h-64">
              {dailyChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip moneyKeys={['revenue']} />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Line type="monotone" dataKey="orders" name="Orders" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="No data this week" />}
            </div>
          </ChartCard>

          {/* Orders bar chart */}
          <ChartCard title="Orders Per Day" subtitle="Number of orders each day this week">
            <div className="h-52">
              {dailyChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChart} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip moneyKeys={[]} />} />
                    <Bar dataKey="orders" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="No orders this week" />}
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
};

// ─── Tab: Monthly ─────────────────────────────────────────────────────────────

const MonthlyTab = () => {
  const now = new Date();
  const [period, setPeriod] = useState(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr || now.getFullYear());
  const month = Number(monthStr || (now.getMonth() + 1));

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [yStr, mStr] = period.split('-');
      const res = await api.get(`/vendor/reports/monthly?year=${Number(yStr)}&month=${Number(mStr)}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load monthly report');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  const tm = data?.this_month || {};
  const topProducts = data?.top_products || [];
  const dailyChart = data?.daily_chart || [];
  const revenueGrowth = data?.revenue_growth;
  const ordersGrowth = data?.orders_growth;

  const handleExport = () => {
    if (!data) return;
    const tmData = data.this_month || {};
    const daily = data.daily_chart || [];
    const products = data.top_products || [];

    const rows = [
      ['MONTHLY REPORT SUMMARY'],
      ['Period', `${MONTH_NAMES[month]} ${year}`],
      ['Exported At', new Date().toLocaleString()],
      [],
      ['KPI Metrics', 'Value', 'Growth vs Last Month'],
      ['Total Orders', tmData.total_orders || 0, data.orders_growth ? `${data.orders_growth}%` : 'N/A'],
      ['Total Revenue (Gross)', fmtMoney(tmData.total_revenue), data.revenue_growth ? `${data.revenue_growth}%` : 'N/A'],
      ['Net Revenue', fmtMoney(tmData.net_revenue), ''],
      ['Completed Deliveries', tmData.completed_deliveries || 0, ''],
      ['Cancelled Orders', tmData.cancelled_orders || 0, ''],
      ['Unique Customers', tmData.customer_count || 0, ''],
      ['Delivery Fees', fmtMoney(tmData.total_delivery_fees), ''],
      ['Avg. Order Value', fmtMoney(tmData.total_orders > 0 ? tmData.total_revenue / tmData.total_orders : 0), ''],
      ['Delivery Success Rate', tmData.total_orders > 0 ? `${((tmData.completed_deliveries / tmData.total_orders) * 100).toFixed(1)}%` : '—', ''],
      [],
      ['DAILY BREAKDOWN'],
      ['Date', 'Orders', 'Revenue'],
      ...daily.map(d => [
        d.date || '',
        d.orders || 0,
        fmtMoney(d.revenue)
      ]),
      [],
      ['TOP SELLING PRODUCTS'],
      ['Product Name', 'Quantity Sold', 'Revenue'],
      ...products.map(p => [
        p.name,
        p.total_qty || 0,
        fmtMoney(p.total_revenue)
      ])
    ];

    downloadExcel(`monthly-report-${year}-${String(month).padStart(2, '0')}.xlsx`, rows, 'Monthly Report');
  };

  return (
    <div className="space-y-6">
      {/* Month / Year picker */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Period</label>
        <input
          type="month"
          value={period}
          max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}
          onChange={(e) => setPeriod(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
        />
        <button
          onClick={() => {
            const current = new Date();
            setPeriod(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
          }}
          className="px-4 py-2 text-xs font-bold bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
        >
          This Month
        </button>
        <button
          onClick={handleExport}
          disabled={!data}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={fetch} /> : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Orders" value={fmt(tm.total_orders)} growth={ordersGrowth} sub="vs last month" color="blue" />
            <KpiCard label="Total Revenue" value={fmtMoney(tm.total_revenue)} growth={revenueGrowth} sub="vs last month" color="green" />
            <KpiCard label="Net Revenue" value={fmtMoney(tm.net_revenue)} color="green" />
            <KpiCard label="Completed" value={fmt(tm.completed_deliveries)} color="green" />
            <KpiCard label="Cancelled" value={fmt(tm.cancelled_orders)} color="rose" />
            <KpiCard label="Customers" value={fmt(tm.customer_count)} color="violet" />
            <KpiCard label="Delivery Fees" value={fmtMoney(tm.total_delivery_fees)} color="blue" />
            <KpiCard label="Avg. Order Value"
              value={fmtMoney(tm.total_orders > 0 ? tm.total_revenue / tm.total_orders : 0)} color="amber" />
          </div>

          {/* Revenue over month */}
          <ChartCard title={`${MONTH_NAMES[month]} ${year} — Revenue Over Time`} subtitle="Daily revenue breakdown">
            <div className="h-64">
              {dailyChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChart}>
                    <defs>
                      <linearGradient id="gradRevMonth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fontWeight: 700 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(d) => new Date(d).getDate()}
                    />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip moneyKeys={['revenue']} />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#gradRevMonth)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="No data this month" />}
            </div>
          </ChartCard>

          {/* Orders bar + Revenue comparison grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Daily Orders" subtitle="Orders placed each day">
              <div className="h-52">
                {dailyChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChart} barSize={10}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(d) => new Date(d).getDate()}
                      />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip moneyKeys={[]} />} />
                      <Bar dataKey="orders" name="Orders" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart text="No orders" />}
              </div>
            </ChartCard>

            {/* Growth summary panel */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
              <SectionHeader title="Growth vs Last Month" subtitle="Percentage change from previous period" />
              <div className="space-y-3">
                {[
                  { label: 'Revenue', value: revenueGrowth },
                  { label: 'Orders', value: ordersGrowth },
                ].map((item, i) => {
                  const g = parseFloat(item.value);
                  const isGood = !isNaN(g) && g >= 0;
                  return (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${isGood ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700">{item.label}</span>
                      </div>
                      <span className={`text-xl font-extrabold ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.value !== null && item.value !== undefined
                          ? `${isGood ? '+' : ''}${item.value}%`
                          : 'N/A'}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50">
                  <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700">Unique Customers</span>
                  </div>
                  <span className="text-xl font-extrabold text-blue-600">{fmt(tm.customer_count)}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50">
                  <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700">Delivery Success Rate</span>
                  </div>
                  <span className="text-xl font-extrabold text-amber-600">
                    {tm.total_orders > 0
                      ? `${((tm.completed_deliveries / tm.total_orders) * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <ChartCard title={`Top Products — ${MONTH_NAMES[month]} ${year}`} subtitle="Best selling products this month by revenue">
            <ProductTable products={topProducts} emptyMsg="No product sales this month" />
          </ChartCard>
        </>
      )}
    </div>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, commissionRes] = await Promise.all([
        api.get('/vendor/reports'),
        api.get('/vendor/commissions'),
      ]);
      setData({ ...res.data, commission_report: commissionRes.data });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const summary = data?.summary || {};
  const salesChart = data?.sales_chart || [];
  const topProducts = data?.top_products || [];
  const commissionSummary = data?.commission_report?.summary || {};

  const handleExport = () => {
    if (!data) return;
    const summaryData = data.summary || {};
    const sales = data.sales_chart || [];
    const products = data.top_products || [];

    const rows = [
      ['OVERVIEW REPORT SUMMARY'],
      ['Exported At', new Date().toLocaleString()],
      [],
      ['KPI Metrics', 'Value'],
      ['Total Orders', summaryData.total_orders || 0],
      ['Total Sales (Gross)', fmtMoney(summaryData.total_sales)],
      ['Net Sales', fmtMoney(summaryData.net_sales)],
      ['Commission Paid', fmtMoney(summaryData.total_commission)],
      ['Completed Orders', summaryData.completed_orders || 0],
      ['Cancelled Orders', summaryData.cancelled_orders || 0],
      ['Unique Customers', summaryData.unique_customers || 0],
      ['Delivery Fees Paid', fmtMoney(summaryData.total_delivery_fees)],
      [],
      ['DAILY SALES (LAST 30 DAYS)'],
      ['Date', 'Sales Amount'],
      ...sales.map(s => [
        s.date || '',
        fmtMoney(s.amount)
      ]),
      [],
      ['ALL-TIME TOP SELLING PRODUCTS'],
      ['Product Name', 'Quantity Sold', 'Revenue'],
      ...products.map(p => [
        p.name,
        p.total_qty || 0,
        fmtMoney(p.total_revenue)
      ])
    ];

    downloadExcel(`overview-report-${new Date().toISOString().slice(0, 10)}.xlsx`, rows, 'Overview Report');
  };

  return (
    <div className="space-y-6">
      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={fetch} /> : (
        <>
          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={!data}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Download size={14} />
              Export Excel
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Orders" value={fmt(summary.total_orders)} color="blue" />
            <KpiCard label="Total Sales" value={fmtMoney(summary.total_sales)} color="green" />
            <KpiCard label="Net Revenue" value={fmtMoney(summary.net_sales)} color="green" />
            <KpiCard label="Commission" value={fmtMoney(summary.total_commission)} color="amber" />
            <KpiCard label="Commission Paid" value={fmtMoney(commissionSummary.commission_paid)} color="green" />
            <KpiCard label="Commission Pending" value={fmtMoney(commissionSummary.commission_pending)} color="amber" />
            <KpiCard label="Total Commission Generated" value={fmtMoney(commissionSummary.total_commission_generated)} color="violet" />
            <KpiCard label="Completed" value={fmt(summary.completed_orders)} color="green" />
            <KpiCard label="Cancelled" value={fmt(summary.cancelled_orders)} color="rose" />
            <KpiCard label="Customers" value={fmt(summary.unique_customers)} color="violet" />
            <KpiCard label="Delivery Fees" value={fmtMoney(summary.total_delivery_fees)} color="blue" />
          </div>

          <ChartCard title="Sales — Last 30 Days" subtitle="Daily revenue over the past month">
            <div className="h-64">
              {salesChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChart}>
                    <defs>
                      <linearGradient id="gradOverview" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fontWeight: 700 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip moneyKeys={['amount']} />} />
                    <Area type="monotone" dataKey="amount" name="Sales" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradOverview)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="No sales data" />}
            </div>
          </ChartCard>

          <ChartCard title="All-Time Top Products" subtitle="Best selling products by quantity">
            <ProductTable products={topProducts} />
          </ChartCard>
        </>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'daily',    label: 'Daily' },
  { key: 'weekly',   label: 'Weekly' },
  { key: 'monthly',  label: 'Monthly' },
];

const ReportsAnalytics = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const user = JSON.parse(localStorage.getItem('vendor_user') || 'null');

  if (!user?.id) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center shadow-lg">
        <h2 className="text-2xl font-bold text-rose-700 mb-4">Authentication Required</h2>
        <p className="text-gray-500 mb-6">No vendor session found. Please sign in to access reports.</p>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Reports &amp; Analytics</h2>
          <p className="text-sm text-gray-400 mt-1">Monitor your business performance — daily, weekly, and monthly.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-2xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl transition-all ${
              activeTab === tab.key
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'daily'    && <DailyTab />}
        {activeTab === 'weekly'   && <WeeklyTab />}
        {activeTab === 'monthly'  && <MonthlyTab />}
      </div>
    </div>
  );
};

export default ReportsAnalytics;
