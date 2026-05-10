import { motion } from 'framer-motion';
import { FadeIn, StaggerContainer, StaggerItem, AnimatedNumber } from '@/components/motion';

export function LandingPage() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: '#fff', color: '#0C4A6E' }}>
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(226,232,240,.5)' }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 900, color: '#032D60', letterSpacing: '-0.5px', textDecoration: 'none' }}>
          SalesFAST <span style={{ color: '#2E844A' }}>7</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8', marginLeft: 8 }}>IT Solutions</span>
        </a>
        <div style={{ display: 'flex', gap: 24, fontSize: 14, fontWeight: 500, color: '#64748B' }}>
          <a href="#solutions" style={{ color: 'inherit', textDecoration: 'none' }}>โซลูชัน</a>
          <a href="#products" style={{ color: 'inherit', textDecoration: 'none' }}>สินค้า</a>
          <a href="#contact" style={{ color: 'inherit', textDecoration: 'none' }}>ติดต่อ</a>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/login" style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, color: '#475569', textDecoration: 'none' }}>เข้าสู่ระบบ</a>
          <a href="#contact" style={{ padding: '8px 16px', borderRadius: 10, background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 14px rgba(249,115,22,.3)' }}>ติดต่อฝ่ายขาย</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 144, paddingBottom: 80, textAlign: 'center', background: 'linear-gradient(180deg, #F0F9FF 0%, #fff 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, left: '20%', width: 400, height: 400, background: 'rgba(14,165,233,.12)', borderRadius: '50%', filter: 'blur(80px)' }} />
          <div style={{ position: 'absolute', top: 0, right: '20%', width: 400, height: 400, background: 'rgba(56,189,248,.1)', borderRadius: '50%', filter: 'blur(80px)' }} />
        </div>
        <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <FadeIn>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 24, background: '#E0F2FE', color: '#0284C7', fontSize: 13, fontWeight: 600, marginBottom: 24, border: '1px solid rgba(14,165,233,.2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0EA5E9', animation: 'pulse 2s ease infinite' }} />
              ผู้นำด้าน IT Solutions สำหรับองค์กรไทย
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 56px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, color: '#032D60', marginBottom: 20 }}>
              โซลูชัน IT ครบวงจร<br/>
              <span style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>สำหรับองค์กรไทย</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={{ fontSize: 18, color: '#475569', maxWidth: 600, margin: '0 auto 36px', lineHeight: 1.7 }}>
              จากอุปกรณ์ Network, Server, Notebook ไปจนถึง Cloud Migration และ Cybersecurity — เรามีทุกอย่างที่ธุรกิจคุณต้องการ
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="#contact" style={{ padding: '14px 28px', borderRadius: 12, background: '#F97316', color: '#fff', fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 14px rgba(249,115,22,.3)' }}>ติดต่อฝ่ายขาย</a>
              <a href="#solutions" style={{ padding: '14px 28px', borderRadius: 12, border: '2px solid #E2E8F0', color: '#0C4A6E', fontWeight: 600, textDecoration: 'none' }}>ดูสินค้าและบริการ</a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '64px 24px', background: 'linear-gradient(135deg, #032D60, #001639)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(14,165,233,.15), transparent 70%)' }} />
        <StaggerContainer style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, textAlign: 'center', position: 'relative' }} className="">
          {[
            { value: 500, suffix: '+', label: 'ลูกค้าองค์กร' },
            { value: 1200, suffix: '+', label: 'โปรเจคสำเร็จ' },
            { value: 45, suffix: '+', label: 'ทีมผู้เชี่ยวชาญ' },
            { value: 10, suffix: '+', label: 'ปีประสบการณ์' },
          ].map((stat) => (
            <StaggerItem key={stat.label}>
              <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 8 }}>
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{stat.label}</div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Solutions */}
      <section id="solutions" style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#0EA5E9', display: 'block', marginBottom: 12 }}>โซลูชันของเรา</span>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-1px', color: '#032D60' }}>โซลูชัน IT ครบวงจรในที่เดียว</h2>
            </div>
          </FadeIn>
          <StaggerContainer style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }} className="">
            {[
              { title: 'Hardware & Devices', desc: 'Notebook, Desktop, Server, Monitor — Dell, HP, Lenovo' },
              { title: 'Network & Wi-Fi', desc: 'Switch, Access Point, Firewall — Cisco, Aruba, Fortinet' },
              { title: 'Cloud Services', desc: 'Microsoft 365, AWS, Cloud Migration, Hybrid Cloud' },
              { title: 'Cybersecurity', desc: 'Antivirus, Firewall, Endpoint Protection, Security Audit' },
              { title: 'Storage & Backup', desc: 'NAS, SAN, Backup Solutions พร้อมติดตั้งและดูแล' },
              { title: 'IT Support', desc: 'IT Support รายเดือน, Helpdesk 8x5, SLA 4 ชั่วโมง' },
            ].map((sol) => (
              <StaggerItem key={sol.title}>
                <motion.div
                  whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(12,74,110,.1)' }}
                  style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'border-color .2s' }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#032D60', marginBottom: 8 }}>{sol.title}</h3>
                  <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>{sol.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" style={{ padding: '96px 24px', background: 'linear-gradient(135deg, #032D60, #001639)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(14,165,233,.2), transparent 60%)' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <FadeIn>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1px', color: '#fff', marginBottom: 16 }}>
              พร้อมยกระดับระบบ IT แล้วหรือยัง?
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.6)', marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
              ปรึกษาฟรีกับทีมผู้เชี่ยวชาญ — เราจะช่วยออกแบบโซลูชันที่เหมาะสมกับธุรกิจคุณ
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="tel:021234567" style={{ padding: '12px 24px', borderRadius: 12, background: '#fff', color: '#032D60', fontWeight: 700, textDecoration: 'none' }}>📞 02-123-4567</a>
              <a href="mailto:sales@salesfast7.com" style={{ padding: '12px 24px', borderRadius: 12, border: '2px solid rgba(255,255,255,.3)', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>✉️ sales@salesfast7.com</a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '48px 24px', background: '#001639', color: 'rgba(255,255,255,.5)', fontSize: 13 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>SalesFAST <span style={{ color: '#4BCA81' }}>7</span></span>
          <span>© {new Date().getFullYear()} SalesFAST 7. All rights reserved.</span>
        </div>
      </footer>

      {/* Pulse animation */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.2)} }`}</style>
    </div>
  );
}
