import { PageTransition, FadeIn } from '@/components/motion';

export function MarketingPage() {
  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[900px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Marketing</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>จัดการ Landing Page และเนื้อหาทางการตลาด</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Landing Page Builder</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 400, margin: '0 auto' }}>
              Visual editor สำหรับจัดการเนื้อหา Landing Page — เพิ่ม/ลบ sections, แก้ไขข้อความ, อัปโหลด Logo
            </p>
            <a href="/" target="_blank" style={{ display: 'inline-block', marginTop: 20, padding: '8px 20px', borderRadius: 10, background: 'var(--sf-blue)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              ดู Landing Page →
            </a>
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
