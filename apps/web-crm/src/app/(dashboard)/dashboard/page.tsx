'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import { api } from '@/lib/api';

type Period = 'month' | 'quarter' | 'year';

interface RevenueSummary {
  closedWon: number;
  target: number;
  newLeads: number;
  conversionRate: number;
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

  const { data: revenue } = useQuery<RevenueSummary>({
    queryKey: ['revenue', period],
    queryFn: () => api('/pipeline/summary', { params: { period } }),
    placeholderData: { closedWon: 0, target: 0, newLeads: 0, conversionRate: 0 },
  });

  const { data: stages } = useQuery<StageData[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api('/pipeline/summary'),
    placeholderData: [],
  });

  const { data: reps } = useQuery<RepPerformance[]>({
    queryKey: ['rep-performance', period],
    queryFn: () => api('/targets', { params: { period } }),
    placeholderData: [],
  });

  const safeRevenue = revenue ?? { closedWon: 0, target: 0, newLeads: 0, conversionRate: 0 };
  const safeStages = stages ?? [];
  const safeReps = reps ?? [];
  const maxStageValue = Math.max(...safeStages.map((s) => s.totalValue), 1);
  const targetPct = safeRevenue.target > 0 ? Math.min((safeRevenue.closedWon / safeRevenue.target) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading as="h1" size="headline">ภาพรวม</Heading>
          <Body size="small" className="mt-1 text-gray-500">แดชบอร์ดสรุปข้อมูลการขาย</Body>
        </div>
        <div className="flex gap-1 rounded-lg bg-white p-1">
          {([['month', 'เดือน'], ['quarter', 'ไตรมาส'], ['year', 'ปี']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`rounded-md px-4 py-2 font-sf-pro-text text-xs font-medium transition-colors ${
                period === key ? 'bg-[#0071e3] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Body size="small" className="text-gray-500">รายได้ (Closed-Won)</Body>
          <p className="mt-1 font-sf-pro-display text-2xl font-semibold tracking-[-0.003em]">
            {formatBaht(safeRevenue.closedWon)}
          </p>
        </Card>
        <Card>
          <Body size="small" className="text-gray-500">เป้าหมาย</Body>
          <p className="mt-1 font-sf-pro-display text-2xl font-semibold tracking-[-0.003em]">
            {formatBaht(safeRevenue.target)}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-[#0071e3] transition-all" style={{ width: `${targetPct}%` }} />
          </div>
        </Card>
        <Card>
          <Body size="small" className="text-gray-500">ลีดใหม่</Body>
          <p className="mt-1 font-sf-pro-display text-2xl font-semibold tracking-[-0.003em]">
            {safeRevenue.newLeads}
          </p>
        </Card>
        <Card>
          <Body size="small" className="text-gray-500">อัตราการแปลง</Body>
          <p className="mt-1 font-sf-pro-display text-2xl font-semibold tracking-[-0.003em]">
            {safeRevenue.conversionRate.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <div className="mt-8">
        <Heading as="h2" size="title">ไปป์ไลน์</Heading>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="min-h-[280px]">
            <Body size="small" className="mb-4 font-medium text-gray-500">มูลค่าตามขั้นตอน</Body>
            <div className="space-y-3">
              {safeStages.map((stage) => (
                <div key={stage.name}>
                  <div className="flex items-center justify-between font-sf-pro-text text-xs">
                    <span className="text-[#1d1d1f]">{stage.name}</span>
                    <span className="text-gray-500">{formatBaht(stage.totalValue)}</span>
                  </div>
                  <div className="mt-1 h-6 w-full overflow-hidden rounded bg-gray-200">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${(stage.totalValue / maxStageValue) * 100}%`,
                        backgroundColor: stage.color || '#0071e3',
                      }}
                    />
                  </div>
                </div>
              ))}
              {safeStages.length === 0 && (
                <Body size="small" className="py-8 text-center text-gray-400">ยังไม่มีข้อมูลไปป์ไลน์</Body>
              )}
            </div>
          </Card>

          <Card className="min-h-[280px]">
            <Body size="small" className="mb-4 font-medium text-gray-500">จำนวนดีลและมูลค่าถ่วงน้ำหนัก</Body>
            <div className="space-y-3">
              {safeStages.map((stage) => (
                <div key={stage.name} className="flex items-center justify-between rounded-lg bg-white p-3">
                  <div>
                    <span className="font-sf-pro-text text-sm font-medium text-[#1d1d1f]">{stage.name}</span>
                    <span className="ml-2 font-sf-pro-text text-xs text-gray-400">{stage.dealCount} ดีล</span>
                  </div>
                  <span className="font-sf-pro-text text-sm font-semibold text-[#0071e3]">
                    {formatBaht(stage.weightedValue)}
                  </span>
                </div>
              ))}
              {safeStages.length === 0 && (
                <Body size="small" className="py-8 text-center text-gray-400">ยังไม่มีข้อมูล</Body>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Lead Conversion & Rep Performance */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <Body size="small" className="mb-4 font-medium text-gray-500">อัตราการแปลงลีด</Body>
          <div className="flex items-end gap-2">
            {['New', 'Contacted', 'Qualified', 'Won'].map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center">
                <div
                  className="w-full rounded-t bg-[#0071e3] transition-all"
                  style={{ height: `${Math.max(20, 120 - i * 30)}px`, opacity: 1 - i * 0.15 }}
                />
                <span className="mt-2 font-sf-pro-text text-[10px] text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Body size="small" className="mb-4 font-medium text-gray-500">ผลงานพนักงานขาย</Body>
          <div className="space-y-2">
            {safeReps.map((rep) => (
              <div key={rep.name} className="flex items-center justify-between rounded-lg bg-white p-3">
                <span className="font-sf-pro-text text-sm text-[#1d1d1f]">{rep.name}</span>
                <div className="flex gap-4 font-sf-pro-text text-xs text-gray-500">
                  <span>{rep.deals} ดีล</span>
                  <span>{formatBaht(rep.revenue)}</span>
                </div>
              </div>
            ))}
            {safeReps.length === 0 && (
              <Body size="small" className="py-6 text-center text-gray-400">ยังไม่มีข้อมูลพนักงานขาย</Body>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
