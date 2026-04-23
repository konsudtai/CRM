'use client';

import { Button } from '@thai-smb-crm/ui-components';
import { authApi } from '@/lib/api';

export default function SsoPage() {
  function handleSso(provider: 'google' | 'microsoft') {
    window.location.href = authApi.ssoRedirect(provider);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-[0px_3px_5px_0px_rgba(0,0,0,0.22),0px_5px_30px_0px_rgba(0,0,0,0.22)]">
        <h1 className="font-sf-pro-display text-2xl font-semibold tracking-[-0.003em] text-[#1d1d1f]">
          เข้าสู่ระบบด้วย SSO
        </h1>
        <p className="mt-1 font-sf-pro-text text-sm text-gray-500">
          เลือกผู้ให้บริการเพื่อเข้าสู่ระบบ
        </p>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => handleSso('google')}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-gray-300 px-4 py-3 font-sf-pro-text text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google Workspace
          </button>

          <button
            onClick={() => handleSso('microsoft')}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-gray-300 px-4 py-3 font-sf-pro-text text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022" />
              <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00" />
              <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF" />
              <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900" />
            </svg>
            Microsoft Entra ID
          </button>
        </div>

        <a
          href="/login"
          className="mt-6 block text-center font-sf-pro-text text-sm text-[#0066cc] hover:underline"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </a>
      </div>
    </div>
  );
}
