/* ══════════════════════════════════════════════════════════════
   SalesFAST 7 — Landing Page Renderer
   Renders content from LandingData (localStorage-backed)
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderAll() {
    var content = window.LandingData.load();

    // ── Company info ──
    setText('company-name', content.company.name);
    setText('company-tag', content.company.tagline);
    setText('company-desc', content.company.description);
    setText('contact-phone', content.company.phone);
    setText('contact-email', content.company.email);
    setText('contact-address', content.company.address);
    setAttr('contact-phone', 'href', 'tel:' + (content.company.phone || '').replace(/[^0-9+]/g, ''));
    setAttr('contact-email', 'href', 'mailto:' + (content.company.email || ''));
    var footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = new Date().getFullYear();
    var footerNames = document.querySelectorAll('.ln-footer-name');
    footerNames.forEach(function (el) { el.textContent = content.company.name; });
    document.title = content.company.name + ' — ' + content.company.tagline;

    // ── Hero ──
    setHTML('hero-badge', esc(content.hero.badge));
    setHTML('hero-title', content.hero.title); // allow HTML <br/> and <span>
    setText('hero-subtitle', content.hero.subtitle);
    setText('hero-cta-primary', content.hero.ctaPrimary);
    setText('hero-cta-secondary', content.hero.ctaSecondary);

    // ── Trust icons ──
    setHTML('icon-award', window.Icons.get('award', 16));
    setHTML('icon-clock', window.Icons.get('clock', 16));
    setHTML('icon-shield', window.Icons.get('shield', 16));
    setHTML('icon-phone', window.Icons.get('phone', 22));
    setHTML('icon-mail', window.Icons.get('mail', 22));
    setHTML('icon-map', window.Icons.get('map', 22));

    // ── Stats ──
    var statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
      statsGrid.className = 'ln-stats-grid stagger';
      statsGrid.innerHTML = content.stats.map(function (s) {
        return '<div class="ln-stat">' +
          '<div class="ln-stat-num" data-target="' + s.value + '" data-suffix="' + esc(s.suffix || '') + '">0' + esc(s.suffix || '') + '</div>' +
          '<div class="ln-stat-label">' + esc(s.label) + '</div>' +
          '</div>';
      }).join('');
    }

    // ── Clients ──
    var clientsTrack = document.getElementById('clients-track');
    if (clientsTrack) {
      clientsTrack.innerHTML = content.clients.map(function (c) {
        return '<div class="ln-client-item">' + esc(c.name) + '</div>';
      }).join('');
    }

    // ── Solutions ──
    var solGrid = document.getElementById('solutions-grid');
    if (solGrid) {
      solGrid.className = 'ln-solutions-grid stagger';
      solGrid.innerHTML = content.categories.map(function (cat) {
        return '<div class="ln-solution-card">' +
          '<div class="ln-solution-icon">' + window.Icons.get(cat.icon, 28) + '</div>' +
          '<h3 class="ln-solution-title">' + esc(cat.name) + '</h3>' +
          '<p class="ln-solution-desc">' + esc(cat.description) + '</p>' +
          '</div>';
      }).join('');
    }

    // ── Product filters ──
    var filterBar = document.getElementById('product-filters');
    if (filterBar) {
      var filterHTML = '<button class="ln-pf-btn active" data-cat="all">ทั้งหมด</button>';
      filterHTML += content.categories.map(function (cat) {
        return '<button class="ln-pf-btn" data-cat="' + esc(cat.id) + '">' + esc(cat.name) + '</button>';
      }).join('');
      filterBar.innerHTML = filterHTML;
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('.ln-pf-btn');
        if (!btn) return;
        filterBar.querySelectorAll('.ln-pf-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderProducts(content, btn.dataset.cat);
      });
    }
    renderProducts(content, 'all');

    // ── Industries ──
    var indGrid = document.getElementById('industries-grid');
    if (indGrid) {
      indGrid.className = 'ln-industries-grid stagger';
      indGrid.innerHTML = content.industries.map(function (i) {
        return '<div class="ln-industry-card">' +
          '<div class="ln-industry-icon">' + window.Icons.get(i.icon, 24) + '</div>' +
          '<span class="ln-industry-name">' + esc(i.name) + '</span>' +
          '</div>';
      }).join('');
    }

    // ── Features ──
    var featGrid = document.getElementById('features-grid');
    if (featGrid) {
      featGrid.className = 'ln-features-grid stagger';
      featGrid.innerHTML = content.features.map(function (f, i) {
        return '<div class="ln-feature-card">' +
          '<div class="ln-feature-num">' + (i + 1).toString().padStart(2, '0') + '</div>' +
          '<h3 class="ln-feature-title">' + esc(f.title) + '</h3>' +
          '<p class="ln-feature-desc">' + esc(f.description) + '</p>' +
          '</div>';
      }).join('');
    }

    // ── Testimonials ──
    var testGrid = document.getElementById('testimonials-grid');
    if (testGrid) {
      testGrid.className = 'ln-testimonials-grid stagger';
      testGrid.innerHTML = content.testimonials.map(function (t) {
        var initials = (t.name || '').split(' ').map(function (p) { return p.charAt(0); }).slice(0, 2).join('');
        return '<div class="ln-testimonial">' +
          '<div class="ln-testimonial-stars">' +
            Array(5).fill(0).map(function () { return window.Icons.get('star', 16); }).join('') +
          '</div>' +
          '<p class="ln-testimonial-quote">' + esc(t.quote) + '</p>' +
          '<div class="ln-testimonial-author">' +
            '<div class="ln-testimonial-avatar">' + esc(initials) + '</div>' +
            '<div>' +
              '<div class="ln-testimonial-name">' + esc(t.name) + '</div>' +
              '<div class="ln-testimonial-role">' + esc(t.role) + ' · ' + esc(t.company) + '</div>' +
            '</div>' +
          '</div>' +
          '</div>';
      }).join('');
    }

    // Re-observe reveal elements after re-rendering
    observeReveals();
  }

  function renderProducts(content, categoryId) {
    var grid = document.getElementById('products-grid');
    if (!grid) return;
    var items = categoryId === 'all'
      ? content.products
      : content.products.filter(function (p) { return p.category === categoryId; });

    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--ln-text-3);font-size:14px">ไม่พบสินค้าในหมวดหมู่นี้</div>';
      return;
    }

    grid.className = 'ln-products-grid stagger';
    grid.innerHTML = items.map(function (p) {
      var cat = content.categories.find(function (c) { return c.id === p.category; });
      var iconName = cat ? cat.icon : 'server';
      var categoryName = cat ? cat.name : '';
      return '<div class="ln-product-card">' +
        '<div class="ln-product-image">' +
          window.Icons.get(iconName) +
          (p.badge ? '<span class="ln-product-badge">' + esc(p.badge) + '</span>' : '') +
        '</div>' +
        '<div class="ln-product-body">' +
          '<div class="ln-product-category">' + esc(categoryName) + '</div>' +
          '<h3 class="ln-product-name">' + esc(p.name) + '</h3>' +
          '<p class="ln-product-desc">' + esc(p.description) + '</p>' +
          '<div class="ln-product-foot">' +
            '<span class="ln-product-price">' + window.LandingData.formatPrice(p.price) + '</span>' +
            '<a href="#contact" class="ln-product-cta">สอบถาม ' + window.Icons.get('chevron_right', 14) + '</a>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    observeReveals();
  }

  // ── Helpers ──
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }
  function setHTML(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value || '';
  }
  function setAttr(id, attr, value) {
    var el = document.getElementById(id);
    if (el) el.setAttribute(attr, value || '');
  }

  // ── Scroll-triggered reveals ──
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
        if (entry.target.classList.contains('ln-stats-grid')) {
          animateStats();
        }
      }
    });
  }, { threshold: 0.15, rootMargin: '-40px' });

  function observeReveals() {
    document.querySelectorAll('.reveal:not(.visible), .stagger:not(.visible)').forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  // ── Stat number count-up ──
  function animateStats() {
    document.querySelectorAll('.ln-stat-num').forEach(function (el) {
      var target = parseInt(el.dataset.target, 10) || 0;
      var suffix = el.dataset.suffix || '';
      var duration = 1500;
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(ease * target).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ── Nav scroll effect ──
  function initNav() {
    var nav = document.getElementById('ln-nav');
    if (!nav) return;
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 30);
    });

    // Mobile menu toggle
    var burger = document.getElementById('ln-burger');
    var mobileMenu = document.getElementById('ln-nav-mobile');
    if (burger && mobileMenu) {
      burger.addEventListener('click', function () {
        burger.classList.toggle('open');
        mobileMenu.classList.toggle('open');
      });
      // Close mobile menu when clicking a link
      mobileMenu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          burger.classList.remove('open');
          mobileMenu.classList.remove('open');
        });
      });
    }
  }

  // ── Contact form submit ──
  window.submitContactForm = function (e) {
    e.preventDefault();
    var form = e.target;
    var data = {
      name: form.name.value,
      company: form.company.value,
      email: form.email.value,
      phone: form.phone.value,
      interest: form.interest.value,
      message: form.message.value,
      timestamp: new Date().toISOString()
    };
    // Save to localStorage (admin can view)
    try {
      var leads = JSON.parse(localStorage.getItem('sf7-landing-leads') || '[]');
      leads.push(data);
      localStorage.setItem('sf7-landing-leads', JSON.stringify(leads));
    } catch (err) { /* ignore */ }

    // TODO: POST to /api/leads/contact-form when backend endpoint is ready

    form.reset();
    showToast();
    return false;
  };

  function showToast() {
    var toast = document.getElementById('ln-toast');
    if (!toast) return;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 4000);
  }

  // ── Init ──
  function init() {
    renderAll();
    initNav();
    observeReveals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Live update when admin saves
  window.addEventListener('landing-content-changed', renderAll);
  window.addEventListener('storage', function (e) {
    if (e.key === 'sf7-landing-content-v1') renderAll();
  });
})();
