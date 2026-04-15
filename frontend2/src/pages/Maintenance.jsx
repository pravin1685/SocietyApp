import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import PaymentQRModal from '../components/PaymentQRModal';

const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export default function Maintenance() {
  const { t } = useTranslation();
  const { isAdmin, user } = useAuth();
  const [year, setYear] = useState(2024);
  const [summary, setSummary] = useState([]);
  const [payments, setPayments] = useState([]);
  const [rates, setRates] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedFlat, setSelectedFlat] = useState(null);
  const [modal, setModal] = useState(false);
  const [qrModal, setQrModal] = useState(null); // { flatNo, pendingAmount, pendingMonths }
  const [editPayment, setEditPayment] = useState(null);
  const [form, setForm] = useState({ amount: '', status: 'paid', payment_date: '', payment_mode: 'Cash', month_occupancy: null });
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get(`/api/maintenance/summary/${year}`),
      axios.get(`/api/maintenance?year=${year}`),
      axios.get('/api/maintenance/rates'),
      axios.get('/api/settings'),
    ]).then(([s, p, r, st]) => {
      setSummary(s.data);
      setPayments(p.data);
      setRates(r.data);
      setSettings(st.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year]);

  const getPayment = (flatId, month) =>
    payments.find(p => p.flat_id === flatId && p.month === month);

  // Get rate for a given occupancy type
  const getRateForType = (occType) => {
    const yr = rates.find(r => r.year == year);
    if (!yr) return 0;
    if (occType === 1) return yr.with_noc;
    if (occType === 2) return yr.empty_flat;
    return yr.without_noc;
  };

  const openEdit = (flat, month) => {
    if (!isAdmin) return;
    const existing = getPayment(flat.id, month);
    setSelectedFlat(flat);
    setEditPayment({ flat_id: flat.id, year, month, ...existing });
    // month_occupancy: use existing override, else flat default
    const occType = existing?.month_occupancy != null ? existing.month_occupancy : flat.is_rented;
    const defaultRate = getRateForType(occType);
    setForm({
      amount: existing?.amount > 0 ? existing.amount : defaultRate || '',
      status: existing?.status || 'pending',
      payment_date: existing?.payment_date || '',
      payment_mode: existing?.payment_mode || 'Cash',
      month_occupancy: occType,
    });
    setModal(true);
  };

  const handleSave = async () => {
    try {
      await axios.post('/api/maintenance', {
        flat_id: editPayment.flat_id, year, month: editPayment.month,
        amount: parseFloat(form.amount) || 0,
        status: form.status, payment_date: form.payment_date, payment_mode: form.payment_mode,
        month_occupancy: form.month_occupancy,
      });
      toast.success('Payment saved!');
      setModal(false); load();
    } catch (e) { toast.error('Error saving'); }
  };

  const OCC_ICONS = ['🏠', '🔑', '🚪'];

  const cellColor = (flat, month) => {
    const p = getPayment(flat.id, month);
    if (!p) return 'bg-gray-100 text-gray-400';
    if (p.status === 'paid') return 'bg-green-100 text-green-700 font-semibold';
    // empty flat (occ=2) pending → gray-ish
    const occ = p.month_occupancy != null ? p.month_occupancy : flat.is_rented;
    if (occ === 2) return 'bg-gray-200 text-gray-500';
    return 'bg-red-100 text-red-600';
  };

  const cellText = (flat, month) => {
    const p = getPayment(flat.id, month);
    if (!p) return '—';
    const occ = p.month_occupancy != null ? p.month_occupancy : flat.is_rented;
    // Show icon only when month_occupancy overrides flat default
    const icon = p.month_occupancy != null && p.month_occupancy !== flat.is_rented
      ? OCC_ICONS[occ] + ' ' : '';
    if (p.status === 'paid') return `${icon}₹${p.amount}`;
    if (occ === 2) return `${icon}Empty`;
    return `${icon}${t('pending')}`;
  };

  const yearRate = rates.find(r => r.year == year);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(e.target.value)} className="input w-28 text-sm">
            {[2023,2024,2025].map(y => <option key={y}>{y}</option>)}
          </select>
          {yearRate && (
            <div className="flex gap-2 text-xs">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">{t('without_noc')}: ₹{yearRate.without_noc}/mo</span>
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">{t('with_noc')}: ₹{yearRate.with_noc}/mo</span>
            </div>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => {
            const y = prompt('Update rate for year:', year);
            const wo = prompt('Without NOC monthly rate:');
            const wi = prompt('With NOC monthly rate:');
            if (y && wo && wi) {
              axios.put(`/api/maintenance/rates/${y}`, { without_noc: +wo, with_noc: +wi })
                .then(() => { toast.success('Rates updated!'); load(); });
            }
          }} className="btn-secondary text-sm">⚙️ {t('settings')}</button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('total_flats'), val: summary.length, color: 'bg-blue-50 text-blue-700' },
          { label: t('paid'), val: summary.filter(f => f.pending_months === 0 && f.total_months > 0).length, color: 'bg-green-50 text-green-700' },
          { label: t('total_collected'), val: '₹' + summary.reduce((s, f) => s + (f.total_paid || 0), 0).toLocaleString('en-IN'), color: 'bg-purple-50 text-purple-700' },
          { label: t('pending'), val: summary.reduce((s, f) => s + (f.pending_months || 0), 0) + ' months', color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
            <p className="text-xl font-bold">{s.val}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Grid Table */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="table-header sticky left-0 bg-gray-50 z-10">{t('flat_no')}</th>
                  <th className="table-header max-w-[120px]">{t('owner_name')}</th>
                  {MONTH_KEYS.map(m => <th key={m} className="table-header text-center px-2">{t(m)}</th>)}
                  <th className="table-header text-center">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(flat => (
                  <tr key={flat.id} className="hover:bg-gray-50">
                    <td className="table-cell font-bold text-blue-700 sticky left-0 bg-white">{flat.flat_no}</td>
                    <td className="table-cell max-w-[120px] truncate">{flat.owner_name}</td>
                    {MONTH_KEYS.map((_, idx) => (
                      <td key={idx}
                        onClick={() => openEdit(flat, idx + 1)}
                        className={`border-b border-gray-100 text-center py-2 px-1 text-xs cursor-pointer rounded-md mx-0.5 transition-all hover:opacity-80 ${cellColor(flat, idx + 1)}`}>
                        {cellText(flat, idx + 1)}
                      </td>
                    ))}
                    <td className="table-cell text-center font-semibold text-green-700">
                      ₹{(flat.total_paid || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && <p className="text-xs text-gray-400 p-3">💡 Click any month cell to update payment status</p>}
        </div>
      )}

      {/* User: Pay Now QR Banner */}
      {!isAdmin && (() => {
        // Use logged-in user's flat — don't rely on summary[0] which was FLAT-01
        const myFlat = summary.find(f => f.id === user?.flat_id) || summary[0];
        if (!myFlat) return null;
        const myPending = payments.filter(p => p.status === 'pending' && p.flat_id === myFlat.id);
        const pendingMos = myPending.length;
        // Pending entries seeded from Excel have amount=0 → use rate per month as fallback
        const yearRate  = rates.find(r => r.year == year);
        const ratePerMo = myFlat.is_rented === 1 ? (yearRate?.with_noc    || 500)
                        : myFlat.is_rented === 2 ? (yearRate?.empty_flat  ||   0)
                        :                          (yearRate?.without_noc || 250);
        const pendingAmt = myPending.reduce((s, p) =>
          s + (p.amount > 0 ? p.amount : ratePerMo), 0);
        if (pendingMos === 0) return (
          <div className="card bg-green-50 border border-green-200 text-center py-4">
            <p className="text-green-700 font-semibold">✅ सर्व देखभाल शुल्क paid आहे! — {year}</p>
          </div>
        );
        return (
          <div className="card bg-orange-50 border border-orange-200 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-orange-700 font-semibold">⚠️ {pendingMos} महिन्यांचे शुल्क बाकी आहे</p>
              <p className="text-2xl font-bold text-orange-800">₹{pendingAmt.toLocaleString('en-IN')}</p>
              <p className="text-xs text-orange-600 mt-0.5">{myFlat.flat_no} — {year}</p>
            </div>
            <button
              onClick={() => setQrModal({ flatNo: myFlat.flat_no, pendingAmount: pendingAmt, pendingMonths: pendingMos })}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 text-sm">
              💳 Pay Now — QR Code
            </button>
          </div>
        );
      })()}

      {/* Admin Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-bold">{selectedFlat?.flat_no} — {t(MONTH_KEYS[editPayment?.month - 1])} {year}</h3>
                <p className="text-xs text-gray-400">{selectedFlat?.owner_name}</p>
              </div>
              <button onClick={() => setModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Month Occupancy Type */}
              <div>
                <label className="label">महिन्याचा प्रकार (Month Type)</label>
                <div className="flex gap-2">
                  {[
                    { val: 0, icon: '🏠', label: 'Owner' },
                    { val: 1, icon: '🔑', label: 'Tenant' },
                    { val: 2, icon: '🚪', label: 'Empty' },
                  ].map(opt => (
                    <button key={opt.val}
                      onClick={() => {
                        const newRate = getRateForType(opt.val);
                        setForm(f => ({ ...f, month_occupancy: opt.val, amount: newRate || f.amount }));
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition flex flex-col items-center gap-0.5 ${
                        form.month_occupancy === opt.val
                          ? opt.val === 0 ? 'bg-blue-600 text-white'
                          : opt.val === 1 ? 'bg-yellow-500 text-white'
                          : 'bg-gray-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      <span>{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {form.month_occupancy !== (selectedFlat?.is_rented ?? 0) && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Flat default ({OCC_ICONS[selectedFlat?.is_rented ?? 0]}) पेक्षा वेगळा — फक्त या महिन्यासाठी
                  </p>
                )}
              </div>
              <div>
                <label className="label">{t('status')}</label>
                <div className="flex gap-2">
                  {['paid','pending'].map(s => (
                    <button key={s} onClick={() => setForm({...form, status: s})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${form.status === s ? (s==='paid'?'bg-green-600 text-white':'bg-red-600 text-white') : 'bg-gray-100 text-gray-600'}`}>
                      {s === 'paid' ? '✅' : '⏳'} {t(s)}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label">{t('amount')} {form.month_occupancy === 2 ? '(Empty = ₹0 असू शकतो)' : ''}</label>
                <input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              </div>
              <div><label className="label">{t('date')}</label>
                <input className="input" type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} />
              </div>
              <div><label className="label">{t('payment_mode')}</label>
                <select className="input" value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}>
                  {['Cash','Online','Cheque','NEFT','UPI'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">{t('cancel')}</button>
              <button onClick={handleSave} className="btn-primary flex-1">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Payment Modal */}
      <PaymentQRModal
        isOpen={!!qrModal}
        onClose={() => setQrModal(null)}
        flatNo={qrModal?.flatNo}
        pendingAmount={qrModal?.pendingAmount || 0}
        pendingMonths={qrModal?.pendingMonths || 0}
        settings={settings}
      />
    </div>
  );
}
