'use client';

import { useState, useRef } from 'react';
import { Button } from '@thai-smb-crm/ui-components';
import { authApi } from '@/lib/api';

export default function MfaPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigit(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('กรุณากรอกรหัส 6 หลัก');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('mfa_session') || '';
      const res = await authApi.verifyMfa(fullCode, sessionToken);
      localStorage.removeItem('mfa_session');
      localStorage.setItem('access_token', res.accessToken);
      localStorage.setItem('refresh_token', res.refreshToken);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'รหัสไม่ถูกต้อง');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-[0px_3px_5px_0px_rgba(0,0,0,0.22),0px_5px_30px_0px_rgba(0,0,0,0.22)]">
        <h1 className="font-sf-pro-display text-2xl font-semibold tracking-[-0.003em] text-[#1d1d1f]">
          ยืนยันตัวตน
        </h1>
        <p className="mt-1 font-sf-pro-text text-sm text-gray-500">
          กรอกรหัส 6 หลักจากแอปยืนยันตัวตนหรือ SMS
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex justify-center gap-3" role="group" aria-label="รหัสยืนยัน 6 หลัก">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                aria-label={`หลักที่ ${i + 1}`}
                className="h-12 w-10 rounded-lg border border-gray-300 text-center font-sf-pro-display text-xl font-semibold text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
              />
            ))}
          </div>
          <Button type="submit" variant="primary" className="mt-6 w-full" disabled={loading}>
            {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
          </Button>
        </form>

        <a
          href="/login"
          className="mt-4 block text-center font-sf-pro-text text-sm text-[#0066cc] hover:underline"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </a>
      </div>
    </div>
  );
}
