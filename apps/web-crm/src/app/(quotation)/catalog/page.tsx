'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import type { Product } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

export default function CatalogPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api('/products'),
    placeholderData: [],
  });
  const products = (data ?? []).filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">แคตตาล็อกสินค้า</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
            จัดการสินค้าและบริการ
          </Body>
        </div>
        <Button variant="primary">+ เพิ่มสินค้า</Button>
      </div>

      <div className="mb-5">
        <input
          type="text"
          placeholder="ค้นหาสินค้า / SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="apple-input max-w-sm"
        />
      </div>

      {isLoading ? (
        <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
      ) : (
        <Card>
          {products.length === 0 ? (
            <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ไม่พบสินค้า</Body>
          ) : (
            <div className="overflow-x-auto">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th>ชื่อสินค้า</th>
                    <th>SKU</th>
                    <th>ราคาต่อหน่วย</th>
                    <th>หน่วย</th>
                    <th>WHT %</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-[#1d1d1f]">{p.name}</td>
                      <td className="!text-[rgba(0,0,0,0.48)]">{p.sku}</td>
                      <td className="font-medium text-[#0071e3]">{formatBaht(p.unitPrice)}</td>
                      <td className="!text-[rgba(0,0,0,0.48)]">{p.unitOfMeasure}</td>
                      <td className="!text-[rgba(0,0,0,0.48)]">{p.whtRate ?? 0}%</td>
                      <td>
                        <span className={`apple-badge ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]'}`}>
                          {p.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
