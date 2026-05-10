/* ══════════════════════════════════════════════════════════════
   SalesFAST 7 — Landing Page Admin CMS
   CRUD for all landing page sections
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var state = {
    content: window.LandingData.load(),
    activeTab: 'company',
    dirty: false
  };

  var ICON_OPTIONS = ['server','wifi','database','cloud','shield','tool','bank','heart','factory','shop','school','building','users','target','clock','award','trending','phone','mail','map'];

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function markDirty() {
    state.dirty = true;
    var badge = document.getElementById('saved-badge');
    if (badge) {
      badge.textContent = 'ยังไม่ได้บันทึก';
      badge.classList.add('unsaved');
    }
  }

  function markClean() {
    state.dirty = false;
    var badge = document.getElementById('saved-badge');
    if (badge) {
      badge.textContent = 'บันทึกแล้ว';
      badge.classList.remove('unsaved');
    }
  }

  function toast(msg, type) {
    var t = document.getElementById('adm-toast');
    if (!t) return;
    t.querySelector('.adm-toast-msg').textContent = msg;
    t.classList.remove('error');
    if (type === 'error') t.classList.add('error');
    t.querySelector('.adm-toast-icon').textContent = type === 'error' ? '✕' : '✓';
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 3000);
  }

  // ══════════════════════════════════════════════
  // Tab navigation
  // ══════════════════════════════════════════════
  function initTabs() {
    document.querySelectorAll('.adm-nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.adm-nav-item').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.activeTab = btn.dataset.tab;
        renderTab();
      });
    });
  }

  // ══════════════════════════════════════════════
  // Render current tab
  // ══════════════════════════════════════════════
  function renderTab() {
    var main = document.getElementById('adm-main');
    switch (state.activeTab) {
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

  // ── Company ──
  function renderCompany(container) {
    var c = state.content.company;
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">ข้อมูลบริษัท</div>' +
        '<div class="adm-panel-desc">ข้อมูลที่จะแสดงใน header, footer และหน้า contact</div>' +
      '</div></div>' +
      '<div class="adm-form">' +
        field('company.name', 'ชื่อบริษัท', c.name) +
        field('company.tagline', 'Tagline (คำขวัญสั้นๆ)', c.tagline) +
        textareaField('company.description', 'คำอธิบายบริษัท', c.description) +
        rowFields([
          field('company.phone', 'โทรศัพท์', c.phone),
          field('company.email', 'อีเมล', c.email)
        ]) +
        field('company.address', 'ที่อยู่', c.address) +
        field('company.foundedYear', 'ปีก่อตั้ง', c.foundedYear, 'number') +
      '</div>' +
    '</div>';
    bindFieldHandlers();
  }

  // ── Hero ──
  function renderHero(container) {
    var h = state.content.hero;
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">Hero Section</div>' +
        '<div class="adm-panel-desc">ส่วนหัวของหน้า landing page ที่ผู้เข้าชมเห็นเป็นอย่างแรก</div>' +
      '</div></div>' +
      '<div class="adm-form">' +
        field('hero.badge', 'Badge (แถบเล็กด้านบน)', h.badge) +
        textareaField('hero.title', 'หัวข้อหลัก (รองรับ HTML: &lt;br/&gt; และ &lt;span class="ln-gradient"&gt;)', h.title) +
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
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">สถิติ</div>' +
        '<div class="adm-panel-desc">ตัวเลขที่แสดงผลงานและความน่าเชื่อถือของบริษัท (แนะนำ 4 รายการ)</div>' +
      '</div></div>' +
      '<div class="adm-list" id="stats-list"></div>' +
      '<button class="adm-add-btn" onclick="Admin.addStat()" style="margin-top:12px">+ เพิ่มสถิติ</button>' +
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
          field('stats[' + i + '].suffix', 'Suffix (เช่น %, +, x)', s.suffix)
        ]),
        field('stats[' + i + '].label', 'ข้อความบรรยาย', s.label)
      ], 'stats', i, state.content.stats.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Categories ──
  function renderCategories(container) {
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">หมวดหมู่สินค้า</div>' +
        '<div class="adm-panel-desc">กลุ่มสินค้าและบริการที่บริษัทขาย — ใช้ในส่วน Solutions และเป็น filter ของ Products</div>' +
      '</div></div>' +
      '<div class="adm-list" id="categories-list"></div>' +
      '<button class="adm-add-btn" onclick="Admin.addCategory()" style="margin-top:12px">+ เพิ่มหมวดหมู่</button>' +
    '</div>';
    renderCategoriesList();
  }

  function renderCategoriesList() {
    var list = document.getElementById('categories-list');
    if (!list) return;
    list.innerHTML = state.content.categories.map(function (cat, i) {
      return itemCard(i, cat.name || 'หมวดหมู่ใหม่', [
        rowFields([
          field('categories[' + i + '].name', 'ชื่อหมวดหมู่', cat.name),
          iconSelectField('categories[' + i + '].icon', 'ไอคอน', cat.icon)
        ]),
        field('categories[' + i + '].id', 'ID (ใช้อ้างอิงจากสินค้า) — ไม่ควรแก้ไขถ้ามีสินค้าใช้อยู่', cat.id),
        textareaField('categories[' + i + '].description', 'คำอธิบาย', cat.description)
      ], 'categories', i, state.content.categories.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Products ──
  function renderProducts(container) {
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">สินค้า</div>' +
        '<div class="adm-panel-desc">สินค้าที่จะแสดงในหน้า Landing — สามารถ filter ตามหมวดหมู่ได้</div>' +
      '</div></div>' +
      '<div class="adm-list" id="products-list"></div>' +
      '<button class="adm-add-btn" onclick="Admin.addProduct()" style="margin-top:12px">+ เพิ่มสินค้า</button>' +
    '</div>';
    renderProductsList();
  }

  function renderProductsList() {
    var list = document.getElementById('products-list');
    if (!list) return;
    var categoryOpts = state.content.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
    }).join('');

    list.innerHTML = state.content.products.map(function (p, i) {
      var catSelect = '<div class="adm-form-group">' +
        '<label class="adm-form-label">หมวดหมู่</label>' +
        '<select class="adm-select" data-path="products[' + i + '].category">' +
          '<option value="">-- เลือก --</option>' +
          categoryOpts.replace('value="' + esc(p.category) + '"', 'value="' + esc(p.category) + '" selected') +
        '</select></div>';
      return itemCard(i, p.name || 'สินค้าใหม่', [
        field('products[' + i + '].name', 'ชื่อสินค้า', p.name),
        rowFields([
          catSelect,
          field('products[' + i + '].price', 'ราคา (บาท)', p.price, 'number')
        ]),
        textareaField('products[' + i + '].description', 'รายละเอียด', p.description),
        field('products[' + i + '].badge', 'Badge (เช่น "Best Seller", "Popular" — เว้นว่างถ้าไม่มี)', p.badge || '')
      ], 'products', i, state.content.products.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Industries ──
  function renderIndustries(container) {
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">อุตสาหกรรม</div>' +
        '<div class="adm-panel-desc">อุตสาหกรรมที่บริษัทให้บริการ แสดงเป็นตาราง 3 คอลัมน์</div>' +
      '</div></div>' +
      '<div class="adm-list" id="industries-list"></div>' +
      '<button class="adm-add-btn" onclick="Admin.addIndustry()" style="margin-top:12px">+ เพิ่มอุตสาหกรรม</button>' +
    '</div>';
    renderIndustriesList();
  }

  function renderIndustriesList() {
    var list = document.getElementById('industries-list');
    if (!list) return;
    list.innerHTML = state.content.industries.map(function (ind, i) {
      return itemCard(i, ind.name || 'อุตสาหกรรมใหม่', [
        rowFields([
          field('industries[' + i + '].name', 'ชื่ออุตสาหกรรม', ind.name),
          iconSelectField('industries[' + i + '].icon', 'ไอคอน', ind.icon)
        ])
      ], 'industries', i, state.content.industries.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Features ──
  function renderFeatures(container) {
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">จุดเด่น (Why Us)</div>' +
        '<div class="adm-panel-desc">เหตุผลที่ลูกค้าควรเลือกบริษัท — แสดงเป็นการ์ด 3 คอลัมน์</div>' +
      '</div></div>' +
      '<div class="adm-list" id="features-list"></div>' +
      '<button class="adm-add-btn" onclick="Admin.addFeature()" style="margin-top:12px">+ เพิ่มจุดเด่น</button>' +
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
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">Testimonials</div>' +
        '<div class="adm-panel-desc">ความคิดเห็นจากลูกค้า สร้างความน่าเชื่อถือ (Social Proof)</div>' +
      '</div></div>' +
      '<div class="adm-list" id="testimonials-list"></div>' +
      '<button class="adm-add-btn" onclick="Admin.addTestimonial()" style="margin-top:12px">+ เพิ่ม Testimonial</button>' +
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
        textareaField('testimonials[' + i + '].quote', 'ข้อความ (Quote)', t.quote)
      ], 'testimonials', i, state.content.testimonials.length);
    }).join('');
    bindFieldHandlers();
  }

  // ── Clients ──
  function renderClients(container) {
    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head"><div>' +
        '<div class="adm-panel-title">ลูกค้าองค์กร</div>' +
        '<div class="adm-panel-desc">ชื่อลูกค้าองค์กรที่ไว้วางใจเรา (แสดงเป็นแถบโลโก้)</div>' +
      '</div></div>' +
      '<div class="adm-list" id="clients-list"></div>' +
      '<button class="adm-add-btn" onclick="Admin.addClient()" style="margin-top:12px">+ เพิ่มลูกค้า</button>' +
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
    leads.reverse(); // newest first

    var body = '';
    if (leads.length === 0) {
      body = '<div class="adm-empty">' +
        '<svg class="adm-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        'ยังไม่มี leads จากฟอร์มติดต่อ<br/><span style="font-size:12px">เมื่อมีผู้กรอกฟอร์มในหน้า Landing ข้อมูลจะแสดงที่นี่</span>' +
        '</div>';
    } else {
      body = '<div style="overflow-x:auto"><table class="adm-leads-table"><thead><tr>' +
        '<th>วันที่</th><th>ชื่อ</th><th>บริษัท</th><th>ติดต่อ</th><th>สนใจ</th><th>ข้อความ</th>' +
        '</tr></thead><tbody>';
      body += leads.map(function (l) {
        var date = new Date(l.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
        return '<tr>' +
          '<td style="white-space:nowrap">' + esc(date) + '</td>' +
          '<td><strong>' + esc(l.name) + '</strong></td>' +
          '<td>' + esc(l.company) + '</td>' +
          '<td style="font-size:12px"><div>' + esc(l.email) + '</div><div style="color:var(--adm-text-2)">' + esc(l.phone) + '</div></td>' +
          '<td>' + esc(l.interest || '-') + '</td>' +
          '<td style="max-width:300px;color:var(--adm-text-2)">' + esc(l.message || '-') + '</td>' +
        '</tr>';
      }).join('');
      body += '</tbody></table></div>';
    }

    container.innerHTML = '<div class="adm-panel">' +
      '<div class="adm-panel-head">' +
        '<div>' +
          '<div class="adm-panel-title">Leads จากฟอร์มติดต่อ</div>' +
          '<div class="adm-panel-desc">ผู้ที่กรอกฟอร์มติดต่อในหน้า Landing ทั้งหมด ' + leads.length + ' รายการ</div>' +
        '</div>' +
        (leads.length > 0 ? '<button class="adm-btn adm-btn-ghost" onclick="Admin.exportLeads()">Export CSV</button>' : '') +
      '</div>' +
      body +
    '</div>';
    updateLeadsCount();
  }

  // ══════════════════════════════════════════════
  // Field helpers
  // ══════════════════════════════════════════════
  function field(path, label, value, type) {
    type = type || 'text';
    return '<div class="adm-form-group">' +
      '<label class="adm-form-label">' + label + '</label>' +
      '<input type="' + type + '" class="adm-input" data-path="' + esc(path) + '" value="' + esc(value) + '"/>' +
    '</div>';
  }

  function textareaField(path, label, value) {
    return '<div class="adm-form-group">' +
      '<label class="adm-form-label">' + label + '</label>' +
      '<textarea class="adm-textarea" data-path="' + esc(path) + '" rows="3">' + esc(value) + '</textarea>' +
    '</div>';
  }

  function iconSelectField(path, label, value) {
    var opts = ICON_OPTIONS.map(function (n) {
      return '<option value="' + n + '"' + (n === value ? ' selected' : '') + '>' + n + '</option>';
    }).join('');
    return '<div class="adm-form-group">' +
      '<label class="adm-form-label">' + label + '</label>' +
      '<select class="adm-select" data-path="' + esc(path) + '">' + opts + '</select>' +
    '</div>';
  }

  function rowFields(fields) {
    return '<div class="adm-form-row">' + fields.join('') + '</div>';
  }

  function itemCard(index, title, bodyParts, listName, idx, total) {
    return '<div class="adm-item" data-idx="' + index + '">' +
      '<div class="adm-item-head">' +
        '<div class="adm-item-title">' +
          '<span class="adm-item-number">' + (index + 1) + '</span>' +
          '<span>' + esc(title) + '</span>' +
        '</div>' +
        '<div class="adm-item-actions">' +
          '<button class="adm-icon-btn adm-move-up" onclick="Admin.move(\'' + listName + '\',' + idx + ',-1)" ' + (idx === 0 ? 'disabled' : '') + ' title="เลื่อนขึ้น">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' +
          '</button>' +
          '<button class="adm-icon-btn adm-move-down" onclick="Admin.move(\'' + listName + '\',' + idx + ',1)" ' + (idx === total - 1 ? 'disabled' : '') + ' title="เลื่อนลง">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<button class="adm-icon-btn adm-del" onclick="Admin.remove(\'' + listName + '\',' + idx + ')" title="ลบ">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="adm-form">' + bodyParts.join('') + '</div>' +
    '</div>';
  }

  // Bind input change to state
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
    if (input.type === 'number') {
      var v = parseFloat(input.value);
      return isNaN(v) ? 0 : v;
    }
    return input.value;
  }

  // Set nested value by path like "stats[0].value"
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

  // ══════════════════════════════════════════════
  // Actions (add/remove/move)
  // ══════════════════════════════════════════════
  var Admin = {
    addStat: function () {
      state.content.stats.push({ label: 'สถิติใหม่', value: 0, suffix: '' });
      markDirty(); renderStatsList();
    },
    addCategory: function () {
      state.content.categories.push({
        id: window.LandingData.generateId('cat'),
        name: 'หมวดหมู่ใหม่', icon: 'server', description: 'คำอธิบาย'
      });
      markDirty(); renderCategoriesList();
    },
    addProduct: function () {
      state.content.products.push({
        id: window.LandingData.generateId('p'),
        name: 'สินค้าใหม่', category: (state.content.categories[0] || {}).id || '',
        price: 0, description: 'รายละเอียดสินค้า', badge: null
      });
      markDirty(); renderProductsList();
    },
    addIndustry: function () {
      state.content.industries.push({
        id: window.LandingData.generateId('ind'),
        name: 'อุตสาหกรรมใหม่', icon: 'building'
      });
      markDirty(); renderIndustriesList();
    },
    addFeature: function () {
      state.content.features.push({
        id: window.LandingData.generateId('f'),
        title: 'จุดเด่นใหม่', description: 'คำอธิบาย'
      });
      markDirty(); renderFeaturesList();
    },
    addTestimonial: function () {
      state.content.testimonials.push({
        id: window.LandingData.generateId('t'),
        name: 'ชื่อลูกค้า', role: 'ตำแหน่ง', company: 'บริษัท', quote: 'ความคิดเห็น...'
      });
      markDirty(); renderTestimonialsList();
    },
    addClient: function () {
      state.content.clients.push({
        id: window.LandingData.generateId('c'),
        name: 'ชื่อลูกค้า'
      });
      markDirty(); renderClientsList();
    },
    remove: function (listName, idx) {
      if (!confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) return;
      state.content[listName].splice(idx, 1);
      markDirty();
      renderTab();
    },
    move: function (listName, idx, dir) {
      var list = state.content[listName];
      var newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= list.length) return;
      var tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp;
      markDirty();
      renderTab();
    },
    exportLeads: function () {
      var leads = [];
      try { leads = JSON.parse(localStorage.getItem('sf7-landing-leads') || '[]'); } catch (e) {}
      if (leads.length === 0) return toast('ยังไม่มีข้อมูล', 'error');
      var headers = ['วันที่','ชื่อ','บริษัท','อีเมล','โทรศัพท์','สนใจ','ข้อความ'];
      var rows = leads.map(function (l) {
        return [l.timestamp, l.name, l.company, l.email, l.phone, l.interest || '', l.message || '']
          .map(function (v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; })
          .join(',');
      });
      var csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'leads-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click(); URL.revokeObjectURL(url);
      toast('Export เรียบร้อย');
    }
  };
  window.Admin = Admin;

  // ══════════════════════════════════════════════
  // Global actions (Save/Reset/Import/Export)
  // ══════════════════════════════════════════════
  window.saveAll = function () {
    if (window.LandingData.save(state.content)) {
      markClean();
      toast('บันทึกเรียบร้อย — หน้า Landing จะอัพเดตทันที');
    } else {
      toast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  };

  window.resetAll = function () {
    if (!confirm('ต้องการคืนค่าทั้งหมดกลับไปเป็นค่าเริ่มต้นใช่หรือไม่?\n\nการเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป')) return;
    window.LandingData.reset();
    state.content = window.LandingData.load();
    markClean();
    renderTab();
    toast('คืนค่าเรียบร้อย');
  };

  window.exportContent = function () {
    window.LandingData.export();
    toast('Export เรียบร้อย');
  };

  window.importTrigger = function () {
    document.getElementById('import-file').click();
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
        toast('Import เรียบร้อย');
      } else {
        toast('ไฟล์ไม่ถูกต้อง', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Warn before leaving if dirty
  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function updateLeadsCount() {
    var badge = document.getElementById('leads-count');
    if (!badge) return;
    var leads = [];
    try { leads = JSON.parse(localStorage.getItem('sf7-landing-leads') || '[]'); } catch (e) {}
    badge.textContent = leads.length;
    badge.style.display = leads.length > 0 ? '' : 'none';
  }

  // Init
  initTabs();
  renderTab();
  updateLeadsCount();
})();
