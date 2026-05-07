/* Customer Search for Lead creation — calls real API */
var selectedAccountId = null;
var selectedAccountData = null;

async function searchCustomer(q) {
  var results = document.getElementById('fl-customer-results');
  if (!q || q.length < 1) { results.style.display = 'none'; return; }
  try {
    var res = await apiFetch('/accounts?search=' + encodeURIComponent(q) + '&limit=6');
    var matches = res.data || res || [];
    if (matches.length === 0) {
      results.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text3);text-align:center">No customers found</div>';
    } else {
      results.innerHTML = matches.map(function(a) {
        return '<div onclick="selectCustomer(\'' + a.id + '\')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseover="this.style.background=\'var(--row-hover)\'" onmouseout="this.style.background=\'transparent\'">' +
          '<div style="font-size:13px;font-weight:600"><span style="color:var(--sf-blue);font-family:monospace;font-size:11px;margin-right:6px">' + esc(a.customer_code||'') + '</span>' + esc(a.company_name||'') + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">' + esc(a.industry||'') + ' / ' + esc(a.phone||'-') + (a.tax_id ? ' / Tax: ' + esc(a.tax_id) : '') + '</div>' +
        '</div>';
      }).join('');
    }
    results.style.display = 'block';
  } catch(e) { results.style.display = 'none'; }
}

async function selectCustomer(id) {
  try {
    var a = await apiFetch('/accounts/' + id);
    if (!a) return;
    selectedAccountId = id;
    selectedAccountData = a;

    // Hide search, show selected card
    var searchInput = document.getElementById('fl-customer-search');
    var searchResults = document.getElementById('fl-customer-results');
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.style.display = 'none';

    // Build selected customer card with full detail
    var selBox = document.getElementById('fl-customer-selected');
    if (selBox) {
      var contact = (a.contacts && a.contacts.length > 0) ? a.contacts[0] : null;
      var html = '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div style="flex:1">' +
          '<div style="font-size:14px;font-weight:700;margin-bottom:6px">' +
            '<span style="color:var(--sf-blue);font-family:monospace;font-size:12px;margin-right:6px">' + esc(a.customer_code||'') + '</span>' +
            esc(a.company_name||'') +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px">';

      if (a.industry) html += '<div><span style="color:var(--text3)">Industry:</span> ' + esc(a.industry) + '</div>';
      if (a.tax_id) html += '<div><span style="color:var(--text3)">Tax ID:</span> ' + esc(a.tax_id) + '</div>';
      if (a.phone) html += '<div><span style="color:var(--text3)">Phone:</span> ' + esc(a.phone) + '</div>';
      if (a.email) html += '<div><span style="color:var(--text3)">Email:</span> ' + esc(a.email) + '</div>';
      if (a.address) html += '<div style="grid-column:1/-1"><span style="color:var(--text3)">Address:</span> ' + esc(a.address) + (a.district ? ', ' + esc(a.district) : '') + (a.province ? ', ' + esc(a.province) : '') + '</div>';

      html += '</div>';

      // Show primary contact
      if (contact) {
        html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(1,118,211,.1)">' +
          '<div style="font-size:11px;font-weight:600;color:var(--sf-blue);margin-bottom:4px">Primary Contact</div>' +
          '<div style="font-size:12px;font-weight:500">' + esc(contact.first_name||'') + ' ' + esc(contact.last_name||'') +
            (contact.title ? ' <span style="color:var(--text3)">(' + esc(contact.title) + ')</span>' : '') +
          '</div>' +
          '<div style="font-size:11px;color:var(--text2)">' +
            (contact.phone ? esc(contact.phone) : '') +
            (contact.email ? (contact.phone ? ' / ' : '') + esc(contact.email) : '') +
            (contact.line_id ? ' / LINE: ' + esc(contact.line_id) : '') +
          '</div>' +
        '</div>';
      }

      html += '</div>' +
        '<button type="button" onclick="clearCustomer()" style="border:none;background:none;color:var(--red);cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;margin-left:12px">✕ Remove</button>' +
      '</div>';

      selBox.innerHTML = html;
      selBox.style.display = 'block';
    }

    // Auto-fill contact name from primary contact
    var contactNameEl = document.getElementById('fl-name');
    if (contact && contactNameEl && !contactNameEl.value) {
      var contact = (a.contacts && a.contacts.length > 0) ? a.contacts[0] : null;
      if (contact) contactNameEl.value = (contact.first_name || '') + ' ' + (contact.last_name || '');
    }

    // Auto-fill contact phone/email from primary contact
    var contactPhoneEl = document.getElementById('fl-contact-phone');
    var contactEmailEl = document.getElementById('fl-contact-email');
    var contactLineEl = document.getElementById('fl-contact-line');
    if (contact) {
      if (contactPhoneEl && !contactPhoneEl.value && contact.phone) contactPhoneEl.value = contact.phone;
      if (contactEmailEl && !contactEmailEl.value && contact.email) contactEmailEl.value = contact.email;
      if (contactLineEl && !contactLineEl.value && contact.line_id) contactLineEl.value = contact.line_id;
    }

  } catch(e) { console.error('selectCustomer:', e); }
}

function clearCustomer() {
  selectedAccountId = null;
  selectedAccountData = null;
  var selBox = document.getElementById('fl-customer-selected');
  if (selBox) { selBox.style.display = 'none'; selBox.innerHTML = ''; }
  // Clear contact fields
  ['fl-name','fl-contact-phone','fl-contact-email','fl-contact-line'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
}
