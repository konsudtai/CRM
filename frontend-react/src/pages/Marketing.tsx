import { PageTransition, FadeIn } from '@/components/motion';

export function MarketingPage() {
  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <FadeIn direction="down">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Marketing</h1>
          <p className="text-sm text-slate-500 mb-8">จัดการ Landing Page และเนื้อหาทางการตลาด</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 p-8 text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Landing Page Builder</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Visual editor สำหรับจัดการเนื้อหา Landing Page — เพิ่ม/ลบ sections, แก้ไขข้อความ, อัปโหลด Logo
            </p>
            <p className="text-xs text-slate-400">กำลังย้ายจาก vanilla — จะพร้อมใช้งานเร็วๆ นี้</p>
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
