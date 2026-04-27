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
    acc[stage.name] = opps.filter((o) => o.stage === stage.name);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  return (
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">โอกาสการขาย</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
            ไปป์ไลน์การขายและการจัดการดีล
          </Body>
        </div>
        <Button variant="primary">+ สร้างโอกาส</Button>
      </div>

      {isLoading ? (
        <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
      ) : safeStages.length === 0 ? (
        <Card>
          <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ยังไม่มีขั้นตอน</Body>
        </Card>
      ) : (
        <div className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {safeStages.map((stage) => {
            const so = grouped[stage.name] ?? [];
            const tv = so.reduce((s, o) => s + o.estimatedValue, 0);
            return (
              <div key={stage.id} className="rounded-[8px] bg-white/60 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stage.color || '#0071e3' }}
                    />
                    <span className="font-sf-pro-text text-[14px] font-semibold tracking-[-0.224px] text-[#1d1d1f]">
                      {stage.name}
                    </span>
                  </div>
                  <span className="apple-badge bg-black/[0.06] text-[rgba(0,0,0,0.48)]">
                    {so.length}
                  </span>
                </div>
                <span className="mb-2 block font-sf-pro-text text-[10px] tracking-[-0.08px] text-[rgba(0,0,0,0.48)]">
                  {formatBaht(tv)}
                </span>
                <div className="space-y-2">
                  {so.map((opp) => (
                    <Card key={opp.id} className="!p-3 cursor-grab">
                      <span className="font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">
                        {opp.dealName}
                      </span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-sf-pro-text text-[14px] font-semibold tracking-[-0.224px] text-[#0071e3]">
                          {formatBaht(opp.estimatedValue)}
                        </span>
                        {opp.aiCloseProbability != null && (
                          <span className="font-sf-pro-text text-[10px] tracking-[-0.08px] text-[rgba(0,0,0,0.48)]">
                            {opp.aiCloseProbability}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-sf-pro-text text-[10px] tracking-[-0.08px] text-[rgba(0,0,0,0.48)]">
                        Close: {new Date(opp.expectedCloseDate).toLocaleDateString('th-TH')}
                      </div>
                    </Card>
                  ))}
                  {so.length === 0 && (
                    <Body size="caption" className="py-4 text-center !text-[rgba(0,0,0,0.2)]">ว่าง</Body>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
