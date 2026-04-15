import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const MONTH_MR = ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function PendingReminders() {
  const [year, setYear]         = useState(2024);
  const [summary, setSummary]   = useState([]);
  const [payments, setPayments] = useState([]);
  const [rates, setRates]       = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all'); // 'all' | 'pending' | 'clear'

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get(`/api/maintenance/summary/${year}`),
      axios.get(`/api/maintenance?year=${year}`),
      axios.get('/api/settings'),
      axios.get('/api/maintenance/rates'),
    ]).then(([s, p, st, r]) => {
      setSummary(s.data);
      setPayments(p.data);
      setSettings(st.data);
      setRates(r.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year]);

  // Build per-flat pending info — use rate when seeded amount is 0
  const yearRate = rates.find(r => r.year == year);
  const flatData = summary.map(flat => {
    const flatPayments  = payments.filter(p => p.flat_id === flat.id);
    const pendingPmts   = flatPayments.filter(p => p.status === 'pending' || !p.status);
    const pendingMonths = pendingPmts.map(p => p.month);
    const ratePerMo = flat.is_rented === 1 ? (yearRate?.with_noc    || 500)
                    : flat.is_rented === 2 ? (yearRate?.empty_flat  ||   0)
                    :                        (yearRate?.without_noc || 250);
    // Seeded pending entries have amount=0 → fall back to rate per month
    const pendingAmount = pendingPmts.reduce((s, p) =>
      s + (p.amount > 0 ? p.amount : ratePerMo), 0);
    return { ...flat, pendingMonths, pendingAmount };
  });

  const filtered = flatData.filter(f => {
    if (filter === 'pending') return f.pending_months > 0;
    if (filter === 'clear')   return f.pending_months === 0;
    return true;
  }).sort((a,b) => (b.pending_months || 0) - (a.pending_months || 0));

  // Generate WhatsApp message for a flat
  const buildMessage = (flat) => {
    const months = flat.pendingMonths.map(m => MONTH_MR[m-1]).join(', ');
    const society = settings.society_name || 'Central Park Society';
    const phone   = settings.contact_phone || '';
    return `नमस्कार ${flat.owner_name || flat.flat_no},\n\nआपल्या *${flat.flat_no}* साठी *${year}* मधील खालील महिन्यांचे देखभाल शुल्क बाकी आहे:\n\n📅 महिने: *${months || 'काही नाही'}*\n💰 एकूण रक्कम: *₹${(flat.pendingAmount || 0).toLocaleString('en-IN')}*\n\nकृपया लवकरात लवकर शुल्क भरावे.\n\n${phone ? `📞 संपर्क: ${phone}` : ''}\n\nधन्यवाद,\n${society}`;
  };

  const copyMessage = (flat) => {
    navigator.clipboard.writeText(buildMessage(flat));
    toast.success(`${flat.flat_no} चा message copied! 📋`);
  };

  const openWhatsApp = (flat) => {
    const msg = encodeURIComponent(buildMessage(flat));
    const phone = (flat.mobile || '').replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    }
  };

  const pendingCount = flatData.filter(f => f.pending_months > 0).length;
  const totalPending = flatData.reduce((s, f) => s + (f.pendingAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🔔 Pending Reminders — थकबाकी यादी</h2>
          <p className="text-sm text-gray-500">WhatsApp / SMS मेसेज templates copy करा</p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28">
          {[2023,2024,2025].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4 bg-red-50 border border-red-100 text-center">
          <p className="text-2xl font-bold text-red-700">{pendingCount}</p>
          <p className="text-xs text-red-600">थकित Flats</p>
        </div>
        <div className="rounded-xl p-4 bg-green-50 border border-green-100 text-center">
          <p className="text-2xl font-bold text-green-700">{flatData.length - pendingCount}</p>
          <p className="text-xs text-green-600">Clear Flats</p>
        </div>
        <div className="rounded-xl p-4 bg-orange-50 border border-orange-100 text-center">
          <p className="text-lg font-bold text-orange-700">₹{totalPending.toLocaleString('en-IN')}</p>
          <p className="text-xs text-orange-600">एकूण थकबाकी</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['all','सर्व'],['pending','थकित'],['clear','Clear']].map(([val,lbl]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter===val ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Flat list */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(flat => (
            <div key={flat.id} className={`card py-3 px-4 flex items-center gap-3 flex-wrap ${flat.pending_months > 0 ? 'border-l-4 border-red-400' : 'border-l-4 border-green-400'}`}>
              {/* Flat info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-blue-700">{flat.flat_no}</span>
                  <span className="text-gray-700 text-sm">{flat.owner_name}</span>
                  {flat.mobile && <span className="text-xs text-gray-400">📞 {flat.mobile}</span>}
                </div>
                {flat.pending_months > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {flat.pendingMonths.map(m => (
                      <span key={m} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {MONTH_EN[m-1]}
                      </span>
                    ))}
                    <span className="text-xs font-semibold text-red-600 ml-1">
                      ₹{(flat.pendingAmount || 0).toLocaleString('en-IN')} बाकी
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-green-600 font-medium">✅ सर्व paid</span>
                )}
              </div>

              {/* Action buttons */}
              {flat.pending_months > 0 && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => copyMessage(flat)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                    📋 Copy Msg
                  </button>
                  <button onClick={() => openWhatsApp(flat)}
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                    📱 WhatsApp
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">🎉</div>
              <p>{filter === 'pending' ? 'सर्व flats clear आहेत!' : 'कोणतेही results नाहीत.'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
