import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ accessToken: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(res.accessToken, res.user || { id: '', email, firstName: '', lastName: '', role: 'Viewer', roles: [] });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '16px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 380 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--sf-navy)', letterSpacing: '-0.5px' }}>
            SalesFAST <span style={{ color: '#2E844A' }}>7</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>IT Solutions & CRM Platform</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', borderRadius: 16, padding: 32, boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>เข้าสู่ระบบ</h2>

          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(194,57,52,.08)', border: '1px solid rgba(194,57,52,.2)', color: '#C23934', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface2)', outline: 'none', fontFamily: 'inherit' }}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface2)', outline: 'none', fontFamily: 'inherit' }}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 24, padding: '10px 24px', borderRadius: 10, background: 'var(--sf-blue)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(1,118,211,.25)' }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
