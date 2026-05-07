'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import { api } from '@/lib/api';

type Period = 'month' | 'quarter' | 'year';

const REFETCH_INTERVAL = 30_000; // 30 seconds realtime polling

// ── Types matching real API responses ──

interface KpiResponse {
  month: { closed: number; target: number; leads: number; conv: number };
  quarter: { closed: number; target: number; leads: number; conv: number };
  year: { closed: number; target: number; leads: number; conv: number };
  activeCustomers: number;
  openTickets: number;
}

interface StageData {
  name: string;
  color: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
}

interface RepPerformance {
  name: string;
  deals: number;
  revenue: number;
  activities: number;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month');

  // ── KPI: revenue, target, leads, conversion (from /dashboard/kpi) ──
  const { data: kpi } = useQuery<KpiResponse>({
    queryKey: ['dashboard-kpi', period],
    queryFn: () => api('/dashboard/kpi', { params: { period } }),
    refetchInterval: REFETCH_INTERVAL,
    placeholderData: {
      month: { closed: 0, target: 0, leads: 0, conv: 0 },
      quarter: { closed: 0, target: 0, leads: 0, conv: 0 },
      year: { closed: 0, target: 0, leads: 0, conv: 0 },
      activeCustomers: 0,
      openTickets: 0,
    },
  });

  // ── Pipeline stages (from /dashboard/pipeline-stages) ──
  const { data: stages } = useQuery<StageData[]>({
    queryKey: ['dashboard-pipeline-stages'],
    queryFn: () => api('/dashboard/pipeline-stages'),
    refetchInterval: REFETCH_INTERVAL,
    placeholderData: [],
  });

  // ── Rep performance (from /dashboard/rep-performance) ──
  const { data: reps } = useQuery<RepPerformance[]>({
    queryKey: ['dashboard-rep-performance', period],
    queryFn: () => api('/dashboard/rep-performance', { params: { period } }),
    refetchInterval: REFETCH_INTERVAL,
    placeholderData: [],
  });

  const safeKpi = kpi ?? {
    month: { closed: 0, target: 0, leads: 0, conv: 0 },
    quarter: { closed: 0, target: 0, leads: 0, conv: 0 },
    year: { closed: 0, target: 0, leads: 0, conv: 0 },
    activeCustomers: 0,
    openTickets: 0,
  };
  const periodKpi = safeKpi[period];
  const safeStages = stages ?? [];
  const safeReps = reps ?? [];
  const maxStageValue = Math.max(...safeStages.map((s) => s.totalValue), 1);
  const targetPct = periodKpi.target > 0
    ? Math.min((periodKpi.closed / periodKpi.target) * 100, 100)
    : 0;

  return (
    <div className="apple-page">
      {/* Page header */}
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">ภาพรวม</Heading>
          <Body size="small" className="mt-1 text-[rgba(0,0,0,0.48)]">
            แดชบอร์ดสรุปข้อมูลการขาย
          </Body>
        </div>
        <div className="apple-filter-bar">
          {([['month', 'เดือน'], ['quarter', 'ไตรมาส'], ['year', 'ปี']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={period === key ? 'apple-filter-btn-active' : 'apple-filter-btn'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Summary — 4 cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">รายได้ (Closed-Won)</Body>
          <p className="mt-2 font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
            {formatBaht(periodKpi.closed)}
          </p>
        </Card>
        <Card>
          <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">เป้าหมาย</Body>
          <p className="mt-2 font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
            {formatBaht(periodKpi.target)}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-[#0071e3] transition-all duration-500"
              style={{ width: `${targetPct}%` }}
            />
          </div>
        </Card>
        <Card>
          <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">ลีดใหม่</Body>
          <p className="mt-2 font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
            {periodKpi.leads}
          </p>
        </Card>
        <Card>
          <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">อัตราการแปลง</Body>
          <p className="mt-2 font-sf-pro-display text-[28px] font-semibold leading-[1.14] tracking-[0.196px] text-[#1d1d1f]">
            {periodKpi.conv.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <div className="mt-10">
        <Heading as="h2" size="headline">ไปป์ไลน์</Heading>
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Stage value bars */}
          <Card className="min-h-[280px]">
            <Body size="caption-bold" className="mb-5 !text-[rgba(0,0,0,0.48)]">
              มูลค่าตามขั้นตอน
            </Body>
            <div className="space-y-4">
              {safeStages.map((stage) => (
                <div key={stage.name}>
                  <div className="flex items-center justify-between">
                    <span className="font-sf-pro-text text-[14px] font-normal tracking-[-0.224px] text-[#1d1d1f]">
                      {stage.name}
                    </span>
                    <span className="font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">
                      {formatBaht(stage.totalValue)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(stage.totalValue / maxStageValue) * 100}%`,
                        backgroundColor: stage.color || '#0071e3',
                      }}
                    />
                  </div>
                </div>
              ))}
              {safeStages.length === 0 && (
                <Body size="small" className="py-8 text-center !text-[rgba(0,0,0,0.48)]">
                  ยังไม่มีข้อมูลไปป์ไลน์
                </Body>
              )}
            </div>
          </Card>

          {/* Deal count + weighted value */}
          <Card className="min-h-[280px]">
            <Body size="caption-bold" className="mb-5 !text-[rgba(0,0,0,0.48)]">
              จำนวนดีลและมูลค่าถ่วงน้ำหนัก
            </Body>
            <div className="space-y-2">
              {safeStages.map((stage) => (
                <div
                  key={stage.name}
                  className="flex items-center justify-between rounded-[8px] bg-[#f5f5f7] px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">
                      {stage.name}
                    </span>
                    <span className="font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">
                      {stage.dealCount} ดีล
                    </span>
                  </div>
                  <span className="font-sf-pro-text text-[14px] font-semibold tracking-[-0.224px] text-[#0071e3]">
                    {formatBaht(stage.weightedValue)}
                  </span>
                </div>
              ))}
              {safeStages.length === 0 && (
                <Body size="small" className="py-8 text-center !text-[rgba(0,0,0,0.48)]">
                  ยังไม่มีข้อมูล
                </Body>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Lead Conversion & Rep Performance */}
      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <Body size="caption-bold" className="mb-5 !text-[rgba(0,0,0,0.48)]">
            อัตราการแปลงลีด
          </Body>
          <div className="flex items-end gap-3">
            {['New', 'Contacted', 'Qualified', 'Won'].map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t-[5px] bg-[#0071e3] transition-all"
                  style={{ height: `${Math.max(24, 120 - i * 30)}px`, opacity: 1 - i * 0.15 }}
                />
                <span className="mt-2 font-sf-pro-text text-[10px] tracking-[-0.08px] text-[rgba(0,0,0,0.48)]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Body size="caption-bold" className="mb-5 !text-[rgba(0,0,0,0.48)]">
            ผลงานพนักงานขาย
          </Body>
          <div className="space-y-2">
            {safeReps.map((rep) => (
              <div
                key={rep.name}
                className="flex items-center justify-between rounded-[8px] bg-[#f5f5f7] px-4 py-3"
              >
                <span className="font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">
                  {rep.name}
                </span>
                <div className="flex gap-4 font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">
                  <span>{rep.deals} ดีล</span>
                  <span>{formatBaht(rep.revenue)}</span>
                </div>
              </div>
            ))}
            {safeReps.length === 0 && (
              <Body size="small" className="py-6 text-center !text-[rgba(0,0,0,0.48)]">
                ยังไม่มีข้อมูลพนักงานขาย
              </Body>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
