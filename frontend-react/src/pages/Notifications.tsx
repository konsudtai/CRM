import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';

const ICON_COLORS: Record<string, string> = {
  lead: '#0176D3',
  task: '#DD7A01',
  deal: '#2E844A',
  quotation: '#0B827C',
  line: '#06C755',
  general: '#0176D3',
};

export function NotificationsPage() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api('/notifications'),
  });

  const notifications = Array.isArray(data) ? data : data?.data || [];

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[900px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[var(--text)]">การแจ้งเตือน</h1>
            <p className="text-[12px] text-[var(--text3)] mt-0.5">ดูการแจ้งเตือนทั้งหมด</p>
          </div>
        </FadeIn>

        {notifications.length === 0 ? (
          <FadeIn delay={0.1}>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-10 text-center">
              <p className="text-[var(--text3)] text-[13px]">ไม่มีการแจ้งเตือน</p>
            </div>
          </FadeIn>
        ) : (
          <StaggerContainer className="space-y-2">
            {notifications.map((n: any) => {
              const iconColor = ICON_COLORS[n.type] || ICON_COLORS.general;
              const isUnread = n.status !== 'sent' && n.status !== 'delivered';
              const timeStr = n.created_at ? new Date(n.created_at).toLocaleString('th-TH') : '';

              return (
                <StaggerItem key={n.id}>
                  <div
                    className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 flex gap-3.5 items-start"
                    style={isUnread ? { borderLeft: '3px solid var(--sf-blue)' } : {}}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-full bg-[var(--surface2)] flex items-center justify-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: iconColor }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[var(--text)]">{n.title}</div>
                      {n.body && <div className="text-[13px] text-[var(--text2)] mt-0.5">{n.body}</div>}
                      <div className="text-[11px] text-[var(--text3)] mt-1.5">{timeStr}</div>
                    </div>

                    {/* Unread dot */}
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-[var(--sf-blue)] flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>
    </PageTransition>
  );
}
