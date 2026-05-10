import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem, AnimatedCard } from '@/components/motion';
import { motion } from 'framer-motion';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const STATUS_COLORS: Record<string, string> = {
  New: 'bg-slate-100 border-slate-300',
  Contacted: 'bg-blue-50 border-blue-200',
  Qualified: 'bg-teal-50 border-teal-200',
  Proposal: 'bg-amber-50 border-amber-200',
  Negotiation: 'bg-red-50 border-red-200',
  Won: 'bg-green-50 border-green-200',
  Lost: 'bg-slate-50 border-slate-200',
};

export function LeadsPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const { data, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api('/leads?limit=200'),
    placeholderData: [],
  });

  const leads = Array.isArray(data) ? data : data?.data || [];

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l: any) => l.status === s);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <PageTransition>
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ลีด</h1>
              <p className="text-sm text-slate-500 mt-1">จัดการลีดและติดตามสถานะ</p>
            </div>
            <div className="flex gap-3">
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${view === 'kanban' ? 'bg-white text-sf-blue shadow-sm' : 'text-slate-500'}`}>Kanban</button>
                <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${view === 'list' ? 'bg-white text-sf-blue shadow-sm' : 'text-slate-500'}`}>รายการ</button>
              </div>
              <button className="px-4 py-2 rounded-xl bg-sf-blue text-white text-sm font-semibold hover:bg-sf-blue-d transition shadow-md shadow-sf-blue/20">
                + สร้างลีด
              </button>
            </div>
          </div>
        </FadeIn>

        {isLoading ? (
          <p className="text-center text-slate-400 py-16">กำลังโหลด...</p>
        ) : view === 'kanban' ? (
          /* Kanban Board */
          <StaggerContainer className="grid grid-flow-col auto-cols-[260px] gap-4 overflow-x-auto pb-4">
            {STATUSES.map((status) => (
              <StaggerItem key={status}>
                <div className={`rounded-xl p-3 border ${STATUS_COLORS[status]} min-h-[400px]`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-700">{status}</span>
                    <span className="text-xs font-semibold bg-white/80 text-slate-500 px-2 py-0.5 rounded-full">
                      {grouped[status]?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(grouped[status] || []).map((lead: any) => (
                      <motion.div
                        key={lead.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        className="bg-white rounded-xl p-3 border border-slate-200/60 cursor-pointer transition-shadow"
                      >
                        <p className="text-sm font-semibold text-slate-800 mb-1">{lead.name}</p>
                        {lead.company_name && (
                          <p className="text-xs text-slate-500">{lead.company_name}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-slate-400">{lead.source || '-'}</span>
                          {lead.metadata?.estimatedValue && (
                            <span className="text-xs font-bold text-sf-blue">
                              ฿{(lead.metadata.estimatedValue / 1000).toFixed(0)}K
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {(grouped[status] || []).length === 0 && (
                      <p className="text-center text-slate-300 text-xs py-8">ว่าง</p>
                    )}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          /* List View */
          <AnimatedCard className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">ชื่อ</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">บริษัท</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">สถานะ</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">แหล่งที่มา</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">มูลค่า</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l: any) => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-sf-blue">{l.name}</td>
                      <td className="px-5 py-3 text-slate-600">{l.company_name || '-'}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-sf-blue/10 text-sf-blue">{l.status}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{l.source || '-'}</td>
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        {l.metadata?.estimatedValue ? `฿${(l.metadata.estimatedValue / 1000).toFixed(0)}K` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimatedCard>
        )}
      </div>
    </PageTransition>
  );
}
