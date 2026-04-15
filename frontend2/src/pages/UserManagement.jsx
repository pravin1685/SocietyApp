import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API = '/api';

const EMPTY_FORM = { username: '', name: '', role: 'user', flat_id: '', password: '' };

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers]       = useState([]);
  const [flats, setFlats]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals
  const [editModal, setEditModal]   = useState(false);
  const [pwdModal, setPwdModal]     = useState(false);
  const [addModal, setAddModal]     = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [newPwd, setNewPwd]         = useState('');
  const [showPwd, setShowPwd]       = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [uRes, fRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/flats`),
      ]);
      setUsers(uRes.data);
      setFlats(fRes.data);
    } catch { toast.error('Error loading data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return (
    <div className="card text-center py-16 text-red-500">
      <div className="text-5xl mb-3">🔒</div>
      <p className="font-semibold">Admin access only</p>
    </div>
  );

  // ── Filtered list
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.username?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q) || u.flat_no?.toLowerCase().includes(q);
    const matchRole   = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount  = users.filter(u => u.role === 'user').length;

  // ── Open edit modal
  const openEdit = (u) => {
    setSelectedUser(u);
    setForm({ username: u.username, name: u.name, role: u.role, flat_id: u.flat_id || '', password: '' });
    setEditModal(true);
  };

  // ── Save edit
  const handleSaveEdit = async () => {
    try {
      await axios.put(`${API}/users/${selectedUser.id}`, {
        username: form.username,
        name: form.name,
        role: form.role,
        flat_id: form.flat_id || null,
      });
      toast.success('User updated ✅');
      setEditModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error updating user');
    }
  };

  // ── Reset password to default
  const handleReset = async (u) => {
    if (!confirm(`"${u.username}" चा password reset करायचा का?\nनवीन password: ${u.username}@123`)) return;
    try {
      const res = await axios.post(`${API}/users/${u.id}/reset-password`);
      toast.success(`Password reset: ${res.data.defaultPassword}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error resetting password');
    }
  };

  // ── Set custom password
  const openPwd = (u) => { setSelectedUser(u); setNewPwd(''); setShowPwd(false); setPwdModal(true); };
  const handleSetPwd = async () => {
    if (newPwd.length < 4) { toast.error('Password कमीत कमी 4 characters हवे'); return; }
    try {
      await axios.put(`${API}/users/${selectedUser.id}/password`, { password: newPwd });
      toast.success('Password changed ✅');
      setPwdModal(false);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error changing password');
    }
  };

  // ── Delete user
  const handleDelete = async (u) => {
    if (!confirm(`"${u.username}" (${u.name}) ला delete करायचे का? हे पूर्ववत होणार नाही.`)) return;
    try {
      await axios.delete(`${API}/users/${u.id}`);
      toast.success('User deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Cannot delete this user');
    }
  };

  // ── Add new user
  const openAdd = () => { setForm(EMPTY_FORM); setAddModal(true); };
  const handleAdd = async () => {
    if (!form.username || !form.password) { toast.error('Username आणि Password आवश्यक आहे'); return; }
    try {
      await axios.post(`${API}/users`, form);
      toast.success('User created ✅');
      setAddModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error creating user');
    }
  };

  // ── Bulk reset all
  const handleBulkReset = async () => {
    if (!confirm(`सर्व ${userCount} users चे passwords reset करायचे का?\n(प्रत्येकाचा password: username@123)`)) return;
    try {
      const res = await axios.post(`${API}/users/bulk/reset-all`);
      toast.success(res.data.message);
    } catch (e) {
      toast.error('Bulk reset failed');
    }
  };

  const unassignedFlats = flats.filter(f => !users.find(u => u.flat_id === f.id && (!selectedUser || u.id !== selectedUser.id)));

  return (
    <div className="space-y-5">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center border-l-4 border-blue-500">
          <p className="text-3xl font-bold text-blue-700">{users.length}</p>
          <p className="text-sm text-gray-500 mt-1">👥 एकूण Users</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-red-500">
          <p className="text-3xl font-bold text-red-700">{adminCount}</p>
          <p className="text-sm text-gray-500 mt-1">🔐 Admins</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-green-500">
          <p className="text-3xl font-bold text-green-700">{userCount}</p>
          <p className="text-sm text-gray-500 mt-1">🏠 Residents</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap flex-1">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 नाव / username / flat शोधा..."
              className="input flex-1 min-w-[200px] text-sm"
            />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input w-32 text-sm">
              <option value="">सर्व roles</option>
              <option value="admin">🔐 Admin</option>
              <option value="user">🏠 User</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleBulkReset} className="btn-secondary text-sm">
              🔄 सर्व Reset
            </button>
            <button onClick={openAdd} className="btn-primary text-sm">
              ➕ नवीन User
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header w-8">#</th>
                  <th className="table-header">नाव / Name</th>
                  <th className="table-header">Username</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Flat</th>
                  <th className="table-header">Mobile</th>
                  <th className="table-header">Default Password</th>
                  <th className="table-header text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">कोणताही user सापडला नाही</td></tr>
                ) : filtered.map((u, idx) => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${u.role === 'admin' ? 'bg-red-50/30' : ''}`}>
                    <td className="table-cell text-gray-400 text-xs">{idx + 1}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'}`}>
                          {(u.name || u.username)[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-xs text-blue-700 font-mono">{u.username}</code>
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {u.role === 'admin' ? '🔐 Admin' : '🏠 User'}
                      </span>
                    </td>
                    <td className="table-cell">
                      {u.flat_no
                        ? <span className="text-blue-700 font-semibold">{u.flat_no}</span>
                        : <span className="text-gray-400 text-xs">—</span>
                      }
                    </td>
                    <td className="table-cell text-gray-500 text-xs">{u.mobile || '—'}</td>
                    <td className="table-cell">
                      <code className="text-xs text-gray-500">{u.username}@123</code>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => openEdit(u)} title="Edit user" className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs transition">✏️</button>
                        <button onClick={() => openPwd(u)} title="Set custom password" className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 text-xs transition">🔑</button>
                        <button onClick={() => handleReset(u)} title="Reset to default password" className="p-1.5 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-600 text-xs transition">🔄</button>
                        {u.role !== 'admin' && (
                          <button onClick={() => handleDelete(u)} title="Delete user" className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs transition">🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card p-4 bg-blue-50 border border-blue-200">
        <p className="text-xs font-semibold text-blue-700 mb-2">📖 Action Guide:</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
          <span>✏️ Edit — username, name, role, flat बदला</span>
          <span>🔑 Set Password — custom password सेट करा</span>
          <span>🔄 Reset — default password (username@123) वर reset करा</span>
          <span>🗑️ Delete — user account काढा (admin काढता येत नाही)</span>
        </div>
      </div>

      {/* ── EDIT MODAL */}
      {editModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">✏️ User Edit करा</h3>
              <button onClick={() => setEditModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">नाव / Full Name</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="पूर्ण नाव" />
              </div>
              <div>
                <label className="label">Username (Login ID)</label>
                <input className="input font-mono" value={form.username} onChange={e => setForm({...form, username: e.target.value.toLowerCase()})} placeholder="username" />
                <p className="text-xs text-gray-400 mt-1">Default password: {form.username}@123</p>
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="user">🏠 User (Resident)</option>
                  <option value="admin">🔐 Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Flat Assign करा</label>
                <select className="input" value={form.flat_id} onChange={e => setForm({...form, flat_id: e.target.value})}>
                  <option value="">— Flat नाही —</option>
                  {flats.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.flat_no} — {f.owner_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setEditModal(false)} className="btn-secondary flex-1">रद्द करा</button>
              <button onClick={handleSaveEdit} className="btn-primary flex-1">💾 Save करा</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SET PASSWORD MODAL */}
      {pwdModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">🔑 Password बदला</h3>
              <button onClick={() => setPwdModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                User: <strong>{selectedUser.name}</strong> (<code className="font-mono">{selectedUser.username}</code>)
              </div>
              <div>
                <label className="label">नवीन Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd ? 'text' : 'password'}
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    placeholder="नवीन password टाका (कमीत कमी 4)"
                  />
                  <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded-lg">
                💡 Default password reset साठी: 🔄 Reset button वापरा<br/>
                Default = <code className="font-mono text-blue-600">{selectedUser.username}@123</code>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setPwdModal(false)} className="btn-secondary flex-1">रद्द करा</button>
              <button onClick={handleSetPwd} className="btn-primary flex-1">🔑 Set Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD NEW USER MODAL */}
      {addModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">➕ नवीन User तयार करा</h3>
              <button onClick={() => setAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">नाव / Full Name</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="पूर्ण नाव" />
              </div>
              <div>
                <label className="label">Username (Login ID) *</label>
                <input className="input font-mono" value={form.username} onChange={e => setForm({...form, username: e.target.value.toLowerCase().replace(/\s/g, '')})} placeholder="e.g. flat101, john_doe" />
              </div>
              <div>
                <label className="label">Password *</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="कमीत कमी 4 characters"
                  />
                  <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                <button onClick={() => setForm({...form, password: (form.username || 'user') + '@123'})} className="text-xs text-blue-600 mt-1 hover:underline">
                  Default वापरा: {form.username || 'username'}@123
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="user">🏠 User</option>
                    <option value="admin">🔐 Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Flat (Optional)</label>
                  <select className="input" value={form.flat_id} onChange={e => setForm({...form, flat_id: e.target.value})}>
                    <option value="">— Flat नाही —</option>
                    {flats.map(f => (
                      <option key={f.id} value={f.id}>{f.flat_no}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setAddModal(false)} className="btn-secondary flex-1">रद्द करा</button>
              <button onClick={handleAdd} className="btn-primary flex-1">➕ User तयार करा</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
