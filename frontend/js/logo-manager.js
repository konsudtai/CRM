/* ══════════════════════════════════════════════════════════════
   SalesFAST 7 — Logo Manager
   Handles logo upload (base64 in localStorage) used across CRM + Landing
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var STORAGE_KEY = 'sf7-brand-logo-v1';
  var DEFAULT_LOGO_PATH = 'logo.png'; // fallback file-based logo

  // ── Load logo URL (data URI if uploaded, else fallback path) ──
  function getLogoUrl(fallbackPath) {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    } catch (e) {}
    return fallbackPath || DEFAULT_LOGO_PATH;
  }

  // ── Save logo (accepts File object or dataURL string) ──
  function saveLogo(input) {
    return new Promise(function (resolve, reject) {
      if (!input) return reject(new Error('No input'));
      if (typeof input === 'string') {
        try {
          localStorage.setItem(STORAGE_KEY, input);
          broadcast();
          return resolve(input);
        } catch (e) { return reject(e); }
      }
      // File or Blob
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var dataUrl = e.target.result;
          localStorage.setItem(STORAGE_KEY, dataUrl);
          broadcast();
          resolve(dataUrl);
        } catch (err) { reject(err); }
      };
      reader.onerror = function () { reject(new Error('Failed to read file')); };
      reader.readAsDataURL(input);
    });
  }

  // ── Reset to default ──
  function resetLogo() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      broadcast();
      return true;
    } catch (e) { return false; }
  }

  // ── Check if custom logo exists ──
  function hasCustomLogo() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
  }

  function broadcast() {
    window.dispatchEvent(new CustomEvent('brand-logo-changed'));
  }

  // ── Apply to all img.brand-logo elements ──
  // If custom logo exists → show img + hide text-only fallback
  // If no custom logo → hide img (text-only like default CRM)
  function apply(fallbackPath) {
    var hasCustom = hasCustomLogo();
    var url = getLogoUrl(fallbackPath);
    document.querySelectorAll('[data-brand-logo]').forEach(function (el) {
      if (el.tagName === 'IMG') {
        if (hasCustom) {
          el.src = url;
          el.style.display = '';
        } else {
          el.removeAttribute('src');
          el.style.display = 'none';
        }
      } else {
        if (hasCustom) {
          el.style.backgroundImage = 'url(' + url + ')';
          el.style.display = '';
        } else {
          el.style.backgroundImage = 'none';
          el.style.display = 'none';
        }
      }
    });
  }

  // Auto-apply on load + on change
  window.addEventListener('brand-logo-changed', function () { apply(); });
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) apply();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(); });
  } else {
    apply();
  }

  window.BrandLogo = {
    get: getLogoUrl,
    save: saveLogo,
    reset: resetLogo,
    hasCustom: hasCustomLogo,
    apply: apply
  };
})();
