import { motion } from 'framer-motion';
import { FadeIn, StaggerContainer, StaggerItem, AnimatedNumber } from '@/components/motion';

export function LandingPage() {
  return (
    <div className="font-jakarta bg-white text-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] flex items-center justify-between px-6 bg-white/90 backdrop-blur-xl border-b border-slate-200/50">
        <a href="/" className="text-lg font-black text-sf-navy tracking-tight">
          SalesFAST <span className="text-brand-green">7</span>
          <span className="text-[11px] font-medium text-slate-400 ml-2">IT Solutions</span>
        </a>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
          <a href="#solutions" className="hover:text-sf-blue transition">โซลูชัน</a>
          <a href="#products" className="hover:text-sf-blue transition">สินค้า</a>
          <a href="#contact" className="hover:text-sf-blue transition">ติดต่อ</a>
        </div>
        <div className="flex gap-2">
          <a href="/login" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-sf-blue transition">เข้าสู่ระบบ</a>
          <a href="#contact" className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition shadow-md shadow-orange-500/20">ติดต่อฝ่ายขาย</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-[144px] pb-20 px-6 text-center bg-gradient-to-b from-sky-50 to-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-200/30 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 text-sky-700 text-sm font-semibold mb-6 border border-sky-200/50">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              ผู้นำด้าน IT Solutions สำหรับองค์กรไทย
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="text-[clamp(36px,5.5vw,60px)] font-extrabold leading-[1.1] tracking-tight text-sf-navy mb-5">
              โซลูชัน IT ครบวงจร<br/>
              <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">สำหรับองค์กรไทย</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-lg text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
              จากอุปกรณ์ Network, Server, Notebook ไปจนถึง Cloud Migration และ Cybersecurity — เรามีทุกอย่างที่ธุรกิจคุณต้องการ
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="flex gap-3 justify-center flex-wrap">
              <a href="#contact" className="px-7 py-3.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition shadow-lg shadow-orange-500/25">
                ติดต่อฝ่ายขาย
              </a>
              <a href="#solutions" className="px-7 py-3.5 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:border-sf-navy hover:bg-slate-50 transition">
                ดูสินค้าและบริการ
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gradient-to-r from-sf-navy to-sf-navy-d relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,.15),transparent_70%)]" />
        <StaggerContainer className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center relative">
          {[
            { value: 500, suffix: '+', label: 'ลูกค้าองค์กร' },
            { value: 1200, suffix: '+', label: 'โปรเจคสำเร็จ' },
            { value: 45, suffix: '+', label: 'ทีมผู้เชี่ยวชาญ' },
            { value: 10, suffix: '+', label: 'ปีประสบการณ์' },
          ].map((stat) => (
            <StaggerItem key={stat.label}>
              <div className="text-4xl font-extrabold text-white mb-2 tracking-tight">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-white/60">{stat.label}</div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Solutions */}
      <section id="solutions" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-500 mb-3 block">โซลูชันของเรา</span>
              <h2 className="text-3xl font-extrabold text-sf-navy tracking-tight">โซลูชัน IT ครบวงจรในที่เดียว</h2>
            </div>
          </FadeIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  className="bg-white rounded-2xl p-7 border border-slate-200/60 hover:border-sky-300 transition-colors cursor-pointer"
                >
                  <h3 className="text-base font-bold text-sf-navy mb-2">{sol.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{sol.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-24 px-6 bg-gradient-to-br from-sf-navy to-sf-navy-d relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(14,165,233,.2),transparent_60%)]" />
        <div className="max-w-3xl mx-auto text-center relative">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
              พร้อมยกระดับระบบ IT แล้วหรือยัง?
            </h2>
            <p className="text-base text-white/60 mb-8 max-w-lg mx-auto">
              ปรึกษาฟรีกับทีมผู้เชี่ยวชาญ — เราจะช่วยออกแบบโซลูชันที่เหมาะสมกับธุรกิจคุณ
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a href="tel:021234567" className="px-6 py-3 rounded-xl bg-white text-sf-navy font-bold hover:bg-slate-100 transition">
                📞 02-123-4567
              </a>
              <a href="mailto:sales@salesfast7.com" className="px-6 py-3 rounded-xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition">
                ✉️ sales@salesfast7.com
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-sf-navy-d text-white/50 text-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <span className="font-bold text-white/80">SalesFAST <span className="text-brand-green">7</span></span>
          <span>&copy; {new Date().getFullYear()} SalesFAST 7. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
