import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'general',     label: '📁 General'              },
  { value: 'audit',       label: '📊 Audit Report'         },
  { value: 'agm',         label: '🏛️ AGM Minutes'         },
  { value: 'maintenance', label: '🔧 Maintenance'          },
  { value: 'legal',       label: '⚖️ Legal / NOC'          },
  { value: 'accounts',    label: '💰 Accounts'             },
  { value: 'circular',    label: '📢 Circular / Notice'    },
];

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

export default function DocumentVault() {
  const { isAdmin }       = useAuth();
  const [docs, setDocs]   = useState([]);
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ title: '', category: 'general' });
  const [fileInfo, setFileInfo]   = useState(null);
  const [fileB64, setFileB64]     = useState('');
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    const url = catFilter
      ? `/api/documents?category=${catFilter}`
      : '/api/documents';
    axios.get(url).then(r => setDocs(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [catFilter]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
    setFileInfo({ name: file.name, size: file.size, type: file.type });
    const reader = new FileReader();
    reader.onload = ev => setFileB64(ev.target.result.split(',')[1]); // strip data:...;base64,
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!form.title.trim()) { toast.error('Title required!'); return; }
    if (!fileB64)           { toast.error('File निवडा!');     return; }
    setUploading(true);
    try {
      await axios.post('/api/documents', {
        title:    form.title,
        category: form.category,
        filename: fileInfo.name,
        mimetype: fileInfo.type || 'application/pdf',
        filedata: fileB64,
      });
      toast.success('Document uploaded! ✅');
      setModal(false); setForm({ title: '', category: 'general' });
      setFileInfo(null); setFileB64(''); load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed');
    }
    finally { setUploading(false); }
  };

  const handleDownload = (doc) => {
    window.open(`/api/documents/${doc.id}/download`, '_blank');
  };

  const handleDelete = async (id) => {
    if (!confirm('हे document delete करायचे?')) return;
    await axios.delete(`/api/documents/${id}`);
    toast.success('Deleted!'); load();
  };

  const catLabel = (val) => CATEGORIES.find(c => c.value === val)?.label || val;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📁 Document Vault</h2>
          <p className="text-sm text-gray-500">Society documents — Audit, AGM, Circulars, Legal papers</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setModal(true); setFileInfo(null); setFileB64(''); setForm({title:'',category:'general'}); }}
            className="btn-primary flex items-center gap-2">
            📤 Upload Document
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setCatFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${!catFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          📂 सर्व
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCatFilter(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${catFilter===c.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Document grid */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-lg font-medium">कोणतेही documents नाहीत</p>
          {isAdmin && <p className="text-sm mt-1">"Upload Document" वर click करा</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.map(doc => {
            const isPdf = doc.mimetype === 'application/pdf' || doc.filename?.endsWith('.pdf');
            const isImg = doc.mimetype?.startsWith('image/');
            const icon  = isPdf ? '📄' : isImg ? '🖼️' : '📎';
            return (
              <div key={doc.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-2">{doc.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{catLabel(doc.category)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtSize(doc.filesize)} · {new Date(doc.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => handleDownload(doc)}
                    className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2 rounded-lg transition flex items-center justify-center gap-1">
                    ⬇️ Download
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(doc.id)}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg transition">
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {modal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-lg">📤 Upload Document</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Document Title *</label>
                <input className="input" value={form.title} placeholder="e.g. AGM Minutes 2024"
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">File (PDF, Image — max 5MB) *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  {fileInfo ? (
                    <div>
                      <div className="text-2xl mb-1">✅</div>
                      <p className="text-sm font-medium text-gray-700">{fileInfo.name}</p>
                      <p className="text-xs text-gray-400">{fmtSize(fileInfo.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl mb-1">📁</div>
                      <p className="text-sm text-gray-500">Click to select file</p>
                      <p className="text-xs text-gray-400">PDF, Images supported</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileSelect} className="hidden" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleUpload} disabled={uploading} className="btn-primary flex-1">
                {uploading ? '⏳ Uploading...' : '📤 Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
