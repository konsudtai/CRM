import { PageTransition, FadeIn } from '@/components/motion';

export function SettingsPage() {
  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <FadeIn direction="down">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">ตั้งค่า</h1>
          <p className="text-sm text-slate-500 mb-8">จัดการผู้ใช้ บทบาท และการเชื่อมต่อ</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="grid gap-4">
            {[
              { title: 'Users & Roles', desc: 'จัดการผู้ใช้งานและสิทธิ์การเข้าถึง', icon: '👥' },
              { title: 'LINE OA Integration', desc: 'เชื่อมต่อ LINE Official Account', icon: '💬' },
              { title: 'AI Configuration', desc: 'ตั้งค่า Amazon Bedrock + Model', icon: '🤖' },
              { title: 'Security', desc: 'MFA, Password Policy, Session', icon: '🔒' },
              { title: 'PDPA', desc: 'นโยบายข้อมูลส่วนบุคคล', icon: '📋' },
            ].map((item) => (
              <div key={item.title} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 p-5 flex items-center gap-4 hover:border-sf-blue hover:shadow-md transition-all cursor-pointer">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
