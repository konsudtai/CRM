import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';

export function SettingsPage() {
  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[900px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>ตั้งค่า</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>จัดการผู้ใช้ บทบาท และการเชื่อมต่อ</p>
          </div>
        </FadeIn>

        <StaggerContainer className="space-y-3">
          {[
            { title: 'Users & Roles', desc: 'จัดการผู้ใช้งานและสิทธิ์การเข้าถึง', icon: '👥' },
            { title: 'LINE OA Integration', desc: 'เชื่อมต่อ LINE Official Account', icon: '💬' },
            { title: 'AI Configuration', desc: 'ตั้งค่า Amazon Bedrock + Model', icon: '🤖' },
            { title: 'Security', desc: 'MFA, Password Policy, Session', icon: '🔒' },
            { title: 'PDPA', desc: 'นโยบายข้อมูลส่วนบุคคล', icon: '📋' },
          ].map((item) => (
            <StaggerItem key={item.title}>
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sf-blue)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ fontSize: 24 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </PageTransition>
  );
}
