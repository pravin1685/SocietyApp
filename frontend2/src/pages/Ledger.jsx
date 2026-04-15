import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EMPTY = { year: new Date().getFullYear(), month: new Date().getMonth()+1, entry_date: '', voucher_no: '', type: 'receipt', details: '', payment_mode: 'Cash', amount: '' };

export default function Ledger() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [entries, setEntries] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    let url = `/api/ledger?year=${year}`;
    if (parseInt(month)) url += `&month=${month}`;
    if (typeFilter) url += `&type=${typeFilter}`;
    axios.get(url).then(r => setEntries(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year, month, typeFilter]);

  const totalReceipts = entries.filter(e => e.type === 'receipt').reduce((s, e) => s + e.amount, 0);
  const totalPayments = entries.filter(e => e.type === 'payment').reduce((s, e) => s + e.amount, 0);
  const balance = totalReceipts - totalPayments;

  const openAdd = () => { setForm({...EMPTY, year, month: month || 1}); setEditId(null); setModal(true); };
  const openEdit = (e) => { setForm({...e}); setEditId(e.id); setModal(true); };

  const handleSave = async () => {
    try {
      if (editId) await axios.put(`/api/ledger/${editId}`, form);
      else await axios.post('/api/ledger', form);
      toast.success('Entry saved!');
      setModal(false); load();
    } catch { toast.error('Error saving'); }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('confirm_delete'))) return;
    await axios.delete(`/api/ledger/${id}`);
    toast.success('Deleted!'); load();
  };

  const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <select value={year} onChange={e => setYear(e.target.value)} className="input w-24 text-sm">
            {[2023,2024,2025].map(y=><option key={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="input w-32 text-sm">
            <option value={0}>{t('all')} Months</option>
            {MONTH_KEYS.map((m,i)=><option key={i} value={i+1}>{t(m)}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-28 text-sm">
            <option value="">{t('all')}</option>
            <option value="receipt">📥 {t('receipt')}</option>
            <option value="payment">📤 {t('payment')}</option>
          </select>
        </div>
        {isAdmin && <button onClick={openAdd} className="btn-primary">➕ {t('add')}</button>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4 bg-green-50 text-center">
          <p className="text-xs text-green-600 font-medium">📥 {t('receipt')}</p>
          <p className="text-xl font-bold text-green-700">₹{totalReceipts.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-xl p-4 bg-red-50 text-center">
          <p className="text-xs text-red-600 font-medium">📤 {t('payment')}</p>
          <p className="text-xl font-bold text-red-700">₹{totalPayments.toLocaleString('en-IN')}</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <p className="text-xs font-medium text-gray-500">💰 {t('net_balance')}</p>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>₹{balance.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">{t('month')}</th>
                  <th className="table-header">{t('flat_no')} / Ref</th>
                  <th className="table-header">{t('details')}</th>
                  <th className="table-header">{t('payment_mode')}</th>
                  <th className="table-header text-right">{t('receipt')} (₹)</th>
                  <th className="table-header text-right">{t('payment')} (₹)</th>
                  {isAdmin && <th className="table-header">{t('action')}</th>}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">{t('no_data')}</td></tr>
                ) : entries.map(e => (
                  <tr key={e.id} className={`hover:bg-gray-50 ${e.type==='receipt' ? 'border-l-2 border-green-400' : 'border-l-2 border-red-400'}`}>
                    <td className="table-cell font-medium">{t(MONTH_KEYS[e.month - 1])}</td>
                    <td className="table-cell text-blue-700 font-semibold">{e.voucher_no || '—'}</td>
                    <td className="table-cell font-medium">{e.details || '—'}</td>
                    <td className="table-cell text-gray-500">{e.payment_mode || '—'}</td>
                    <td className="table-cell text-right">
                      {e.type==='receipt' ? <span className="text-green-700 font-semibold">₹{e.amount.toLocaleString('en-IN')}</span> : '—'}
                    </td>
                    <td className="table-cell text-right">
                      {e.type==='payment' ? <span className="text-red-600 font-semibold">₹{e.amount.toLocaleString('en-IN')}</span> : '—'}
                    </td>
                    {isAdmin && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(e)} className="text-blue-600 hover:text-blue-800 text-xs">✏️</button>
                          <button onClick={() => handleDelete(e.id)} className="text-red-500 hover:text-red-700 text-xs">🗑️</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="table-cell" colSpan={4}>{t('total')}</td>
                  <td className="table-cell text-right text-green-700">₹{totalReceipts.toLocaleString('en-IN')}</td>
                  <td className="table-cell text-right text-red-700">₹{totalPayments.toLocaleString('en-IN')}</td>
                  {isAdmin && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">{editId ? t('edit') : t('add')} Entry</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">{t('status')}</label>
                <div className="flex gap-2">
                  {['receipt','payment'].map(s => (
                    <button key={s} onClick={() => setForm({...form, type: s})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${form.type===s ? (s==='receipt'?'bg-green-600 text-white':'bg-red-600 text-white') : 'bg-gray-100 text-gray-600'}`}>
                      {s==='receipt'?'📥':'📤'} {t(s)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('year')}</label>
                  <select className="input" value={form.year} onChange={e => setForm({...form, year: e.target.value})}>
                    {[2023,2024,2025].map(y=><option key={y}>{y}</option>)}
                  </select>
                </div>
                <div><label className="label">{t('month')}</label>
                  <select className="input" value={form.month} onChange={e => setForm({...form, month: e.target.value})}>
                    {MONTH_KEYS.map((m,i)=><option key={i} value={i+1}>{t(m)}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">{t('date')}</label><input className="input" type="date" value={form.entry_date} onChange={e => setForm({...form, entry_date: e.target.value})} /></div>
              <div><label className="label">{t('voucher_no')}</label><input className="input" value={form.voucher_no} onChange={e => setForm({...form, voucher_no: e.target.value})} /></div>
              <div><label className="label">{t('details')}</label><input className="input" value={form.details} onChange={e => setForm({...form, details: e.target.value})} placeholder="Details..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('payment_mode')}</label>
                  <select className="input" value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}>
                    {['Cash','Online','Cheque','NEFT','UPI'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label">{t('amount')}</label><input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">{t('cancel')}</button>
              <button onClick={handleSave} className="btn-primary flex-1">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
