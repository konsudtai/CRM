'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import type { CalendarEvent } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

type ViewMode = 'daily' | 'weekly' | 'monthly';

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  return days;
}

function getWeekDays(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

const typeIcon: Record<string, string> = { task: '📋', appointment: '📅', meeting: '🤝' };
const typeLabel: Record<string, string> = { task: 'งาน', appointment: 'นัดหมาย', meeting: 'ประชุม' };

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: events, isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events', year, month],
    queryFn: () => api('/calendar/events', { params: { year: String(year), month: String(month + 1) } }),
    placeholderData: [],
  });

  const eventsForDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    (events ?? []).forEach(ev => { const key = ev.date.slice(0, 10); if (!map.has(key)) map.set(key, []); map.get(key)!.push(ev); });
    return map;
  }, [events]);

  function getEventsForDay(date: Date): CalendarEvent[] {
    return eventsForDate.get(date.toISOString().slice(0, 10)) ?? [];
  }

  function navigate(dir: -1 | 1) {
    const d = new Date(currentDate);
    if (viewMode === 'monthly') d.setMonth(d.getMonth() + dir);
    else if (viewMode === 'weekly') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }

  const today = new Date();
  const monthDays = getMonthDays(year, month);
  const weekDays = getWeekDays(currentDate);

  const eventColors: Record<string, string> = {
    task: 'bg-[#0071e3]/10 text-[#0071e3]',
    appointment: 'bg-purple-100 text-purple-700',
    meeting: 'bg-green-100 text-green-700',
  };

  function renderEventPill(ev: CalendarEvent) {
    return (
      <div key={ev.id} className={`mb-0.5 truncate rounded-[5px] px-1 py-0.5 font-sf-pro-text text-[10px] tracking-[-0.08px] ${eventColors[ev.type] ?? 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]'}`}>
        {typeIcon[ev.type]} {ev.title}
      </div>
    );
  }

  return (
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">ปฏิทิน</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">ดูงาน นัดหมาย และการประชุม</Body>
        </div>
        <div className="flex gap-2">
          <a href="/tasks"><Button variant="secondary">📋 รายการงาน</Button></a>
          <a href="/tasks/new"><Button variant="primary">+ สร้างงาน</Button></a>
        </div>
      </div>

      {/* View mode toggle + navigation */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="apple-filter-btn rounded-[8px] border border-black/[0.06] bg-white">←</button>
          <span className="min-w-[200px] text-center font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">
            {viewMode === 'monthly' && `${THAI_MONTHS[month]} ${year + 543}`}
            {viewMode === 'weekly' && `${weekDays[0].toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            {viewMode === 'daily' && currentDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => navigate(1)} className="apple-filter-btn rounded-[8px] border border-black/[0.06] bg-white">→</button>
          <button onClick={() => setCurrentDate(new Date())} className="apple-filter-btn rounded-[8px] border border-black/[0.06] bg-white text-[#0071e3]">วันนี้</button>
        </div>
        <div className="apple-filter-bar">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} className={viewMode === mode ? 'apple-filter-btn-active' : 'apple-filter-btn'}>
              {mode === 'daily' ? 'วัน' : mode === 'weekly' ? 'สัปดาห์' : 'เดือน'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
      ) : (
        <Card className="!p-0 overflow-hidden">
          {/* Monthly */}
          {viewMode === 'monthly' && (
            <div>
              <div className="grid grid-cols-7 border-b border-black/[0.06] bg-[#f5f5f7]">
                {THAI_DAYS.map(d => (
                  <div key={d} className="px-2 py-2 text-center font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-black/[0.04] bg-[#f5f5f7]/50" />;
                  const isToday = sameDay(day, today);
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div key={day.toISOString()} className={`min-h-[80px] border-b border-r border-black/[0.04] p-1 ${isToday ? 'bg-[#0071e3]/[0.04]' : ''}`}>
                      <div className={`mb-1 text-right font-sf-pro-text text-[12px] tracking-[-0.12px] ${isToday ? 'font-bold text-[#0071e3]' : 'text-[rgba(0,0,0,0.48)]'}`}>
                        {day.getDate()}
                      </div>
                      {dayEvents.slice(0, 3).map(renderEventPill)}
                      {dayEvents.length > 3 && <div className="font-sf-pro-text text-[10px] text-[rgba(0,0,0,0.48)]">+{dayEvents.length - 3} อื่นๆ</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly */}
          {viewMode === 'weekly' && (
            <div>
              <div className="grid grid-cols-7 border-b border-black/[0.06] bg-[#f5f5f7]">
                {weekDays.map((d, i) => (
                  <div key={i} className={`px-2 py-2 text-center ${sameDay(d, today) ? 'bg-[#0071e3]/[0.04]' : ''}`}>
                    <div className="font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">{THAI_DAYS[d.getDay()]}</div>
                    <div className={`font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] ${sameDay(d, today) ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}>{d.getDate()}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {weekDays.map((d, i) => {
                  const dayEvents = getEventsForDay(d);
                  return (
                    <div key={i} className={`min-h-[200px] border-r border-black/[0.04] p-2 ${sameDay(d, today) ? 'bg-[#0071e3]/[0.02]' : ''}`}>
                      {dayEvents.length === 0 ? (
                        <div className="py-4 text-center font-sf-pro-text text-[10px] text-[rgba(0,0,0,0.2)]">ว่าง</div>
                      ) : (
                        <div className="space-y-1">
                          {dayEvents.map(ev => (
                            <div key={ev.id} className="rounded-[8px] bg-[#f5f5f7] p-2">
                              <div className="font-sf-pro-text text-[10px] tracking-[-0.08px] text-[rgba(0,0,0,0.48)]">{typeIcon[ev.type]} {typeLabel[ev.type]}</div>
                              <div className="font-sf-pro-text text-[12px] font-medium tracking-[-0.12px] text-[#1d1d1f]">{ev.title}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily */}
          {viewMode === 'daily' && (
            <div className="p-5">
              {(() => {
                const dayEvents = getEventsForDay(currentDate);
                if (dayEvents.length === 0) return <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ไม่มีกิจกรรมในวันนี้</Body>;
                return (
                  <div className="space-y-3">
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="flex items-start gap-3 rounded-[8px] bg-[#f5f5f7] p-4">
                        <span className="text-xl">{typeIcon[ev.type]}</span>
                        <div className="flex-1">
                          <div className="font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">{ev.title}</div>
                          <div className="mt-1 font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">{typeLabel[ev.type]}</div>
                          {ev.priority && (
                            <span className={`mt-1 inline-block apple-badge ${ev.priority === 'High' ? 'bg-red-100 text-red-700' : ev.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]'}`}>
                              {ev.priority === 'High' ? 'สูง' : ev.priority === 'Medium' ? 'กลาง' : 'ต่ำ'}
                            </span>
                          )}
                        </div>
                        {ev.status && (
                          <span className={`apple-badge ${ev.status === 'Completed' ? 'bg-green-100 text-green-700' : ev.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-[#0071e3]/10 text-[#0071e3]'}`}>
                            {ev.status === 'Completed' ? 'เสร็จสิ้น' : ev.status === 'Overdue' ? 'เกินกำหนด' : ev.status === 'In Progress' ? 'กำลังดำเนินการ' : 'เปิด'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4">
        {Object.entries(typeLabel).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1 font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">
            <span>{typeIcon[type]}</span> {label}
          </div>
        ))}
      </div>
    </div>
  );
}
