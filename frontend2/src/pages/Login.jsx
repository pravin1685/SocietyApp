import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('admin');

  const toggleLang = () => {
    const next = i18n.language === 'mr' ? 'en' : 'mr';
    i18n.changeLanguage(next);
    localStorage.setItem('lang', next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(username.trim(), password);
      toast.success(`${t('welcome')}, ${u.name || u.username}!`);
      navigate('/dashboard');
    } catch {
      toast.error(t('invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    if (role === 'admin') { setUsername('admin'); setPassword('admin@123'); }
    else { setUsername('flat01'); setPassword('flat01@123'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl">🏢</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{t('app_name')}</h1>
          <p className="text-blue-200 mt-1">{t('society_management')}</p>
          <button onClick={toggleLang} className="mt-3 text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full transition">
            {i18n.language === 'mr' ? '🇮🇳 English' : '🇮🇳 मराठी'}
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex">
            <button onClick={() => { setTab('admin'); setUsername(''); setPassword(''); }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              🔐 {t('login_as_admin')}
            </button>
            <button onClick={() => { setTab('user'); setUsername(''); setPassword(''); }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === 'user' ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              🏠 {t('login_as_user')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="label">{t('username')}</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)}
                placeholder={tab === 'admin' ? 'admin' : 'flat01'} required />
            </div>
            <div>
              <label className="label">{t('password')}</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>

            <button type="submit" disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition ${tab === 'admin' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-60`}>
              {loading ? t('loading') : t('login')}
            </button>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-400 text-center mb-2">Demo credentials:</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => fillDemo('admin')}
                  className="flex-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 py-2 rounded-lg transition">
                  Admin Demo
                </button>
                <button type="button" onClick={() => fillDemo('user')}
                  className="flex-1 text-xs bg-green-50 text-green-600 hover:bg-green-100 py-2 rounded-lg transition">
                  User Demo (FLAT-01)
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
