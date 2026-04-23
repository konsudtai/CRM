'use client';

import { useState } from 'react';
import { Button } from '@thai-smb-crm/ui-components';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      if (res.mfaRequired) {
        localStorage.setItem('mfa_session', res.accessToken);
        window.location.href = '/mfa';
      } else {
        localStorage.setItem('access_token', res.accessToken);
        localStorage.setItem('refresh_token', res.refreshToken);
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-[0px_3px_5px_0px_rgba(0,0,0,0.22),0px_5px_30px_0px_rgba(0,0,0,0.22)]">
        <h1 className="font-sf-pro-display text-2xl font-semibold tracking-[-0.003em] text-[#1d1d1f]">
          เข้าสู่ระบบ
        </h1>
        <p className="mt-1 font-sf-pro-text text-sm text-gray-500">
          Thai SMB CRM Platform
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block font-sf-pro-text text-xs font-medium text-gray-700">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 font-sf-pro-text text-sm text-[#1d1d1f] placeholder:text-gray-400 focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-sf-pro-text text-xs font-medium text-gray-700">
              รหัสผ่าน
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 font-sf-pro-text text-sm text-[#1d1d1f] placeholder:text-gray-400 focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            />
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 font-sf-pro-text text-xs text-gray-400">หรือ</span>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <a
              href="/sso"
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 font-sf-pro-text text-sm font-medium text-[#1d1d1f] hover:bg-gray-50"
            >
              เข้าสู่ระบบด้วย SSO
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
