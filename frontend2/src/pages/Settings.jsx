import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const YEARS = [2023, 2024, 2025, 2026];

export default function Settings() {
  const [settings, setSettings]     = useState({});
  const [rates, setRates]           = useState([]);
  const [saving, setSaving]         = useState(false);
  const [activeTab, setActiveTab]   = useState('society');
  const fileRef = useRef(null);

  const load = () => {
    Promise.all([
      axios.get('/api/settings'),
      axios.get('/api/maintenance/rates'),
    ]).then(([s, r]) => {
      setSettings(s.data);
      setRates(r.data);
    }).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  // ── Society Settings ────────────────────────────────────────────────────────
  const saveSocietySettings = async () => {
    setSaving(true);
    try {
      await axios.put('/api/settings', {
        society_name:    settings.society_name    || 'Central Park Society',
        society_address: settings.society_address || '',
        upi_id:          settings.upi_id          || '',
        upi_name:        settings.upi_name        || '',
        contact_email:   settings.contact_email   || '',
        contact_phone:   settings.contact_phone   || '',
      });
      toast.success('Settings saved! ✅');
    } catch { toast.error('Error saving settings'); }
    finally { setSaving(false); }
  };

  // ── Maintenance Rate ────────────────────────────────────────────────────────
  const saveRate = async (year, without_noc, with_noc, empty_flat = 0, shop_rate = 150) => {
    try {
      await axios.put(`/api/maintenance/rates/${year}`, { without_noc, with_noc, empty_flat, shop_rate });
      toast.success(`${year} चा दर saved! ✅`);
      load();
    } catch { toast.error('Error saving rate'); }
  };

  const addRate = async () => {
    const y = Math.max(...rates.map(r => r.year), 2025) + 1;
    await saveRate(y, 250, 500);
  };

  // ── Bank QR Upload ──────────────────────────────────────────────────────────
  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error('QR image too large (max 500KB)'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await axios.put('/api/settings/bank_qr_raw', { value: ev.target.result });
        setSettings(p => ({ ...p, bank_qr_raw: ev.target.result }));
        toast.success('Bank QR uploaded! ✅');
      } catch { toast.error('Error uploading QR'); }
    };
    reader.readAsDataURL(file);
  };

  // ── Backup / Restore ───────────────────────────────────────────────────────
  const importRef = useRef(null);
  const [restoring, setRestoring] = useState(false);

  const handleExport = async () => {
    try {
      const res = await axios.get('/api/backup/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = `society-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded! 💾');
    } catch { toast.error('Export failed'); }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        setRestoring(true);
        const data = JSON.parse(ev.target.result);
        const res  = await axios.post('/api/backup/restore', data);
        toast.success(`✅ Restore done! Flats: ${res.data.stats.flats}, Users: ${res.data.stats.users}, Payments: ${res.data.stats.payments}`);
        load();
      } catch (err) {
        toast.error('Restore failed: ' + (err.response?.data?.error || err.message));
      } finally {
        setRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'society',  icon: '🏢', label: 'Society Info'     },
    { id: 'upi',      icon: '💳', label: 'UPI / Payment'    },
    { id: 'rates',    icon: '💰', label: 'Maintenance Rates' },
    { id: 'backup',   icon: '💾', label: 'Backup / Restore'  },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-gray-800">⚙️ Settings — सेटिंग्ज</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Society Info Tab ── */}
      {activeTab === 'society' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">🏢 Society Information</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="label">Society Name / सोसायटीचे नाव</label>
              <input className="input" value={settings.society_name || ''} placeholder="Central Park Housing Society"
                onChange={e => setSettings(p => ({ ...p, society_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Address / पत्ता</label>
              <textarea className="input" rows={2} value={settings.society_address || ''} placeholder="Society address..."
                onChange={e => setSettings(p => ({ ...p, society_address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contact Email</label>
                <input className="input" type="email" value={settings.contact_email || ''} placeholder="society@email.com"
                  onChange={e => setSettings(p => ({ ...p, contact_email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Contact Phone</label>
                <input className="input" value={settings.contact_phone || ''} placeholder="9XXXXXXXXX"
                  onChange={e => setSettings(p => ({ ...p, contact_phone: e.target.value }))} />
              </div>
            </div>
          </div>
          <button onClick={saveSocietySettings} disabled={saving} className="btn-primary">
            {saving ? '⏳ Saving...' : '💾 Save Settings'}
          </button>
        </div>
      )}

      {/* ── UPI / Payment Tab ── */}
      {activeTab === 'upi' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">💳 UPI Payment Setup</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              📌 UPI ID सेट केल्यावर Residents ला "Pay Now" button मध्ये QR Code दिसेल. त्यांच्या pending amount सकट QR generate होईल.
            </div>
            <div>
              <label className="label">UPI ID (VPA) — जसे: <code className="bg-gray-100 px-1 rounded">centralpark@sbi</code></label>
              <input className="input font-mono" value={settings.upi_id || ''} placeholder="yourname@bankname"
                onChange={e => setSettings(p => ({ ...p, upi_id: e.target.value }))} />
            </div>
            <div>
              <label className="label">Payee Name (UPI मध्ये दिसेल)</label>
              <input className="input" value={settings.upi_name || ''} placeholder="Central Park Society"
                onChange={e => setSettings(p => ({ ...p, upi_name: e.target.value }))} />
            </div>
            <button onClick={saveSocietySettings} disabled={saving} className="btn-primary">
              {saving ? '⏳ Saving...' : '💾 Save UPI Settings'}
            </button>
          </div>

          {/* Bank QR Upload */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-700">🏦 Bank QR Image Upload (Optional)</h3>
            <p className="text-sm text-gray-500">
              जर आपल्याकडे Bank-generated QR code image असेल तर upload करा. हे UPI ID QR चे backup म्हणून वापरता येईल.
            </p>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="btn-secondary w-full flex items-center justify-center gap-2">
                  📤 Bank QR Image Upload करा (max 500KB)
                </button>
              </div>
              {settings.bank_qr_raw && (
                <div className="border-2 border-green-400 rounded-xl p-1 w-28 h-28 flex-shrink-0">
                  <img src={settings.bank_qr_raw} alt="Bank QR" className="w-full h-full object-contain rounded-lg" />
                </div>
              )}
            </div>
          </div>

          {/* QR Preview */}
          {settings.upi_id && (
            <div className="card text-center space-y-2">
              <p className="text-sm font-medium text-gray-600">✅ UPI QR Preview (₹500 sample)</p>
              <p className="text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded-lg break-all">
                upi://pay?pa={settings.upi_id}&pn={settings.upi_name || 'Society'}&am=500.00&cu=INR
              </p>
              <p className="text-xs text-green-600">Residents ला हा link त्यांच्या actual pending amount सकट QR मध्ये दिसेल</p>
            </div>
          )}
        </div>
      )}

      {/* ── Maintenance Rates Tab ── */}
      {activeTab === 'rates' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">💰 Maintenance Rates — दर</h3>
            <button onClick={addRate} className="btn-secondary text-sm">➕ New Year Rate</button>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            📌 हे rates Maintenance collection page वर automatically वापरले जातात.
          </div>
          <div className="space-y-3">
            {rates.sort((a,b) => b.year - a.year).map(r => (
              <RateRow key={r.year} rate={r} onSave={saveRate} />
            ))}
          </div>
        </div>
      )}

      {/* ── Backup / Restore Tab ── */}
      {activeTab === 'backup' && (
        <div className="space-y-4">
          {/* Export */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">📤 Data Export — Backup</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              📌 सर्व flats, payments, ledger, settings चा backup JSON file मध्ये download होईल.
              हे file safe ठेवा — restore साठी लागेल.
            </div>
            <button onClick={handleExport}
              className="btn-primary flex items-center gap-2">
              💾 Download Backup File
            </button>
          </div>

          {/* Import */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">📥 Data Restore — Import</h3>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              ⚠️ <strong>Warning:</strong> Restore केल्यावर सध्याचा सर्व data delete होऊन backup चा data येईल.
              Users delete होणार नाहीत.
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              💡 <strong>Use case:</strong> Local PC वरून backup घ्या → Live server वर restore करा.
              Data migration साठी हे वापरा.
            </div>
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <button onClick={() => importRef.current?.click()}
              disabled={restoring}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-50">
              {restoring ? '⏳ Restoring...' : '📥 Select Backup File & Restore'}
            </button>
          </div>

          {/* Instructions */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-700">📋 Step-by-Step — Local → Live Migration</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><span className="font-bold text-blue-600">1.</span> Local app उघडा (localhost:5173) → Settings → Backup/Restore</li>
              <li className="flex gap-2"><span className="font-bold text-blue-600">2.</span> <strong>"Download Backup File"</strong> click करा → JSON file save होईल</li>
              <li className="flex gap-2"><span className="font-bold text-blue-600">3.</span> Live app उघडा (society-app-black.vercel.app) → Admin login → Settings → Backup/Restore</li>
              <li className="flex gap-2"><span className="font-bold text-blue-600">4.</span> <strong>"Select Backup File & Restore"</strong> click करा → JSON file select करा</li>
              <li className="flex gap-2"><span className="font-bold text-blue-600">5.</span> ✅ Done! सर्व data live वर येईल</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function RateRow({ rate, onSave }) {
  const [wo, setWo]   = useState(rate.without_noc);
  const [wi, setWi]   = useState(rate.with_noc);
  const [em, setEm]   = useState(rate.empty_flat ?? 0);
  const [sh, setSh]   = useState(rate.shop_rate  ?? 150);
  const [dirty, setDirty] = useState(false);

  const monthly = [
    { icon: '🏠', label: 'Owner (Without NOC)', val: wo, set: v => { setWo(v); setDirty(true); }, color: 'text-green-700' },
    { icon: '🔑', label: 'Tenant (With NOC)',   val: wi, set: v => { setWi(v); setDirty(true); }, color: 'text-yellow-700' },
    { icon: '🚪', label: 'Empty / Vacant',       val: em, set: v => { setEm(v); setDirty(true); }, color: 'text-gray-500' },
    { icon: '🏪', label: 'Shop Rate',            val: sh, set: v => { setSh(v); setDirty(true); }, color: 'text-purple-700' },
  ];

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-blue-700">{rate.year}</span>
        {dirty && (
          <button
            onClick={() => { onSave(rate.year, parseFloat(wo), parseFloat(wi), parseFloat(em), parseFloat(sh)); setDirty(false); }}
            className="btn-primary text-xs px-4 py-1.5">
            💾 Save
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {monthly.map(m => (
          <div key={m.label} className="bg-white rounded-lg border border-gray-200 p-2.5">
            <label className="text-xs text-gray-500 block mb-1">{m.icon} {m.label}</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400">₹</span>
              <input type="number" min="0" className="input text-sm py-1 px-2 font-bold"
                value={m.val}
                onChange={e => m.set(e.target.value)} />
              <span className="text-xs text-gray-400">/mo</span>
            </div>
            <p className={`text-xs font-semibold mt-1 ${m.color}`}>
              Annual: ₹{(parseFloat(m.val || 0) * 12).toLocaleString('en-IN')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
