/* ══════════════════════════════════════════════════════════════
   SalesFAST 7 — Landing Page Data Manager
   Stores landing page content in localStorage (admin-editable)
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var STORAGE_KEY = 'sf7-landing-content-v1';

  // ── Default content (fallback if localStorage is empty) ──
  var DEFAULT_CONTENT = {
    company: {
      name: 'SalesFAST 7',
      tagline: 'IT Solutions & Services Partner',
      description: 'ผู้เชี่ยวชาญด้านโซลูชัน IT ครบวงจรสำหรับองค์กรไทย — ตั้งแต่ Hardware, Software, Network ไปจนถึง Cloud และ Cybersecurity',
      phone: '02-123-4567',
      email: 'sales@salesfast7.com',
      address: 'กรุงเทพมหานคร ประเทศไทย',
      foundedYear: 2015,
      tagline_en: 'IT Solutions & Services Partner'
    },
    hero: {
      badge: 'ผู้นำด้าน IT Solutions สำหรับองค์กรไทย',
      title: 'โซลูชัน IT ครบวงจร<br/>สำหรับองค์กรไทย',
      subtitle: 'จากอุปกรณ์ Network, Server, Notebook ไปจนถึง Cloud Migration และ Cybersecurity — เรามีทุกอย่างที่ธุรกิจคุณต้องการ พร้อมทีมผู้เชี่ยวชาญดูแลตลอด 24/7',
      ctaPrimary: 'ติดต่อฝ่ายขาย',
      ctaSecondary: 'ดูสินค้าและบริการ'
    },
    stats: [
      { label: 'ลูกค้าองค์กรที่ไว้วางใจ', value: 500, suffix: '+' },
      { label: 'โปรเจคที่ส่งมอบสำเร็จ', value: 1200, suffix: '+' },
      { label: 'ทีมผู้เชี่ยวชาญที่ได้รับ Certified', value: 45, suffix: '+' },
      { label: 'ปีแห่งประสบการณ์', value: 10, suffix: '+' }
    ],
    categories: [
      { id: 'hardware', name: 'Hardware & Devices', icon: 'server', description: 'Notebook, Desktop, Server, Monitor — ทุกแบรนด์ชั้นนำ Dell, HP, Lenovo' },
      { id: 'network', name: 'Network & Wi-Fi', icon: 'wifi', description: 'Switch, Access Point, Firewall — Cisco, Aruba, Fortinet, Sophos' },
      { id: 'storage', name: 'Storage & Backup', icon: 'database', description: 'NAS, SAN, Backup Solutions พร้อมติดตั้งและดูแล' },
      { id: 'cloud', name: 'Cloud Services', icon: 'cloud', description: 'Microsoft 365, AWS, Cloud Migration, Hybrid Cloud' },
      { id: 'security', name: 'Cybersecurity', icon: 'shield', description: 'Antivirus, Firewall, Endpoint Protection, Security Audit' },
      { id: 'service', name: 'IT Support & Service', icon: 'tool', description: 'IT Support รายเดือน, Helpdesk 8x5, SLA 4 ชั่วโมง' }
    ],
    products: [
      { id: 'p1', name: 'Dell PowerEdge R750', category: 'hardware', price: 285000, description: '2x Xeon Gold, 64GB RAM, 2x 960GB SSD RAID — เซิร์ฟเวอร์ระดับองค์กร', badge: 'Best Seller' },
      { id: 'p2', name: 'Cisco Catalyst 9200L-24P', category: 'network', price: 89000, description: '24-Port PoE+, 4x 1G SFP, Layer 3 Switch', badge: null },
      { id: 'p3', name: 'Fortinet FortiGate 60F', category: 'security', price: 45000, description: 'NGFW, 10 Gbps, SD-WAN, UTM Protection', badge: 'Recommended' },
      { id: 'p4', name: 'Notebook Dell Latitude 5540', category: 'hardware', price: 42900, description: 'Intel i7, 16GB RAM, 512GB SSD, 15.6" FHD', badge: null },
      { id: 'p5', name: 'Microsoft 365 Business Premium', category: 'cloud', price: 650, description: 'Teams + Office + Security — ต่อ user/เดือน', badge: 'Popular' },
      { id: 'p6', name: 'Synology NAS DS1621+', category: 'storage', price: 28500, description: '6-Bay NAS, AMD Ryzen, 4GB RAM สำหรับ SMB', badge: null }
    ],
    industries: [
      { id: 'finance', name: 'การเงินและธนาคาร', icon: 'bank' },
      { id: 'healthcare', name: 'โรงพยาบาลและสาธารณสุข', icon: 'heart' },
      { id: 'manufacturing', name: 'การผลิตและอุตสาหกรรม', icon: 'factory' },
      { id: 'retail', name: 'ค้าปลีกและ E-Commerce', icon: 'shop' },
      { id: 'education', name: 'การศึกษาและมหาวิทยาลัย', icon: 'school' },
      { id: 'government', name: 'หน่วยงานภาครัฐ', icon: 'building' }
    ],
    features: [
      { id: 'f1', title: 'ทีมผู้เชี่ยวชาญ Certified', description: 'วิศวกรกว่า 45 ท่าน ได้รับ Certified จาก Cisco, Microsoft, AWS, Fortinet' },
      { id: 'f2', title: 'SLA 4 ชั่วโมง Onsite', description: 'บริการซ่อมบำรุง Onsite ภายใน 4 ชั่วโมงในเขต กทม. และปริมณฑล' },
      { id: 'f3', title: 'ติดตั้งครบวงจร', description: 'ตั้งแต่สำรวจพื้นที่ ออกแบบ ติดตั้ง ทดสอบ ส่งมอบ ครบในทีมเดียว' },
      { id: 'f4', title: 'Support 24/7', description: 'ทีม Helpdesk พร้อมให้บริการตลอด 24 ชั่วโมงผ่าน Phone, Email, LINE' },
      { id: 'f5', title: 'ราคาที่แข่งขันได้', description: 'Partner โดยตรงกับแบรนด์ชั้นนำ ให้ราคาที่ดีที่สุดพร้อมการรับประกันเต็มรูปแบบ' },
      { id: 'f6', title: 'ใบเสนอราคาภาษาไทย', description: 'ใบเสนอราคาภาษาไทย คำนวณ VAT 7% และ WHT อัตโนมัติ ส่งผ่าน LINE ได้ทันที' }
    ],
    testimonials: [
      { id: 't1', name: 'คุณสมชาย วงศ์ดี', role: 'IT Manager', company: 'บริษัท สยามเทค จำกัด', quote: 'ทีมงาน SalesFAST 7 ดูแลระบบ IT ให้เรามา 3 ปี ไม่เคยผิดหวัง งานเร็ว ทีมมีความเป็นมืออาชีพสูง' },
      { id: 't2', name: 'คุณศิริพร แสงทอง', role: 'CTO', company: 'บริษัท ไฟแนนซ์โปร จำกัด', quote: 'การ migrate ระบบเดิมขึ้น Cloud ราบรื่นเกินคาด ทีม SalesFAST 7 วางแผนดีมาก ไม่มี downtime' },
      { id: 't3', name: 'คุณวิชัย สุขสม', role: 'Managing Director', company: 'บริษัท ฟู้ดเทค อินดัสทรี จำกัด', quote: 'ระบบ Security ที่ติดตั้งโดย SalesFAST 7 ช่วยให้เราผ่าน audit ได้ตั้งแต่ครั้งแรก คุ้มค่ามาก' }
    ],
    clients: [
      { id: 'c1', name: 'สยามเทค' },
      { id: 'c2', name: 'ไทยดิจิทัล' },
      { id: 'c3', name: 'กรุงเทพซอฟต์' },
      { id: 'c4', name: 'เอเชียเน็ต' },
      { id: 'c5', name: 'ไฟแนนซ์โปร' },
      { id: 'c6', name: 'เมดิเทค' },
      { id: 'c7', name: 'ฟู้ดเทค' },
      { id: 'c8', name: 'รีเทลมาสเตอร์' }
    ]
  };

  // ── API ──
  function loadContent() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        // Merge with defaults to handle missing fields after updates
        return mergeDeep(JSON.parse(JSON.stringify(DEFAULT_CONTENT)), parsed);
      }
    } catch (e) {
      console.warn('Failed to load landing content:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  }

  function saveContent(content) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
      // Broadcast to other tabs/windows
      window.dispatchEvent(new CustomEvent('landing-content-changed', { detail: content }));
      return true;
    } catch (e) {
      console.error('Failed to save landing content:', e);
      return false;
    }
  }

  function resetContent() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportContent() {
    var content = loadContent();
    var blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'salesfast7-landing-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importContent(jsonString) {
    try {
      var data = JSON.parse(jsonString);
      return saveContent(data);
    } catch (e) {
      return false;
    }
  }

  // ── Deep merge helper ──
  function mergeDeep(target, source) {
    for (var key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = mergeDeep(target[key] || {}, source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // ── ID generator ──
  function generateId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // ── Format helpers ──
  function formatPrice(price) {
    if (price >= 1000000) return '฿' + (price / 1000000).toFixed(1) + 'M';
    if (price >= 1000) return '฿' + (price / 1000).toFixed(0) + 'K';
    return '฿' + price.toLocaleString();
  }

  // ── Export ──
  window.LandingData = {
    load: loadContent,
    save: saveContent,
    reset: resetContent,
    export: exportContent,
    import: importContent,
    generateId: generateId,
    formatPrice: formatPrice,
    DEFAULTS: DEFAULT_CONTENT
  };
})();
