import { useEffect, useState } from 'react';
import axios from 'axios';

const PRIORITY_STYLE = {
  urgent: { bg: 'bg-red-50 border-red-300',  icon: '🚨', text: 'text-red-800',  badge: 'bg-red-600 text-white' },
  normal: { bg: 'bg-blue-50 border-blue-200', icon: '📢', text: 'text-blue-800', badge: 'bg-blue-600 text-white' },
  info:   { bg: 'bg-green-50 border-green-200', icon: 'ℹ️', text: 'text-green-800', badge: 'bg-green-600 text-white' },
};

export default function NoticesBanner() {
  const [notices, setNotices] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_notices') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    axios.get('/api/notices')
      .then(r => setNotices(r.data))
      .catch(() => {});
  }, []);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('dismissed_notices', JSON.stringify(next));
  };

  const visible = notices.filter(n => !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map(n => {
        const s = PRIORITY_STYLE[n.priority] || PRIORITY_STYLE.normal;
        return (
          <div key={n.id} className={`flex gap-3 items-start p-3 rounded-xl border ${s.bg}`}>
            <span className="text-xl mt-0.5 flex-shrink-0">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                  {n.priority === 'urgent' ? 'तातडीचे' : n.priority === 'info' ? 'माहिती' : 'सूचना'}
                </span>
                <span className={`text-sm font-semibold ${s.text}`}>{n.title}</span>
              </div>
              <p className={`text-xs ${s.text} opacity-80`}>{n.body}</p>
            </div>
            <button onClick={() => dismiss(n.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-lg leading-none">✕</button>
          </div>
        );
      })}
    </div>
  );
}
