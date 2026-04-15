import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  verified: 'bg-green-100  text-green-700  border-green-300',
  rejected: 'bg-red-100    text-red-700    border-red-300',
};
const STATUS_MR = { pending: '⏳ Pending', verified: '✅ Verified', rejected: '❌ Rejected' };

export default function PaymentVerification() {
  const [verifications, setVerifications] = useState([]);
  const [stats, setStats]       = useState({});
  const [filter, setFilter]     = useState('pending');
  const [loading, setLoading]   = useState(true);
  const [rejectModal, setRejectModal] = useState(null); // { id }
  const [rejectNote, setRejectNote]   = useState('');
  const [imgModal, setImgModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [v, s] = await Promise.all([
        axios.get(`/api/verifications?status=${filter}`),
        axios.get('/api/verifications/stats'),
      ]);
      setVerifications(v.data);
      setStats(s.data);
    } catch { toast.error('Load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleVerify = async (id) => {
    try {
      await axios.put(`/api/verifications/${id}/verify`);
      toast.success('✅ Payment verified & marked as Paid!');
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
  };

  const handleReject = async () => {
    try {
      await axios.put(`/api/verifications/${rejectModal}/reject`, { note: rejectNote });
      toast.success('Payment rejected');
      setRejectModal(null); setRejectNote('');
      load();
    } catch { toast.error('Error'); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">✅ Payment Verification</h2>
        <p className="text-sm text-gray-500">Residents नी submit केलेले UPI payments verify करा</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '⏳ Pending',  val: stats.pending  || 0, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: '✅ Verified', val: stats.verified || 0, color: 'bg-green-50  border-green-200  text-green-700'  },
          { label: '❌ Rejected', val: stats.rejected || 0, color: 'bg-red-50    border-red-200    text-red-700'    },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.val}</p>
            <p className="text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['pending','verified','rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize ${filter === f ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>
            {STATUS_MR[f]}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <div className="text-5xl mb-2">{filter === 'pending' ? '🎉' : '📭'}</div>
          <p>{filter === 'pending' ? 'कोणताही pending verification नाही!' : 'कोणतेही records नाहीत.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifications.map(v => (
            <div key={v.id} className={`card py-4 px-5 border-l-4 ${
              v.status === 'pending' ? 'border-yellow-400' :
              v.status === 'verified' ? 'border-green-400' : 'border-red-400'
            }`}>
              <div className="flex flex-wrap items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-blue-700 text-base">{v.flat_no}</span>
                    <span className="text-gray-700 text-sm">{v.owner_name}</span>
                    {v.mobile && <span className="text-xs text-gray-400">📞 {v.mobile}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[v.status]}`}>
                      {STATUS_MR[v.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-semibold">
                      {MONTHS[v.month]} {v.year}
                    </span>
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg font-bold">
                      ₹{(v.amount || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-gray-500">{v.payment_mode}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">UTR:</span>
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono font-bold text-gray-800 select-all">
                      {v.utr_number}
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(v.utr_number); toast.success('UTR copied!'); }}
                      className="text-xs text-blue-500 hover:text-blue-700">📋</button>
                  </div>

                  <div className="text-xs text-gray-400">
                    Submitted: {new Date(v.created_at).toLocaleString('en-IN')}
                    {v.verified_at && ` · ${v.status === 'verified' ? 'Verified' : 'Rejected'}: ${new Date(v.verified_at).toLocaleString('en-IN')} by ${v.verified_by}`}
                    {v.note && <span className="ml-2 text-orange-600">Note: {v.note}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {v.screenshot && (
                    <button onClick={() => setImgModal(v.screenshot)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
                      🖼️ Screenshot
                    </button>
                  )}
                  {v.status === 'pending' && (
                    <>
                      <button onClick={() => handleVerify(v.id)}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition">
                        ✅ Verify करा
                      </button>
                      <button onClick={() => { setRejectModal(v.id); setRejectNote(''); }}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium transition">
                        ❌ Reject करा
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg text-red-700">❌ Payment Reject करा</h3>
            <div>
              <label className="label">Reason / कारण (optional)</label>
              <textarea className="input" rows={3} placeholder="उदा: UTR सापडला नाही, चुकीची रक्कम..."
                value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleReject} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition">
                Reject करा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {imgModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setImgModal(null)}>
          <div className="max-w-lg w-full">
            <img src={imgModal} alt="Payment screenshot" className="w-full rounded-2xl shadow-2xl" />
            <p className="text-center text-white/70 text-sm mt-2">Tap anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
