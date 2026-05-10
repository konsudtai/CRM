import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem, AnimatedCard } from '@/components/motion';
import { motion } from 'framer-motion';

export function DashboardPage() {
  const { data: leads } = useQuery({
    queryKey: ['leads-all'],
    queryFn: () => api('/leads?limit=500'),
    refetchInterval: 30_000,
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts-all'],
    queryFn: () => api('/accounts?limit=100'),
    refetchInterval: 30_000,
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks-all'],
    queryFn: () => api('/tasks'),
    refetchInterval: 30_000,
  });

  // Process leads data
  const allLeads = (Array.isArray(leads) ? leads : leads?.data || []).map((l: any) => {
    const m = typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata || {};
    return { ...l, value: m.estimatedValue || 0, project: m.projectName || '', priority: m.priority || 'Medium' };
  });

  const wonLeads = allLeads.filter((l: any) => l.status === 'Won');
  const lostLeads = allLeads.filter((l: any) => l.status === 'Lost');
  const openLeads = allLeads.filter((l: any) => l.status !== 'Won' && l.status !== 'Lost');
  const totalVal = allLeads.reduce((s: number, l: any) => s + l.value, 0);
  const wonVal = wonLeads.reduce((s: number, l: any) => s + l.value, 0);
  const openVal = openLeads.reduce((s: number, l: any) => s + l.value, 0);
  const winRate = allLeads.length > 0 ? Math.round(wonLeads.length / allLeads.length * 100) : 0;
  const accountsList = Array.isArray(accounts) ? accounts : accounts?.items || accounts?.data || [];
  const tasksList = Array.isArray(tasks) ? tasks : tasks?.data || [];

  const stageColors: Record<string, string> = { New: '#64748B', Contacted: '#0176D3', Qualified: '#0B827C', Proposal: '#D97706', Negotiation: '#DC2626', Won: '#2E844A', Lost: '#9CA3AF' };
  const stageOrder = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

  // Group by stage
  const stageData = stageOrder.map((s) => {
    const items = allLeads.filter((l: any) => l.status === s);
    return { name: s, count: items.length, value: items.reduce((sum: number, l: any) => sum + l.value, 0), color: stageColors[s] };
  }).filter((s) => s.count > 0);
  const maxStageVal = Math.max(...stageData.map((s) => s.value), 1);

  function fmt(n: number) {
    if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
    return `฿${n.toLocaleString()}`;
  }

  // KPI data
  const kpis = [
    { label: 'Total Deals', value: String(allLeads.length), color: '#0176D3', sub: `${fmt(totalVal)} total value` },
    { label: 'Open Deals', value: String(openLeads.length), color: '#D97706', sub: `${fmt(openVal)} in pipeline` },
    { label: 'Won Deals', value: String(wonLeads.length), color: '#2E844A', sub: `${fmt(wonVal)} revenue` },
    { label: 'Lost Deals', value: String(lostLeads.length), color: '#DC2626', sub: `${fmt(lostLeads.reduce((s: number, l: any) => s + l.value, 0))} lost` },
    { label: 'Win Rate', value: `${winRate}%`, color: '#7F56D9', sub: `${wonLeads.length} of ${allLeads.length} deals` },
    { label: 'Customers', value: String(accountsList.length), color: '#0B827C', sub: 'Active accounts' },
  ];

  // Quick actions
  const quickActions = [
    { label: 'New Lead', color: '#0176D3', bg: 'rgba(1,118,211,.06)', href: '/leads' },
    { label: 'Add Customer', color: '#2E844A', bg: 'rgba(46,132,74,.06)', href: '/accounts' },
    { label: 'Quotation', color: '#D97706', bg: 'rgba(221,122,1,.06)', href: '/quotations' },
    { label: 'Log Call', color: '#7F56D9', bg: 'rgba(127,86,217,.06)', href: '/tasks' },
    { label: 'Calendar', color: '#0B827C', bg: 'rgba(11,130,124,.06)', href: '/calendar' },
    { label: 'Products', color: '#C23934', bg: 'rgba(194,57,52,.06)', href: '/products' },
  ];

  // Top open deals
  const topOpen = openLeads.sort((a: any, b: any) => b.value - a.value).slice(0, 8);

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[var(--text)]">Dashboard</h1>
            <p className="text-[12px] text-[var(--text3)] mt-0.5">Sales CRM Overview — Real-time data</p>
          </div>
        </FadeIn>

        {/* Quick Actions */}
        <StaggerContainer className="grid grid-cols-6 gap-2 mb-5 max-[1024px]:grid-cols-3 max-[640px]:grid-cols-2">
          {quickActions.map((qa) => (
            <StaggerItem key={qa.label}>
              <motion.a
                href={qa.href}
                whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,.06)' }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[12px] font-semibold text-[var(--text2)] no-underline hover:no-underline hover:border-[var(--sf-blue)] transition-colors"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: qa.bg, color: qa.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
                </div>
                <span style={{ color: qa.color }}>{qa.label}</span>
              </motion.a>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* KPI Cards */}
        <StaggerContainer className="grid grid-cols-6 gap-2.5 mb-5 max-[1024px]:grid-cols-3 max-[640px]:grid-cols-2">
          {kpis.map((kpi) => (
            <StaggerItem key={kpi.label}>
              <AnimatedCard className="bg-[var(--surface)] rounded-xl p-3.5 border border-[var(--border)] relative overflow-hidden hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: kpi.color }} />
                <div className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px]">{kpi.label}</div>
                <div className="text-[24px] font-extrabold tracking-[-0.5px] mt-1 leading-none" style={{ color: kpi.color }}>{kpi.value}</div>
                <div className="text-[10px] text-[var(--text3)] mt-1">{kpi.sub}</div>
              </AnimatedCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Row: Pipeline Bar Chart + Pipeline Summary Kanban */}
        <FadeIn delay={0.2}>
          <div className="grid grid-cols-2 gap-3.5 mb-3.5 max-[1024px]:grid-cols-1">
            {/* Pipeline Bar Chart */}
            <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[13px] font-bold text-[var(--text)]">Sales Pipeline by Stage</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(1,118,211,.06)] text-[var(--sf-blue)]">{fmt(totalVal)} total</span>
              </div>
              <div className="space-y-1.5">
                {stageData.map((stage) => (
                  <div key={stage.name} className="flex items-center gap-2">
                    <span className="w-[100px] text-[11px] font-medium text-[var(--text2)] truncate">{stage.name}</span>
                    <div className="flex-1 h-[22px] bg-[var(--surface3)] rounded-[5px] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(stage.value / maxStageVal) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-[5px] flex items-center pl-2 text-[10px] font-bold text-white min-w-[20px]"
                        style={{ backgroundColor: stage.color }}
                      >
                        {stage.count}
                      </motion.div>
                    </div>
                    <span className="w-[70px] text-[11px] font-semibold text-[var(--text)] text-right">{fmt(stage.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Open Deals */}
            <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[13px] font-bold text-[var(--text)]">Top Open Deals</span>
              </div>
              {topOpen.length === 0 ? (
                <p className="text-center text-[var(--text3)] py-6 text-[12px]">No open deals</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2 border-b-2 border-[var(--border)]">Deal / Company</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2 border-b-2 border-[var(--border)]">Stage</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2 border-b-2 border-[var(--border)]">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topOpen.map((l: any) => (
                      <tr key={l.id} className="hover:bg-[rgba(1,118,211,.02)]">
                        <td className="py-2.5 border-b border-[var(--border)] text-[12px]">
                          <div className="font-semibold">{l.project || l.name}</div>
                          <div className="text-[10px] text-[var(--text3)]">{l.company_name || ''}</div>
                        </td>
                        <td className="py-2.5 border-b border-[var(--border)]">
                          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${stageColors[l.status]}18`, color: stageColors[l.status] }}>{l.status}</span>
                        </td>
                        <td className="py-2.5 border-b border-[var(--border)] text-[11px] font-bold text-[var(--sf-blue)]">{fmt(l.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Row: Deal Breakdown Pie + Customers */}
        <FadeIn delay={0.3}>
          <div className="grid grid-cols-2 gap-3.5 mb-3.5 max-[1024px]:grid-cols-1">
            {/* Deal Stages Breakdown */}
            <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[13px] font-bold text-[var(--text)]">Deal Register Breakdown</span>
              </div>
              <div className="flex items-center gap-5">
                {/* Simple donut representation */}
                <div className="relative w-[140px] h-[140px] flex-shrink-0">
                  <svg viewBox="0 0 140 140" className="w-full h-full">
                    {(() => {
                      let startAngle = -Math.PI / 2;
                      const total = allLeads.length || 1;
                      return stageData.map((s) => {
                        const angle = (s.count / total) * 2 * Math.PI;
                        const endAngle = startAngle + angle;
                        const r = 55;
                        const cx = 70, cy = 70;
                        const x1 = cx + r * Math.cos(startAngle);
                        const y1 = cy + r * Math.sin(startAngle);
                        const x2 = cx + r * Math.cos(endAngle);
                        const y2 = cy + r * Math.sin(endAngle);
                        const large = angle > Math.PI ? 1 : 0;
                        const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
                        startAngle = endAngle;
                        return <path key={s.name} d={path} fill={s.color} stroke="white" strokeWidth="1.5" />;
                      });
                    })()}
                    <circle cx="70" cy="70" r="28" fill="var(--surface)" />
                    <text x="70" y="72" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--text)">{allLeads.length}</text>
                    <text x="70" y="84" textAnchor="middle" fontSize="8" fill="var(--text3)">Total</text>
                  </svg>
                </div>
                {/* Legend */}
                <div className="flex-1 space-y-1">
                  {stageData.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-[11px]">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-[var(--text2)]">{s.name}</span>
                      <span className="font-bold text-[var(--text)]">{s.count} ({Math.round(s.count / (allLeads.length || 1) * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Customers & Revenue */}
            <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[13px] font-bold text-[var(--text)]">Customers & Revenue</span>
                <a href="/accounts" className="text-[11px] text-[var(--sf-blue)] no-underline hover:underline">View All</a>
              </div>
              {accountsList.length === 0 ? (
                <p className="text-center text-[var(--text3)] py-6 text-[12px]">No customers</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase text-left pb-2 border-b-2 border-[var(--border)]">Company</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase text-left pb-2 border-b-2 border-[var(--border)]">Status</th>
                      <th className="text-[10px] font-semibold text-[var(--text3)] uppercase text-left pb-2 border-b-2 border-[var(--border)]">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsList.slice(0, 8).map((a: any) => (
                      <tr key={a.id} className="hover:bg-[rgba(1,118,211,.02)]">
                        <td className="py-2 border-b border-[var(--border)] text-[12px] font-semibold">{a.company_name || a.companyName}</td>
                        <td className="py-2 border-b border-[var(--border)]">
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.account_status === 'active' ? 'bg-[rgba(46,132,74,.08)] text-[#2E844A]' : 'bg-[rgba(194,57,52,.08)] text-[#C23934]'}`}>
                            {a.account_status || 'active'}
                          </span>
                        </td>
                        <td className="py-2 border-b border-[var(--border)] text-[11px] font-bold text-[var(--sf-blue)]">{fmt(parseFloat(a.total_revenue || a.totalRevenue || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Tasks Overview */}
        <FadeIn delay={0.4}>
          <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[13px] font-bold text-[var(--text)]">Tasks Overview</span>
              <a href="/tasks" className="text-[11px] text-[var(--sf-blue)] no-underline hover:underline">View All</a>
            </div>
            {tasksList.length === 0 ? (
              <p className="text-center text-[var(--text3)] py-4 text-[12px]">No tasks</p>
            ) : (
              <div className="space-y-1">
                {(() => {
                  const byStatus: Record<string, number> = {};
                  tasksList.forEach((t: any) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
                  const colors: Record<string, string> = { Open: '#94A3B8', 'In Progress': '#0176D3', Completed: '#2E844A', Overdue: '#DC2626' };
                  return ['Open', 'In Progress', 'Completed', 'Overdue'].map((s) => {
                    const c = byStatus[s] || 0;
                    if (c === 0) return null;
                    return (
                      <div key={s} className="flex items-center gap-1.5 py-1 text-[11px]">
                        <div className="w-2 h-2 rounded-full" style={{ background: colors[s] || '#94A3B8' }} />
                        <span className="flex-1 text-[var(--text2)]">{s}</span>
                        <span className="font-bold text-[var(--text)]">{c} ({Math.round(c / tasksList.length * 100)}%)</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
