import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem, AnimatedCard, AnimatedNumber } from '@/components/motion';
import { useState } from 'react';

type Period = 'month' | 'quarter' | 'year';

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month');

  const { data: kpi } = useQuery({
    queryKey: ['dashboard-kpi', period],
    queryFn: () => api('/dashboard/kpi', { params: { period } }),
    refetchInterval: 30_000,
  });

  const { data: stages } = useQuery({
    queryKey: ['dashboard-pipeline-stages'],
    queryFn: () => api('/dashboard/pipeline-stages'),
    refetchInterval: 30_000,
  });

  const { data: reps } = useQuery({
    queryKey: ['dashboard-rep-performance', period],
    queryFn: () => api('/dashboard/rep-performance', { params: { period } }),
    refetchInterval: 30_000,
  });

  const periodKpi = kpi?.[period] || { closed: 0, target: 0, leads: 0, conv: 0 };
  const safeStages = stages || [];
  const safeReps = reps || [];
  const maxStageValue = Math.max(...safeStages.map((s: any) => s.totalValue), 1);
  const targetPct = periodKpi.target > 0 ? Math.min((periodKpi.closed / periodKpi.target) * 100, 100) : 0;

  function fmt(n: number) {
    if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
    return `฿${n.toLocaleString()}`;
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ภาพรวม</h1>
              <p className="text-sm text-slate-500 mt-1">แดชบอร์ดสรุปข้อมูลการขาย</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {(['month', 'quarter', 'year'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    period === key
                      ? 'bg-white dark:bg-slate-700 text-sf-blue shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {key === 'month' ? 'เดือน' : key === 'quarter' ? 'ไตรมาส' : 'ปี'}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* KPI Cards */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {[
            { label: 'รายได้ (Closed-Won)', value: periodKpi.closed, format: fmt },
            { label: 'เป้าหมาย', value: periodKpi.target, format: fmt, progress: targetPct },
            { label: 'ลีดใหม่', value: periodKpi.leads, format: (n: number) => n.toString() },
            { label: 'อัตราการแปลง', value: periodKpi.conv, format: (n: number) => `${n.toFixed(1)}%` },
          ].map((card, i) => (
            <StaggerItem key={i}>
              <AnimatedCard className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-500 mb-2">{card.label}</p>
                <p className="text-[28px] font-bold text-slate-900 dark:text-white tracking-tight">
                  {card.format(card.value)}
                </p>
                {card.progress !== undefined && (
                  <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sf-blue rounded-full transition-all duration-700"
                      style={{ width: `${card.progress}%` }}
                    />
                  </div>
                )}
              </AnimatedCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Pipeline */}
        <FadeIn delay={0.2}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">ไปป์ไลน์</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10">
            <AnimatedCard className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-700 min-h-[280px]">
              <p className="text-xs font-semibold text-slate-500 mb-5">มูลค่าตามขั้นตอน</p>
              <div className="space-y-4">
                {safeStages.map((stage: any) => (
                  <div key={stage.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-700 dark:text-slate-300">{stage.name}</span>
                      <span className="text-slate-500 text-xs">{fmt(stage.totalValue)}</span>
                    </div>
                    <div className="h-[6px] bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(stage.totalValue / maxStageValue) * 100}%`,
                          backgroundColor: stage.color || '#0176D3',
                        }}
                      />
                    </div>
                  </div>
                ))}
                {safeStages.length === 0 && (
                  <p className="text-center text-slate-400 py-8 text-sm">ยังไม่มีข้อมูลไปป์ไลน์</p>
                )}
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.1} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-700 min-h-[280px]">
              <p className="text-xs font-semibold text-slate-500 mb-5">จำนวนดีลและมูลค่าถ่วงน้ำหนัก</p>
              <div className="space-y-2">
                {safeStages.map((stage: any) => (
                  <div key={stage.name} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-700/50 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{stage.name}</span>
                      <span className="text-xs text-slate-400">{stage.dealCount} ดีล</span>
                    </div>
                    <span className="text-sm font-semibold text-sf-blue">{fmt(stage.weightedValue)}</span>
                  </div>
                ))}
              </div>
            </AnimatedCard>
          </div>
        </FadeIn>

        {/* Rep Performance */}
        <FadeIn delay={0.3}>
          <AnimatedCard className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 mb-5">ผลงานพนักงานขาย</p>
            <div className="space-y-2">
              {safeReps.map((rep: any) => (
                <div key={rep.name} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-700/50 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{rep.name}</span>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>{rep.deals} ดีล</span>
                    <span className="font-semibold text-sf-blue">{fmt(rep.revenue)}</span>
                  </div>
                </div>
              ))}
              {safeReps.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-sm">ยังไม่มีข้อมูลพนักงานขาย</p>
              )}
            </div>
          </AnimatedCard>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
