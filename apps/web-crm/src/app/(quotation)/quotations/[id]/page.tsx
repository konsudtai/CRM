'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import type { Quotation } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

/* ── Status helpers ── */
const STATUS_LABELS: Record<string, string> = {
  draft: 'ร่าง',
  pending_approval: 'รออนุมัติ',
  sent: 'ส่งแล้ว',
  accepted: 'ยอมรับ',
  rejected: 'ปฏิเสธ',
  expired: 'หมดอายุ',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-700',
};

const STATUS_FLOW: Record<string, string[]> = {
  draft: ['sent', 'pending_approval'],
  pending_approval: ['sent', 'draft'],
  sent: ['accepted', 'rejected', 'expired'],
};


/* ── Send Quotation Modal ── */
function SendModal({
  quotationId,
  onClose,
}: {
  quotationId: string;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<'email' | 'line'>('email');
  const [recipient, setRecipient] = useState('');

  const sendMutation = useMutation({
    mutationFn: () =>
      api(`/quotations/${quotationId}/send`, {
        method: 'POST',
        body: JSON.stringify({ channel, recipient }),
      }),
    onSuccess: () => onClose(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <Heading as="h2" size="title">ส่งใบเสนอราคา</Heading>
        <Body size="small" className="mt-1 mb-5 text-gray-500">
          เลือกช่องทางการส่งใบเสนอราคาให้ลูกค้า
        </Body>

        {/* Channel selector */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setChannel('email')}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              channel === 'email'
                ? 'border-[#0071e3] bg-[#0071e3]/5 text-[#0071e3]'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            ✉️ อีเมล
          </button>
          <button
            onClick={() => setChannel('line')}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              channel === 'line'
                ? 'border-[#06c755] bg-[#06c755]/5 text-[#06c755]'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            💬 LINE OA
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-xs text-gray-500">
            {channel === 'email' ? 'อีเมลผู้รับ' : 'LINE User ID'}
          </label>
          <input
            type={channel === 'email' ? 'email' : 'text'}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={channel === 'email' ? 'customer@example.com' : 'U1234567890abcdef'}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
          />
        </div>

        {sendMutation.isError && (
          <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">
            {(sendMutation.error as Error).message || 'ส่งไม่สำเร็จ'}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button
            variant="primary"
            onClick={() => sendMutation.mutate()}
            disabled={!recipient || sendMutation.isPending}
          >
            {sendMutation.isPending ? 'กำลังส่ง...' : 'ส่งใบเสนอราคา'}
          </Button>
        </div>
      </div>
    </div>
  );
}


/* ── Main Detail Page ── */
export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [sendOpen, setSendOpen] = useState(false);

  const { data: quotation, isLoading } = useQuery<Quotation>({
    queryKey: ['quotation', id],
    queryFn: () => api(`/quotations/${id}`),
    enabled: !!id,
  });

  /* Status transition */
  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      api(`/quotations/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  /* Approval */
  const approveMutation = useMutation({
    mutationFn: () =>
      api(`/quotations/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  /* Finalize (generate PDF + assign number) */
  const finalizeMutation = useMutation({
    mutationFn: () =>
      api(`/quotations/${id}/finalize`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  if (isLoading || !quotation) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
        <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
      </div>
    );
  }

  const nextStatuses = STATUS_FLOW[quotation.status] ?? [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <a href="/quotations" className="text-[#0066cc] text-sm hover:underline">← ใบเสนอราคา</a>
          <Heading as="h1" size="headline">
            {quotation.quotationNumber || 'ร่างใบเสนอราคา'}
          </Heading>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[quotation.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[quotation.status] ?? quotation.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Finalize button for drafts without a quotation number */}
          {quotation.status === 'draft' && !quotation.quotationNumber && (
            <Button
              variant="secondary"
              onClick={() => finalizeMutation.mutate()}
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending ? 'กำลังสร้าง...' : '📄 สร้าง PDF & เลขที่'}
            </Button>
          )}

          {/* Approval button for pending_approval */}
          {quotation.status === 'pending_approval' && (
            <Button
              variant="primary"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'กำลังอนุมัติ...' : '✓ อนุมัติ'}
            </Button>
          )}

          {/* Status transition buttons */}
          {nextStatuses.map((s) => (
            <Button
              key={s}
              variant="secondary"
              onClick={() => statusMutation.mutate(s)}
              disabled={statusMutation.isPending}
            >
              → {STATUS_LABELS[s]}
            </Button>
          ))}

          {/* Send button (available when sent or draft with number) */}
          {(quotation.status === 'sent' || quotation.status === 'draft') && quotation.quotationNumber && (
            <Button variant="primary" onClick={() => setSendOpen(true)}>
              📨 ส่งให้ลูกค้า
            </Button>
          )}
        </div>
      </div>


      {/* Error messages */}
      {(statusMutation.isError || approveMutation.isError || finalizeMutation.isError) && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {((statusMutation.error || approveMutation.error || finalizeMutation.error) as Error)?.message || 'เกิดข้อผิดพลาด'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: PDF preview + line items */}
        <div className="lg:col-span-2 space-y-4">
          {/* PDF Preview */}
          {quotation.pdfUrl && (
            <Card>
              <Body size="small" className="mb-3 font-semibold text-[#1d1d1f]">ตัวอย่าง PDF</Body>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <iframe
                  src={quotation.pdfUrl}
                  title="Quotation PDF Preview"
                  className="h-[500px] w-full"
                />
              </div>
              <div className="mt-3">
                <a
                  href={quotation.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0066cc] hover:underline"
                >
                  ⬇ ดาวน์โหลด PDF
                </a>
              </div>
            </Card>
          )}

          {/* Line items */}
          <Card>
            <Body size="small" className="mb-3 font-semibold text-[#1d1d1f]">รายการสินค้า</Body>
            {quotation.lineItems.length === 0 ? (
              <Body size="small" className="py-6 text-center text-gray-400">ไม่มีรายการ</Body>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 text-xs font-medium text-gray-500">สินค้า</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">SKU</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 text-center">จำนวน</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">ราคา/หน่วย</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">ส่วนลด</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">WHT%</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-sm font-medium text-[#1d1d1f]">{item.productName}</td>
                        <td className="py-2 pr-3 text-sm text-gray-500">{item.sku}</td>
                        <td className="py-2 pr-3 text-sm text-center">{item.quantity}</td>
                        <td className="py-2 pr-3 text-sm">{formatBaht(item.unitPrice)}</td>
                        <td className="py-2 pr-3 text-sm text-gray-500">
                          {item.discountType === 'percentage' ? `${item.discount}%` : formatBaht(item.discount)}
                        </td>
                        <td className="py-2 pr-3 text-sm text-gray-500">{item.whtRate}%</td>
                        <td className="py-2 text-right text-sm font-medium text-[#0071e3]">{formatBaht(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Financial summary + status tracking */}
        <div className="space-y-4">
          {/* Financial summary */}
          <Card>
            <Body size="small" className="mb-4 font-semibold text-[#1d1d1f]">สรุปยอด</Body>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">ยอดรวม</span>
                <span className="font-medium">{formatBaht(quotation.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">ส่วนลดรวม</span>
                <span className="font-medium text-red-500">-{formatBaht(quotation.totalDiscount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
                <span className="text-gray-500">VAT 7%</span>
                <span className="font-medium">+{formatBaht(quotation.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">หัก ณ ที่จ่าย (WHT)</span>
                <span className="font-medium text-red-500">-{formatBaht(quotation.whtAmount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="text-sm font-semibold text-[#1d1d1f]">ยอดสุทธิ</span>
                <span className="text-lg font-bold text-[#0071e3]">{formatBaht(quotation.grandTotal)}</span>
              </div>
            </div>
          </Card>

          {/* Status tracking */}
          <Card>
            <Body size="small" className="mb-4 font-semibold text-[#1d1d1f]">สถานะใบเสนอราคา</Body>
            <div className="space-y-3">
              {(['draft', 'pending_approval', 'sent', 'accepted'] as const).map((step) => {
                const isCurrent = quotation.status === step;
                const isPast =
                  ['draft', 'pending_approval', 'sent', 'accepted'].indexOf(quotation.status) >
                  ['draft', 'pending_approval', 'sent', 'accepted'].indexOf(step);
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-[#0071e3] text-white'
                          : isPast
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isPast ? '✓' : ['draft', 'pending_approval', 'sent', 'accepted'].indexOf(step) + 1}
                    </div>
                    <span className={`text-sm ${isCurrent ? 'font-semibold text-[#1d1d1f]' : isPast ? 'text-green-600' : 'text-gray-400'}`}>
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                );
              })}
              {(quotation.status === 'rejected' || quotation.status === 'expired') && (
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">✕</div>
                  <span className="text-sm font-semibold text-red-600">{STATUS_LABELS[quotation.status]}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Quotation metadata */}
          <Card>
            <Body size="small" className="mb-3 font-semibold text-[#1d1d1f]">ข้อมูลเพิ่มเติม</Body>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">รหัสลูกค้า</span>
                <span className="text-[#1d1d1f]">{quotation.accountId}</span>
              </div>
              {quotation.contactId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ผู้ติดต่อ</span>
                  <span className="text-[#1d1d1f]">{quotation.contactId}</span>
                </div>
              )}
              {quotation.opportunityId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">โอกาสการขาย</span>
                  <span className="text-[#1d1d1f]">{quotation.opportunityId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">สร้างโดย</span>
                <span className="text-[#1d1d1f]">{quotation.createdBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่สร้าง</span>
                <span className="text-[#1d1d1f]">{new Date(quotation.createdAt).toLocaleDateString('th-TH')}</span>
              </div>
              {quotation.validUntil && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ใช้ได้ถึง</span>
                  <span className="text-[#1d1d1f]">{new Date(quotation.validUntil).toLocaleDateString('th-TH')}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Send modal */}
      {sendOpen && <SendModal quotationId={id} onClose={() => setSendOpen(false)} />}
    </div>
  );
}
