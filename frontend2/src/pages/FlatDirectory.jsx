import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = { sl_no: '', flat_no: '', owner_name: '', tenant_name: '', mobile: '', is_rented: 0 };

// Occupancy types with labels, icons and colors
const OCC_TYPES = [
  { value: 0, icon: '🏠', label: 'Owner Occupied', labelMr: 'मालक', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 1, icon: '🔑', label: 'Tenant / Rented', labelMr: 'भाडेकरू', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 2, icon: '🚪', label: 'Empty / Vacant',  labelMr: 'रिकामे',  color: 'bg-gray-100 text-gray-500 border-gray-200' },
];

function OccBadge({ val }) {
  const t = OCC_TYPES.find(o => o.value === val) || OCC_TYPES[0];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${t.color}`}>
      {t.icon} {t.labelMr}
    </span>
  );
}

export default function FlatDirectory() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [flats, setFlats]   = useState([]);
  const [rates, setRates]   = useState([]);
  const [year, setYear]     = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(-1); // -1 = all
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/flats'),
      axios.get('/api/maintenance/rates'),
    ]).then(([f, r]) => {
      setFlats(f.data);
      setRates(r.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Get the active rate row for selected year
  const rateRow = rates.find(r => r.year == year) || { without_noc: 250, with_noc: 500, empty_flat: 0 };

  // Monthly rate per flat based on occupancy type
  const getMonthlyRate = (flat) => {
    if (flat.is_rented === 1) return rateRow.with_noc;
    if (flat.is_rented === 2) return rateRow.empty_flat;
    return rateRow.without_noc;
  };

  const filtered = flats
    .filter(f => filterType === -1 || f.is_rented === filterType)
    .filter(f =>
      f.flat_no?.toLowerCase().includes(search.toLowerCase()) ||
      f.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.mobile?.includes(search)
    );

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setModal(true); };
  const openEdit = (flat) => { setForm({ ...flat }); setEditId(flat.id); setModal(true); };

  const handleSave = async () => {
    if (!form.flat_no || !form.owner_name) { toast.error('Flat No आणि Owner Name required!'); return; }
    try {
      if (editId) {
        await axios.put(`/api/flats/${editId}`, form);
        toast.success('Flat updated! ✅');
      } else {
        await axios.post('/api/flats', form);
        toast.success('Flat added! ✅');
      }
      setModal(false); load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error saving');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('confirm_delete'))) return;
    await axios.delete(`/api/flats/${id}`);
    toast.success('Flat deleted!'); load();
  };

  // Preview monthly rate in modal for selected type
  const previewRate = OCC_TYPES.find(o => o.value === form.is_rented);
  const previewAmt  = form.is_rented === 1 ? rateRow.with_noc
                    : form.is_rented === 2 ? rateRow.empty_flat
                    : rateRow.without_noc;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <input className="input w-48 text-sm" placeholder={`🔍 ${t('search')}...`}
            value={search} onChange={e => setSearch(e.target.value)} />
          {/* Year selector for rate display */}
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-24 text-sm">
            {rates.map(r => <option key={r.year}>{r.year}</option>)}
          </select>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            ➕ {t('add')} Flat
          </button>
        )}
      </div>

      {/* Rate info bar */}
      <div className="flex flex-wrap gap-2 items-center bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
        <span className="text-xs text-blue-600 font-semibold mr-1">{year} Rate:</span>
        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">🏠 Owner — ₹{rateRow.without_noc}/mo</span>
        <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">🔑 Tenant — ₹{rateRow.with_noc}/mo</span>
        <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">🚪 Empty — ₹{rateRow.empty_flat}/mo</span>
        <span className="text-xs text-blue-400 ml-auto">⚙️ Settings मध्ये rate बदला</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'एकूण Flats', val: flats.length, color: 'bg-blue-50 text-blue-700', filter: -1 },
          { label: '🏠 Owner', val: flats.filter(f => f.is_rented === 0).length, color: 'bg-green-50 text-green-700', filter: 0 },
          { label: '🔑 Tenant', val: flats.filter(f => f.is_rented === 1).length, color: 'bg-yellow-50 text-yellow-700', filter: 1 },
          { label: '🚪 Empty', val: flats.filter(f => f.is_rented === 2).length, color: 'bg-gray-50 text-gray-600', filter: 2 },
        ].map(s => (
          <button key={s.label} onClick={() => setFilterType(filterType === s.filter ? -1 : s.filter)}
            className={`rounded-xl p-3 text-center transition border-2 ${s.color} ${filterType === s.filter ? 'border-blue-400 shadow' : 'border-transparent'}`}>
            <p className="text-xl font-bold">{s.val}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">{t('flat_no')}</th>
                  <th className="table-header">{t('owner_name')}</th>
                  <th className="table-header">{t('tenant_name')}</th>
                  <th className="table-header">{t('mobile')}</th>
                  <th className="table-header">प्रकार / Type</th>
                  <th className="table-header text-right">₹/महिना Rate</th>
                  {isAdmin && <th className="table-header">{t('action')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">{t('no_data')}</td></tr>
                ) : filtered.map((f, i) => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell text-gray-400 text-sm">{i + 1}</td>
                    <td className="table-cell font-bold text-blue-700">{f.flat_no}</td>
                    <td className="table-cell font-medium">{f.owner_name}</td>
                    <td className="table-cell text-gray-500 text-sm">{f.tenant_name || '—'}</td>
                    <td className="table-cell text-sm">{f.mobile || '—'}</td>
                    <td className="table-cell"><OccBadge val={f.is_rented} /></td>
                    <td className="table-cell text-right">
                      <span className={`font-bold text-sm ${
                        f.is_rented === 2 ? 'text-gray-400' :
                        f.is_rented === 1 ? 'text-yellow-700' : 'text-green-700'
                      }`}>
                        {getMonthlyRate(f) > 0 ? `₹${getMonthlyRate(f).toLocaleString('en-IN')}` : '—'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(f)} className="text-blue-600 hover:text-blue-800 text-sm">✏️</button>
                          <button onClick={() => handleDelete(f.id)} className="text-red-500 hover:text-red-700 text-sm">🗑️</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-sm">
                  <td className="table-cell" colSpan={6}>
                    <span className="text-gray-600">एकूण Monthly Collection ({year})</span>
                  </td>
                  <td className="table-cell text-right text-blue-700 font-bold">
                    ₹{flats.reduce((s, f) => s + getMonthlyRate(f), 0).toLocaleString('en-IN')}/mo
                  </td>
                  {isAdmin && <td />}
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
              <h3 className="font-bold text-lg">{editId ? '✏️ Edit' : '➕ Add'} Flat</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Sl. No</label>
                  <input className="input" type="number" value={form.sl_no}
                    onChange={e => setForm({...form, sl_no: e.target.value})} />
                </div>
                <div>
                  <label className="label">{t('flat_no')}</label>
                  <input className="input" value={form.flat_no}
                    onChange={e => setForm({...form, flat_no: e.target.value})} placeholder="FLAT-01" />
                </div>
              </div>
              <div>
                <label className="label">{t('owner_name')} — मालकाचे नाव</label>
                <input className="input" value={form.owner_name}
                  onChange={e => setForm({...form, owner_name: e.target.value})} />
              </div>
              <div>
                <label className="label">{t('tenant_name')} — भाडेकरूचे नाव (असल्यास)</label>
                <input className="input" value={form.tenant_name || ''}
                  onChange={e => setForm({...form, tenant_name: e.target.value})} />
              </div>
              <div>
                <label className="label">{t('mobile')}</label>
                <input className="input" value={form.mobile || ''}
                  onChange={e => setForm({...form, mobile: e.target.value})} />
              </div>

              {/* Occupancy type selector with rate preview */}
              <div>
                <label className="label">Flat प्रकार — Occupancy Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {OCC_TYPES.map(o => (
                    <button key={o.value}
                      onClick={() => setForm({...form, is_rented: o.value})}
                      className={`py-3 px-2 rounded-xl border-2 text-center transition ${
                        form.is_rented === o.value
                          ? 'border-blue-500 bg-blue-50 shadow'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="text-2xl mb-1">{o.icon}</div>
                      <div className="text-xs font-semibold text-gray-700">{o.labelMr}</div>
                      <div className="text-xs text-gray-400">{o.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate preview for selected type */}
              <div className={`rounded-xl p-3 border ${previewRate?.color || 'bg-gray-50 border-gray-200'} flex items-center justify-between`}>
                <div>
                  <p className="text-xs font-medium text-gray-600">
                    {previewRate?.icon} {previewRate?.labelMr} — Monthly Maintenance Rate
                  </p>
                  <p className="text-xs text-gray-400">{year} साठी assigned rate:</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-700">
                    {previewAmt > 0 ? `₹${previewAmt.toLocaleString('en-IN')}` : 'Free'}
                  </p>
                  <p className="text-xs text-gray-400">per month</p>
                </div>
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
