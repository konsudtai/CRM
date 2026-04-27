'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { api } from '@/lib/api';

interface SearchResultItem {
  entity_type: string;
  entity_id: string;
  title: string;
  body?: string;
  account_id?: string;
}

interface SearchResponse {
  results: SearchResultItem[];
}

const ENTITY_ICONS: Record<string, string> = {
  accounts: '🏢',
  contacts: '👤',
  leads: '🎯',
  opportunities: '💰',
  tasks: '✅',
  notes: '📝',
};

const ENTITY_ORDER = ['accounts', 'contacts', 'leads', 'opportunities', 'tasks', 'notes'];

function getNavigationPath(item: SearchResultItem): string {
  switch (item.entity_type) {
    case 'accounts':
      return `/accounts/${item.entity_id}`;
    case 'contacts':
      return item.account_id ? `/accounts/${item.account_id}` : `/contacts`;
    case 'leads':
      return `/leads/${item.entity_id}`;
    case 'opportunities':
      return `/opportunities/${item.entity_id}`;
    case 'tasks':
      return '/tasks';
    case 'notes':
      return item.account_id ? `/accounts/${item.account_id}` : '/accounts';
    default:
      return '/';
  }
}

function groupByEntityType(results: SearchResultItem[]): Record<string, SearchResultItem[]> {
  const grouped: Record<string, SearchResultItem[]> = {};
  for (const item of results) {
    if (!grouped[item.entity_type]) {
      grouped[item.entity_type] = [];
    }
    grouped[item.entity_type].push(item);
  }
  return grouped;
}

export function CommandPalette() {
  const router = useRouter();
  const t = useTranslations('search');
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const data = await api<SearchResponse>('/search', {
        params: { q: searchQuery },
      });
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // Reset state when closing
  useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery('');
      setResults([]);
      setIsSearching(false);
    }
  }, [commandPaletteOpen]);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      setCommandPaletteOpen(false);
      router.push(getNavigationPath(item));
    },
    [router, setCommandPaletteOpen],
  );

  const grouped = groupByEntityType(results);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Dialog */}
      <div className="relative mx-auto mt-[20vh] w-full max-w-[560px] px-4">
        <Command
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#1d1d1f]/95 shadow-2xl backdrop-blur-xl backdrop-saturate-[180%]"
          shouldFilter={false}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setCommandPaletteOpen(false);
          }}
        >
          {/* Search input */}
          <div className="flex items-center border-b border-white/10 px-4">
            <svg
              className="mr-3 h-4 w-4 shrink-0 text-white/40"
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
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t('placeholder')}
              className="h-12 w-full bg-transparent font-sf-pro-text text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <kbd className="ml-2 shrink-0 rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-sf-pro-text text-[10px] text-white/50">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            {isSearching && (
              <Command.Loading>
                <div className="px-3 py-6 text-center font-sf-pro-text text-sm text-white/40">
                  {t('searching')}
                </div>
              </Command.Loading>
            )}

            {!isSearching && query.trim() && results.length === 0 && (
              <Command.Empty className="px-3 py-6 text-center font-sf-pro-text text-sm text-white/40">
                {t('noResults')}
              </Command.Empty>
            )}

            {ENTITY_ORDER.map((entityType) => {
              const items = grouped[entityType];
              if (!items || items.length === 0) return null;

              const labelKey = entityType as 'accounts' | 'contacts' | 'leads' | 'opportunities' | 'tasks' | 'notes';
              const label = t(labelKey);
              const icon = ENTITY_ICONS[entityType] || '📄';

              return (
                <Command.Group
                  key={entityType}
                  heading={
                    <span className="flex items-center gap-1.5 px-2 py-1.5 font-sf-pro-text text-xs font-medium text-white/50">
                      <span>{icon}</span>
                      {label}
                    </span>
                  }
                >
                  {items.map((item) => (
                    <Command.Item
                      key={`${item.entity_type}-${item.entity_id}`}
                      value={`${item.entity_type}-${item.entity_id}`}
                      onSelect={() => handleSelect(item)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-sf-pro-text text-sm text-white/90 transition-colors data-[selected=true]:bg-apple-blue/90 data-[selected=true]:text-white"
                    >
                      <span className="truncate">{item.title}</span>
                      {item.body && (
                        <span className="ml-auto truncate text-xs text-white/40">
                          {item.body.slice(0, 60)}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
