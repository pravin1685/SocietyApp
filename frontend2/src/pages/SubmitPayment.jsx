import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const MONTHS = ['','जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
const MONTHS_EN = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_STYLE = {
  pending:  { bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', icon: '⏳', label: 'Verification Pending' },
  verified: { bg: 'bg-green-50  border-green-300',  badge: 'bg-green-100  text-green-700',  icon: '✅', label: 'Verified & Paid'      },
  rejected: { bg: 'bg-red-50    border-red-300',    badge: 'bg-red-100    text-red-700',    icon: '❌', label: 'Rejected'             },
};

export default function SubmitPayment() {
  const { user } = useAuth();
  const imgRef   = useRef(null);

  const [summary,  setSummary]  = useState(null);
  const [payments, setPayments] = useState([]);
  const [rates,    setRates]    = useState([]);
  const [myVerifs, setMyVerifs] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [year,     setYear]     = useState(new Date().getFullYear());

  const [form, setForm] = useState({
    month: '', amount: '', utr_number: '', payment_mode: 'UPI', screenshot: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [imgPreview, setImgPreview] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, r, v] = await Promise.all([
        axios.get(`/api/maintenance/summary/${year}`),
        axios.get(`/api/maintenance?year=${year}`),
        axios.get('/api/maintenance/rates'),
        axios.get('/api/verifications/my'),
      ]);
      const myFlat = s.data.find(f => f.id === user?.flat_id) || s.data[0];
      setSummary(myFlat);
      setPayments(p.data.filter(pm => pm.flat_id === user?.flat_id));
      setRates(r.data);
      setMyVerifs(v.data);
    } catch (e) { toast.error('Load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year]);

  // Auto-fill amount when month changes
  useEffect(() => {
    if (!form.month || !summary) return;
    const yr    = rates.find(r => r.year == year);
    const rate  = summary.is_rented === 1 ? yr?.with_noc
                : summary.is_rented === 2 ? yr?.empty_flat
                : yr?.without_noc;
    const existing = payments.find(p => p.month === +form.month);
    setForm(f => ({ ...f, amount: existing?.amount > 0 ? existing.amount : (rate || '') }));
  }, [form.month]);

  const handleImg = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { toast.error('Image too large (max 1MB)'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      setImgPreview(ev.target.result);
      setForm(f => ({ ...f, screenshot: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const pendingMonths = payments.filter(p => p.status === 'pending');

  const handleSubmit = async () => {
    if (!form.month)      { toast.error('Month select करा'); return; }
    if (!form.utr_number) { toast.error('UTR number enter करा'); return; }
    if (!form.amount)     { toast.error('Amount enter करा'); return; }

    // Check already submitted for this month
    const alreadySubmitted = myVerifs.find(
      v => v.year == year && v.month == form.month && v.status !== 'rejected'
    );
    if (alreadySubmitted) {
      toast.error(`${MONTHS_EN[form.month]} साठी आधीच submit झाला आहे (${alreadySubmitted.status})`);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/verifications', {
        year, month: +form.month,
        amount: +form.amount,
        utr_number: form.utr_number.trim().toUpperCase(),
        payment_mode: form.payment_mode,
        screenshot: form.screenshot,
      });
      toast.success('Payment submitted! Admin verify करतील लवकरच ✅');
      setForm({ month: '', amount: '', utr_number: '', payment_mode: 'UPI', screenshot: '' });
      setImgPreview('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Submit failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">💳 Payment Submit करा</h2>
        <p className="text-sm text-gray-500">UPI payment केल्यावर UTR number इथे submit करा — Admin verify करतील</p>
      </div>

      {/* Flat info + pending */}
      {summary && (
        <div className="card bg-blue-50 border border-blue-200 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="font-bold text-blue-800">{summary.flat_no} — {summary.owner_name}</p>
              <p className="text-xs text-blue-600">
                Year: {year} · Pending: {pendingMonths.length} months
              </p>
            </div>
            <select value={year} onChange={e => setYear(+e.target.value)}
              className="ml-auto input w-24 text-sm">
              {[2023,2024,2025,2026].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          {pendingMonths.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pendingMonths.map(p => (
                <button key={p.month}
                  onClick={() => setForm(f => ({ ...f, month: String(p.month) }))}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                    form.month == p.month ? 'bg-blue-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}>
                  {MONTHS_EN[p.month]}
                </button>
              ))}
              <span className="text-xs text-gray-500 self-center ml-1">← month click करा</span>
            </div>
          )}
        </div>
      )}

      {/* Submit Form */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-700">📋 Payment Details</h3>

        {/* Month */}
        <div>
          <label className="label">महिना (Month) *</label>
          <select className="input" value={form.month}
            onChange={e => setForm(f => ({ ...f, month: e.target.value }))}>
            <option value="">-- Month Select करा --</option>
            {pendingMonths.map(p => (
              <option key={p.month} value={p.month}>
                {MONTHS[p.month]} ({MONTHS_EN[p.month]})
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="label">Amount (₹) *</label>
          <input className="input" type="number" placeholder="500"
            value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </div>

        {/* UTR */}
        <div>
          <label className="label">UTR / Transaction ID *</label>
          <input className="input font-mono tracking-wider" placeholder="UTR12345678901234"
            value={form.utr_number}
            onChange={e => setForm(f => ({ ...f, utr_number: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">
            📱 PhonePe/GPay मध्ये: History → Transaction → UTR Number दिसेल
          </p>
        </div>

        {/* Payment Mode */}
        <div>
          <label className="label">Payment Mode</label>
          <div className="flex gap-2 flex-wrap">
            {['UPI','PhonePe','GPay','Paytm','NEFT','IMPS'].map(m => (
              <button key={m} onClick={() => setForm(f => ({ ...f, payment_mode: m }))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                  form.payment_mode === m
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}>{m}</button>
            ))}
          </div>
        </div>

        {/* Screenshot (optional) */}
        <div>
          <label className="label">Payment Screenshot (optional)</label>
          <input ref={imgRef} type="file" accept="image/*" onChange={handleImg} className="hidden" />
          <button onClick={() => imgRef.current?.click()}
            className="btn-secondary w-full flex items-center justify-center gap-2">
            📸 Screenshot Upload करा (max 1MB)
          </button>
          {imgPreview && (
            <div className="mt-2 relative">
              <img src={imgPreview} alt="preview" className="rounded-xl max-h-40 object-contain border border-gray-200" />
              <button onClick={() => { setImgPreview(''); setForm(f => ({ ...f, screenshot: '' })); }}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center">✕</button>
            </div>
          )}
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50">
          {submitting ? '⏳ Submitting...' : '📤 Payment Submit करा'}
        </button>
      </div>

      {/* My Verification History */}
      {myVerifs.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700">📜 माझे Submissions</h3>
          <div className="space-y-2">
            {myVerifs.slice(0, 10).map(v => {
              const s = STATUS_STYLE[v.status] || STATUS_STYLE.pending;
              return (
                <div key={v.id} className={`rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap ${s.bg}`}>
                  <span className="text-xl">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{MONTHS_EN[v.month]} {v.year}</span>
                      <span className="font-bold text-green-700">₹{v.amount}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      UTR: <code className="font-mono">{v.utr_number}</code>
                      {v.note && <span className="ml-2 text-red-600">({v.note})</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(v.created_at).toLocaleDateString('en-IN')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
