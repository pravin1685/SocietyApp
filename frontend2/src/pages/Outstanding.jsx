import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const EMPTY = { flat_id:'', year:'', maintenance_outstanding:0, audit_fee:0, three_phase_motor:0, conveyance_deed_fee:0, toilet_tank_cleaning:0, other_charges:0, remark:'' };

export default function Outstanding() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [year, setYear] = useState(2024);
  const [data, setData] = useState([]);
  const [flats, setFlats] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      axios.get(`/api/outstanding?year=${year}`),
      isAdmin ? axios.get('/api/flats') : Promise.resolve({ data: [] }),
    ]).then(([o, f]) => { setData(o.data); setFlats(f.data); })
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year]);

  const openAdd = () => { setForm({...EMPTY, year}); setEditId(null); setModal(true); };
  const openEdit = (row) => { setForm({...row}); setEditId(row.id); setModal(true); };

  const f = (key) => parseFloat(form[key]) || 0;
  const total = f('maintenance_outstanding') + f('audit_fee') + f('three_phase_motor') + f('conveyance_deed_fee') + f('toilet_tank_cleaning') + f('other_charges');

  const handleSave = async () => {
    try {
      if (editId) await axios.put(`/api/outstanding/${editId}`, form);
      else await axios.post('/api/outstanding', form);
      toast.success('Saved!');
      setModal(false); load();
    } catch { toast.error('Error saving'); }
  };

  const grandTotal = data.reduce((s, r) => s + (r.total_outstanding || 0), 0);

  const Field = ({ label, fk }) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" type="number" value={form[fk]} onChange={e => setForm({...form, [fk]: e.target.value})} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select value={year} onChange={e => setYear(e.target.value)} className="input w-28 text-sm">
          {[2023,2024,2025].map(y => <option key={y}>{y}</option>)}
        </select>
        {isAdmin && <button onClick={openAdd} className="btn-primary">➕ {t('add')}</button>}
      </div>

      {/* Grand Total */}
      <div className="card bg-red-50 border-red-200 flex items-center gap-4">
        <span className="text-3xl">⚠️</span>
        <div>
          <p className="text-sm text-gray-500">{t('total_outstanding')} — {year}</p>
          <p className="text-3xl font-bold text-red-700">₹{grandTotal.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500">{data.filter(r=>r.total_outstanding>0).length} flats with dues</p>
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
                  <th className="table-header">{t('flat_no')}</th>
                  <th className="table-header">{t('owner_name')}</th>
                  <th className="table-header text-right">{t('maintenance_outstanding')}</th>
                  <th className="table-header text-right">{t('audit_fee')}</th>
                  <th className="table-header text-right">{t('three_phase_motor')}</th>
                  <th className="table-header text-right">{t('conveyance_deed')}</th>
                  <th className="table-header text-right">{t('toilet_tank')}</th>
                  <th className="table-header text-right">{t('other_charges')}</th>
                  <th className="table-header text-right">{t('total')}</th>
                  {isAdmin && <th className="table-header">{t('action')}</th>}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">{t('no_data')}</td></tr>
                ) : data.map(row => (
                  <tr key={row.id} className={`hover:bg-gray-50 ${row.total_outstanding > 0 ? '' : 'opacity-60'}`}>
                    <td className="table-cell font-bold text-blue-700">{row.flat_no}</td>
                    <td className="table-cell">{row.owner_name}</td>
                    {['maintenance_outstanding','audit_fee','three_phase_motor','conveyance_deed_fee','toilet_tank_cleaning','other_charges'].map(k => (
                      <td key={k} className="table-cell text-right">
                        {row[k] > 0 ? <span className="text-red-600">₹{row[k].toLocaleString('en-IN')}</span> : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="table-cell text-right font-bold">
                      {row.total_outstanding > 0
                        ? <span className="text-red-700">₹{row.total_outstanding.toLocaleString('en-IN')}</span>
                        : <span className="badge-paid">✅ Clear</span>}
                    </td>
                    {isAdmin && (
                      <td className="table-cell">
                        <button onClick={() => openEdit(row)} className="text-blue-600 hover:text-blue-800 text-sm">✏️ {t('edit')}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="table-cell" colSpan={2}>{t('total')}</td>
                  {['maintenance_outstanding','audit_fee','three_phase_motor','conveyance_deed_fee','toilet_tank_cleaning','other_charges'].map(k => (
                    <td key={k} className="table-cell text-right text-red-700">
                      ₹{data.reduce((s,r)=>s+(r[k]||0),0).toLocaleString('en-IN')}
                    </td>
                  ))}
                  <td className="table-cell text-right text-red-700 text-base">₹{grandTotal.toLocaleString('en-IN')}</td>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">{editId ? t('edit') : t('add')} Outstanding</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {!editId && (
                <div>
                  <label className="label">{t('flat_no')}</label>
                  <select className="input" value={form.flat_id} onChange={e => setForm({...form, flat_id: e.target.value})}>
                    <option value="">Select flat...</option>
                    {flats.map(f => <option key={f.id} value={f.id}>{f.flat_no} — {f.owner_name}</option>)}
                  </select>
                </div>
              )}
              <Field label={t('maintenance_outstanding')} fk="maintenance_outstanding" />
              <Field label={t('audit_fee')} fk="audit_fee" />
              <Field label={t('three_phase_motor')} fk="three_phase_motor" />
              <Field label={t('conveyance_deed')} fk="conveyance_deed_fee" />
              <Field label={t('toilet_tank')} fk="toilet_tank_cleaning" />
              <Field label={t('other_charges')} fk="other_charges" />
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700">{t('total')}: ₹{total.toLocaleString('en-IN')}</p>
              </div>
              <div><label className="label">{t('remark')}</label><input className="input" value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} /></div>
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
