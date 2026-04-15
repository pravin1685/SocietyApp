import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

// Generates a UPI QR code for the given amount and settings
export default function PaymentQRModal({ isOpen, onClose, flatNo, pendingAmount, pendingMonths, settings }) {
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [upiLink, setUpiLink] = useState('');

  const upiId       = settings?.upi_id || '';
  const societyName = settings?.society_name || 'Central Park Society';
  const txnNote     = `Maintenance ${flatNo} - ${pendingMonths} months`;

  useEffect(() => {
    if (!isOpen || !upiId) return;
    const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(societyName)}&am=${pendingAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(txnNote)}`;
    setUpiLink(link);
    QRCode.toDataURL(link, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a8a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(url => setQrDataUrl(url));
  }, [isOpen, upiId, pendingAmount, flatNo]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `Payment_QR_${flatNo}_₹${pendingAmount}.png`;
    a.click();
  };

  const openUPIApp = (app) => {
    const urls = {
      phonePe: upiLink.replace('upi://', 'phonepe://'),
      gPay:    upiLink.replace('upi://', 'tez://upi/'),
      paytm:   upiLink.replace('upi://', 'paytmmp://'),
      bhim:    upiLink,
    };
    window.location.href = urls[app] || upiLink;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 p-5 text-white text-center">
          <div className="text-2xl mb-1">💳 देखभाल शुल्क भरा</div>
          <div className="text-sm opacity-80">{societyName}</div>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount info */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <p className="text-xs text-orange-600 font-medium">{flatNo} — {pendingMonths} महिने बाकी</p>
            <p className="text-3xl font-bold text-orange-700">₹{pendingAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500 mt-1">UPI ID: <strong>{upiId || 'Not configured'}</strong></p>
          </div>

          {!upiId && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 text-center">
              ⚠️ Admin ने UPI ID सेट केलेला नाही. Settings → Society Settings मध्ये UPI ID add करा.
            </div>
          )}

          {/* QR Code */}
          {qrDataUrl && upiId && (
            <div className="flex flex-col items-center gap-3">
              <div className="border-4 border-blue-800 rounded-2xl p-2 bg-white shadow-md">
                <img src={qrDataUrl} alt="UPI QR Code" className="w-52 h-52" />
              </div>
              <p className="text-xs text-gray-500 text-center">
                📷 हा QR कोड कोणत्याही UPI App ने scan करा
              </p>
            </div>
          )}

          {/* Mobile UPI app buttons */}
          {upiId && (
            <div>
              <p className="text-xs text-gray-500 text-center mb-2 font-medium">📱 Mobile वर थेट App उघडा:</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openUPIApp('phonePe')}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition">
                  <span className="text-lg">📱</span> PhonePe
                </button>
                <button onClick={() => openUPIApp('gPay')}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                  <span className="text-lg">💰</span> Google Pay
                </button>
                <button onClick={() => openUPIApp('paytm')}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition">
                  <span className="text-lg">💳</span> Paytm
                </button>
                <button onClick={() => openUPIApp('bhim')}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition">
                  <span className="text-lg">🏦</span> BHIM/Any UPI
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            {qrDataUrl && upiId && (
              <button onClick={handleDownload}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1">
                ⬇️ QR Download
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition">
              बंद करा
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Payment केल्यावर Admin ला कळवा — ते receipt confirm करतील
          </p>
        </div>
      </div>
    </div>
  );
}
