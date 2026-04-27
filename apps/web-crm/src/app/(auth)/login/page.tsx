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
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-[380px] rounded-[12px] bg-white p-8 shadow-[3px_5px_30px_0px_rgba(0,0,0,0.22)]">
        {/* Header */}
        <h1 className="font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
          เข้าสู่ระบบ
        </h1>
        <p className="mt-1 font-sf-pro-text text-[14px] leading-[1.29] tracking-[-0.224px] text-[rgba(0,0,0,0.48)]">
          Thai SMB CRM Platform
        </p>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-[8px] bg-red-50 px-4 py-3 font-sf-pro-text text-[14px] tracking-[-0.224px] text-red-600">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.8)]"
            >
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              className="apple-input mt-1.5"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.8)]"
            >
              รหัสผ่าน
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="apple-input mt-1.5"
            />
          </div>
          <Button type="submit" variant="primary" className="!w-full" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </form>

        {/* Divider */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">
                หรือ
              </span>
            </div>
          </div>
          <div className="mt-4">
            <a
              href="/sso"
              className="flex min-h-[44px] w-full items-center justify-center rounded-[8px] border border-black/[0.06] bg-[#fafafc] px-4 py-2 font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f] transition-colors hover:bg-black/[0.04]"
            >
              เข้าสู่ระบบด้วย SSO
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
