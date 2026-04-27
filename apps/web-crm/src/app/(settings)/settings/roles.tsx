'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import type { Role, Permission } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

const MODULES = ['leads', 'opportunities', 'accounts', 'contacts', 'quotations', 'tasks', 'reports', 'settings'];
const MODULE_LABELS: Record<string, string> = {
  leads: 'ลีด',
  opportunities: 'โอกาสการขาย',
  accounts: 'บัญชีลูกค้า',
  contacts: 'ผู้ติดต่อ',
  quotations: 'ใบเสนอราคา',
  tasks: 'งาน',
  reports: 'รายงาน',
  settings: 'ตั้งค่า',
};
const ACTIONS = ['create', 'read', 'update', 'delete'] as const;
const ACTION_LABELS: Record<string, string> = { create: 'สร้าง', read: 'ดู', update: 'แก้ไข', delete: 'ลบ' };

export default function RolesSettings() {
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPermissions, setFormPermissions] = useState<Permission[]>(
    MODULES.map(m => ({ module: m, actions: [] }))
  );

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api('/roles'),
    placeholderData: [],
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; permissions: Permission[] }) =>
      editingRole
        ? api(`/roles/${editingRole.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/roles', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      resetForm();
    },
  });

  function resetForm() {
    setShowForm(false);
    setEditingRole(null);
    setFormName('');
    setFormPermissions(MODULES.map(m => ({ module: m, actions: [] })));
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setFormName(role.name);
    setFormPermissions(
      MODULES.map(m => {
        const existing = role.permissions.find(p => p.module === m);
        return { module: m, actions: existing?.actions ?? [] };
      })
    );
    setShowForm(true);
  }

  function toggleAction(module: string, action: typeof ACTIONS[number]) {
    setFormPermissions(prev =>
      prev.map(p => {
        if (p.module !== module) return p;
        const has = p.actions.includes(action);
        return { ...p, actions: has ? p.actions.filter(a => a !== action) : [...p.actions, action] };
      })
    );
  }

  function handleSave() {
    const filtered = formPermissions.filter(p => p.actions.length > 0);
    saveMutation.mutate({ name: formName, permissions: filtered });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading as="h2" size="title">บทบาทและสิทธิ์</Heading>
          <Body size="small" className="mt-1 text-gray-500">จัดการบทบาทและกำหนดสิทธิ์การเข้าถึง</Body>
        </div>
        {!showForm && (
          <Button variant="primary" onClick={() => { resetForm(); setShowForm(true); }}>
            + สร้างบทบาท
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <Heading as="h3" size="subtitle" className="mb-4">
            {editingRole ? 'แก้ไขบทบาท' : 'สร้างบทบาท'}
          </Heading>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-[#1d1d1f]">ชื่อบทบาท</label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              disabled={editingRole?.isDefault}
              className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3] disabled:bg-gray-100"
              placeholder="เช่น ผู้จัดการฝ่ายขาย"
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-[#1d1d1f]">สิทธิ์การเข้าถึง</label>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500">โมดูล</th>
                    {ACTIONS.map(a => (
                      <th key={a} className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">
                        {ACTION_LABELS[a]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => {
                    const perm = formPermissions.find(p => p.module === mod);
                    return (
                      <tr key={mod} className="border-b border-gray-100">
                        <td className="px-4 py-2.5 text-sm font-medium text-[#1d1d1f]">{MODULE_LABELS[mod]}</td>
                        {ACTIONS.map(action => (
                          <td key={action} className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={perm?.actions.includes(action) ?? false}
                              onChange={() => toggleAction(mod, action)}
                              className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSave} disabled={!formName.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
            <Button variant="secondary" onClick={resetForm}>ยกเลิก</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
      ) : (
        <div className="space-y-3">
          {roles.map(role => (
            <Card key={role.id} className="flex items-center justify-between !py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                  role.isDefault ? 'bg-[#0071e3]/10 text-[#0071e3]' : 'bg-gray-200 text-gray-600'
                }`}>
                  {role.name.charAt(0)}
                </div>
                <div>
                  <span className="text-sm font-medium text-[#1d1d1f]">{role.name}</span>
                  <Body size="caption" className="text-gray-400">
                    {role.isDefault ? 'บทบาทเริ่มต้น' : 'บทบาทกำหนดเอง'}
                    {' · '}
                    {role.permissions.length} โมดูล
                  </Body>
                </div>
              </div>
              <Button variant="ghost" onClick={() => openEdit(role)}>แก้ไข</Button>
            </Card>
          ))}
          {roles.length === 0 && (
            <Body size="small" className="py-12 text-center text-gray-400">ยังไม่มีบทบาท</Body>
          )}
        </div>
      )}
    </div>
  );
}
