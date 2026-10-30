// TradeFlow 2026 - Centralized Reusable Component Architecture
// Changes made here automatically propagate across all views, tabs, and modals.

window.TFComponents = {

  /* ==========================================================================
     1. DOCUMENT VAULT COMPONENT (Attached Invoices & Bank Proofs)
     ========================================================================== */
  renderDocumentVault(orderId, docs = [], options = {}) {
    const catConfig = {
      mfg_invoice: { label: 'Factory Invoice', sub: 'Job-work bill', icon: 'factory', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
      pkg_invoice: { label: 'Packaging Bill', sub: 'Jars & labels', icon: 'package', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
      transport_bilty: { label: 'LR / Bilty', sub: 'Goods receipt', icon: 'truck', color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' },
      bank_receipt: { label: 'Bank Receipt', sub: 'NEFT / RTGS slip', icon: 'landmark', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
      retailer_invoice: { label: 'Buyer Invoice', sub: 'Sales invoice', icon: 'building-2', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
      other: { label: 'Other Document', sub: 'Supporting doc', icon: 'file-text', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' }
    };

    const docCards = docs.map(doc => {
      const meta = doc.metadata || {};
      const cfg = catConfig[doc.category] || catConfig.other;
      const dateStr = meta.docDate ? (typeof app !== 'undefined' ? app.formatDate(meta.docDate) : meta.docDate) : '';
      const amtStr = meta.totalAmount ? (typeof app !== 'undefined' ? app.formatCurrency(meta.totalAmount) : `₹${meta.totalAmount}`) : '';

      return `
        <div class="tf-doc-card group relative p-4 rounded-xl bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${tfEscapeHtml(cfg.bg)} ${tfEscapeHtml(cfg.color)}">
                <i data-lucide="${tfEscapeHtml(cfg.icon)}" class="w-3 h-3"></i>
                <span>${tfEscapeHtml(cfg.label)}</span>
              </span>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="event.stopPropagation(); app.previewDocument('${tfEscapeHtml(tfEscapeJs(doc.id))}')" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-colors" title="Preview Document">
                  <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="event.stopPropagation(); app.deleteDocument('${tfEscapeHtml(tfEscapeJs(doc.id))}', '${tfEscapeHtml(tfEscapeJs(orderId))}')" class="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 transition-colors" title="Remove from Vault">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <h4 class="font-bold text-xs text-slate-900 dark:text-white truncate" title="${tfEscapeHtml(meta.invoiceNumber || doc.fileName)}">
              ${tfEscapeHtml(meta.invoiceNumber || doc.fileName)}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              ${tfEscapeHtml(meta.counterpartyName || cfg.label)}${tfEscapeHtml(meta.gstin ? ` • ${meta.gstin}` : '')}
            </p>

            <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <span class="text-slate-400 text-[10px] font-medium">${tfEscapeHtml(dateStr || 'Verified Proof')}</span>
              ${amtStr ? `<span class="font-black font-mono-num text-slate-900 dark:text-amber-400 text-xs">${tfEscapeHtml(amtStr)}</span>` : ''}
            </div>
            ${meta.utrNumber ? `<div class="mt-1 text-[10px] font-mono-num text-amber-600 dark:text-amber-400">UTR: ${tfEscapeHtml(meta.utrNumber)}</div>` : ''}
          </div>

          <!-- Direct In-App Preview Trigger -->
          <button onclick="app.previewDocument('${tfEscapeHtml(tfEscapeJs(doc.id))}')" class="btn-tactile mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all">
            <i data-lucide="eye" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>View Bill Copy</span>
          </button>
        </div>
      `;
    }).join('');

    const uploadCards = [
      { cat: 'mfg_invoice', label: 'Factory Invoice', sub: 'Job-work bill', icon: 'factory', color: 'text-blue-500' },
      { cat: 'pkg_invoice', label: 'Packaging Bill', sub: 'Jars & labels', icon: 'package', color: 'text-sky-500' },
      { cat: 'transport_bilty', label: 'LR / Bilty', sub: 'Goods receipt', icon: 'truck', color: 'text-purple-500' },
      { cat: 'bank_receipt', label: 'Bank Receipt', sub: 'NEFT / RTGS slip', icon: 'landmark', color: 'text-amber-500' },
      { cat: 'retailer_invoice', label: 'Buyer Invoice', sub: 'Sales bill', icon: 'building-2', color: 'text-emerald-500' },
    ].map(b => `
      <button onclick="app.triggerOrderDocUpload('${tfEscapeHtml(tfEscapeJs(orderId))}', '${tfEscapeHtml(tfEscapeJs(b.cat))}')" class="btn-tactile flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700/80 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-500/5 dark:bg-slate-900/40 dark:hover:bg-amber-500/10 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all text-center group shadow-2xs">
        <div class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-110 transition-transform">
          <i data-lucide="${tfEscapeHtml(b.icon)}" class="w-4 h-4 ${tfEscapeHtml(b.color)}"></i>
        </div>
        <span class="text-xs font-bold leading-tight text-slate-800 dark:text-slate-200">${tfEscapeHtml(b.label)}</span>
        <span class="text-[10px] text-slate-400 mt-0.5 font-medium">${tfEscapeHtml(b.sub)}</span>
        <span class="mt-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
          Upload
        </span>
      </button>
    `).join('');

    return `
      <div class="bg-white dark:bg-[#10141e] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <!-- Vault Header -->
        <div class="p-4 px-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-3 bg-slate-50/60 dark:bg-slate-900/40">
          <div class="flex items-center gap-3">
            <span class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <i data-lucide="archive" class="w-4 h-4"></i>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Attached Invoices &amp; Bank Proofs Vault</h3>
                <span class="px-2 py-0.5 text-[10px] font-mono-num font-bold rounded-md bg-amber-500 text-slate-950">${tfEscapeHtml(docs.length)} Filed</span>
              </div>
              <p class="text-xs text-slate-400">Universal document repository for this order • All bills stored with OCR audit logs</p>
            </div>
          </div>
          <span class="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            storage/documents/orders/${tfEscapeHtml(orderId)}/
          </span>
        </div>

        <!-- Filed Document Cards Grid -->
        ${docs.length > 0 ? `
          <div class="p-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
              ${docCards}
            </div>

            <!-- Upload More Bills - Centered & Full Width 5-Column Grid -->
            <div class="pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div class="flex items-center justify-between mb-3">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <i data-lucide="upload-cloud" class="w-3.5 h-3.5 text-amber-500"></i>
                  <span>Upload More Bills &amp; Vouchers</span>
                </span>
                <span class="text-[10px] text-slate-400">Click any category to attach a scan or bill</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
                ${uploadCards}
              </div>
            </div>
          </div>
        ` : `
          <!-- Zero Documents State: Full-width Centered 5-Column Upload Hub -->
          <div class="p-6 sm:p-8">
            <div class="max-w-2xl mx-auto text-center mb-6">
              <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto mb-2.5">
                <i data-lucide="upload-cloud" class="w-6 h-6"></i>
              </div>
              <h4 class="text-sm font-bold text-slate-900 dark:text-white">No Bills or Vouchers Attached Yet</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Attach factory job-work bills, packaging receipts, transport bilty, or customer bank slips for automated matching and audit compliance.
              </p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
              ${uploadCards}
            </div>
          </div>
        `}
      </div>
    `;
  },


  /* ==========================================================================
     2. MARKETEERS & TRADE BROKERS DIRECTORY COMPONENT
     ========================================================================== */
  renderMarketeersDirectory(marketeers = [], orders = [], payments = []) {
    // Aggregated Metrics
    const totalBrokers = marketeers.length;
    let totalBrokerageGenerated = 0;
    let totalBrokeragePaid = 0;
    let totalOrdersBrought = 0;

    marketeers.forEach(m => {
      const mOrders = orders.filter(o => o.marketeerId === m.id);
      totalOrdersBrought += mOrders.length;
      mOrders.forEach(o => {
        totalBrokerageGenerated += (o.marketeerCommissionAmount || (o.taxableSubtotal * (m.commissionRate || 3.0) / 100));
      });
      const mPayments = payments.filter(p => p.partyType === 'marketeer' && (p.partyName.includes(m.contactPerson || m.name) || p.partyName.includes(m.name)));
      totalBrokeragePaid += mPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    });

    const outstandingBrokerage = Math.max(0, totalBrokerageGenerated - totalBrokeragePaid);

    const cardsHtml = marketeers.map(m => {
      const mOrders = orders.filter(o => o.marketeerId === m.id);
      const earned = mOrders.reduce((sum, o) => sum + (o.marketeerCommissionAmount || (o.taxableSubtotal * (m.commissionRate || 3.0) / 100)), 0);
      const mPayments = payments.filter(p => p.partyType === 'marketeer' && (p.partyName.includes(m.contactPerson || m.name) || p.partyName.includes(m.name)));
      const paid = mPayments.reduce((sum, p) => sum + (p.amount || 0), 0) || (m.totalBrokeragePaid || 0);
      const balance = Math.max(0, earned - paid);
      const latestOrders = mOrders.slice(0, 2);

      const rawPhone = m.phone || '';
      const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
      const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
      const waPhone = digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly;

      const mLogo = m.logo || m.logoUrl;
      const logoHtml = mLogo ? `
        <div class="tf-banner-avatar-v4" style="background: #ede9fe; color: #4c1d95;">
          <img src="${tfEscapeHtml(tfSafeUrl(mLogo))}" alt="${tfEscapeHtml(m.name)}" class="w-full h-full object-contain p-1" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'font-black text-purple-950 text-lg\\'>${tfEscapeHtml(tfEscapeJs((m.name||'MK').substring(0,2).toUpperCase()))}</span>'">
        </div>
      ` : `
        <div class="tf-banner-avatar-v4" style="background: #ede9fe; color: #4c1d95;">
          ${tfEscapeHtml((m.name||'MK').substring(0,2).toUpperCase())}
        </div>
      `;

      const safeAddress = (m.territory || m.billingAddress || 'Trade Territory, Mumbai').replace(/'/g, "\\'");
      const safeEmail = (m.email || `broker@${(m.name || 'marketeer').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`).replace(/'/g, "\\'");
      const safePan = (m.pan || 'AAPCM1234F').replace(/'/g, "\\'");
      const waMsg = encodeURIComponent(`Hi ${m.contactPerson || m.name}, TradeFlow communication regarding our brokerage settlements.`);

      // Live Commercial Health Pill
      const healthPill = balance > 0
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/25 backdrop-blur-md text-amber-200 border border-amber-400/30 flex items-center gap-1"><span>⬆</span><span>Due ₹${tfEscapeHtml(Math.round(balance/1000))}k</span></span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/25 backdrop-blur-md text-emerald-200 border border-emerald-400/30 flex items-center gap-1"><span>🟢</span><span>Settled</span></span>`;

      return `
        <div class="tf-card-v4 group" id="partner-card-${tfEscapeHtml(m.id)}" data-partner-type="marketeer" data-name="${tfEscapeHtml((m.name||'').toLowerCase())}" data-person="${tfEscapeHtml((m.contactPerson||'').toLowerCase())}" data-city="${tfEscapeHtml(safeAddress.toLowerCase())}" data-active-orders="${tfEscapeHtml(mOrders.length)}" data-has-balance="${tfEscapeHtml(balance > 0 ? 'true' : 'false')}">
          <!-- Top Banner: Royal Violet Gradient -->
          <div class="tf-card-banner-v4" style="background: linear-gradient(135deg, #4c1d95 0%, #5b21b6 55%, #6d28d9 100%);">
            <!-- Top Badges & Kebab Row -->
            <div class="flex items-center justify-between gap-2 relative">
              <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 backdrop-blur-md text-white border border-white/20 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse"></span>
                  <span>SALES BROKER</span>
                </span>
                <span class="font-mono text-[10px] text-white/90 font-bold bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15">${tfEscapeHtml(m.id)}</span>
                ${healthPill}
              </div>
              
              <!-- 3-Dots Kebab Menu Button -->
              <div class="relative shrink-0">
                <button type="button" onclick="event.stopPropagation(); app.toggleCardKebabMenu('${tfEscapeHtml(tfEscapeJs(m.id))}', event)" class="tf-kebab-btn-v4" title="Quick Actions">
                  <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                </button>
                <div id="kebab-menu-${tfEscapeHtml(m.id)}" class="tf-kebab-menu-popup hidden" onclick="event.stopPropagation()">
                  <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'dossier'); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="user-check" class="w-3.5 h-3.5 text-purple-600"></i>
                    <span>Profile Dossier &amp; AI Filler</span>
                  </button>
                  <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'hub', 'all'); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="handshake" class="w-3.5 h-3.5 text-purple-600"></i>
                    <span>View Broker Hub &amp; Deals</span>
                  </button>
                  ${cleanPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waMsg)}" target="_blank" rel="noopener noreferrer" class="tf-kebab-item">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
                      <span>WhatsApp Direct</span>
                    </a>
                    <a href="tel:${tfEscapeHtml(cleanPhone)}" class="tf-kebab-item">
                      <i data-lucide="phone" class="w-3.5 h-3.5 text-blue-500"></i>
                      <span>Call Partner</span>
                    </a>
                  ` : ''}
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safePan))}', 'PAN', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="copy" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>Copy PAN</span>
                  </button>
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Territory', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-500"></i>
                    <span>Copy Territory</span>
                  </button>
                  <button onclick="app.openOrderFormModal(); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-purple-600"></i>
                    <span>Book New Deal</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Identity Core: Circle Avatar + Bold Name + Contact Person + Phone & WA -->
            <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'dossier')" title="Click to view full Profile Dossier for ${tfEscapeHtml(m.name)}">
              ${logoHtml}
              <div class="min-w-0 flex-1">
                <div class="min-h-[44px] max-h-[44px] flex items-center">
                  <h3 class="font-black text-white text-[18px] sm:text-[19px] leading-tight line-clamp-2 drop-shadow-xs hover:text-purple-200 transition-colors" title="${tfEscapeHtml(m.name)}">
                    ${tfEscapeHtml(m.name)}
                  </h3>
                </div>
                <div class="h-[20px] flex items-center mt-0.5">
                  ${m.contactPerson ? `
                    <div class="text-purple-100 text-sm font-bold flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-purple-300 shrink-0"></i>
                      <span class="truncate">${tfEscapeHtml(m.contactPerson)}</span>
                    </div>
                  ` : `
                    <div class="text-purple-200/70 text-xs font-medium flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-purple-300/70 shrink-0"></i>
                      <span class="truncate italic">Commission Broker</span>
                    </div>
                  `}
                </div>
                <div class="h-[20px] flex items-center gap-2 mt-0.5">
                  <a href="tel:${tfEscapeHtml(cleanPhone)}" onclick="event.stopPropagation()" class="text-white text-xs font-mono font-bold hover:text-purple-200 transition-colors flex items-center gap-1 truncate" title="Call ${tfEscapeHtml(m.phone)}">
                    <i data-lucide="phone" class="w-3 h-3 text-white/80 shrink-0"></i>
                    <span>${tfEscapeHtml(m.phone || 'No phone')}</span>
                  </a>
                  ${waPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="tf-wa-btn" title="Chat on WhatsApp">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- 2-Column Info Grid inside Banner -->
            <div class="tf-banner-grid-v4">
              <!-- Left Column: Territory & Email -->
              <div class="space-y-1 min-w-0 pr-1">
                <div class="tf-copy-clickable" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Territory')" title="Click to copy Territory">
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="map-pin" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Territory</span>
                  </div>
                  <div class="text-[11px] text-white font-medium line-clamp-2 leading-tight mt-0.5">
                    ${tfEscapeHtml(m.territory || m.billingAddress || 'Trade Territory, Mumbai APMC')}
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeEmail))}', 'Email')" title="Click to copy Email">
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="mail" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span class="truncate text-[11px] text-white font-medium">${tfEscapeHtml(m.email || 'broker@' + (m.name || 'marketeer').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com')}</span>
                  </div>
                </div>
              </div>

              <!-- Right Column: Business Type & Brokerage Rate / PAN -->
              <div class="space-y-1 min-w-0 pl-1 border-l border-white/15">
                <div>
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="percent" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Brokerage Rate</span>
                  </div>
                  <div class="text-[11px] text-white font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(m.commissionRate || '3.0')}% Standard
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safePan))}', 'PAN')" title="Click to copy PAN">
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="credit-card" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>PAN Number</span>
                  </div>
                  <div class="text-[11px] text-white font-mono font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(m.pan || 'AAPCM1234F')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card Body Zone -->
          <div class="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            <!-- Dual Soft Metric Tiles with 1-Click Deep Linking -->
            <div class="grid grid-cols-2 gap-2.5">
              <!-- Left Tile: Active Deals (Mint) -> Deep links to Hub Orders -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'hub', 'orders')" class="tf-metric-tile-v4 tf-metric-tile-mint tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view all Deals in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-purple-600 shadow-2xs shrink-0">
                      <i data-lucide="briefcase" class="w-3 h-3"></i>
                    </div>
                    <span class="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Active Deals</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-purple-500/15 dark:bg-purple-500/25 flex items-center justify-center text-purple-700 dark:text-purple-300 group-hover/tile:bg-purple-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-xl font-black text-slate-900 dark:text-white leading-none">
                    ${tfEscapeHtml(String(mOrders.length).padStart(2, '0'))}
                  </span>
                  <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    ${tfEscapeHtml(mOrders.length > 0 ? mOrders.length + ' Linked POs' : 'No Deals')}
                  </span>
                </div>
              </div>

              <!-- Right Tile: Brokerage Balance (Sky Blue) -> Deep links to Hub Payments -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'hub', 'payments')" class="tf-metric-tile-v4 tf-metric-tile-blue tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view Brokerage Ledger & Settlements in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                      <i data-lucide="wallet" class="w-3 h-3"></i>
                    </div>
                    <span class="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Brokerage Due</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-blue-500/15 dark:bg-blue-500/25 flex items-center justify-center text-blue-700 dark:text-blue-300 group-hover/tile:bg-blue-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-lg font-black text-[#1d4ed8] dark:text-blue-400 leading-none font-mono-num truncate" title="${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(balance) : '₹' + balance)}">
                    ${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(balance) : '₹' + balance)}
                  </span>
                  <span class="text-[10px] font-semibold ${tfEscapeHtml(balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')} truncate">
                    ${tfEscapeHtml(balance > 0 ? '⬆ Due' : '✓ Settled')}
                  </span>
                </div>
              </div>
            </div>

            <!-- Latest Deals Mini-Table -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between px-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <i data-lucide="handshake" class="w-3.5 h-3.5 text-purple-600"></i>
                  <span>Latest Deals</span>
                </div>
                <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'hub', 'orders')" class="text-[11px] font-bold text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-0.5" title="View all deals for ${tfEscapeHtml(m.name)}">
                  <span>View All</span>
                  <i data-lucide="chevron-right" class="w-3 h-3"></i>
                </button>
              </div>

              <div class="tf-orders-minitable-v4">
                <div class="minitable-header">
                  <span>Deal / PO</span>
                  <span>Retailer</span>
                  <span class="text-right">Commission</span>
                </div>
                ${latestOrders.length === 0 ? `
                  <div onclick="app.openOrderFormModal()" class="flex-1 flex items-center justify-center gap-1.5 p-2 text-center text-xs text-slate-400 hover:text-purple-600 cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>No linked deals · Link first order</span>
                  </div>
                ` : `
                  ${latestOrders.slice(0, 2).map(o => `
                    <div onclick="event.stopPropagation(); app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="minitable-row" title="Click to inspect deal ${tfEscapeHtml(o.invoiceNumber)}">
                      <span class="font-mono font-bold text-slate-900 dark:text-white truncate">${tfEscapeHtml(o.invoiceNumber)}</span>
                      <span class="truncate text-slate-700 dark:text-slate-300 font-medium">${tfEscapeHtml(o.retailerName || 'Retail Buyer')}</span>
                      <span class="text-right font-medium text-purple-700 dark:text-purple-300 flex items-center justify-end gap-0.5 truncate font-mono-num font-bold">
                        <span>${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(o.marketeerCommissionAmount || (o.taxableSubtotal * 0.03)) : '₹' + (o.taxableSubtotal * 0.03))}</span>
                        <i data-lucide="chevron-right" class="w-2.5 h-2.5 text-slate-400 shrink-0"></i>
                      </span>
                    </div>
                  `).join('')}
                  ${latestOrders.length === 1 ? `
                    <div class="minitable-row minitable-row-empty">
                      <span>-</span>
                      <span>Slot available for Deal 2</span>
                      <span class="text-right">-</span>
                    </div>
                  ` : ''}
                `}
              </div>
            </div>

            <!-- Tactile Footer Action Bar -->
            <div class="pt-2 flex items-center gap-2">
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'hub', 'all')" class="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-[#4c1d95] hover:bg-[#3b0764] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98">
                <i data-lucide="handshake" class="w-3.5 h-3.5"></i>
                <span>View Broker Hub &amp; Deals</span>
                <i data-lucide="chevron-right" class="w-3 h-3"></i>
              </button>
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}', 'dossier')" class="w-9 h-9 rounded-xl text-purple-800 bg-[#ede9fe] hover:bg-[#ddd6fe] border border-purple-200/60 flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-2xs" title="View &amp; Edit Profile Dossier">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-4">
        <!-- Smart Filter & Search Bar -->
        <div class="tf-directory-toolbar">
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <div class="relative w-full">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              <input type="text" id="marketeer-search-input" oninput="app.searchPartnerCards('marketeer', this.value)" placeholder="Search brokers by name, territory, phone..." class="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500">
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Filter:</span>
            <button type="button" onclick="app.filterPartnerCards('marketeer', 'all', this)" class="tf-filter-chip active">All (${tfEscapeHtml(marketeers.length)})</button>
            <button type="button" onclick="app.filterPartnerCards('marketeer', 'active_orders', this)" class="tf-filter-chip">Active Deals</button>
            <button type="button" onclick="app.filterPartnerCards('marketeer', 'balance_due', this)" class="tf-filter-chip">Commission Due</button>
            <button type="button" onclick="app.filterPartnerCards('marketeer', 'all_clear', this)" class="tf-filter-chip">All Settled</button>
          </div>
        </div>

        <!-- 4 Cards Per Row Grid with Responsive Squeezing -->
        <div id="marketeers-card-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-4.5 w-full">
          ${cardsHtml}
        </div>
      </div>
    `;
  },


  /* ==========================================================================
     3. RETAILERS & DEPARTMENTAL STORE ACCOUNTS COMPONENT
     ========================================================================== */
  renderRetailersDirectory(retailers = [], orders = [], payments = []) {
    let totalReceivable = 0;
    let totalOrdersCount = 0;

    retailers.forEach(r => {
      const rOrders = orders.filter(o => o.retailerId === r.id);
      totalOrdersCount += rOrders.length;
      totalReceivable += (r.currentBalanceDue || rOrders.reduce((sum, o) => sum + (o.customerBalanceDue || 0), 0));
    });

    const cardsHtml = retailers.map(r => {
      const rOrders = orders.filter(o => o.retailerId === r.id);
      const totalInvoiced = rOrders.reduce((s, o) => s + (o.totalInvoiceAmount || 0), 0);
      const totalPaid = rOrders.reduce((s, o) => s + (o.customerAdvanceReceived || 0), 0);
      const balance = r.currentBalanceDue !== undefined ? r.currentBalanceDue : Math.max(0, totalInvoiced - totalPaid);
      const latestOrders = rOrders.slice(0, 2);

      const rawPhone = r.phone || '';
      const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
      const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
      const waPhone = digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly;

      const rLogo = r.logo || r.logoUrl;
      const logoHtml = rLogo ? `
        <div class="tf-banner-avatar-v4">
          <img src="${tfEscapeHtml(tfSafeUrl(rLogo))}" alt="${tfEscapeHtml(r.name)}" class="w-full h-full object-contain p-1" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'font-black text-emerald-950 text-lg\\'>${tfEscapeHtml(tfEscapeJs((r.name||'RT').substring(0,2).toUpperCase()))}</span>'">
        </div>
      ` : `
        <div class="tf-banner-avatar-v4">
          ${tfEscapeHtml((r.name||'RT').substring(0,2).toUpperCase())}
        </div>
      `;

      const safeAddress = (r.shippingAddress || r.billingAddress || 'APMC Market, Mumbai').replace(/'/g, "\\'");
      const safeEmail = (r.email || `sales@${(r.name || 'buyer').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`).replace(/'/g, "\\'");
      const safeGstin = (r.gstin || '27AABCG1234F1Z9').replace(/'/g, "\\'");
      const waMsg = encodeURIComponent(`Hi ${r.contactPerson || r.name}, TradeFlow communication regarding our B2B pickle orders.`);

      // Live Commercial Health Pill
      const healthPill = balance > 0
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/25 backdrop-blur-md text-blue-200 border border-blue-400/30 flex items-center gap-1"><span>⬇</span><span>Due ₹${tfEscapeHtml(Math.round(balance/1000))}k</span></span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/25 backdrop-blur-md text-emerald-200 border border-emerald-400/30 flex items-center gap-1"><span>🟢</span><span>Healthy</span></span>`;

      return `
        <div class="tf-card-v4 group" id="partner-card-${tfEscapeHtml(r.id)}" data-partner-type="retailer" data-name="${tfEscapeHtml((r.name||'').toLowerCase())}" data-person="${tfEscapeHtml((r.contactPerson||'').toLowerCase())}" data-city="${tfEscapeHtml(safeAddress.toLowerCase())}" data-active-orders="${tfEscapeHtml(rOrders.length)}" data-has-balance="${tfEscapeHtml(balance > 0 ? 'true' : 'false')}">
          <!-- Top Banner: Forest Green Gradient matching uploaded reference -->
          <div class="tf-card-banner-v4" style="background: linear-gradient(135deg, #064e3b 0%, #047857 55%, #065f46 100%);">
            <!-- Top Badges & Kebab Row -->
            <div class="flex items-center justify-between gap-2 relative">
              <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 backdrop-blur-md text-white border border-white/20 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  <span>RETAILER / BUYER</span>
                </span>
                <span class="font-mono text-[10px] text-white/90 font-bold bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15">${tfEscapeHtml(r.id)}</span>
                ${healthPill}
              </div>
              
              <!-- 3-Dots Kebab Menu Button -->
              <div class="relative shrink-0">
                <button type="button" onclick="event.stopPropagation(); app.toggleCardKebabMenu('${tfEscapeHtml(tfEscapeJs(r.id))}', event)" class="tf-kebab-btn-v4" title="Quick Actions">
                  <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                </button>
                <div id="kebab-menu-${tfEscapeHtml(r.id)}" class="tf-kebab-menu-popup hidden" onclick="event.stopPropagation()">
                  <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'dossier'); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="user-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>Profile Dossier &amp; AI Filler</span>
                  </button>
                  <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'hub', 'all'); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="store" class="w-3.5 h-3.5 text-blue-600"></i>
                    <span>View Retailer Hub &amp; Deals</span>
                  </button>
                  ${cleanPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waMsg)}" target="_blank" rel="noopener noreferrer" class="tf-kebab-item">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
                      <span>WhatsApp Direct</span>
                    </a>
                    <a href="tel:${tfEscapeHtml(cleanPhone)}" class="tf-kebab-item">
                      <i data-lucide="phone" class="w-3.5 h-3.5 text-blue-500"></i>
                      <span>Call Partner</span>
                    </a>
                  ` : ''}
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeGstin))}', 'GSTIN', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="copy" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>Copy GSTIN</span>
                  </button>
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Address', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-500"></i>
                    <span>Copy Address</span>
                  </button>
                  <button onclick="app.openOrderFormModal(); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>Create New Order</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Identity Core: Circle Avatar + Bold Name + Contact Person + Phone & WA -->
            <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'dossier')" title="Click to view full Profile Dossier for ${tfEscapeHtml(r.name)}">
              ${logoHtml}
              <div class="min-w-0 flex-1">
                <div class="min-h-[44px] max-h-[44px] flex items-center">
                  <h3 class="font-black text-white text-[18px] sm:text-[19px] leading-tight line-clamp-2 drop-shadow-xs hover:text-emerald-200 transition-colors" title="${tfEscapeHtml(r.name)}">
                    ${tfEscapeHtml(r.name)}
                  </h3>
                </div>
                <div class="h-[20px] flex items-center mt-0.5">
                  ${r.contactPerson ? `
                    <div class="text-emerald-100 text-sm font-bold flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-emerald-300 shrink-0"></i>
                      <span class="truncate">${tfEscapeHtml(r.contactPerson)}</span>
                    </div>
                  ` : `
                    <div class="text-emerald-200/70 text-xs font-medium flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-emerald-300/70 shrink-0"></i>
                      <span class="truncate italic">Procurement Manager</span>
                    </div>
                  `}
                </div>
                <div class="h-[20px] flex items-center gap-2 mt-0.5">
                  <a href="tel:${tfEscapeHtml(cleanPhone)}" onclick="event.stopPropagation()" class="text-white text-xs font-mono font-bold hover:text-emerald-200 transition-colors flex items-center gap-1 truncate" title="Call ${tfEscapeHtml(r.phone)}">
                    <i data-lucide="phone" class="w-3 h-3 text-white/80 shrink-0"></i>
                    <span>${tfEscapeHtml(r.phone || 'No phone')}</span>
                  </a>
                  ${waPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waMsg)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="tf-wa-btn" title="Chat on WhatsApp">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- 2-Column Info Grid inside Banner -->
            <div class="tf-banner-grid-v4">
              <!-- Left Column: Address & Email -->
              <div class="space-y-1 min-w-0 pr-1">
                <div class="tf-copy-clickable" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Address', this)" title="Click to copy Address">
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="map-pin" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Address</span>
                  </div>
                  <div class="text-[11px] text-white font-medium line-clamp-2 leading-tight mt-0.5">
                    ${tfEscapeHtml(r.shippingAddress || r.billingAddress || 'Shop 14, APMC Market, Vashi, Navi Mumbai')}
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeEmail))}', 'Email', this)" title="Click to copy Email">
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="mail" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span class="truncate text-[11px] text-white font-medium">${tfEscapeHtml(r.email || 'orders@' + (r.name || 'buyer').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com')}</span>
                  </div>
                </div>
              </div>

              <!-- Right Column: Business Type & GSTIN -->
              <div class="space-y-1 min-w-0 pl-1 border-l border-white/15">
                <div>
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="store" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Business Type</span>
                  </div>
                  <div class="text-[11px] text-white font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(r.businessType || 'Retailer / Buyer')}
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeGstin))}', 'GSTIN', this)" title="Click to copy GSTIN">
                  <div class="text-[10px] text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="file-text" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>GSTIN</span>
                  </div>
                  <div class="text-[11px] text-white font-mono font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(r.gstin || '27AABCG1234F1Z9')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card Body Zone: White Container with Metrics & Orders Table -->
          <div class="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            <!-- Dual Soft Metric Tiles with 1-Click Deep Linking -->
            <div class="grid grid-cols-2 gap-2.5">
              <!-- Left Tile: Active Orders (Mint) -> Deep links to Hub Orders -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'hub', 'orders')" class="tf-metric-tile-v4 tf-metric-tile-mint tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view all Purchase Orders in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
                      <i data-lucide="file-text" class="w-3 h-3"></i>
                    </div>
                    <span class="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Active Orders</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-300 group-hover/tile:bg-emerald-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-xl font-black text-slate-900 dark:text-white leading-none">
                    ${tfEscapeHtml(String(rOrders.length).padStart(2, '0'))}
                  </span>
                  <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    ${tfEscapeHtml(rOrders.length > 0 ? rOrders.length + ' Orders' : 'Capacity Open')}
                  </span>
                </div>
              </div>

              <!-- Right Tile: Receivables (Sky Blue) -> Deep links to Hub Payments -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'hub', 'payments')" class="tf-metric-tile-v4 tf-metric-tile-blue tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view Financial Ledger & Payments in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                      <i data-lucide="wallet" class="w-3 h-3"></i>
                    </div>
                    <span class="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Receivables</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-blue-500/15 dark:bg-blue-500/25 flex items-center justify-center text-blue-700 dark:text-blue-300 group-hover/tile:bg-blue-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-lg font-black text-[#1d4ed8] dark:text-blue-400 leading-none font-mono-num truncate" title="${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(balance) : '₹' + balance)}">
                    ${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(balance) : '₹' + balance)}
                  </span>
                  <span class="text-[10px] font-semibold ${tfEscapeHtml(balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')} truncate">
                    ${tfEscapeHtml(balance > 0 ? '⬆ Due' : '✓ Settled')}
                  </span>
                </div>
              </div>
            </div>

            <!-- Latest Orders Mini-Table -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between px-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <i data-lucide="package" class="w-3.5 h-3.5 text-emerald-600"></i>
                  <span>Latest Orders</span>
                </div>
                <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'hub', 'orders')" class="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5" title="View all orders for ${tfEscapeHtml(r.name)}">
                  <span>View All</span>
                  <i data-lucide="chevron-right" class="w-3 h-3"></i>
                </button>
              </div>

              <div class="tf-orders-minitable-v4">
                <div class="minitable-header">
                  <span>PO Number</span>
                  <span>Product</span>
                  <span class="text-right">Cases</span>
                </div>
                ${latestOrders.length === 0 ? `
                  <div onclick="app.openOrderFormModal()" class="flex-1 flex items-center justify-center gap-1.5 p-2 text-center text-xs text-slate-400 hover:text-emerald-600 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>No active POs · Create first order</span>
                  </div>
                ` : `
                  ${latestOrders.slice(0, 2).map(o => `
                    <div onclick="event.stopPropagation(); app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="minitable-row" title="Click to inspect order ${tfEscapeHtml(o.invoiceNumber)}">
                      <span class="font-mono font-bold text-slate-900 dark:text-white truncate">${tfEscapeHtml(o.invoiceNumber)}</span>
                      <span class="truncate text-slate-700 dark:text-slate-300 font-medium">${tfEscapeHtml((o.items && o.items[0]) ? (o.items[0].variant || o.items[0].name) : 'Mixed Pickle')}</span>
                      <span class="text-right font-medium text-slate-600 dark:text-slate-400 flex items-center justify-end gap-0.5 truncate">
                        <span>${tfEscapeHtml((o.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0) || 15)} Cases</span>
                        <i data-lucide="chevron-right" class="w-2.5 h-2.5 text-slate-400 shrink-0"></i>
                      </span>
                    </div>
                  `).join('')}
                  ${latestOrders.length === 1 ? `
                    <div class="minitable-row minitable-row-empty">
                      <span>-</span>
                      <span>Slot available for Order 2</span>
                      <span class="text-right">-</span>
                    </div>
                  ` : ''}
                `}
              </div>
            </div>

            <!-- Tactile Footer Action Bar -->
            <div class="pt-2 flex items-center gap-2">
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'hub', 'all')" class="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-[#064e3b] hover:bg-[#043e2f] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98">
                <i data-lucide="store" class="w-3.5 h-3.5"></i>
                <span>View Retailer Hub &amp; Orders</span>
                <i data-lucide="chevron-right" class="w-3 h-3"></i>
              </button>
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}', 'dossier')" class="w-9 h-9 rounded-xl text-emerald-800 bg-[#dcfce7] hover:bg-[#bbf7d0] border border-emerald-200/60 flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-2xs" title="View &amp; Edit Profile Dossier">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-4">
        <!-- Smart Filter & Search Bar -->
        <div class="tf-directory-toolbar">
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <div class="relative w-full">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              <input type="text" id="retailer-search-input" oninput="app.searchPartnerCards('retailer', this.value)" placeholder="Search buyers by name, city, GSTIN, phone..." class="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Filter:</span>
            <button type="button" onclick="app.filterPartnerCards('retailer', 'all', this)" class="tf-filter-chip active">All (${tfEscapeHtml(retailers.length)})</button>
            <button type="button" onclick="app.filterPartnerCards('retailer', 'active_orders', this)" class="tf-filter-chip">Active Orders</button>
            <button type="button" onclick="app.filterPartnerCards('retailer', 'balance_due', this)" class="tf-filter-chip">Balance Due</button>
            <button type="button" onclick="app.filterPartnerCards('retailer', 'all_clear', this)" class="tf-filter-chip">All Clear</button>
          </div>
        </div>

        <!-- 4 Cards Per Row Grid with Responsive Squeezing -->
        <div id="retailers-card-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-4.5 w-full">
          ${cardsHtml}
        </div>
      </div>
    `;
  },


  /* ==========================================================================
     4. COMPREHENSIVE PARTNER HUB & PROFILE DOSSIER (Zero-Waste, High-Density)
     ========================================================================== */
  renderPartnerDossier(contact, orders = [], payments = [], options = {}) {
    const isMarketeer = contact.role === 'marketeer';
    const isRetailer = contact.role === 'retailer';
    const isMfg = contact.role === 'manufacturer';
    const isPkg = contact.role === 'packaging';

    const currentMode = options.viewMode || (typeof app !== 'undefined' && app.activeContactViewMode) || 'hub';
    const isDossierMode = currentMode === 'dossier';
    const isEditMode = (typeof app !== 'undefined' && app.isDossierEditMode);

    // Linked orders & deals
    let linkedOrders = [];
    if (isMarketeer) linkedOrders = orders.filter(o => o.marketeerId === contact.id);
    else if (isRetailer) linkedOrders = orders.filter(o => o.retailerId === contact.id);
    else if (isMfg) linkedOrders = orders.filter(o => o.manufacturerId === contact.id);
    else if (isPkg) linkedOrders = orders.filter(o => o.packagingVendorId === contact.id);
    else linkedOrders = orders.filter(o => o.transporterId === contact.id);

    // Linked payment settlements
    const cleanName = (contact.name || '').toLowerCase();
    const cleanPerson = (contact.contactPerson || '').toLowerCase();
    const linkedPayments = payments.filter(p => {
      const pName = (p.partyName || '').toLowerCase();
      return (pName && (pName.includes(cleanName) || (cleanPerson && pName.includes(cleanPerson)))) || (p.orderId && linkedOrders.some(o => o.id === p.orderId));
    });

    // Segmented batches
    const completedBatches = linkedOrders.filter(o => o.status === 'settled');
    const workingBatches = linkedOrders.filter(o => o.status !== 'settled');

    // Financial volume & dues
    let totalVolume = 0;
    let totalPaid = 0;
    let balanceDue = 0;

    if (isMarketeer) {
      totalVolume = linkedOrders.reduce((sum, o) => sum + (o.marketeerCommissionAmount || (o.taxableSubtotal * (contact.commissionRate || 3.0) / 100)), 0);
      totalPaid = linkedPayments.reduce((sum, p) => sum + (p.amount || 0), 0) || (contact.totalBrokeragePaid || 0);
      balanceDue = Math.max(0, totalVolume - totalPaid);
    } else if (isRetailer) {
      totalVolume = linkedOrders.reduce((s, o) => s + (o.totalInvoiceAmount || 0), 0);
      totalPaid = linkedOrders.reduce((s, o) => s + (o.customerAdvanceReceived || 0), 0);
      balanceDue = Math.max(0, totalVolume - totalPaid);
    } else if (isMfg) {
      totalVolume = linkedOrders.reduce((s, o) => s + (o.manufacturerTotalCost || 0), 0);
      totalPaid = linkedOrders.reduce((s, o) => s + (o.manufacturerAdvancePaid || 0), 0);
      balanceDue = Math.max(0, totalVolume - totalPaid);
    } else if (isPkg) {
      totalVolume = linkedOrders.reduce((s, o) => s + (o.packagingCost || 0), 0);
      totalPaid = linkedOrders.reduce((s, o) => s + (o.packagingAdvancePaid || 0), 0);
      balanceDue = Math.max(0, totalVolume - totalPaid);
    } else {
      totalVolume = linkedOrders.reduce((s, o) => s + (o.transportCost || 0), 0);
      totalPaid = linkedOrders.reduce((s, o) => s + (o.transportPaid || 0), 0);
      balanceDue = Math.max(0, totalVolume - totalPaid);
    }

    // Role-specific badge & color themes
    const roleThemes = {
      manufacturer: { label: 'PICKLE FACTORY', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', icon: 'factory', color: 'text-emerald-600', balanceLabel: 'Payable to Factory' },
      retailer: { label: 'RETAILER / BUYER', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', icon: 'store', color: 'text-emerald-600', balanceLabel: 'Receivable from Buyer' },
      marketeer: { label: 'SALES BROKER', bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20', icon: 'handshake', color: 'text-purple-600', balanceLabel: 'Payable Brokerage' },
      packaging: { label: 'PACKAGING SUPPLIER', bg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20', icon: 'package', color: 'text-sky-600', balanceLabel: 'Payable to Supplier' },
      transporter: { label: 'LOGISTICS / FREIGHT', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', icon: 'truck', color: 'text-amber-600', balanceLabel: 'Pending Freight' }
    };
    const theme = roleThemes[contact.role] || roleThemes.retailer;

    // GST State decoding
    const gstin = contact.gstin || '';
    const stateCode = gstin ? gstin.substring(0, 2) : '';
    const stateMap = {
      '27': 'Maharashtra', '24': 'Gujarat', '07': 'Delhi', '06': 'Haryana', '08': 'Rajasthan',
      '09': 'Uttar Pradesh', '29': 'Karnataka', '33': 'Tamil Nadu', '19': 'West Bengal', '23': 'Madhya Pradesh'
    };
    const stateName = stateMap[stateCode] || (contact.state || 'India');

    // Telephony helpers
    const rawPhone = contact.phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
    const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
    const waPhone = digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly;
    const waContextMsg = encodeURIComponent(`Hi ${contact.contactPerson || contact.name}, TradeFlow communication regarding our ${theme.label.toLowerCase()} operations.`);

    // Profile completeness calculation
    const keyFields = [
      { key: 'name', label: 'Company Name' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'email', label: 'Official Email' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'pan', label: 'PAN Card' },
      { key: 'billingAddress', label: 'Billing Address' },
      { key: 'bankName', label: 'Bank Name', fallback: () => contact.bankDetails?.bankName },
      { key: 'accountNumber', label: 'Bank Account No', fallback: () => contact.bankDetails?.accountNumber },
      { key: 'ifsc', label: 'IFSC Code', fallback: () => contact.bankDetails?.ifsc }
    ];
    let filledCount = 0;
    const missingSpecs = [];
    keyFields.forEach(f => {
      const val = contact[f.key] || (f.fallback ? f.fallback() : null);
      if (val && String(val).trim() !== '') filledCount++;
      else missingSpecs.push(f.label);
    });
    const completenessPct = Math.round((filledCount / keyFields.length) * 100);

    const prevCrumb = (typeof app !== 'undefined' && app.navigationStack && app.navigationStack.length) ? app.navigationStack[app.navigationStack.length - 1] : null;
    const backLabel = prevCrumb ? (prevCrumb.title ? `Back to ${prevCrumb.title}` : 'Back') : 'Back to Directory';

    // Logo & Avatar
    const cLogo = contact.logo || contact.logoUrl;
    const avatarHtml = cLogo ? `
      <div class="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
        <img src="${tfEscapeHtml(tfSafeUrl(cLogo))}" alt="${tfEscapeHtml(contact.name)}" class="w-full h-full object-contain p-1" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'font-black text-slate-800 dark:text-white text-base\\'>${tfEscapeHtml(tfEscapeJs((contact.name||'TF').substring(0,2).toUpperCase()))}</span>'">
      </div>
    ` : `
      <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-black text-base flex items-center justify-center shrink-0">
        ${tfEscapeHtml((contact.name || 'TF').substring(0,2).toUpperCase())}
      </div>
    `;

    // Dynamic Custom Tags
    const customSections = Array.isArray(contact.customSections) ? contact.customSections : [];

    // Safe escaped strings for copy
    const safeGstin = (contact.gstin || '').replace(/'/g, "\\'");
    const safePan = (contact.pan || '').replace(/'/g, "\\'");
    const safeFssai = (contact.fssai || contact.fssaiNumber || '').replace(/'/g, "\\'");
    const safeMsme = (contact.msme || '').replace(/'/g, "\\'");
    const safePhone = (contact.phone || '').replace(/'/g, "\\'");
    const safeAltPhone = (contact.altPhone || '').replace(/'/g, "\\'");
    const safeEmail = (contact.email || '').replace(/'/g, "\\'");
    const safeBillingEmail = (contact.billingEmail || '').replace(/'/g, "\\'");
    const safeBilling = (contact.billingAddress || contact.address || '').replace(/'/g, "\\'");
    const safeShipping = (contact.shippingAddress || contact.address || '').replace(/'/g, "\\'");
    const safeBankName = (contact.bankName || contact.bankDetails?.bankName || '').replace(/'/g, "\\'");
    const safeBeneficiary = (contact.beneficiaryName || contact.bankDetails?.beneficiaryName || contact.name || '').replace(/'/g, "\\'");
    const safeAccNo = (contact.accountNumber || contact.bankDetails?.accountNumber || '').replace(/'/g, "\\'");
    const safeIfsc = (contact.ifsc || contact.bankDetails?.ifsc || '').replace(/'/g, "\\'");
    const safeUpi = (contact.upiId || contact.bankDetails?.upiId || '').replace(/'/g, "\\'");

    // Render Order Row for Hub Table
    const renderHubOrderRow = (o) => {
      const orderDate = typeof app !== 'undefined' ? app.formatDate(o.date) : o.date;
      const orderTotal = typeof app !== 'undefined' ? app.formatCurrency(o.totalInvoiceAmount) : '₹' + o.totalInvoiceAmount;
      const advancePaid = typeof app !== 'undefined' ? app.formatCurrency(o.customerAdvanceReceived || o.manufacturerAdvancePaid || 0) : '₹0';
      const orderBal = typeof app !== 'undefined' ? app.formatCurrency(o.customerBalanceDue || (o.manufacturerTotalCost ? Math.max(0, o.manufacturerTotalCost - (o.manufacturerAdvancePaid||0)) : 0)) : '₹0';
      const itemsSummary = (o.items && o.items.length) ? o.items.map(i => `${i.quantity || i.cases || 15}x ${i.variant || i.name}`).join(', ') : 'Mixed Pickle Batch';

      const statusMap = {
        settled: { label: 'Settled', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
        in_production: { label: 'In Production', bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
        in_transit: { label: 'In Transit', bg: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
        delivered_overdue: { label: 'Delivered (Due)', bg: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
        draft: { label: 'Draft', bg: 'bg-slate-500/10 text-slate-600 border-slate-500/20' }
      };
      const st = statusMap[o.status] || { label: o.status || 'Active', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };

      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/80 cursor-pointer" onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')">
          <td class="py-3 px-3.5 font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
            <span class="hover:underline flex items-center gap-1">${tfEscapeHtml(o.invoiceNumber)}<i data-lucide="arrow-up-right" class="w-3 h-3 text-slate-400"></i></span>
          </td>
          <td class="py-3 px-3.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num whitespace-nowrap">${tfEscapeHtml(orderDate)}</td>
          <td class="py-3 px-3.5 text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[220px] truncate" title="${tfEscapeHtml(itemsSummary)}">${tfEscapeHtml(itemsSummary)}</td>
          <td class="py-3 px-3.5 text-xs">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border ${tfEscapeHtml(st.bg)}">${tfEscapeHtml(st.label)}</span>
          </td>
          <td class="py-3 px-3.5 text-xs text-right font-bold font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(orderTotal)}</td>
          <td class="py-3 px-3.5 text-xs text-right font-medium font-mono-num text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(advancePaid)}</td>
          <td class="py-3 px-3.5 text-xs text-right font-black font-mono-num ${tfEscapeHtml(balanceDue > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500')}">${tfEscapeHtml(orderBal)}</td>
          <td class="py-3 px-3.5 text-right whitespace-nowrap" onclick="event.stopPropagation()">
            <button onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="btn-tactile px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1 inline-flex shadow-2xs">
              <i data-lucide="eye" class="w-3 h-3 text-amber-500"></i>
              <span>Inspect</span>
            </button>
          </td>
        </tr>
      `;
    };

    // Render Payment Row for Payments Section
    const renderHubPaymentRow = (p) => {
      const pDate = typeof app !== 'undefined' ? app.formatDate(p.date) : p.date;
      const pAmt = typeof app !== 'undefined' ? app.formatCurrency(p.amount) : '₹' + p.amount;
      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/80 text-xs">
          <td class="py-2.5 px-3.5 font-mono text-slate-500 dark:text-slate-400 font-mono-num whitespace-nowrap">${tfEscapeHtml(pDate)}</td>
          <td class="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">${tfEscapeHtml(p.partyName || contact.name)}</td>
          <td class="py-2.5 px-3.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              ${tfEscapeHtml(p.mode || 'NEFT / RTGS')}
            </span>
          </td>
          <td class="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-300 text-[11px]">${tfEscapeHtml(p.referenceNumber || p.utrNumber || 'BANK-REF')}</td>
          <td class="py-2.5 px-3.5 text-right font-black font-mono-num text-emerald-600 dark:text-emerald-400 text-xs">${tfEscapeHtml(pAmt)}</td>
          <td class="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">${tfEscapeHtml(p.notes || 'Settlement processed')}</td>
        </tr>
      `;
    };

    // Main Return HTML
    return `
      <div class="space-y-4 max-w-7xl mx-auto">
        <!-- Top Navigation & View Switcher Bar -->
        <div class="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <button onclick="app.navigateBack()" class="btn-tactile px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
              <i data-lucide="arrow-left" class="w-4 h-4 text-slate-500"></i>
              <span>${tfEscapeHtml(backLabel)}</span>
            </button>
            <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tfEscapeHtml(theme.bg)}">${tfEscapeHtml(theme.label)}</span>
              <span>/</span>
              <span class="font-bold text-slate-900 dark:text-white">${tfEscapeHtml(contact.name)}</span>
            </div>
          </div>

          <!-- Dual Mode Switcher Tabs (Business Deals Hub vs Profile Dossier) -->
          <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button onclick="app.switchContactViewMode('hub')" class="tf-tab-pill ${tfEscapeHtml(!isDossierMode ? 'active' : '')}">
              <i data-lucide="bar-chart-3" class="w-3.5 h-3.5"></i>
              <span>Business Deals &amp; Orders Hub</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold ${tfEscapeHtml(!isDossierMode ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600')}">${tfEscapeHtml(linkedOrders.length)}</span>
            </button>
            <button onclick="app.switchContactViewMode('dossier')" class="tf-tab-pill ${tfEscapeHtml(isDossierMode ? 'active' : '')}">
              <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
              <span>Profile Dossier &amp; AI Studio</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold ${tfEscapeHtml(isDossierMode ? 'bg-white/25 text-white' : 'bg-emerald-500/15 text-emerald-600')}">${tfEscapeHtml(completenessPct)}%</span>
            </button>
          </div>
        </div>

        ${isDossierMode ? `
          <!-- ================================================================= -->
          <!-- MODE B: ULTRA-COMPACT ZERO-WASTE PROFILE DOSSIER & AI STUDIO      -->
          <!-- ================================================================= -->
          <div class="space-y-4">
            <!-- Zone A: Compact Identity Header Strip (48px) -->
            <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="flex items-center gap-3.5 min-w-0">
                ${avatarHtml}
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">${tfEscapeHtml(contact.name)}</h2>
                    ${contact.brandName ? `<span class="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">Brand: ${tfEscapeHtml(contact.brandName)}</span>` : ''}
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${tfEscapeHtml(theme.bg)}">${tfEscapeHtml(theme.label)}</span>
                    <span class="font-mono text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">${tfEscapeHtml(contact.id)}</span>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      ${tfEscapeHtml(stateCode ? `${stateCode} · ${stateName}` : stateName)}
                    </span>
                  </div>
                  <!-- Profile Completeness Score Meter -->
                  <div class="flex items-center gap-2.5 mt-1.5">
                    <div class="w-32 tf-completeness-meter">
                      <div class="tf-completeness-bar" style="width: ${tfEscapeHtml(completenessPct)}%"></div>
                    </div>
                    <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono-num">${tfEscapeHtml(completenessPct)}% Profile Complete</span>
                    ${missingSpecs.length > 0 ? `
                      <span class="text-[10px] text-amber-600 dark:text-amber-400 font-medium hidden sm:inline">• Missing: ${tfEscapeHtml(missingSpecs.slice(0, 2).join(', '))}</span>
                    ` : `
                      <span class="text-[10px] text-emerald-600 font-bold hidden sm:inline">• ✓ 100% Fully Verified</span>
                    `}
                  </div>
                </div>
              </div>

              <!-- Top Action Quick-Bar -->
              <div class="flex items-center gap-2 flex-wrap shrink-0">
                ${cleanPhone ? `
                  <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waContextMsg)}" target="_blank" rel="noopener noreferrer" class="btn-tactile px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center gap-1.5 shadow-2xs">
                    <i data-lucide="message-circle" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>WhatsApp</span>
                  </a>
                  <a href="tel:${tfEscapeHtml(cleanPhone)}" class="btn-tactile px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-300 dark:border-blue-800 rounded-lg flex items-center gap-1.5 shadow-2xs">
                    <i data-lucide="phone" class="w-3.5 h-3.5 text-blue-600"></i>
                    <span>Call</span>
                  </a>
                ` : ''}
                ${contact.email ? `
                  <a href="mailto:${tfEscapeHtml(contact.email)}" class="btn-tactile px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
                    <i data-lucide="mail" class="w-3.5 h-3.5 text-slate-600"></i>
                    <span>Email</span>
                  </a>
                ` : ''}
                <button onclick="app.toggleDossierAiDrawer()" class="btn-tactile px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-300 dark:border-purple-800 rounded-lg flex items-center gap-1.5 shadow-2xs" title="Open AI Smart Scan & Visiting Card Parser">
                  <i data-lucide="sparkles" class="w-3.5 h-3.5 text-purple-600"></i>
                  <span>AI Smart Filler</span>
                </button>
                <button onclick="app.toggleDossierEditMode()" class="btn-tactile px-3 py-1.5 text-xs font-bold ${tfEscapeHtml(isEditMode ? 'text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950' : 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200')} border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
                  <i data-lucide="${tfEscapeHtml(isEditMode ? 'x' : 'edit-3')}" class="w-3.5 h-3.5 ${tfEscapeHtml(isEditMode ? '' : 'text-amber-500')}"></i>
                  <span>${tfEscapeHtml(isEditMode ? 'Cancel Edit' : 'Edit Details')}</span>
                </button>
              </div>
            </div>

            <!-- Collapsible AI Smart Filler Drawer (0px space when closed) -->
            <div id="dossier-ai-filler-drawer" class="hidden p-5 rounded-2xl bg-gradient-to-r from-purple-500/5 via-white to-amber-500/5 dark:from-purple-950/20 dark:via-slate-900 dark:to-amber-950/20 border-2 border-dashed border-purple-400/50 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="p-1.5 rounded-lg bg-purple-500 text-white"><i data-lucide="sparkles" class="w-4 h-4"></i></span>
                  <div>
                    <h3 class="text-xs font-bold uppercase tracking-wider text-purple-950 dark:text-purple-200">AI Smart Profile Extractor</h3>
                    <p class="text-[11px] text-slate-500">Drop visiting card photo, invoice bill, or paste text to auto-populate without overwriting existing data</p>
                  </div>
                </div>
                <button onclick="app.toggleDossierAiDrawer()" class="text-slate-400 hover:text-slate-600"><i data-lucide="x" class="w-4 h-4"></i></button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-center cursor-pointer hover:border-purple-500 transition-colors" onclick="document.getElementById('dossier-ai-file-input').click()">
                  <i data-lucide="upload-cloud" class="w-6 h-6 text-purple-500 mx-auto mb-1"></i>
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block">Upload Card / Invoice Image</span>
                  <span class="text-[10px] text-slate-400">PNG, JPG, PDF receipt (AI Vision OCR)</span>
                  <input type="file" id="dossier-ai-file-input" class="hidden" accept="image/*" onchange="app.handleDossierImageUpload(this)">
                </div>
                <div class="space-y-2">
                  <textarea id="dossier-ai-text-input" rows="3" placeholder="Or paste trade message, GSTIN, WhatsApp profile text here..." class="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"></textarea>
                  <button onclick="app.runDossierTextExtraction()" class="btn-tactile w-full py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-2xs flex items-center justify-center gap-1.5">
                    <i data-lucide="cpu" class="w-3.5 h-3.5"></i>
                    <span>Extract &amp; Cumulatively Merge</span>
                  </button>
                </div>
              </div>
            </div>

            ${isEditMode ? `
              <!-- ================= INLINE EDIT MODE ================= -->
              <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <i data-lucide="edit-3" class="w-4 h-4 text-amber-500"></i>
                      <span>Edit Profile Specifications (Cumulative Merge Active)</span>
                    </h3>
                    <p class="text-xs text-slate-400 mt-0.5">Blank fields will NEVER overwrite or erase previously saved data</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="app.toggleDossierEditMode(false)" class="btn-tactile px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">Cancel</button>
                    <button type="button" onclick="app.saveDossierForm('${tfEscapeHtml(tfEscapeJs(contact.id))}')" class="btn-tactile px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1">
                      <i data-lucide="check" class="w-3.5 h-3.5"></i>
                      <span>Save Profile Changes</span>
                    </button>
                  </div>
                </div>

                <form id="dossier-edit-form" class="space-y-6" onsubmit="event.preventDefault(); app.saveDossierForm('${tfEscapeHtml(tfEscapeJs(contact.id))}')">
                  <!-- Section 1: Commercial Identity -->
                  <div class="space-y-3">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <i data-lucide="building-2" class="w-3.5 h-3.5 text-emerald-500"></i>
                      <span>1. Commercial &amp; Contact Identity</span>
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Legal Name *</label>
                        <input type="text" id="dossier-name" value="${tfEscapeHtml(contact.name || '')}" required class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Brand / Trade Name</label>
                        <input type="text" id="dossier-brandName" value="${tfEscapeHtml(contact.brandName || '')}" placeholder="e.g. Saurashtra Special" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                        <input type="text" id="dossier-contactPerson" value="${tfEscapeHtml(contact.contactPerson || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                        <input type="text" id="dossier-designation" value="${tfEscapeHtml(contact.designation || 'Partner / Owner')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Primary Phone *</label>
                        <input type="text" id="dossier-phone" value="${tfEscapeHtml(contact.phone || '')}" required class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Alternate Phone</label>
                        <input type="text" id="dossier-altPhone" value="${tfEscapeHtml(contact.altPhone || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Email</label>
                        <input type="email" id="dossier-email" value="${tfEscapeHtml(contact.email || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Terms</label>
                        <input type="text" id="dossier-paymentTerms" value="${tfEscapeHtml(contact.paymentTerms || 'Net 15 Days')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                    </div>
                  </div>

                  <!-- Section 2: Statutory & Tax -->
                  <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <i data-lucide="file-check" class="w-3.5 h-3.5 text-blue-500"></i>
                      <span>2. Statutory &amp; Regulatory Credentials</span>
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">GSTIN (15 Digits)</label>
                        <input type="text" id="dossier-gstin" value="${tfEscapeHtml(contact.gstin || '')}" maxlength="15" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">PAN Card (10 Chars)</label>
                        <input type="text" id="dossier-pan" value="${tfEscapeHtml(contact.pan || '')}" maxlength="10" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">FSSAI Food License</label>
                        <input type="text" id="dossier-fssai" value="${tfEscapeHtml(contact.fssai || contact.fssaiNumber || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">MSME / Udyam Number</label>
                        <input type="text" id="dossier-msme" value="${tfEscapeHtml(contact.msme || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase">
                      </div>
                    </div>
                  </div>

                  <!-- Section 3: Banking & Payout Coordinates -->
                  <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <i data-lucide="landmark" class="w-3.5 h-3.5 text-amber-500"></i>
                      <span>3. Banking &amp; Settlement Coordinates</span>
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
                        <input type="text" id="dossier-bankName" value="${tfEscapeHtml(contact.bankName || contact.bankDetails?.bankName || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Beneficiary Name</label>
                        <input type="text" id="dossier-beneficiaryName" value="${tfEscapeHtml(contact.beneficiaryName || contact.bankDetails?.beneficiaryName || contact.name || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Number</label>
                        <input type="text" id="dossier-accountNumber" value="${tfEscapeHtml(contact.accountNumber || contact.bankDetails?.accountNumber || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">IFSC Code</label>
                        <input type="text" id="dossier-ifsc" value="${tfEscapeHtml(contact.ifsc || contact.bankDetails?.ifsc || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Branch Name</label>
                        <input type="text" id="dossier-branch" value="${tfEscapeHtml(contact.branch || contact.bankDetails?.branch || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">UPI ID (e.g. name@bank)</label>
                        <input type="text" id="dossier-upiId" value="${tfEscapeHtml(contact.upiId || contact.bankDetails?.upiId || '')}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono">
                      </div>
                    </div>
                  </div>

                  <!-- Section 4: Registered & Delivery Addresses -->
                  <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-500"></i>
                      <span>4. Operating Facilities &amp; Addresses</span>
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Registered / Billing Address</label>
                        <textarea id="dossier-billingAddress" rows="2" class="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">${tfEscapeHtml(contact.billingAddress || contact.address || '')}</textarea>
                      </div>
                      <div>
                        <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Factory / Shipping Warehouse Address</label>
                        <textarea id="dossier-shippingAddress" rows="2" class="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">${tfEscapeHtml(contact.shippingAddress || contact.address || '')}</textarea>
                      </div>
                    </div>
                  </div>

                  <!-- Section 5: Dynamic Custom Sections & Tags Builder -->
                  <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <i data-lucide="tag" class="w-3.5 h-3.5 text-purple-500"></i>
                        <span>5. Dynamic Custom Specifications &amp; Notes</span>
                      </h4>
                      <button type="button" onclick="app.promptAddCustomTag('${tfEscapeHtml(tfEscapeJs(contact.id))}')" class="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span>Add Custom Field</span>
                      </button>
                    </div>
                    <div id="dossier-custom-tags-container" class="flex items-center gap-2 flex-wrap">
                      ${customSections.map((cs, idx) => `
                        <span class="tf-custom-tag">
                          <span>${tfEscapeHtml(cs.key)}: <strong>${tfEscapeHtml(cs.val)}</strong></span>
                          <button type="button" onclick="app.removeContactCustomTag('${tfEscapeHtml(tfEscapeJs(contact.id))}', ${tfEscapeHtml(idx)})" class="hover:text-rose-600 font-bold ml-1">×</button>
                        </span>
                      `).join('')}
                      ${customSections.length === 0 ? `<span class="text-xs text-slate-400">No custom tags added yet. Click "+ Add Custom Field" above.</span>` : ''}
                    </div>
                  </div>

                  <!-- Submit Action Row -->
                  <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                    <button type="button" onclick="app.toggleDossierEditMode(false)" class="btn-tactile px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg">Cancel</button>
                    <button type="submit" class="btn-tactile px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5">
                      <i data-lucide="save" class="w-4 h-4"></i>
                      <span>Save All Changes (Cumulative Merge)</span>
                    </button>
                  </div>
                </form>
              </div>
            ` : `
              <!-- ================= READ ONLY MODE: HIGH-DENSITY 3-COLUMN MICRO-MATRIX ================= -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <!-- Column 1: Commercial & Identity -->
                <div class="tf-spec-card space-y-2.5">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <i data-lucide="building-2" class="w-3.5 h-3.5 text-emerald-500"></i>
                      <span>Commercial Identity</span>
                    </span>
                    <span class="text-[10px] font-mono text-slate-400">SPEC-01</span>
                  </div>

                  <div class="space-y-1.5 text-xs">
                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Trade / Entity Name</span>
                        <span class="font-bold text-slate-900 dark:text-white truncate block text-xs" title="${tfEscapeHtml(contact.name)}">${tfEscapeHtml(contact.name)}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(contact.name))}', 'Company Name', this)" class="tf-copy-btn" title="Copy Entity Name">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Contact Person</span>
                        <span class="font-bold text-slate-800 dark:text-slate-200 block text-xs">${tfEscapeHtml(contact.contactPerson || 'Direct')} (${tfEscapeHtml(contact.designation || 'Owner')})</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(contact.contactPerson||''))}', 'Contact Person', this)" class="tf-copy-btn" title="Copy Contact Person">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Primary Telephony</span>
                        <span class="font-mono-num font-bold text-emerald-600 dark:text-emerald-400 text-xs">${tfEscapeHtml(contact.phone || 'Not Specified')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safePhone))}', 'Phone Number', this)" class="tf-copy-btn" title="Copy Phone">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    ${contact.altPhone ? `
                      <div class="tf-spec-cell">
                        <div class="min-w-0 pr-2">
                          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Alternate Phone</span>
                          <span class="font-mono-num font-bold text-slate-700 dark:text-slate-300 text-xs">${tfEscapeHtml(contact.altPhone)}</span>
                        </div>
                        <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAltPhone))}', 'Alternate Phone', this)" class="tf-copy-btn" title="Copy Alt Phone">
                          <i data-lucide="copy" class="w-3 h-3"></i>
                        </button>
                      </div>
                    ` : ''}

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Official Email</span>
                        <span class="font-medium text-slate-800 dark:text-slate-200 truncate block text-xs" title="${tfEscapeHtml(contact.email || 'None')}">${tfEscapeHtml(contact.email || 'orders@tradeflow.com')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeEmail))}', 'Email', this)" class="tf-copy-btn" title="Copy Email">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Payment Terms</span>
                        <span class="font-bold text-amber-600 dark:text-amber-400 text-xs">${tfEscapeHtml(contact.paymentTerms || 'Net 15 Days')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(contact.paymentTerms || 'Net 15 Days'))}', 'Payment Terms', this)" class="tf-copy-btn">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Column 2: Statutory & Tax Verification -->
                <div class="tf-spec-card space-y-2.5">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <i data-lucide="file-check" class="w-3.5 h-3.5 text-blue-500"></i>
                      <span>Tax &amp; Credentials</span>
                    </span>
                    <span class="text-[10px] font-mono text-slate-400">SPEC-02</span>
                  </div>

                  <div class="space-y-1.5 text-xs">
                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">GSTIN Registration</span>
                        <div class="flex items-center gap-1.5 mt-0.5">
                          <span class="font-mono font-bold text-slate-900 dark:text-white text-xs">${tfEscapeHtml(contact.gstin || '27AABCS1234F1Z9')}</span>
                          <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                            ${tfEscapeHtml(stateCode || '27')}
                          </span>
                        </div>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeGstin))}', 'GSTIN', this)" class="tf-copy-btn" title="Copy GSTIN">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Income Tax PAN</span>
                        <span class="font-mono font-bold text-slate-900 dark:text-white text-xs">${tfEscapeHtml(contact.pan || (gstin ? gstin.substring(2, 12) : 'AABCS1234F'))}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safePan))}', 'PAN', this)" class="tf-copy-btn" title="Copy PAN">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">FSSAI Food License</span>
                        <span class="font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs">${tfEscapeHtml(contact.fssai || contact.fssaiNumber || '11521034000123')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeFssai))}', 'FSSAI License', this)" class="tf-copy-btn" title="Copy FSSAI">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">MSME / Udyam No</span>
                        <span class="font-mono font-medium text-slate-800 dark:text-slate-200 text-xs">${tfEscapeHtml(contact.msme || 'UDYAM-MH-01-0012345')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeMsme))}', 'MSME Number', this)" class="tf-copy-btn" title="Copy MSME">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Business Nature</span>
                        <span class="font-medium text-slate-800 dark:text-slate-200 text-xs">${tfEscapeHtml(contact.businessNature || contact.businessType || 'B2B Trade & Processing')}</span>
                      </div>
                      <span class="text-[10px] text-emerald-600 font-bold">✓ Active</span>
                    </div>
                  </div>
                </div>

                <!-- Column 3: Banking & Payout Coordinates -->
                <div class="tf-spec-card space-y-2.5">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <i data-lucide="landmark" class="w-3.5 h-3.5 text-amber-500"></i>
                      <span>Banking Coordinates</span>
                    </span>
                    <span class="text-[10px] font-mono text-slate-400">SPEC-03</span>
                  </div>

                  <div class="space-y-1.5 text-xs">
                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Bank Name &amp; Branch</span>
                        <span class="font-bold text-slate-900 dark:text-white text-xs">${tfEscapeHtml(contact.bankName || contact.bankDetails?.bankName || 'HDFC Bank')} • ${tfEscapeHtml(contact.branch || contact.bankDetails?.branch || 'Vashi APMC')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeBankName))}', 'Bank Name', this)" class="tf-copy-btn" title="Copy Bank Name">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Beneficiary Name</span>
                        <span class="font-medium text-slate-800 dark:text-slate-200 truncate block text-xs">${tfEscapeHtml(contact.beneficiaryName || contact.bankDetails?.beneficiaryName || contact.name)}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeBeneficiary))}', 'Beneficiary Name', this)" class="tf-copy-btn" title="Copy Beneficiary">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Account Number</span>
                        <span class="font-mono font-bold text-slate-900 dark:text-white text-xs">${tfEscapeHtml(contact.accountNumber || contact.bankDetails?.accountNumber || '50200012345678')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAccNo))}', 'Account Number', this)" class="tf-copy-btn" title="Copy Account No">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Bank IFSC Code</span>
                        <span class="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">${tfEscapeHtml(contact.ifsc || contact.bankDetails?.ifsc || 'HDFC0001234')}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeIfsc))}', 'IFSC Code', this)" class="tf-copy-btn" title="Copy IFSC">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>

                    <div class="tf-spec-cell">
                      <div class="min-w-0 pr-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Instant UPI VPA</span>
                        <span class="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-semibold">${tfEscapeHtml(contact.upiId || contact.bankDetails?.upiId || `${(contact.name||'trade').toLowerCase().replace(/[^a-z]/g,'')}@okhdfcbank`)}</span>
                      </div>
                      <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeUpi))}', 'UPI ID', this)" class="tf-copy-btn" title="Copy UPI">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Zone C: Compact 2-Column Facility & Dispatch Bar -->
              <div class="p-4 rounded-xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div class="tf-spec-cell">
                    <div class="min-w-0 pr-2">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <i data-lucide="map-pin" class="w-3 h-3 text-rose-500"></i>
                        <span>Registered Office / Billing Address</span>
                      </span>
                      <p class="font-medium text-slate-800 dark:text-slate-200 mt-0.5 line-clamp-2">${tfEscapeHtml(contact.billingAddress || contact.address || 'Shop 14, APMC Market, Sector 19, Vashi, Navi Mumbai - 400703')}</p>
                    </div>
                    <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeBilling))}', 'Billing Address', this)" class="tf-copy-btn" title="Copy Billing Address">
                      <i data-lucide="copy" class="w-3 h-3"></i>
                    </button>
                  </div>

                  <div class="tf-spec-cell">
                    <div class="min-w-0 pr-2">
                      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <i data-lucide="truck" class="w-3 h-3 text-blue-500"></i>
                        <span>Factory / Dispatch Gate Address</span>
                      </span>
                      <p class="font-medium text-slate-800 dark:text-slate-200 mt-0.5 line-clamp-2">${tfEscapeHtml(contact.shippingAddress || contact.address || 'Plot 42, Food Industrial Estate, Sonipat, Haryana - 131001')}</p>
                    </div>
                    <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeShipping))}', 'Shipping Address', this)" class="tf-copy-btn" title="Copy Shipping Address">
                      <i data-lucide="copy" class="w-3 h-3"></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Zone D: Dynamic Custom Specifications & Tags (Zero Wasted Space) -->
              <div class="p-4 rounded-xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <i data-lucide="tag" class="w-3.5 h-3.5 text-purple-500"></i>
                    <span>Custom Specifications:</span>
                  </span>
                  ${customSections.map((cs, idx) => `
                    <span class="tf-custom-tag">
                      <span>${tfEscapeHtml(cs.key)}: <strong>${tfEscapeHtml(cs.val)}</strong></span>
                      <button onclick="app.removeContactCustomTag('${tfEscapeHtml(tfEscapeJs(contact.id))}', ${tfEscapeHtml(idx)})" class="hover:text-rose-600 font-bold ml-1" title="Remove tag">×</button>
                    </span>
                  `).join('')}
                  ${customSections.length === 0 ? `<span class="text-xs text-slate-400">None added yet.</span>` : ''}
                </div>
                <button onclick="app.promptAddCustomTag('${tfEscapeHtml(tfEscapeJs(contact.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-1">
                  <i data-lucide="plus" class="w-3 h-3"></i>
                  <span>Add Custom Spec</span>
                </button>
              </div>
            `}
          </div>
        ` : `
          <!-- ================================================================= -->
          <!-- MODE A: FULL-WINDOW BUSINESS DEALS, ORDERS & PAYMENTS HUB         -->
          <!-- ================================================================= -->
          <div class="space-y-5">
            <!-- Financial KPI Ribbon -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="p-4 rounded-2xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  ${tfEscapeHtml(isMarketeer ? 'Brokerage Generated' : (isMfg ? 'Factory Job-Work Cost' : (isPkg ? 'Packaging Bills' : 'Total B2B Volume')))}
                </span>
                <span class="text-xl sm:text-2xl font-black font-mono-num text-slate-900 dark:text-white">
                  ${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(totalVolume) : '₹' + totalVolume)}
                </span>
                <span class="text-[11px] text-slate-500 block mt-1">${tfEscapeHtml(linkedOrders.length)} Linked Deal Batches</span>
              </div>

              <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">
                  ${tfEscapeHtml(isMarketeer ? 'Commission Paid' : (isRetailer ? 'Customer Advances Recv' : 'Advances Disbursed'))}
                </span>
                <span class="text-xl sm:text-2xl font-black font-mono-num text-emerald-600 dark:text-emerald-400">
                  ${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(totalPaid) : '₹' + totalPaid)}
                </span>
                <span class="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 block mt-1">${tfEscapeHtml(linkedPayments.length)} Bank Transactions</span>
              </div>

              <div class="p-4 rounded-2xl ${tfEscapeHtml(balanceDue > 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800')} shadow-sm">
                <span class="text-[10px] font-bold uppercase tracking-wider ${tfEscapeHtml(balanceDue > 0 ? 'text-blue-800 dark:text-blue-300' : 'text-slate-400')} block mb-1">
                  ${tfEscapeHtml(theme.balanceLabel)}
                </span>
                <span class="text-xl sm:text-2xl font-black font-mono-num ${tfEscapeHtml(balanceDue > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300')}">
                  ${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(balanceDue) : '₹' + balanceDue)}
                </span>
                <span class="text-[11px] font-bold ${tfEscapeHtml(balanceDue > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600')} block mt-1">
                  ${tfEscapeHtml(balanceDue > 0 ? 'Action Required' : '✓ Fully Reconciled')}
                </span>
              </div>

              <div class="p-4 rounded-2xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Production Batches</span>
                <div class="flex items-baseline gap-2">
                  <span class="text-xl sm:text-2xl font-black font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(workingBatches.length)}</span>
                  <span class="text-xs text-slate-400 font-medium">In Production / Transit</span>
                </div>
                <span class="text-[11px] text-slate-500 block mt-1">${tfEscapeHtml(completedBatches.length)} Batches Delivered &amp; Settled</span>
              </div>
            </div>

            <!-- SECTION 1: Orders & Deals Ledger Table -->
            <div id="hub-orders-section" class="p-5 rounded-2xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3 transition-all duration-300">
              <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600"><i data-lucide="package" class="w-4 h-4"></i></span>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white">All Purchase Orders &amp; Commercial Deals (${tfEscapeHtml(linkedOrders.length)})</h3>
                    <p class="text-xs text-slate-400">Click any row to inspect complete batch manufacturing &amp; dispatch tracking</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick="app.openOrderFormModal()" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1.5">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>Create New PO / Deal</span>
                  </button>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                      <th class="py-2.5 px-3.5">PO / Invoice #</th>
                      <th class="py-2.5 px-3.5">Date</th>
                      <th class="py-2.5 px-3.5">Products / Flavours</th>
                      <th class="py-2.5 px-3.5">Status</th>
                      <th class="py-2.5 px-3.5 text-right">Order Value</th>
                      <th class="py-2.5 px-3.5 text-right">Advance Paid</th>
                      <th class="py-2.5 px-3.5 text-right">Balance Due</th>
                      <th class="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linkedOrders.length > 0 ? linkedOrders.map(renderHubOrderRow).join('') : `
                      <tr>
                        <td colspan="8" class="py-8 text-center text-slate-400 text-xs">
                          No orders or commercial deals recorded for this partner yet.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- SECTION 2: Payments & Commercial Settlements Ledger -->
            <div id="hub-payments-section" class="p-5 rounded-2xl bg-white dark:bg-[#10141e] border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3 transition-all duration-300">
              <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="p-1.5 rounded-lg bg-blue-500/10 text-blue-600"><i data-lucide="wallet" class="w-4 h-4"></i></span>
                  <div>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white">Payments &amp; Commercial Settlement Statement (${tfEscapeHtml(linkedPayments.length)})</h3>
                    <p class="text-xs text-slate-400">Complete audit trail of RTGS/NEFT slips, advances, and bank settlements</p>
                  </div>
                </div>
                <button onclick="app.openPaymentModal()" class="btn-tactile px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-1.5 shadow-2xs">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                  <span>Record Payment Settlement</span>
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                      <th class="py-2.5 px-3.5">Date</th>
                      <th class="py-2.5 px-3.5">Counterparty</th>
                      <th class="py-2.5 px-3.5">Mode</th>
                      <th class="py-2.5 px-3.5">UTR / Bank Ref #</th>
                      <th class="py-2.5 px-3.5 text-right">Amount Settled</th>
                      <th class="py-2.5 px-3.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linkedPayments.length > 0 ? linkedPayments.map(renderHubPaymentRow).join('') : `
                      <tr>
                        <td colspan="6" class="py-8 text-center text-slate-400 text-xs">
                          No direct bank settlements recorded yet. Click "Record Payment Settlement" above to log advances.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `}
      </div>
    `;
  },



  /* ==========================================================================
     5. PICKLE PRODUCTS & SKU MASTER COMPONENT
     ========================================================================== */
  renderSkuGrid(products = [], orders = [], filterOptions = {}) {
    const totalSkus = products.length;
    let totalMarginSum = 0;

    products.forEach(p => {
      const cogs = (p.baseCostPerUnit || 0) + (p.pkgCostPerUnit || 0);
      const margin = (p.defaultUnitRate || 0) - cogs;
      const marginPct = p.defaultUnitRate > 0 ? (margin / p.defaultUnitRate) * 100 : 0;
      totalMarginSum += marginPct;
    });

    const avgMargin = totalSkus > 0 ? (totalMarginSum / totalSkus).toFixed(1) : '30.0';

    const cardsHtml = products.map(p => {
      const mfgCost = p.baseCostPerUnit || 48.00;
      const pkgCost = p.pkgCostPerUnit || 11.50;
      const unitCogs = mfgCost + pkgCost;
      const sellingPrice = p.defaultUnitRate || 85.00;
      const mrp = p.mrp || (sellingPrice * 1.4);
      const grossMargin = Math.max(0, sellingPrice - unitCogs);
      const marginPct = sellingPrice > 0 ? ((grossMargin / sellingPrice) * 100).toFixed(1) : '0';
      const retailerMargin = Math.max(0, mrp - sellingPrice);

      // Pack size visual styling
      const isGlass = p.variant && p.variant.toLowerCase().includes('glass');
      const isBucket = p.variant && (p.variant.toLowerCase().includes('bucket') || p.variant.toLowerCase().includes('5kg'));
      const packBadge = isBucket ? '5kg Food Service Bucket' : (isGlass ? '1kg Glass Jar' : '500g PET Jar');
      const packIcon = isBucket ? 'archive' : (isGlass ? 'flask-conical' : 'package');

      // Check how many active orders are using this SKU
      const activeBatchesCount = orders.filter(o => 
        o.status !== 'settled' && o.items && o.items.some(i => i.productId === p.id || i.name === p.name)
      ).length;

      return `
        <div class="tf-card p-5 rounded-2xl bg-white dark:bg-[#111522] border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all shadow-xs flex flex-col justify-between group">
          <div>
            <!-- SKU Card Header -->
            <div class="flex items-start justify-between gap-2 mb-3">
              <div class="min-w-0">
                <h3 class="font-extrabold text-slate-900 dark:text-white text-sm truncate" title="${tfEscapeHtml(p.name)}">
                  ${tfEscapeHtml(p.name)}
                </h3>
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <i data-lucide="${tfEscapeHtml(packIcon)}" class="w-3 h-3 text-amber-500"></i>
                    <span>${tfEscapeHtml(p.variant || packBadge)}</span>
                  </span>
                  <span class="px-1.5 py-0.5 text-[10px] font-mono-num font-bold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    ${tfEscapeHtml(p.id)}
                  </span>
                </div>
              </div>
            </div>

            <!-- Costing Breakdown Section -->
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70 space-y-2 text-xs mb-3.5">
              <div class="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Factory Base Mfg:</span>
                <span class="font-mono-num font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(mfgCost) : '₹' + mfgCost)}</span>
              </div>
              <div class="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Jar &amp; Label Pack:</span>
                <span class="font-mono-num font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(pkgCost) : '₹' + pkgCost)}</span>
              </div>

              <!-- Visual Split COGS Bar -->
              <div class="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
                <div class="flex justify-between items-center font-bold text-slate-900 dark:text-white text-xs mb-1">
                  <span>Total Unit COGS:</span>
                  <span class="font-mono-num font-black text-amber-600 dark:text-amber-400">${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(unitCogs) : '₹' + unitCogs)}</span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                  <div class="bg-blue-500 h-full" style="width: ${tfEscapeHtml((mfgCost / unitCogs) * 100)}%" title="Factory: ${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(mfgCost) : mfgCost)}"></div>
                  <div class="bg-sky-400 h-full" style="width: ${tfEscapeHtml((pkgCost / unitCogs) * 100)}%" title="Packaging: ${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(pkgCost) : pkgCost)}"></div>
                </div>
              </div>
            </div>

            <!-- Pricing & Profit Scenario -->
            <div class="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-2 text-xs mb-3.5">
              <div class="flex justify-between items-center">
                <span class="text-slate-500 dark:text-slate-400">Selling to Retailer:</span>
                <span class="font-mono-num font-black text-sm text-slate-900 dark:text-white">${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(sellingPrice) : '₹' + sellingPrice)}</span>
              </div>
              <div class="flex justify-between items-center text-[11px] text-slate-400">
                <span>MRP (Retail Price):</span>
                <span class="font-mono-num font-semibold text-slate-600 dark:text-slate-300">${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(mrp) : '₹' + mrp)}</span>
              </div>
              <div class="pt-1.5 border-t border-amber-500/15 flex justify-between items-center">
                <span class="text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">Gross Unit Margin:</span>
                <span class="inline-flex items-center gap-1 font-mono-num font-black text-xs ${tfEscapeHtml(parseFloat(marginPct) >= 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600')}">
                  +${tfEscapeHtml(typeof app !== 'undefined' ? app.formatCurrency(grossMargin) : '₹' + grossMargin)} (${tfEscapeHtml(marginPct)}%)
                </span>
              </div>
            </div>

            <!-- Active Orders using this SKU -->
            <div class="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-2">
              <span>Case Pack: <strong class="text-slate-700 dark:text-slate-300 font-mono-num">${tfEscapeHtml(p.casePack || 24)} jars/case</strong></span>
              <span class="font-semibold text-slate-600 dark:text-slate-300">
                ${tfEscapeHtml(activeBatchesCount > 0 ? `🔥 Used in ${activeBatchesCount} Batches` : 'Standard Catalog')}
              </span>
            </div>
          </div>

          <!-- Bottom Action Buttons: Edit SKU & Simulate Batch -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <button onclick="app.openSkuEditModal('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile flex-1 py-1.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center gap-1.5 shadow-2xs">
              <i data-lucide="edit-3" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Edit SKU</span>
            </button>
            <button onclick="app.openSkuCalculatorModal('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile flex-1 py-1.5 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 rounded-lg shadow-2xs flex items-center justify-center gap-1.5">
              <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
              <span>Simulate Batch</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-6">
        <!-- Top SKU Master Hero & Controls -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[#10141e] border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div>
            <div class="flex items-center gap-2.5 mb-1">
              <span class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <i data-lucide="tag" class="w-5 h-5"></i>
              </span>
              <div>
                <h2 class="text-base font-extrabold text-slate-900 dark:text-white">Pickle Products &amp; SKU Master</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Track base factory cost, jar/label packaging expense, selling prices, and profit margins</p>
              </div>
            </div>
          </div>

          <!-- Quick Metrics & Actions -->
          <div class="flex items-center gap-3 flex-wrap">
            <div class="p-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Catalog</span>
              <span class="font-mono-num font-black text-sm text-slate-900 dark:text-white">${tfEscapeHtml(totalSkus)} SKUs</span>
            </div>
            <div class="p-2.5 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-0.5">Avg Margin</span>
              <span class="font-mono-num font-black text-sm text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(avgMargin)}%</span>
            </div>
            <span class="px-3 py-2 rounded-xl text-xs font-mono-num font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              HSN: 20019000 (12% GST)
            </span>
            <button onclick="app.openSkuCalculatorModal()" class="btn-tactile px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 rounded-lg shadow-sm flex items-center gap-1.5">
              <i data-lucide="calculator" class="w-4 h-4"></i>
              <span>Batch Profit Simulator</span>
            </button>
          </div>
        </div>

        <!-- SKU Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

};
