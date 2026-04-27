'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import type { Product } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

interface LineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  whtRate: number;
}

function calcLineTotal(item: LineItem): number {
  const gross = item.quantity * item.unitPrice;
  const disc =
    item.discountType === 'percentage'
      ? gross * (item.discount / 100)
      : item.discount;
  return Math.round((gross - disc) * 100) / 100;
}

export default function NewQuotationPage() {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api('/products'),
    placeholderData: [],
  });
  const catalog = (products ?? []).filter(
    (p) =>
      p.isActive &&
      (!catalogSearch ||
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(catalogSearch.toLowerCase())),
  );


  const addProduct = (product: Product) => {
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.unitPrice,
        discount: 0,
        discountType: 'fixed' as const,
        whtRate: product.whtRate ?? 0,
      },
    ]);
    setCatalogOpen(false);
    setCatalogSearch('');
  };

  const updateItem = (index: number, updates: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    );
  };

  const removeItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Live financial calculations ── */
  const financials = useMemo(() => {
    const lineTotals = lineItems.map(calcLineTotal);
    const subtotal = Math.round(lineTotals.reduce((s, v) => s + v, 0) * 100) / 100;
    const afterDiscount = Math.round((subtotal - totalDiscount) * 100) / 100;
    const vatAmount = Math.round(afterDiscount * 0.07 * 100) / 100;
    const whtAmount = Math.round(
      lineItems.reduce((s, item, i) => s + lineTotals[i] * (item.whtRate / 100), 0) * 100,
    ) / 100;
    const grandTotal = Math.round((afterDiscount + vatAmount - whtAmount) * 100) / 100;
    return { lineTotals, subtotal, vatAmount, whtAmount, grandTotal };
  }, [lineItems, totalDiscount]);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ id: string }>('/quotations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      window.location.href = `/quotations/${data.id}`;
    },
  });

  const handleSubmit = () => {
    createMutation.mutate({
      accountId,
      contactId: contactId || undefined,
      validUntil: validUntil || undefined,
      totalDiscount,
      lineItems: lineItems.map((item, i) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        discountType: item.discountType,
        whtRate: item.whtRate,
        lineTotal: financials.lineTotals[i],
      })),
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading as="h1" size="headline">สร้างใบเสนอราคา</Heading>
          <Body size="small" className="mt-1 text-gray-500">เลือกสินค้า กำหนดจำนวน และส่วนลด</Body>
        </div>
        <div className="flex gap-2">
          <a href="/quotations">
            <Button variant="secondary">ยกเลิก</Button>
          </a>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={lineItems.length === 0 || !accountId || createMutation.isPending}
          >
            {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกใบเสนอราคา'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Line items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quotation info */}
          <Card>
            <Body size="small" className="mb-3 font-semibold text-[#1d1d1f]">ข้อมูลใบเสนอราคา</Body>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">รหัสลูกค้า *</label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="Account ID"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">ผู้ติดต่อ</label>
                <input
                  type="text"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  placeholder="Contact ID (optional)"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">ใช้ได้ถึง</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                />
              </div>
            </div>
          </Card>


          {/* Product selection */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <Body size="small" className="font-semibold text-[#1d1d1f]">รายการสินค้า</Body>
              <Button variant="secondary" onClick={() => setCatalogOpen(!catalogOpen)}>
                + เพิ่มสินค้า
              </Button>
            </div>

            {/* Catalog picker */}
            {catalogOpen && (
              <div className="mb-4 rounded-lg border border-[#0071e3]/20 bg-white p-3">
                <input
                  type="text"
                  placeholder="ค้นหาสินค้า / SKU..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="mb-2 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#0071e3]"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto">
                  {catalog.length === 0 ? (
                    <Body size="caption" className="py-3 text-center text-gray-400">ไม่พบสินค้า</Body>
                  ) : (
                    catalog.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-[#0071e3]/5"
                      >
                        <div>
                          <span className="font-medium text-[#1d1d1f]">{p.name}</span>
                          <span className="ml-2 text-xs text-gray-400">{p.sku}</span>
                        </div>
                        <span className="text-sm font-medium text-[#0071e3]">{formatBaht(p.unitPrice)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Line items table */}
            {lineItems.length === 0 ? (
              <Body size="small" className="py-8 text-center text-gray-400">
                ยังไม่มีรายการสินค้า — กดปุ่ม &quot;เพิ่มสินค้า&quot; เพื่อเริ่มต้น
              </Body>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 text-xs font-medium text-gray-500">สินค้า</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 w-20">จำนวน</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">ราคา/หน่วย</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 w-28">ส่วนลด</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">ประเภท</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">WHT%</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 text-right">รวม</th>
                      <th className="pb-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 pr-2">
                          <span className="text-sm font-medium text-[#1d1d1f]">{item.productName}</span>
                          <span className="ml-1 text-[10px] text-gray-400">{item.sku}</span>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Math.max(1, +e.target.value) })}
                            className="w-16 rounded border border-gray-200 px-2 py-1 text-sm text-center outline-none focus:border-[#0071e3]"
                          />
                        </td>
                        <td className="py-2 pr-2 text-sm">{formatBaht(item.unitPrice)}</td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min={0}
                            step={item.discountType === 'percentage' ? 1 : 0.01}
                            value={item.discount}
                            onChange={(e) => updateItem(idx, { discount: Math.max(0, +e.target.value) })}
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-sm text-center outline-none focus:border-[#0071e3]"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={item.discountType}
                            onChange={(e) => updateItem(idx, { discountType: e.target.value as 'percentage' | 'fixed' })}
                            className="rounded border border-gray-200 px-1 py-1 text-xs outline-none focus:border-[#0071e3]"
                          >
                            <option value="fixed">฿</option>
                            <option value="percentage">%</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2 text-sm text-gray-500">{item.whtRate}%</td>
                        <td className="py-2 text-right text-sm font-medium text-[#0071e3]">
                          {formatBaht(financials.lineTotals[idx])}
                        </td>
                        <td className="py-2 pl-2">
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-red-400 hover:text-red-600 text-sm"
                            aria-label="ลบรายการ"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>


        {/* Right: Financial summary */}
        <div className="space-y-4">
          <Card>
            <Body size="small" className="mb-4 font-semibold text-[#1d1d1f]">สรุปยอด</Body>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">ยอดรวมก่อนส่วนลด</span>
                <span className="font-medium">{formatBaht(financials.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">ส่วนลดรวม</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={totalDiscount}
                    onChange={(e) => setTotalDiscount(Math.max(0, +e.target.value))}
                    className="w-24 rounded border border-gray-200 px-2 py-1 text-sm text-right outline-none focus:border-[#0071e3]"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
                <span className="text-gray-500">ยอดหลังส่วนลด</span>
                <span className="font-medium">
                  {formatBaht(Math.max(0, financials.subtotal - totalDiscount))}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT 7%</span>
                <span className="font-medium text-[#1d1d1f]">+{formatBaht(financials.vatAmount)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">หัก ณ ที่จ่าย (WHT)</span>
                <span className="font-medium text-red-500">-{formatBaht(financials.whtAmount)}</span>
              </div>

              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="text-sm font-semibold text-[#1d1d1f]">ยอดสุทธิ</span>
                <span className="text-lg font-bold text-[#0071e3]">{formatBaht(financials.grandTotal)}</span>
              </div>
            </div>
          </Card>

          {createMutation.isError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {(createMutation.error as Error).message || 'เกิดข้อผิดพลาด'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
