import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/stores/auth';
import { api } from '@/lib/api';

interface Message {
  id: string;
  type: 'agent' | 'user' | 'notif';
  text: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [badge, setBadge] = useState(2);
  const messagesRef = useRef<HTMLDivElement>(null);
  const user = useAuth((s) => s.user);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const name = user?.firstName || 'คุณ';
    const isManager = user?.role === 'Sales Manager' || user?.role === 'Admin';

    addMsg('agent', `สวัสดีค่ะ คุณ${name}! น้องขายไว พร้อมช่วยค่ะ 😊`);
    setTimeout(() => {
      if (isManager) {
        addMsg('notif', `<strong>📋 Daily Briefing</strong><br/><br/>🔴 Lead รอ assign: <strong>3</strong><br/>🟡 Deal ใกล้ปิด: ฿3.2M<br/>🟢 ยอดเดือนนี้: ฿4.28M / เป้า ฿6M (71%)`);
      } else {
        addMsg('notif', `<strong>📋 Daily Briefing</strong><br/><br/>🟡 งานวันนี้: <strong>3</strong><br/>🔴 เกินกำหนด: <strong>1</strong><br/>🟢 ยอดของคุณ: ฿1.2M / เป้า ฿3M (40%)`);
      }
    }, 600);
  }, [user]);

  function addMsg(type: Message['type'], text: string) {
    setMessages((prev) => [...prev, { id: Date.now().toString() + Math.random(), type, text }]);
    setTimeout(() => {
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    addMsg('user', text);
    setTyping(true);

    try {
      const res = await api<{ reply?: string; message?: string; error?: string }>('/agents/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, agentType: 'sales-assistant', tenantId: user?.id || 'default' }),
      });
      setTyping(false);
      const reply = res.reply || res.message || res.error || 'ขออภัยค่ะ ไม่ได้รับข้อมูลจาก AI';
      addMsg('agent', reply.replace(/\n/g, '<br/>'));
    } catch (err: any) {
      setTyping(false);
      addMsg('agent', `ขออภัยค่ะ ไม่สามารถเชื่อมต่อได้: ${err.message || 'network error'}`);
    }
  }

  const quickActions = user?.role === 'Admin' || user?.role === 'Sales Manager'
    ? ['Assign Lead', 'สรุปทีม', 'Lead ใหม่', 'งานเกินกำหนด']
    : ['Lead ของฉัน', 'งานวันนี้', 'สร้าง QT', 'Deal โฟกัส'];

  return (
    <>
      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { setOpen(!open); setBadge(0); }}
        className="fixed bottom-6 right-6 z-[900] w-[60px] h-[60px] rounded-full border-[3px] border-white cursor-pointer flex items-center justify-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, #667EEA, #764BA2)', boxShadow: '0 4px 20px rgba(118,75,162,.4)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#C23934] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
            {badge}
          </span>
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-[92px] right-6 z-[901] w-[380px] max-h-[520px] bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden max-[480px]:w-[calc(100vw-24px)] max-[480px]:right-3"
          >
            {/* Header */}
            <div className="p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #032D60, #0176D3)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white border-2 border-white/20" style={{ background: 'linear-gradient(135deg, #1B96FF, #7F56D9)' }}>
                ขว
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-bold text-white">น้องขายไว</div>
                <div className="text-[11px] text-white/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4BCA81]" /> Online
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 cursor-pointer border-none text-[16px]">×</button>
            </div>

            {/* Messages */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 min-h-[200px] max-h-[320px]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-[1.5] ${
                    msg.type === 'user'
                      ? 'bg-[#0176D3] text-white self-end rounded-br-sm'
                      : msg.type === 'notif'
                        ? 'bg-[rgba(221,122,1,.08)] border border-[rgba(221,122,1,.15)] text-[var(--text)] self-start rounded-xl text-[12px]'
                        : 'bg-[var(--surface2)] text-[var(--text)] self-start rounded-bl-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: msg.text }}
                />
              ))}
              {typing && (
                <div className="flex gap-1 px-3.5 py-2.5 self-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text3)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text3)] animate-bounce" style={{ animationDelay: '100ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text3)] animate-bounce" style={{ animationDelay: '200ms' }} />
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-1.5 flex-wrap px-4 pb-2">
              {quickActions.map((qa) => (
                <button
                  key={qa}
                  onClick={() => { setInput(qa); setTimeout(sendMessage, 50); }}
                  className="px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[11px] font-medium text-[var(--sf-blue)] cursor-pointer hover:bg-[rgba(1,118,211,.06)] hover:border-[var(--sf-blue)] transition-colors"
                >
                  {qa}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[var(--border)] flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="ถามอะไรก็ได้..."
                className="flex-1 px-3.5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] outline-none focus:border-[var(--sf-blue)] transition-colors"
              />
              <button
                onClick={sendMessage}
                className="w-9 h-9 rounded-full bg-[#0176D3] text-white flex items-center justify-center cursor-pointer hover:bg-[#014486] transition-colors border-none flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
