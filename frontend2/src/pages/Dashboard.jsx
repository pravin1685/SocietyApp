import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import NoticesBanner from '../components/NoticesBanner';

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_MR = ['जाने','फेब्रु','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टें','ऑक्टो','नोव्हें','डिसें'];

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className={`card flex items-center gap-4 border-l-4 ${color}`}>
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function fmt(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [year, setYear] = useState(2024);
  const [loading, setLoading] = useState(true);

  const MONTHS = i18n.language === 'mr' ? MONTHS_MR : MONTHS_EN;

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/dashboard/summary?year=${year}`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  const chartData = MONTHS.map((m, i) => {
    const entry = data?.monthly?.find(e => e.month === i + 1) || {};
    return { name: m, [t('receipt')]: entry.receipts || 0, [t('payment')]: entry.payments || 0 };
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  const balance = (data?.ledger?.total_receipts || 0) - (data?.ledger?.total_payments || 0);

  return (
    <div className="space-y-6">
      {/* Notices Banner */}
      <NoticesBanner />

      {/* Year Selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">{t('dashboard')}</h1>
        <select value={year} onChange={e => setYear(e.target.value)}
          className="input w-32 text-sm">
          {[2023, 2024, 2025].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon="💰" label={t('total_collected')}
          value={fmt(data?.maintenance?.total_collected)}
          sub={`${data?.maintenance?.pending_count || 0} months pending`}
          color="border-green-500" />
        <StatCard icon="⚠️" label={t('total_outstanding')}
          value={fmt(data?.outstanding?.total_outstanding)}
          sub={`${data?.outstanding?.flat_count || 0} flats`}
          color="border-red-500" />
        <StatCard icon="📈" label={t('total_income')}
          value={fmt(data?.ledger?.total_receipts)}
          color="border-blue-500" />
        <StatCard icon="📉" label={t('total_expenses')}
          value={fmt(data?.ledger?.total_payments)}
          sub={`${t('net_balance')}: ${fmt(balance)}`}
          color="border-purple-500" />
      </div>

      {/* Flat Stats (Admin) */}
      {data?.flatStats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon="🏢" label={t('total_flats')} value={data.flatStats.total_flats} color="border-gray-400" />
          <StatCard icon="🏠" label={t('owner_occupied')} value={data.flatStats.owner_occupied} color="border-blue-400" />
          <StatCard icon="🔑" label={t('rented')} value={data.flatStats.rented} color="border-yellow-400" />
        </div>
      )}

      {/* Monthly Chart */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-4">{t('monthly_summary')} — {year}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} />
            <Legend />
            <Bar dataKey={t('receipt')} fill="#22c55e" radius={[4,4,0,0]} />
            <Bar dataKey={t('payment')} fill="#ef4444" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balance */}
      <div className={`card flex items-center gap-4 ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <span className="text-3xl">{balance >= 0 ? '✅' : '❌'}</span>
        <div>
          <p className="text-sm text-gray-500">{t('net_balance')} {year}</p>
          <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(balance)}</p>
        </div>
      </div>
    </div>
  );
}
