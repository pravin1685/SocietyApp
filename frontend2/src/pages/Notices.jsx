import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const PRIORITY_OPTS = [
  { value: 'normal', label: '📢 Normal — सामान्य', color: 'bg-blue-100 text-blue-700' },
  { value: 'urgent', label: '🚨 Urgent — तातडीचे', color: 'bg-red-100 text-red-700' },
  { value: 'info',   label: 'ℹ️ Info — माहिती',    color: 'bg-green-100 text-green-700' },
];
const EMPTY = { title: '', body: '', priority: 'normal', expires_at: '' };

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    axios.get('/api/notices/all')
      .then(r => setNotices(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (n) => { setForm({ title: n.title, body: n.body, priority: n.priority, expires_at: n.expires_at || '' }); setEditId(n.id); setModal(true); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title आणि Body required!'); return; }
    try {
      if (editId) {
        await axios.put(`/api/notices/${editId}`, { ...form, active: 1 });
      } else {
        await axios.post('/api/notices', form);
      }
      toast.success('Notice saved! ✅');
      setModal(false); load();
    } catch { toast.error('Error saving notice'); }
  };

  const toggleActive = async (n) => {
    await axios.put(`/api/notices/${n.id}`, { ...n, active: n.active ? 0 : 1 });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('हे notice delete करायचे?')) return;
    await axios.delete(`/api/notices/${id}`);
    toast.success('Deleted!'); load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📢 Notices &amp; Announcements</h2>
          <p className="text-sm text-gray-500">Residents च्या Dashboard वर दिसणाऱ्या सूचना manage करा</p>
        </div>
        <button onClick={openAdd} className="btn-primary">➕ New Notice</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 bg-blue-50 text-center border border-blue-100">
          <p className="text-2xl font-bold text-blue-700">{notices.length}</p>
          <p className="text-xs text-blue-600">एकूण Notices</p>
        </div>
        <div className="rounded-xl p-3 bg-green-50 text-center border border-green-100">
          <p className="text-2xl font-bold text-green-700">{notices.filter(n => n.active).length}</p>
          <p className="text-xs text-green-600">Active</p>
        </div>
        <div className="rounded-xl p-3 bg-red-50 text-center border border-red-100">
          <p className="text-2xl font-bold text-red-700">{notices.filter(n => n.priority === 'urgent').length}</p>
          <p className="text-xs text-red-600">Urgent</p>
        </div>
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" /></div>
        ) : notices.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p>कोणतेही notices नाहीत. नवीन notice add करा.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notices.map(n => {
              const pOpt = PRIORITY_OPTS.find(p => p.value === n.priority) || PRIORITY_OPTS[0];
              return (
                <div key={n.id} className={`p-4 flex gap-3 items-start ${!n.active ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pOpt.color}`}>{pOpt.label}</span>
                      {!n.active && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                      {n.expires_at && <span className="text-xs text-orange-500">Expires: {new Date(n.expires_at).toLocaleDateString('en-IN')}</span>}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(n)}
                      className={`text-xs px-2 py-1.5 rounded-lg font-medium ${n.active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      {n.active ? '🔕 Hide' : '✅ Show'}
                    </button>
                    <button onClick={() => openEdit(n)} className="text-xs px-2 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg">✏️</button>
                    <button onClick={() => handleDelete(n.id)} className="text-xs px-2 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">{editId ? '✏️ Edit Notice' : '➕ New Notice'}</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Priority — प्राधान्य</label>
                <div className="flex gap-2">
                  {PRIORITY_OPTS.map(p => (
                    <button key={p.value} onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${form.priority === p.value ? p.color + ' border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Title — शीर्षक *</label>
                <input className="input" value={form.title} placeholder="Notice title..."
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Message — संदेश *</label>
                <textarea className="input" rows={4} value={form.body} placeholder="Notice message..."
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
              </div>
              <div>
                <label className="label">Expires On (Optional)</label>
                <input className="input" type="date" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} className="btn-primary flex-1">💾 Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
