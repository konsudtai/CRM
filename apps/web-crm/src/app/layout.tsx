import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { QueryProvider } from '@/providers/query-provider';
import { CommandPalette } from '@/components/CommandPalette';
import { SearchTrigger } from '@/components/SearchTrigger';
import './globals.css';

export const metadata: Metadata = {
  title: 'Thai SMB CRM',
  description: 'CRM platform for Thai SMBs',
};

const NAV_LINKS = [
  { href: '/dashboard', label: 'แดชบอร์ด' },
  { href: '/accounts', label: 'ลูกค้า' },
  { href: '/contacts', label: 'ผู้ติดต่อ' },
  { href: '/leads', label: 'ลีด' },
  { href: '/opportunities', label: 'โอกาสขาย' },
  { href: '/pipeline', label: 'ไปป์ไลน์' },
  { href: '/tasks', label: 'งาน' },
  { href: '/quotations', label: 'ใบเสนอราคา' },
  { href: '/settings', label: 'ตั้งค่า' },
];

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
            {/* Apple Glass Navigation — 48px, translucent dark + blur */}
            <nav
              className="sticky top-0 z-50 flex h-12 items-center justify-between bg-black/80 px-4 backdrop-blur-[20px] backdrop-saturate-[180%] sm:px-6"
              role="navigation"
            >
              <div className="flex items-center gap-8">
                <a
                  href="/dashboard"
                  className="font-sf-pro-text text-[12px] font-semibold tracking-tight text-white"
                >
                  CRM
                </a>
                <div className="hidden items-center gap-5 md:flex">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="inline-flex min-h-[48px] items-center font-sf-pro-text text-[12px] font-normal text-white/80 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
              <SearchTrigger />
            </nav>

            <CommandPalette />
            <main>{children}</main>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
