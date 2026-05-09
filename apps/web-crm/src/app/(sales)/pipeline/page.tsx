'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import { api } from '@/lib/api';
import { FadeIn, PageTransition, AnimatedCard, StaggerChildren, StaggerItem } from '@/components/motion';

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
    <PageTransition>
    <div className="apple-page">
      <FadeIn direction="down" duration={0.4}>
      <div className="mb-8">
        <Heading as="h1" size="section">สรุปไปป์ไลน์</Heading>
        <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
          ภาพรวมมูลค่าและจำนวนดีลตามขั้นตอน
        </Body>
      </div>
      </FadeIn>

      {/* Summary cards */}
      <StaggerChildren className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3" staggerDelay={0.1}>
        <StaggerItem><Card>
          <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">มูลค่ารวม</Body>
          <p className="mt-2 font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
            {formatBaht(grandTotal)}
          </p>
        </Card></StaggerItem>
        <StaggerItem><Card>
          <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">มูลค่าถ่วงน้ำหนัก</Body>
          <p className="mt-2 font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
            {formatBaht(grandWeighted)}
          </p>
        </Card></StaggerItem>
        <StaggerItem><Card>
          <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">จำนวนดีลทั้งหมด</Body>
          <p className="mt-2 font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
            {totalDeals}
          </p>
        </Card></StaggerItem>
      </StaggerChildren>

      {isLoading ? (
        <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
      ) : stages.length === 0 ? (
        <Card>
          <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ยังไม่มีข้อมูลไปป์ไลน์</Body>
        </Card>
      ) : (
        <StaggerChildren className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
          {stages.map((stage) => (
            <StaggerItem key={stage.name}>
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: stage.color || '#0071e3' }}
                />
                <span className="font-sf-pro-text text-[14px] font-semibold tracking-[-0.224px] text-[#1d1d1f]">
                  {stage.name}
                </span>
                <span className="ml-auto font-sf-pro-text text-[10px] tracking-[-0.08px] text-[rgba(0,0,0,0.48)]">
                  {stage.probability}%
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">จำนวนดีล</span>
                  <span className="font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">{stage.dealCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">มูลค่ารวม</span>
                  <span className="font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">{formatBaht(stage.totalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">มูลค่าถ่วงน้ำหนัก</span>
                  <span className="font-sf-pro-text text-[14px] font-semibold tracking-[-0.224px] text-[#0071e3]">{formatBaht(stage.weightedValue)}</span>
                </div>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${grandTotal > 0 ? (stage.totalValue / grandTotal) * 100 : 0}%`,
                    backgroundColor: stage.color || '#0071e3',
                  }}
                />
              </div>
            </Card>
            </StaggerItem>
          ))}
        </StaggerChildren>
      )}
    </div>
    </PageTransition>
  );
}
