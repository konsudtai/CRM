'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import type { Opportunity, PipelineStage } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

export default function OpportunitiesPage() {
  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api('/pipeline/stages'),
    placeholderData: [],
  });
  const { data: opportunities, isLoading } = useQuery<Opportunity[]>({
    queryKey: ['opportunities'],
    queryFn: () => api('/opportunities'),
    placeholderData: [],
  });
  const safeStages = (stages ?? []).sort((a, b) => a.order - b.order);
  const opps = opportunities ?? [];
  const grouped = safeStages.reduce((acc, stage) => {
    acc[stage.name] = opps.filter(o => o.stage === stage.name);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading as="h1" size="headline">โอกาสการขาย</Heading>
          <Body size="small" className="mt-1 text-gray-500">ไปป์ไลน์การขายและการจัดการดีล</Body>
        </div>
        <Button variant="primary">+ สร้างโอกาส</Button>
      </div>
      {isLoading ? (
        <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
      ) : safeStages.length === 0 ? (
        <Card><Body size="small" className="py-12 text-center text-gray-400">ยังไม่มีขั้นตอน</Body></Card>
      ) : (
        <div className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {safeStages.map(stage => {
            const so = grouped[stage.name] ?? [];
            const tv = so.reduce((s, o) => s + o.estimatedValue, 0);
            return (
              <div key={stage.id} className="rounded-lg bg-white/60 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color || '#0071e3' }} />
                    <span className="text-xs font-semibold">{stage.name}</span>
                  </div>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px]">{so.length}</span>
                </div>
                <span className="mb-2 block text-[10px] text-gray-400">{formatBaht(tv)}</span>
                <div className="space-y-2">
                  {so.map(opp => (
                    <Card key={opp.id} className="!p-3 cursor-grab">
                      <span className="text-sm font-medium">{opp.dealName}</span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0071e3]">{formatBaht(opp.estimatedValue)}</span>
                        {opp.aiCloseProbability != null && <span className="text-[10px] text-gray-400">{opp.aiCloseProbability}%</span>}
                      </div>
                      <div className="mt-1 text-[10px] text-gray-400">Close: {new Date(opp.expectedCloseDate).toLocaleDateString('th-TH')}</div>
                    </Card>
                  ))}
                  {so.length === 0 && <Body size="caption" className="py-4 text-center text-gray-300">Empty</Body>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
