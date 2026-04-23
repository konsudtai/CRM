import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Thai SMB CRM',
  description: 'CRM platform for Thai SMBs',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <nav className="sticky top-0 z-50 flex h-12 items-center bg-black/80 px-6 backdrop-blur-[20px] backdrop-saturate-[180%]">
              <span className="font-sf-pro-text text-xs font-medium tracking-tight text-white">
                Thai SMB CRM
              </span>
              <div className="ml-8 flex gap-6">
                <a href="/dashboard" className="font-sf-pro-text text-xs text-white/80 hover:text-white">แดชบอร์ด</a>
                <a href="/accounts" className="font-sf-pro-text text-xs text-white/80 hover:text-white">บัญชีลูกค้า</a>
                <a href="/leads" className="font-sf-pro-text text-xs text-white/80 hover:text-white">ลีด</a>
                <a href="/opportunities" className="font-sf-pro-text text-xs text-white/80 hover:text-white">โอกาสการขาย</a>
                <a href="/quotations" className="font-sf-pro-text text-xs text-white/80 hover:text-white">ใบเสนอราคา</a>
                <a href="/settings" className="font-sf-pro-text text-xs text-white/80 hover:text-white">ตั้งค่า</a>
              </div>
            </nav>
            <main>{children}</main>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
