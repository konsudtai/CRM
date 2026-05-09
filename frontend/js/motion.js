/* ══════════════════════════════════════════════════════════════
   SalesFAST 7 — Motion System
   Scroll-triggered animations using Intersection Observer
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Intersection Observer for scroll-triggered reveals ──
  var observerOptions = {
    root: null,
    rootMargin: '-40px',
    threshold: 0.1
  };

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Unobserve after revealing (animate once)
        revealObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // ── Initialize: observe all reveal elements ──
  function initMotion() {
    // Observe elements with reveal classes
    var revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-scale');
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });

    // Auto-apply reveal to common elements if not already animated
    autoRevealElements();
  }

  // ── Auto-apply reveal animations to common page elements ──
  function autoRevealElements() {
    // KPI cards — stagger
    var kpiGrid = document.querySelector('.dk-kpi, .kpi-grid');
    if (kpiGrid && !kpiGrid.classList.contains('stagger')) {
      kpiGrid.classList.add('stagger');
      Array.from(kpiGrid.children).forEach(function (child) {
        if (!child.classList.contains('reveal') && !child.classList.contains('visible')) {
          child.classList.add('reveal');
          revealObserver.observe(child);
        }
      });
    }

    // Dashboard cards — stagger
    var cardGrids = document.querySelectorAll('.dk-g2, .dk-g3, .dk-g32');
    cardGrids.forEach(function (grid) {
      if (!grid.classList.contains('stagger')) {
        grid.classList.add('stagger');
        Array.from(grid.children).forEach(function (child) {
          if (!child.classList.contains('reveal')) {
            child.classList.add('reveal');
            revealObserver.observe(child);
          }
        });
      }
    });

    // Quick action buttons — stagger
    var qaGrid = document.querySelector('.qa-grid');
    if (qaGrid && !qaGrid.classList.contains('stagger')) {
      qaGrid.classList.add('stagger');
      Array.from(qaGrid.children).forEach(function (child) {
        if (!child.classList.contains('reveal')) {
          child.classList.add('reveal-scale');
          revealObserver.observe(child);
        }
      });
    }

    // Kanban columns — stagger
    var kanbanWrap = document.querySelector('.kanban, .kk-wrap');
    if (kanbanWrap && !kanbanWrap.classList.contains('stagger')) {
      kanbanWrap.classList.add('stagger');
      Array.from(kanbanWrap.children).forEach(function (child) {
        if (!child.classList.contains('reveal')) {
          child.classList.add('reveal');
          revealObserver.observe(child);
        }
      });
    }

    // Cards with class .card or .dk-card — hover effect
    var cards = document.querySelectorAll('.card, .dk-card');
    cards.forEach(function (card) {
      if (!card.classList.contains('card-hover')) {
        card.classList.add('card-hover');
      }
    });

    // Table rows — subtle reveal
    var tables = document.querySelectorAll('.dk-tbl tbody, .sf7-table tbody, table tbody');
    tables.forEach(function (tbody) {
      var rows = tbody.querySelectorAll('tr');
      rows.forEach(function (row, i) {
        if (i < 20 && !row.classList.contains('reveal')) {
          row.classList.add('reveal');
          row.style.transitionDelay = (i * 0.03) + 's';
          revealObserver.observe(row);
        }
      });
    });

    // Pipeline bars — animate width
    var barFills = document.querySelectorAll('.dk-bar-fill, .dk-agent-fill, .funnel-fill');
    barFills.forEach(function (bar) {
      if (!bar.dataset.animated) {
        var width = bar.style.width;
        bar.style.setProperty('--bar-width', width);
        bar.style.width = '0';
        bar.dataset.animated = '1';

        var barObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              setTimeout(function () {
                bar.style.width = width;
                bar.style.transition = 'width .8s cubic-bezier(.25,.1,.25,1)';
              }, 100);
              barObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.2 });
        barObserver.observe(bar);
      }
    });
  }

  // ── Run on DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMotion);
  } else {
    // DOM already loaded, run after a tick to let other scripts render
    setTimeout(initMotion, 50);
  }

  // ── Re-run after dynamic content loads (for SPA-like behavior) ──
  // MutationObserver to catch dynamically added content
  var bodyObserver = new MutationObserver(function (mutations) {
    var hasNewNodes = mutations.some(function (m) { return m.addedNodes.length > 0; });
    if (hasNewNodes) {
      // Debounce
      clearTimeout(bodyObserver._timer);
      bodyObserver._timer = setTimeout(autoRevealElements, 100);
    }
  });

  // Start observing after init
  setTimeout(function () {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }, 500);

  // Export for manual use
  window.sfMotion = {
    reveal: function (el) {
      if (el) { el.classList.add('reveal'); revealObserver.observe(el); }
    },
    revealAll: autoRevealElements
  };
})();
