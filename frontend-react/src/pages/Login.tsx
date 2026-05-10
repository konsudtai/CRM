import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { api } from '@/lib/api';

export function LoginPage() {
  const [email, setEmail] = useState(() => localStorage.getItem('salesfast7-email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [success, setSuccess] = useState(false);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    localStorage.setItem('salesfast7-email', email);
    setLoading(true);

    try {
      const res = await api<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(res.accessToken, {
        id: res.user?.id || '',
        email: res.user?.email || email,
        firstName: res.user?.firstName || '',
        lastName: res.user?.lastName || '',
        role: res.user?.roles?.[0] || 'Viewer',
        roles: res.user?.roles || [],
      });
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
        {/* ── Left: Brand Panel ── */}
        <div style={{ background: '#032D60', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 48, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30%', right: '-20%', width: '70%', height: '80%', background: 'radial-gradient(circle, rgba(1,118,211,.12), transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '50%', height: '60%', background: 'radial-gradient(circle, rgba(27,150,255,.08), transparent 60%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo */}
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.6px' }}>
              SalesFAST <span style={{ color: '#4BCA81' }}>7</span>
            </div>

            {/* Copy */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#1B96FF', marginBottom: 20 }}>Welcome back</div>
              <h1 style={{ fontSize: 'clamp(28px, 3vw, 44px)', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, color: '#fff', marginBottom: 20 }}>
                Sell smarter<br/>with <span style={{ color: '#1B96FF' }}>SalesFAST 7</span>
              </h1>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,.55)', lineHeight: 1.65, maxWidth: 380, marginBottom: 40 }}>
                Manage customers, track leads, and close deals faster with a CRM built for Thai businesses.
              </p>

              {/* Feature pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: '📊', text: 'Real-time Dashboard', sub: 'Track KPIs and pipeline instantly' },
                  { icon: '🎯', text: 'Lead Scoring', sub: 'Focus on high-probability leads' },
                  { icon: '📄', text: 'Thai Quotations', sub: 'Generate and send in seconds' },
                ].map((f) => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
                    <span style={{ fontSize: 18 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.8)' }}>{f.text}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{f.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 32, paddingTop: 40, borderTop: '1px solid rgba(255,255,255,.07)' }}>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>2,400+</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Thai businesses</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>35%</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>More sales</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>97%</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Satisfaction</div></div>
            </div>
          </div>
        </div>

        {/* ── Right: Form ── */}
        <div style={{ background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, position: 'relative' }}>
          <a href="/" style={{ position: 'absolute', top: 24, left: 24, fontSize: 13, color: '#9CA3AF', textDecoration: 'none', padding: '6px 10px', borderRadius: 8 }}>← Back to home</a>

          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px', color: '#111827', marginBottom: 6 }}>Log in</div>
            <div style={{ fontSize: 14, color: '#6B7280' }}>Enter the credentials provided by your administrator.</div>

            <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(194,57,52,.08)', border: '1px solid rgba(194,57,52,.15)', color: '#C23934', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@company.co.th"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontFamily: 'inherit', color: '#111827', outline: 'none' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#0176D3'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(1,118,211,.12)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{ width: '100%', padding: '11px 44px 11px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 14, fontFamily: 'inherit', color: '#111827', outline: 'none' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#0176D3'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(1,118,211,.12)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14 }}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#6B7280' }}>
                  <input type="checkbox" defaultChecked style={{ width: 16, height: 16, borderRadius: 4, accentColor: '#0176D3' }} />
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', color: '#fff', background: '#0176D3', boxShadow: '0 2px 12px rgba(1,118,211,.35)', opacity: loading ? 0.8 : 1, transition: 'all .2s' }}
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 16 }}>
                Need an account? <a href="mailto:admin@salesfast7.com" style={{ color: '#0176D3', textDecoration: 'none', fontWeight: 500 }}>Contact your administrator</a>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Success overlay */}
      {success && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(3,45,96,.6)', backdropFilter: 'blur(16px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 40, textAlign: 'center', maxWidth: 340, width: '90%' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px', background: '#0176D3', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(1,118,211,.35)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Login successful!</div>
            <div style={{ fontSize: 14, color: '#6B7280' }}>Redirecting to Dashboard...</div>
          </div>
        </div>
      )}

      {/* Responsive: hide left panel on mobile */}
      <style>{`
        @media (max-width: 768px) {
          body > div > div:first-child > div:first-child { display: none !important; }
          body > div > div:first-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
