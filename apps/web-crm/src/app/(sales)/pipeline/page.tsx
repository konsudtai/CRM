'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import { api } from '@/lib/api';

interface StageSummary {
  name: string;
  color: string;
  probability: number;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
}

export default function PipelinePage() {
  const { data, isLoading } = useQuery<StageSummary[]>({
    queryKey: ['pipeline-summary'],
    queryFn: () => api('/pipeline/summary'),
    placeholderData: [],
  });
  const stages = data ?? [];
  const grandTotal = stages.reduce((s, st) => s + st.totalValue, 0);
  const grandWeighted = stages.reduce((s, st) => s + st.weightedValue, 0);
  const totalDeals = stages.reduce((s, st) => s + st.dealCount, 0);

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <Heading as="h1" size="headline">สรุปไปป์ไลน์</Heading>
      <Body size="small" className="mt-1 mb-6 text-gray-500">ภาพรวมมูลค่าและจำนวนดีลตามขั้นตอน</Body>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <Body size="small" className="text-gray-500">มูลค่ารวม</Body>
          <p className="mt-1 font-sf-pro-display text-2xl font-semibold">{formatBaht(grandTotal)}</p>
        </Card>
        <Card>
          <Body size="small" className="text-gray-500">มูลค่าถ่วงน้ำหนัก</Body>
          <p className="mt-1 font-sf-pro-display text-2xl font-semibold">{formatBaht(grandWeighted)}</p>
        </Card>
        <Card>
          <Body size="small" className="text-gray-500">จำนวนดีลทั้งหมด</Body>
          <p className="mt-1 font-sf-pro-display text-2xl font-semibold">{totalDeals}</p>
        </Card>
      </div>

      {isLoading ? (
        <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
      ) : stages.length === 0 ? (
        <Card><Body size="small" className="py-12 text-center text-gray-400">ยังไม่มีข้อมูลไปป์ไลน์</Body></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map(stage => (
            <Card key={stage.name}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color || '#0071e3' }} />
                <span className="text-sm font-semibold text-[#1d1d1f]">{stage.name}</span>
                <span className="ml-auto text-[10px] text-gray-400">{stage.probability}%</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">จำนวนดีล</span>
                  <span className="text-sm font-medium">{stage.dealCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">มูลค่ารวม</span>
                  <span className="text-sm font-medium">{formatBaht(stage.totalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">มูลค่าถ่วงน้ำหนัก</span>
                  <span className="text-sm font-semibold text-[#0071e3]">{formatBaht(stage.weightedValue)}</span>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${grandTotal > 0 ? (stage.totalValue / grandTotal) * 100 : 0}%`,
                  backgroundColor: stage.color || '#0071e3',
                }} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
