import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';
import { motion } from 'framer-motion';

function fmt(n: number) {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;

const stageColors: Record<string, string> = {
  New: '#64748B',
  Contacted: '#0176D3',
  Qualified: '#0B827C',
  Proposal: '#D97706',
  Negotiation: '#DC2626',
  Won: '#2E844A',
  Lost: '#9CA3AF',
};

export function LeadsPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const { data } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api('/leads?limit=200'),
  });

  const allLeads = (Array.isArray(data) ? data : data?.data || []).map((l: any) => {
    const m = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata || {};
    return { ...l, value: m.estimatedValue || 0, project: m.projectName || '', priority: m.priority || 'Medium', source: l.source || '' };
  });

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = allLeads.filter((l: any) => l.status === stage);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--text)]">Pipeline</h1>
              <p className="text-[12px] text-[var(--text3)] mt-0.5">Manage leads and deals through every stage</p>
            </div>
            {/* View Toggle */}
            <div className="flex gap-1 bg-[rgba(3,45,96,.05)] rounded-lg p-1">
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer ${view === 'kanban' ? 'bg-white shadow-sm text-[var(--text)]' : 'text-[var(--text2)]'}`}
              >
                Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer ${view === 'list' ? 'bg-white shadow-sm text-[var(--text)]' : 'text-[var(--text2)]'}`}
              >
                List
              </button>
            </div>
          </div>
        </FadeIn>

        {view === 'kanban' ? (
          <FadeIn delay={0.1}>
            <div className="flex gap-2.5 overflow-x-auto pb-4">
              {STAGES.map((stage) => {
                const leads = grouped[stage] || [];
                const color = stageColors[stage];
                const totalValue = leads.reduce((s: number, l: any) => s + l.value, 0);
                return (
                  <div key={stage} className="bg-[var(--surface2)] rounded-[10px] p-2.5 min-w-[180px] flex-1">
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
                        <span className="text-[11px] font-bold text-[var(--text)]">{stage}</span>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${color}18`, color }}
                      >
                        {leads.length}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-[var(--sf-blue)] mb-2 px-1">{fmt(totalValue)}</div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {leads.length === 0 ? (
                        <div className="text-[11px] text-[var(--text3)] text-center py-4">No leads</div>
                      ) : (
                        leads.map((l: any) => (
                          <motion.div
                            key={l.id}
                            whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}
                            className="bg-[var(--surface)] rounded-lg p-2.5 border border-[var(--border)] cursor-pointer"
                          >
                            <div className="text-[12px] font-semibold text-[var(--text)] leading-tight">{l.project || l.name}</div>
                            {l.company_name && (
                              <div className="text-[10px] text-[var(--text3)] mt-0.5">{l.company_name}</div>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-[var(--text3)]">{l.source}</span>
                              {l.value > 0 && (
                                <span className="text-[11px] font-bold text-[var(--sf-blue)]">{fmt(l.value)}</span>
                              )}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </FadeIn>
        ) : (
          <FadeIn delay={0.1}>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Name</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Company</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Stage</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Source</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLeads.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-[var(--text3)] py-8 text-[12px]">No leads found</td>
                      </tr>
                    ) : (
                      allLeads.map((l: any) => (
                        <tr key={l.id} className="hover:bg-[rgba(1,118,211,.02)]">
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-semibold text-[var(--text)]">{l.project || l.name}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{l.company_name || '-'}</td>
                          <td className="py-2.5 border-b border-[var(--border)]">
                            <span
                              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: `${stageColors[l.status]}18`, color: stageColors[l.status] }}
                            >
                              {l.status}
                            </span>
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{l.source || '-'}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-bold text-[var(--sf-blue)]">{l.value > 0 ? fmt(l.value) : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  );
}
