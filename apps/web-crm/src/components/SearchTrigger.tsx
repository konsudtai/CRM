'use client';

import { useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';

export function SearchTrigger() {
  const t = useTranslations('common');
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

  return (
    <button
      type="button"
      onClick={() => setCommandPaletteOpen(true)}
      className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1 font-sf-pro-text text-xs text-white/60 transition-colors hover:bg-white/15 hover:text-white/80"
      aria-label={t('search')}
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <span>{t('search')}</span>
      <kbd className="rounded border border-white/20 bg-white/10 px-1 py-0.5 text-[10px] leading-none">
        ⌘K
      </kbd>
    </button>
  );
}
