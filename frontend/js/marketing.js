/* ══════════════════════════════════════════════════════════════
   SalesFAST 7 — Marketing Page (Landing CMS + Logo)
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var state = {
    content: null,
    activeTab: 'logo',
    dirty: false
  };

  var ICON_OPTIONS = ['server','wifi','database','cloud','shield','tool','bank','heart','factory','shop','school','building','users','target','clock','award','trending','phone','mail','map'];

  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function markDirty() {
    state.dirty = true;
    var badge = document.getElementById('saved-badge');
    if (badge) { badge.textContent = 'ยังไม่ได้บันทึก'; badge.classList.add('unsaved'); }
  }
  function markClean() {
    state.dirty = false;
    var badge = document.getElementById('saved-badge');
    if (badge) { badge.textContent = 'บันทึกแล้ว'; badge.classList.remove('unsaved'); }
    var lastSaved = document.getElementById('last-saved-text');
    if (lastSaved) lastSaved.textContent = 'บันทึกล่าสุด ' + new Date().toLocaleTimeString('th-TH');
  }

  // ── Tab navigation ──
  var SECTIONS = [
    { id:'logo', label:'Logo บริษัท', icon:'target' },
    { id:'company', label:'ข้อมูลบริษัท', icon:'building' },
    { id:'hero', label:'Hero Section', icon:'trending' },
    { id:'stats', label:'สถิติ', icon:'award' },
    { id:'categories', label:'หมวดหมู่สินค้า', icon:'database' },
    { id:'products', label:'สินค้า', icon:'shop' },
    { id:'industries', label:'อุตสาหกรรม', icon:'factory' },
    { id:'features', label:'จุดเด่น', icon:'star' },
    { id:'testimonials', label:'Testimonials', icon:'users' },
    { id:'clients', label:'ลูกค้า', icon:'heart' },
    { id:'leads', label:'Leads จากฟอร์ม', icon:'mail' }
  ];

  function initTabs() {
    renderSectionsList();

    // Add section button
    var addBtn = document.getElementById('pb-add-section');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var options = SECTIONS.filter(function (s) { return s.id !== 'leads'; }).map(function (s) { return s.label; });
        var choice = prompt('เพิ่ม Section:\n\n' + options.map(function (o, i) { return (i + 1) + '. ' + o; }).join('\n') + '\n\nพิมพ์ชื่อ section:');
        if (!choice) return;
        var found = SECTIONS.find(function (s) { return s.label.toLowerCase().indexOf(choice.toLowerCase()) >= 0; });
        if (found) {
          state.activeTab = found.id;
          renderSectionsList();
          renderTab();
        }
      });
    }
  }

  function renderSectionsList() {
    var container = document.getElementById('pb-sections') || document.getElementById('ve-sections');
    if (!container) return;

    container.innerHTML = SECTIONS.map(function (s, i) {
      var isActive = s.id === state.activeTab;
      var canDelete = s.id !== 'hero' && s.id !== 'company' && s.id !== 'leads';
      return '<div class="pb-comp' + (isActive ? ' active' : '') + '" data-tab="' + s.id + '" draggable="true">' +
        '<div class="pb-comp-handle"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>' +
        '<div class="pb-comp-icon">' + (window.Icons ? window.Icons.get(s.icon, 14) : '') + '</div>' +
        '<div class="pb-comp-info">' +
          '<div class="pb-comp-name">' + escHtml(s.label) + '</div>' +
          '<div class="pb-comp-desc">' + getSectionPreview(s.id) + '</div>' +
        '</div>' +
        '<div class="pb-comp-actions">' +
          (i > 0 ? '<button class="pb-comp-btn" onclick="PB.moveSection(' + i + ',-1)" title="เลื่อนขึ้น"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg></button>' : '') +
          (i < SECTIONS.length - 1 ? '<button class="pb-comp-btn" onclick="PB.moveSection(' + i + ',1)" title="เลื่อนลง"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></button>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    // Bind click
    container.querySelectorAll('.pb-comp').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.pb-comp-btn')) return;
        container.querySelectorAll('.pb-comp').forEach(function (c) { c.classList.remove('active'); });
        el.classList.add('active');
        state.activeTab = el.dataset.tab;
        renderTab();
      });
    });
  }

  function getSectionPreview(id) {
    if (!state.content) return '';
    switch (id) {
      case 'logo': return window.BrandLogo && window.BrandLogo.hasCustom() ? 'Custom logo' : 'Text only';
      case 'company': return escHtml((state.content.company.name || '').substring(0, 25));
      case 'hero': return escHtml((state.content.hero.badge || '').substring(0, 25));
      case 'stats': return state.content.stats.length + ' items';
      case 'categories': return state.content.categories.length + ' items';
      case 'products': return state.content.products.length + ' items';
      case 'industries': return state.content.industries.length + ' items';
      case 'features': return state.content.features.length + ' items';
      case 'testimonials': return state.content.testimonials.length + ' items';
      case 'clients': return state.content.clients.length + ' items';
      case 'leads': var l = []; try { l = JSON.parse(localStorage.getItem('sf7-landing-leads') || '[]'); } catch (e) {} return l.length + ' leads';
      default: return '';
    }
  }

  // ── Refresh live preview iframe ──
  function refreshPreview() {
    var iframe = document.getElementById('pb-iframe') || document.getElementById('ve-iframe');
    if (iframe) {
      try { iframe.contentWindow.location.reload(); } catch (e) {}
    }
  }

  // ── Render current tab ──
  function renderTab() {
    var main = document.getElementById('pb-editor-body') || document.getElementById('panel-body') || document.getElementById('mk-cms-main');
    if (!main) return;

    // Update editor title
    var titleEl = document.getElementById('pb-editor-title') || document.getElementById('panel-title');
    var section = SECTIONS.find(function (s) { return s.id === state.activeTab; });
    if (titleEl && section) {
      titleEl.innerHTML = (window.Icons ? window.Icons.get(section.icon, 14) : '') + ' ' + escHtml(section.label);
    }

    switch (state.activeTab) {
      case 'logo': renderLogo(main); break;
      case 'company': renderCompany(main); break;
      case 'hero': renderHero(main); break;
      case 'stats': renderStats(main); break;
      case 'categories': renderCategories(main); break;
      case 'products': renderProducts(main); break;
      case 'industries': renderIndustries(main); break;
      case 'features': renderFeatures(main); break;
      case 'testimonials': renderTestimonials(main); break;
      case 'clients': renderClients(main); break;
      case 'leads': renderLeads(main); break;
    }
  }

  // ── Logo tab ──
  function renderLogo(container) {
    container.innerHTML =
      '<div style="margin-bottom:16px">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:16px">อัปโหลด Logo สำหรับ Landing Page เท่านั้น — CRM ใช้ text "SalesFAST 7 IT Solutions"</div>' +
      '</div>' +
      '<div class="mk-logo-box">' +
        '<div class="mk-logo-preview">' +
          '<img id="logo-preview" src="" alt="Logo" style="display:none"/>' +
          '<div id="logo-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--text3);font-size:10px;text-align:center;padding:8px">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>' +
            '<span>ไม่มี Logo</span>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<input type="file" id="logo-file-input" accept="image/png,image/jpeg,image/svg+xml" style="display:none"/>' +
            '<button class="btn btn-primary" id="logo-upload-btn" style="padding:6px 12px;font-size:11px">Upload Logo</button>' +
            '<button class="btn btn-secondary" onclick="MK.resetLogo()" style="padding:6px 12px;font-size:11px;color:#C23934" id="logo-reset-btn">Reset</button>' +
          '</div>' +
          '<div style="margin-top:8px;font-size:10px" id="logo-status"><span style="color:var(--text2)">ใช้ text เริ่มต้น</span></div>' +
          '<div style="margin-top:12px;font-size:10px;color:var(--text3);line-height:1.5">รองรับ PNG, JPG, SVG (≤ 2MB)<br/>แนะนำ 512x512 px</div>' +
        '</div>' +
      '</div>';

    document.getElementById('logo-upload-btn').addEventListener('click', function () {
      document.getElementById('logo-file-input').click();
    });
    document.getElementById('logo-file-input').addEventListener('change', uploadLogo);
    refreshLogoPreview();
  }

  function refreshLogoPreview() {
    var preview = document.getElementById('logo-preview');
    var placeholder = document.getElementById('logo-placeholder');
    var status = document.getElementById('logo-status');
    var resetBtn = document.getElementById('logo-reset-btn');
    if (!preview) return;

    if (window.BrandLogo && window.BrandLogo.hasCustom()) {
      preview.src = window.BrandLogo.get();
      preview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      if (status) status.innerHTML = '<span style="color:#2E844A;font-weight:600">&#10003; กำลังใช้ logo ที่อัปโหลด</span>';
      if (resetBtn) resetBtn.style.display = '';
    } else {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
      if (status) status.innerHTML = '<span style="color:var(--text2)">ใช้ text เริ่มต้น "SalesFAST 7"</span>';
      if (resetBtn) resetBtn.style.display = 'none';
    }
  }

  function uploadLogo(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('ไฟล์ใหญ่เกินไป — กรุณาใช้ไฟล์ขนาดไม่เกิน 2MB');
      event.target.value = '';
      return;
    }
    if (!window.BrandLogo) {
      alert('Logo manager not loaded');
      return;
    }
    window.BrandLogo.save(file).then(function () {
      refreshLogoPreview();
      event.target.value = '';
      if (window.toast) window.toast('อัปโหลด Logo เรียบร้อย — แสดงที่หน้า Landing Page ทันที');
    }).catch(function (err) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    });
  }

  // ── Company ──
  function renderCompany(container) {
    var c = state.content.company;
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">ข้อมูลบริษัท</div>' +
        '<div class="mk-panel-desc">ข้อมูลที่จะแสดงใน header, footer และหน้า contact</div>' +
      '</div></div>' +
      '<div class="ed-form">' +
        field('company.name', 'ชื่อบริษัท', c.name) +
        field('company.tagline', 'Tagline', c.tagline) +
        textareaField('company.description', 'คำอธิบาย', c.description) +
        rowFields([
          field('company.phone', 'โทรศัพท์', c.phone),
          field('company.email', 'อีเมล', c.email)
        ]) +
        field('company.address', 'ที่อยู่', c.address) +
      '</div>' +
    '</div>';
    bindFieldHandlers();
  }

  // ── Hero ──
  function renderHero(container) {
    var h = state.content.hero;
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">Hero Section</div>' +
        '<div class="mk-panel-desc">ส่วนหัวของหน้า Landing page — แสดงเป็นอย่างแรกเมื่อผู้เข้าชมเปิดหน้า</div>' +
      '</div></div>' +
      '<div class="ed-form">' +
        field('hero.badge', 'Badge (แถบเล็กด้านบน)', h.badge) +
        textareaField('hero.title', 'หัวข้อหลัก (รองรับ HTML: <br/>, <span class="ln-gradient">)', h.title) +
        textareaField('hero.subtitle', 'คำอธิบาย', h.subtitle) +
        rowFields([
          field('hero.ctaPrimary', 'ปุ่ม CTA หลัก', h.ctaPrimary),
          field('hero.ctaSecondary', 'ปุ่ม CTA รอง', h.ctaSecondary)
        ]) +
      '</div>' +
    '</div>';
    bindFieldHandlers();
  }

  // ── Stats ──
  function renderStats(container) {
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">สถิติ</div>' +
        '<div class="mk-panel-desc">ตัวเลขแสดงผลงาน (แนะนำ 4 รายการ)</div>' +
      '</div></div>' +
      '<div class="ed-items" id="stats-list"></div>' +
      '<button class="ed-add-btn" onclick="MK.addStat()">+ เพิ่มสถิติ</button>' +
    '</div>';
    renderStatsList();
  }
  function renderStatsList() {
    var list = document.getElementById('stats-list');
    if (!list) return;
    list.innerHTML = state.content.stats.map(function (s, i) {
      return itemCard(i, 'สถิติ #' + (i + 1), [
        rowFields([
          field('stats[' + i + '].value', 'ตัวเลข', s.value, 'number'),
          field('stats[' + i + '].suffix', 'Suffix (%, +, x)', s.suffix)
        ]),
        field('stats[' + i + '].label', 'คำอธิบาย', s.label)
      ], 'stats', i, state.content.stats.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Categories ──
  function renderCategories(container) {
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">หมวดหมู่สินค้า</div>' +
        '<div class="mk-panel-desc">กลุ่มสินค้าและบริการ — ใช้ใน Solutions section + filter ของ Products</div>' +
      '</div></div>' +
      '<div class="ed-items" id="categories-list"></div>' +
      '<button class="ed-add-btn" onclick="MK.addCategory()">+ เพิ่มหมวดหมู่</button>' +
    '</div>';
    renderCategoriesList();
  }
  function renderCategoriesList() {
    var list = document.getElementById('categories-list');
    if (!list) return;
    list.innerHTML = state.content.categories.map(function (cat, i) {
      return itemCard(i, cat.name || 'หมวดหมู่ใหม่', [
        rowFields([
          field('categories[' + i + '].name', 'ชื่อ', cat.name),
          iconSelectField('categories[' + i + '].icon', 'ไอคอน', cat.icon)
        ]),
        field('categories[' + i + '].id', 'ID (อ้างอิงจากสินค้า)', cat.id),
        textareaField('categories[' + i + '].description', 'คำอธิบาย', cat.description)
      ], 'categories', i, state.content.categories.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Products ──
  function renderProducts(container) {
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">สินค้า</div>' +
        '<div class="mk-panel-desc">สินค้าที่แสดงในหน้า Landing — filter ตามหมวดหมู่ได้</div>' +
      '</div></div>' +
      '<div class="ed-items" id="products-list"></div>' +
      '<button class="ed-add-btn" onclick="MK.addProduct()">+ เพิ่มสินค้า</button>' +
    '</div>';
    renderProductsList();
  }
  function renderProductsList() {
    var list = document.getElementById('products-list');
    if (!list) return;
    var categoryOpts = state.content.categories.map(function (c) {
      return '<option value="' + escHtml(c.id) + '">' + escHtml(c.name) + '</option>';
    }).join('');

    list.innerHTML = state.content.products.map(function (p, i) {
      var optsWithSelected = categoryOpts.replace(
        'value="' + escHtml(p.category) + '"',
        'value="' + escHtml(p.category) + '" selected'
      );
      var catSelect = '<div class="ed-group">' +
        '<label class="ed-label">หมวดหมู่</label>' +
        '<select class="ed-select" data-path="products[' + i + '].category">' +
          '<option value="">-- เลือก --</option>' + optsWithSelected +
        '</select></div>';
      return itemCard(i, p.name || 'สินค้าใหม่', [
        field('products[' + i + '].name', 'ชื่อสินค้า', p.name),
        rowFields([catSelect, field('products[' + i + '].price', 'ราคา (บาท)', p.price, 'number')]),
        textareaField('products[' + i + '].description', 'รายละเอียด', p.description),
        field('products[' + i + '].badge', 'Badge (เช่น Best Seller — เว้นว่างถ้าไม่มี)', p.badge || '')
      ], 'products', i, state.content.products.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Industries ──
  function renderIndustries(container) {
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">อุตสาหกรรม</div>' +
        '<div class="mk-panel-desc">อุตสาหกรรมที่ให้บริการ — แสดงเป็นตาราง 3 คอลัมน์</div>' +
      '</div></div>' +
      '<div class="ed-items" id="industries-list"></div>' +
      '<button class="ed-add-btn" onclick="MK.addIndustry()">+ เพิ่มอุตสาหกรรม</button>' +
    '</div>';
    renderIndustriesList();
  }
  function renderIndustriesList() {
    var list = document.getElementById('industries-list');
    if (!list) return;
    list.innerHTML = state.content.industries.map(function (ind, i) {
      return itemCard(i, ind.name || 'อุตสาหกรรมใหม่', [
        rowFields([
          field('industries[' + i + '].name', 'ชื่อ', ind.name),
          iconSelectField('industries[' + i + '].icon', 'ไอคอน', ind.icon)
        ])
      ], 'industries', i, state.content.industries.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Features ──
  function renderFeatures(container) {
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">จุดเด่น (Why Us)</div>' +
        '<div class="mk-panel-desc">เหตุผลที่ควรเลือกบริษัท</div>' +
      '</div></div>' +
      '<div class="ed-items" id="features-list"></div>' +
      '<button class="ed-add-btn" onclick="MK.addFeature()">+ เพิ่มจุดเด่น</button>' +
    '</div>';
    renderFeaturesList();
  }
  function renderFeaturesList() {
    var list = document.getElementById('features-list');
    if (!list) return;
    list.innerHTML = state.content.features.map(function (f, i) {
      return itemCard(i, f.title || 'จุดเด่นใหม่', [
        field('features[' + i + '].title', 'หัวข้อ', f.title),
        textareaField('features[' + i + '].description', 'คำอธิบาย', f.description)
      ], 'features', i, state.content.features.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Testimonials ──
  function renderTestimonials(container) {
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">Testimonials</div>' +
        '<div class="mk-panel-desc">ความคิดเห็นจากลูกค้า — สร้างความน่าเชื่อถือ</div>' +
      '</div></div>' +
      '<div class="ed-items" id="testimonials-list"></div>' +
      '<button class="ed-add-btn" onclick="MK.addTestimonial()">+ เพิ่ม Testimonial</button>' +
    '</div>';
    renderTestimonialsList();
  }
  function renderTestimonialsList() {
    var list = document.getElementById('testimonials-list');
    if (!list) return;
    list.innerHTML = state.content.testimonials.map(function (t, i) {
      return itemCard(i, t.name || 'Testimonial ใหม่', [
        rowFields([
          field('testimonials[' + i + '].name', 'ชื่อ', t.name),
          field('testimonials[' + i + '].role', 'ตำแหน่ง', t.role)
        ]),
        field('testimonials[' + i + '].company', 'บริษัท', t.company),
        textareaField('testimonials[' + i + '].quote', 'Quote', t.quote)
      ], 'testimonials', i, state.content.testimonials.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Clients ──
  function renderClients(container) {
    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head"><div>' +
        '<div class="mk-panel-title">ลูกค้าองค์กร</div>' +
        '<div class="mk-panel-desc">ชื่อลูกค้าที่ไว้วางใจเรา (แสดงเป็นแถบ)</div>' +
      '</div></div>' +
      '<div class="ed-items" id="clients-list"></div>' +
      '<button class="ed-add-btn" onclick="MK.addClient()">+ เพิ่มลูกค้า</button>' +
    '</div>';
    renderClientsList();
  }
  function renderClientsList() {
    var list = document.getElementById('clients-list');
    if (!list) return;
    list.innerHTML = state.content.clients.map(function (c, i) {
      return itemCard(i, c.name || 'ลูกค้าใหม่', [
        field('clients[' + i + '].name', 'ชื่อลูกค้า', c.name)
      ], 'clients', i, state.content.clients.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Leads (view-only) ──
  function renderLeads(container) {
    var leads = [];
    try { leads = JSON.parse(localStorage.getItem('sf7-landing-leads') || '[]'); } catch (e) {}
    var reversed = leads.slice().reverse();

    var body = '';
    if (reversed.length === 0) {
      body = '<div class="mk-empty">' +
        '<svg class="mk-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        'ยังไม่มี leads จากฟอร์มติดต่อ<br/><span style="font-size:11px">เมื่อมีผู้กรอกฟอร์มในหน้า Landing ข้อมูลจะแสดงที่นี่</span>' +
        '</div>';
    } else {
      body = '<div style="overflow-x:auto"><table class="mk-leads-table"><thead><tr>' +
        '<th>วันที่</th><th>ชื่อ</th><th>บริษัท</th><th>ติดต่อ</th><th>สนใจ</th><th>ข้อความ</th>' +
        '</tr></thead><tbody>';
      body += reversed.map(function (l) {
        var date = new Date(l.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
        return '<tr>' +
          '<td style="white-space:nowrap">' + escHtml(date) + '</td>' +
          '<td><strong>' + escHtml(l.name) + '</strong></td>' +
          '<td>' + escHtml(l.company) + '</td>' +
          '<td style="font-size:11px"><div>' + escHtml(l.email) + '</div><div style="color:var(--text2)">' + escHtml(l.phone) + '</div></td>' +
          '<td>' + escHtml(l.interest || '-') + '</td>' +
          '<td style="max-width:280px;color:var(--text2)">' + escHtml(l.message || '-') + '</td>' +
          '</tr>';
      }).join('');
      body += '</tbody></table></div>';
    }

    container.innerHTML = '<div class="mk-panel">' +
      '<div class="mk-panel-head">' +
        '<div>' +
          '<div class="mk-panel-title">Leads จากฟอร์มติดต่อ</div>' +
          '<div class="mk-panel-desc">ผู้กรอกฟอร์มใน Landing ทั้งหมด ' + reversed.length + ' รายการ</div>' +
        '</div>' +
        (reversed.length > 0 ? '<button class="btn btn-secondary" onclick="MK.exportLeads()">Export CSV</button>' : '') +
      '</div>' + body +
    '</div>';
    updateLeadsCount();
  }

  // ── Field helpers ──
  function field(path, label, value, type) {
    type = type || 'text';
    return '<div class="ed-group">' +
      '<label class="ed-label">' + label + '</label>' +
      '<input type="' + type + '" class="ed-input" data-path="' + escHtml(path) + '" value="' + escHtml(value) + '"/>' +
    '</div>';
  }
  function textareaField(path, label, value) {
    return '<div class="ed-group">' +
      '<label class="ed-label">' + label + '</label>' +
      '<textarea class="ed-textarea" data-path="' + escHtml(path) + '" rows="3">' + escHtml(value) + '</textarea>' +
    '</div>';
  }
  function iconSelectField(path, label, value) {
    var opts = ICON_OPTIONS.map(function (n) {
      return '<option value="' + n + '"' + (n === value ? ' selected' : '') + '>' + n + '</option>';
    }).join('');
    return '<div class="ed-group">' +
      '<label class="ed-label">' + label + '</label>' +
      '<select class="ed-select" data-path="' + escHtml(path) + '">' + opts + '</select>' +
    '</div>';
  }
  function rowFields(fields) { return '<div class="ed-form-row">' + fields.join('') + '</div>'; }

  function itemCard(index, title, bodyParts, listName, idx, total) {
    return '<div class="ed-item">' +
      '<div class="ed-item-head">' +
        '<div class="ed-item-title">' +
          '<span class="ed-item-num">' + (index + 1) + '</span>' +
          '<span>' + escHtml(title) + '</span>' +
        '</div>' +
        '<div class="ed-item-btns">' +
          '<button class="ed-item-btn" onclick="MK.move(\'' + listName + '\',' + idx + ',-1)" ' + (idx === 0 ? 'disabled' : '') + ' title="เลื่อนขึ้น">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' +
          '</button>' +
          '<button class="ed-item-btn" onclick="MK.move(\'' + listName + '\',' + idx + ',1)" ' + (idx === total - 1 ? 'disabled' : '') + ' title="เลื่อนลง">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<button class="ed-item-btn del" onclick="MK.remove(\'' + listName + '\',' + idx + ')" title="ลบ">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ed-form">' + bodyParts.join('') + '</div>' +
    '</div>';
  }

  function bindFieldHandlers() {
    document.querySelectorAll('[data-path]').forEach(function (input) {
      input.addEventListener('input', function () {
        setPath(state.content, input.dataset.path, castValue(input));
        markDirty();
      });
      input.addEventListener('change', function () {
        setPath(state.content, input.dataset.path, castValue(input));
        markDirty();
      });
    });
  }
  function castValue(input) {
    if (input.type === 'number') { var v = parseFloat(input.value); return isNaN(v) ? 0 : v; }
    return input.value;
  }
  function setPath(obj, path, value) {
    var parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (cur[key] == null) cur[key] = isNaN(parts[i + 1]) ? {} : [];
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
  }

  // ── Public API ──
  var MK = {
    addStat: function () { state.content.stats.push({ label: 'สถิติใหม่', value: 0, suffix: '' }); markDirty(); renderStatsList(); },
    addCategory: function () {
      state.content.categories.push({ id: window.LandingData.generateId('cat'), name: 'หมวดหมู่ใหม่', icon: 'server', description: 'คำอธิบาย' });
      markDirty(); renderCategoriesList();
    },
    addProduct: function () {
      state.content.products.push({ id: window.LandingData.generateId('p'), name: 'สินค้าใหม่', category: (state.content.categories[0] || {}).id || '', price: 0, description: 'รายละเอียด', badge: null });
      markDirty(); renderProductsList();
    },
    addIndustry: function () {
      state.content.industries.push({ id: window.LandingData.generateId('ind'), name: 'อุตสาหกรรมใหม่', icon: 'building' });
      markDirty(); renderIndustriesList();
    },
    addFeature: function () {
      state.content.features.push({ id: window.LandingData.generateId('f'), title: 'จุดเด่นใหม่', description: 'คำอธิบาย' });
      markDirty(); renderFeaturesList();
    },
    addTestimonial: function () {
      state.content.testimonials.push({ id: window.LandingData.generateId('t'), name: 'ชื่อ', role: 'ตำแหน่ง', company: 'บริษัท', quote: '' });
      markDirty(); renderTestimonialsList();
    },
    addClient: function () {
      state.content.clients.push({ id: window.LandingData.generateId('c'), name: 'ชื่อลูกค้า' });
      markDirty(); renderClientsList();
    },
    remove: function (listName, idx) {
      if (!confirm('ต้องการลบรายการนี้?')) return;
      state.content[listName].splice(idx, 1);
      markDirty(); renderTab();
    },
    move: function (listName, idx, dir) {
      var list = state.content[listName];
      var newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= list.length) return;
      var tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp;
      markDirty(); renderTab();
    },
    resetLogo: function () {
      if (!confirm('Reset logo กลับเป็น default?')) return;
      if (window.BrandLogo && window.BrandLogo.reset()) {
        refreshLogoPreview();
        if (window.toast) window.toast('Reset logo เรียบร้อย');
      }
    },
    exportLeads: function () {
      var leads = [];
      try { leads = JSON.parse(localStorage.getItem('sf7-landing-leads') || '[]'); } catch (e) {}
      if (leads.length === 0) { alert('ยังไม่มีข้อมูล'); return; }
      var headers = ['วันที่','ชื่อ','บริษัท','อีเมล','โทรศัพท์','สนใจ','ข้อความ'];
      var rows = leads.map(function (l) {
        return [l.timestamp, l.name, l.company, l.email, l.phone, l.interest || '', l.message || '']
          .map(function (v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }).join(',');
      });
      var csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'leads-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click(); URL.revokeObjectURL(url);
      if (window.toast) window.toast('Export CSV เรียบร้อย');
    }
  };
  window.MK = MK;

  // ── PB (Page Builder) global API ──
  window.PB = {
    save: function () { window.saveAll(); renderSectionsList(); },
    exportJSON: function () { window.exportContent(); },
    reset: function () { window.resetAll(); },
    moveSection: function (idx, dir) {
      // Sections order is visual only (content structure stays same)
      var newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= SECTIONS.length) return;
      var tmp = SECTIONS[idx]; SECTIONS[idx] = SECTIONS[newIdx]; SECTIONS[newIdx] = tmp;
      renderSectionsList();
    }
  };

  // ── Global actions ──
  window.saveAll = function () {
    if (window.LandingData.save(state.content)) {
      markClean();
      refreshPreview();
      if (window.toast) window.toast('บันทึกเรียบร้อย — Landing page อัพเดตทันที');
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };
  window.resetAll = function () {
    if (!confirm('Reset เนื้อหาทั้งหมดเป็นค่าเริ่มต้น?\n\nการเปลี่ยนแปลงที่ยังไม่บันทึกจะหายไป')) return;
    window.LandingData.reset();
    state.content = window.LandingData.load();
    markClean();
    renderTab();
    if (window.toast) window.toast('Reset เนื้อหาเรียบร้อย');
  };
  window.exportContent = function () {
    window.LandingData.export();
    if (window.toast) window.toast('Export JSON เรียบร้อย');
  };
  window.importContent = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (evt) {
      if (window.LandingData.import(evt.target.result)) {
        state.content = window.LandingData.load();
        markClean();
        renderTab();
        if (window.toast) window.toast('Import เรียบร้อย');
      } else {
        alert('ไฟล์ไม่ถูกต้อง');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  function updateLeadsCount() {
    var badge = document.getElementById('leads-count');
    if (!badge) return;
    var leads = [];
    try { leads = JSON.parse(localStorage.getItem('sf7-landing-leads') || '[]'); } catch (e) {}
    badge.textContent = leads.length;
    badge.style.display = leads.length > 0 ? '' : 'none';
  }

  // ── Init ──
  function init() {
    if (!window.LandingData) {
      console.error('LandingData not loaded');
      return;
    }
    state.content = window.LandingData.load();
    initTabs();
    renderTab();
    updateLeadsCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
