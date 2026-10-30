/* Unified TradeFlow Smart Fill intake.
 * Reuses the NVIDIA extraction API exercised by api_test_lab.html and only
 * applies reviewed values to the existing partner/payment forms.
 */
(() => {
  const node = (id) => document.getElementById(id);
  const clean = (value) => value === null || value === undefined ? '' : String(value).trim();
  const esc = (value) => clean(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const postAi = async (endpoint, payload) => {
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    try {
      return await fetch(`/api/ai/${endpoint}`, options);
    } catch (_) {
      throw new Error('Could not reach the TradeFlow server. Make sure TradeFlow is running.');
    }
  };

  class TradeFlowSmartFillController {
    constructor() {
      this.context = 'auto';
      this.extracted = null;
      this.originalFile = null;
      this.originalDataUrl = '';
      this.visionDataUrl = '';
      this.visionMimeType = '';
      this.rawText = '';
      this.isInvoice = false;
      this.lastSnapshot = null;
      this.pendingPartnerArchive = null;
      this.busy = false;
      this.nvidiaBusy = false;
      this.previewOpen = false;
      this.previewZoom = 1.0;
      this.duplicateConflict = null;
      this.isPdf = false;
      this.pdfDoc = null;
      this.pdfCurrentPage = 1;
      this.pdfTotalPages = 1;
      this.isRenderingPdf = false;
      this.pendingPdfRender = false;
      this.textInspectorOpen = false;
      this.partnerCollision = null;
      this.isPanning = false;
      this.panStartX = 0;
      this.panStartY = 0;
      this.scrollStartX = 0;
      this.scrollStartY = 0;
      this.imageNaturalWidth = 0;
      this.imageNaturalHeight = 0;
      this.pdfBaseWidth = 0;
      this.pdfBaseHeight = 0;
      this.customReviewFields = new Set();
    }

    togglePreview(forceState) {
      if (typeof forceState === 'boolean') {
        this.previewOpen = forceState;
      } else {
        this.previewOpen = !this.previewOpen;
      }
      const pane = node('smart-fill-preview-pane');
      const panel = node('smart-fill-modal-panel');
      const btnText = node('smart-fill-btn-preview-text');
      if (this.previewOpen) {
        pane?.classList.remove('hidden');
        pane?.classList.add('flex');
        panel?.classList.remove('max-w-5xl');
        panel?.classList.add('max-w-7xl', 'w-[96vw]');
        if (btnText) btnText.textContent = 'Hide Preview';
        this.renderPreviewContent();
      } else {
        pane?.classList.add('hidden');
        pane?.classList.remove('flex');
        panel?.classList.remove('max-w-7xl', 'w-[96vw]');
        panel?.classList.add('max-w-5xl');
        if (btnText) btnText.textContent = 'Toggle Preview';
      }
    }

    toggleTextInspector(forceState) {
      if (typeof forceState === 'boolean') {
        this.textInspectorOpen = forceState;
      } else {
        this.textInspectorOpen = !this.textInspectorOpen;
      }
      const drawer = node('smart-fill-text-inspector');
      if (this.textInspectorOpen) {
        drawer?.classList.remove('hidden');
        drawer?.classList.add('flex');
        const inspectorText = node('smart-fill-inspector-raw-text');
        if (inspectorText) inspectorText.value = this.rawText || node('smart-fill-text')?.value || '';
        if (!this.previewOpen && (this.originalDataUrl || this.visionDataUrl)) {
          this.togglePreview(true);
        }
      } else {
        drawer?.classList.add('hidden');
        drawer?.classList.remove('flex');
      }
    }

    copyExtractedText() {
      const text = node('smart-fill-inspector-raw-text')?.value || this.rawText || '';
      if (!text) {
        window.app?.showToast?.('No extracted text to copy.');
        return;
      }
      navigator.clipboard?.writeText?.(text).then(() => {
        window.app?.showToast?.('📋 Extracted text copied to clipboard!');
      }).catch(() => {
        window.app?.showToast?.('Could not copy to clipboard.');
      });
    }

    applyInspectorTextAndAnalyze() {
      const text = clean(node('smart-fill-inspector-raw-text')?.value);
      if (text) {
        this.rawText = text;
        const mainInput = node('smart-fill-text');
        if (mainInput) mainInput.value = text;
      }
      this.toggleTextInspector(false);
      this.analyze();
    }

    zoomIn() { this.setZoom(this.previewZoom * 1.15); }
    zoomOut() { this.setZoom(this.previewZoom * 0.85); }
    resetZoom() { this.setZoom(1.0); }

    fitWidth() {
      const viewport = node('smart-fill-preview-viewport');
      if (!viewport) return;
      const availWidth = Math.max(150, viewport.clientWidth - 32);
      let targetWidth = 600;
      if (this.isPdf && this.pdfBaseWidth) targetWidth = this.pdfBaseWidth;
      else if (this.imageNaturalWidth) targetWidth = this.imageNaturalWidth;
      this.setZoom(availWidth / targetWidth);
    }

    fitPage() {
      const viewport = node('smart-fill-preview-viewport');
      if (!viewport) return;
      const availWidth = Math.max(150, viewport.clientWidth - 32);
      const availHeight = Math.max(150, viewport.clientHeight - 32);
      let targetWidth = 600, targetHeight = 800;
      if (this.isPdf && this.pdfBaseWidth) {
        targetWidth = this.pdfBaseWidth;
        targetHeight = this.pdfBaseHeight || 800;
      } else if (this.imageNaturalWidth) {
        targetWidth = this.imageNaturalWidth;
        targetHeight = this.imageNaturalHeight || 800;
      }
      this.setZoom(Math.min(availWidth / targetWidth, availHeight / targetHeight));
    }

    zoomAtPoint(val, clientX, clientY) {
      const viewport = node('smart-fill-preview-viewport');
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;

      const oldZoom = this.previewZoom;
      const clampedZoom = Math.max(0.05, Math.min(5.0, val));
      if (Math.abs(oldZoom - clampedZoom) < 0.005) return;

      const ratio = clampedZoom / oldZoom;
      const newScrollLeft = (viewport.scrollLeft + pointerX) * ratio - pointerX;
      const newScrollTop = (viewport.scrollTop + pointerY) * ratio - pointerY;

      this.setZoom(clampedZoom);
      viewport.scrollLeft = Math.max(0, newScrollLeft);
      viewport.scrollTop = Math.max(0, newScrollTop);
    }

    setZoom(val) {
      this.previewZoom = Math.max(0.05, Math.min(5.0, val));
      const lbl = node('smart-fill-zoom-val');
      if (lbl) lbl.textContent = `${Math.round(this.previewZoom * 100)}%`;

      if (this.isPdf && this.pdfDoc) {
        this.renderPdfPreview();
      } else {
        const img = node('smart-fill-preview-img');
        if (img) {
          const baseW = this.imageNaturalWidth || 600;
          img.style.width = `${Math.round(baseW * this.previewZoom)}px`;
          img.style.maxWidth = 'none';
        }
      }
    }

    async rotatePreview(degrees = 90) {
      if (!this.originalDataUrl && !this.visionDataUrl) return;
      const currentUrl = this.originalDataUrl || this.visionDataUrl;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.height;
        canvas.height = img.width;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const rotatedUrl = canvas.toDataURL('image/jpeg', 0.9);
        this.originalDataUrl = rotatedUrl;
        this.visionDataUrl = rotatedUrl;
        this.imageNaturalWidth = canvas.width;
        this.imageNaturalHeight = canvas.height;
        this.needsAutoFit = true;
        this.renderPreviewContent();
        // Re-run local RapidOCR on the rotated upright image
        this.runRapidOcrIntake(this.originalFile || { name: 'rotated_document.jpg', size: 150000 });
      };
      img.src = tfSafeUrl(currentUrl);
    }

    toggleCropMode(forceState) {
      this.isCropMode = (typeof forceState === 'boolean') ? forceState : !this.isCropMode;
      const overlay = node('smart-fill-desktop-crop-overlay');
      const marquee = node('smart-fill-crop-marquee');
      const cropBtnLabel = node('smart-fill-btn-crop-label');
      if (cropBtnLabel) cropBtnLabel.textContent = this.isCropMode ? 'Cancel' : 'Crop';
      if (!overlay || !marquee) return;
      if (this.isCropMode) {
        overlay.classList.remove('hidden');
        const vp = node('smart-fill-preview-viewport');
        const vW = vp.clientWidth || 400;
        const vH = vp.clientHeight || 500;
        marquee.style.left = Math.round(vW * 0.1) + 'px';
        marquee.style.top = Math.round(vH * 0.1) + 'px';
        marquee.style.width = Math.round(vW * 0.8) + 'px';
        marquee.style.height = Math.round(vH * 0.8) + 'px';
        this.initDesktopCropDrag();
      } else {
        overlay.classList.add('hidden');
      }
    }

    initDesktopCropDrag() {
      const marquee = node('smart-fill-crop-marquee');
      const overlay = node('smart-fill-desktop-crop-overlay');
      if (!marquee || !overlay || marquee._cropBound) return;
      marquee._cropBound = true;

      let isDragging = false;
      let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

      marquee.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = marquee.offsetLeft;
        initialTop = marquee.offsetTop;
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        marquee.style.left = Math.max(0, initialLeft + dx) + 'px';
        marquee.style.top = Math.max(0, initialTop + dy) + 'px';
      });

      window.addEventListener('mouseup', () => { isDragging = false; });
    }

    applyDesktopCrop() {
      const marquee = node('smart-fill-crop-marquee');
      const img = node('smart-fill-preview-img');
      if (!marquee || !img) return;

      const mRect = marquee.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();

      const scaleX = (this.imageNaturalWidth || img.naturalWidth) / Math.max(1, iRect.width);
      const scaleY = (this.imageNaturalHeight || img.naturalHeight) / Math.max(1, iRect.height);

      const cropX = Math.max(0, (mRect.left - iRect.left) * scaleX);
      const cropY = Math.max(0, (mRect.top - iRect.top) * scaleY);
      const cropW = Math.min((this.imageNaturalWidth || img.naturalWidth) - cropX, mRect.width * scaleX);
      const cropH = Math.min((this.imageNaturalHeight || img.naturalHeight) - cropY, mRect.height * scaleY);

      if (cropW < 20 || cropH < 20) {
        window.app?.showToast?.('Selected crop area is too small.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropW);
      canvas.height = Math.round(cropH);
      const ctx = canvas.getContext('2d');
      const sourceImg = new Image();
      sourceImg.onload = () => {
        ctx.drawImage(sourceImg, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        const croppedUrl = canvas.toDataURL('image/jpeg', 0.9);
        this.originalDataUrl = croppedUrl;
        this.visionDataUrl = croppedUrl;
        this.imageNaturalWidth = canvas.width;
        this.imageNaturalHeight = canvas.height;
        this.toggleCropMode(false);
        this.needsAutoFit = true;
        this.renderPreviewContent();
        this.runRapidOcrIntake(this.originalFile || { name: 'cropped_document.jpg', size: 100000 });
      };
      sourceImg.src = tfSafeUrl(this.originalDataUrl || this.visionDataUrl);
    }

    prevPdfPage() {
      if (!this.isPdf || !this.pdfDoc || this.pdfCurrentPage <= 1) return;
      this.pdfCurrentPage--;
      this.renderPdfPreview();
    }

    nextPdfPage() {
      if (!this.isPdf || !this.pdfDoc || this.pdfCurrentPage >= this.pdfTotalPages) return;
      this.pdfCurrentPage++;
      this.renderPdfPreview();
    }

    updatePdfPageControls() {
      const controls = node('smart-fill-pdf-page-controls');
      const pageLbl = node('smart-fill-pdf-page-num');
      const prevBtn = node('smart-fill-pdf-prev-btn');
      const nextBtn = node('smart-fill-pdf-next-btn');
      if (!controls) return;
      if (this.isPdf && this.pdfTotalPages > 1) {
        controls.classList.remove('hidden');
        controls.classList.add('flex');
        if (pageLbl) pageLbl.textContent = `${this.pdfCurrentPage} / ${this.pdfTotalPages}`;
        if (prevBtn) prevBtn.disabled = this.pdfCurrentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.pdfCurrentPage >= this.pdfTotalPages;
      } else {
        controls.classList.add('hidden');
        controls.classList.remove('flex');
      }
    }

    hidePdfPageControls() {
      const controls = node('smart-fill-pdf-page-controls');
      if (controls) {
        controls.classList.add('hidden');
        controls.classList.remove('flex');
      }
    }

    downloadOriginalFile() {
      const data = this.originalDataUrl || this.visionDataUrl;
      if (!data) {
        window.app?.showToast?.('No document available to download.');
        return;
      }
      const fileName = this.originalFile?.name || (this.isPdf ? 'document.pdf' : 'document.jpg');
      const a = document.createElement('a');
      a.href = tfSafeUrl(data);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.app?.showToast?.(`📥 Downloading ${fileName}...`);
    }

    openPreviewNewTab() {
      const data = this.originalDataUrl || this.visionDataUrl;
      if (!data) {
        window.app?.showToast?.('No document available to open.');
        return;
      }
      const fileName = this.originalFile?.name || (this.isPdf ? 'document.pdf' : 'document.jpg');
      const win = window.open();
      if (win) {
        if (this.isPdf || fileName.toLowerCase().endsWith('.pdf') || (typeof data === 'string' && data.startsWith('data:application/pdf'))) {
          win.document.write(`<!DOCTYPE html><html><head><title>${tfEscapeHtml(esc(fileName))}</title><style>body,html{margin:0;padding:0;height:100%;overflow:hidden;background:#0f172a;}</style></head><body><iframe src="${tfEscapeHtml(tfSafeUrl(data))}" frameborder="0" style="width:100%;height:100%;border:none;" allowfullscreen></iframe></body></html>`);
        } else {
          win.document.write(`<!DOCTYPE html><html><head><title>${tfEscapeHtml(esc(fileName))}</title><style>body,html{margin:0;padding:0;min-height:100%;display:flex;align-items:center;justify-content:center;background:#0f172a;}</style></head><body><img src="${tfEscapeHtml(tfSafeUrl(data))}" style="max-width:100%;max-height:100vh;box-shadow:0 10px 25px rgba(0,0,0,0.5);border-radius:8px;"></body></html>`);
        }
      }
    }

    async renderPreviewContent() {
      const wrap = node('smart-fill-canvas-wrapper');
      const fname = node('smart-fill-preview-filename');
      if (fname && this.originalFile) {
        fname.textContent = this.originalFile.name;
        fname.title = this.originalFile.name;
      }
      if (!wrap) return;

      if (this.isPdf) {
        await this.renderPdfPreview();
      } else if (this.originalDataUrl || this.visionDataUrl) {
        this.hidePdfPageControls();
        const src = this.originalDataUrl || this.visionDataUrl;
        wrap.style.transform = 'none';

        const img = new Image();
        img.onload = () => {
          this.imageNaturalWidth = img.naturalWidth || 800;
          this.imageNaturalHeight = img.naturalHeight || 1000;
          if (this.needsAutoFit !== false) {
            this.needsAutoFit = false;
            this.fitPage();
          } else {
            const targetWidth = Math.round(this.imageNaturalWidth * this.previewZoom);
            wrap.innerHTML = `<img id="smart-fill-preview-img" src="${tfEscapeHtml(tfSafeUrl(src))}" style="width: ${tfEscapeHtml(targetWidth)}px; max-width: none;" class="h-auto rounded shadow-2xl border border-slate-700 pointer-events-none select-none transition-all duration-75" alt="Preview">`;
          }
        };
        img.onerror = () => {
          wrap.innerHTML = `<img id="smart-fill-preview-img" src="${tfEscapeHtml(tfSafeUrl(src))}" style="max-width: none;" class="max-w-full h-auto rounded shadow-lg border border-slate-700 pointer-events-none select-none" alt="Preview">`;
        };
        img.src = tfSafeUrl(src);
      } else {
        this.hidePdfPageControls();
        wrap.style.transform = 'none';
        wrap.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No visual document attached to preview</div>`;
      }
      if (window.lucide) window.lucide.createIcons();
    }

    async renderPdfPreview() {
      const wrap = node('smart-fill-canvas-wrapper');
      if (!wrap) return;

      this.updatePdfPageControls();

      // If pdfDoc not yet loaded in memory but originalDataUrl exists
      if (!this.pdfDoc && this.originalDataUrl && typeof pdfjsLib !== 'undefined') {
        try {
          let pdfBytes = null;
          if (this.originalDataUrl.startsWith('data:')) {
            const base64 = this.originalDataUrl.split(',')[1];
            const binary = atob(base64);
            pdfBytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) pdfBytes[i] = binary.charCodeAt(i);
          }
          if (pdfBytes) {
            this.pdfDoc = await pdfjsLib.getDocument({ isEvalSupported: false, data: pdfBytes }).promise;
            this.pdfTotalPages = this.pdfDoc.numPages;
            this.updatePdfPageControls();
          }
        } catch (err) {
          console.warn('[SmartFill] Failed restoring pdfDoc from originalDataUrl:', err);
        }
      }

      if (!this.pdfDoc) {
        wrap.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Loading PDF document...</div>`;
        return;
      }

      if (this.isRenderingPdf) {
        this.pendingPdfRender = true;
        return;
      }
      this.isRenderingPdf = true;

      try {
        const page = await this.pdfDoc.getPage(this.pdfCurrentPage || 1);
        wrap.style.transform = 'none';
        wrap.innerHTML = tfSanitizeHtml('');

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        this.pdfBaseWidth = unscaledViewport.width;
        this.pdfBaseHeight = unscaledViewport.height;

        const effectiveScale = this.previewZoom;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: effectiveScale * dpr });

        const canvas = document.createElement('canvas');
        canvas.id = 'smart-fill-pdf-canvas';
        canvas.className = 'shadow-2xl rounded-lg bg-white pointer-events-none border border-slate-700 transition-all duration-75';
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;
        canvas.style.maxWidth = 'none';

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        wrap.appendChild(canvas);
      } catch (err) {
        console.error('[SmartFill] PDF render error:', err);
        wrap.innerHTML = `<div class="p-8 text-center text-rose-400 text-xs">Error rendering PDF: ${tfEscapeHtml(esc(err.message))}</div>`;
      } finally {
        this.isRenderingPdf = false;
        if (this.pendingPdfRender) {
          this.pendingPdfRender = false;
          this.renderPdfPreview();
        }
      }
    }

    async loadFromMobileSnap(snapData) {
      if (!snapData) return;
      this.needsAutoFit = true;
      this.fileUrl = snapData.fileUrl || null;
      this.originalDataUrl = snapData.base64 || snapData.fileUrl;
      this.visionDataUrl = snapData.base64 || snapData.fileUrl;
      this.visionMimeType = snapData.fileType || 'image/jpeg';
      this.originalFile = { name: snapData.fileName || 'mobile_snap.jpg', type: snapData.fileType || 'image/jpeg', size: 120000 };
      const label = node('smart-fill-file-label');
      if (label) label.textContent = `📷 ${snapData.fileName} (From Phone)`;
      this.renderPreviewContent();
      if (!this.previewOpen) this.togglePreview(true);
      this.setStatus('📷 Mobile photo received. Running RapidOCR locally...');

      // Convert fileUrl to genuine client base64 data URI if not already present
      if (this.fileUrl && (!this.visionDataUrl || !this.visionDataUrl.startsWith('data:'))) {
        try {
          const res = await fetch(this.fileUrl);
          if (res.ok) {
            const blob = await res.blob();
            const b64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            this.originalDataUrl = b64Data;
            this.visionDataUrl = b64Data;
            if (blob.type) this.visionMimeType = blob.type;
          }
        } catch (e) {
          console.warn('[SmartFill] Client blob conversion fallback to server resolution:', e);
        }
      }

      // Run RapidOCR local intake so text is extracted and inspect button lights up
      await this.runRapidOcrIntake(this.originalFile);
      this.persistDraft();
    }

    showDuplicateWarning(dupCheck) {
      let banner = node('smart-fill-duplicate-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'smart-fill-duplicate-banner';
        const reviewSection = node('smart-fill-review')?.closest('section');
        if (reviewSection) {
          reviewSection.insertAdjacentElement('beforebegin', banner);
        }
      }
      const existing = dupCheck.duplicate || dupCheck.existing || {};
      banner.className = 'p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 shadow-sm';
      banner.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="p-1.5 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </span>
          <div class="min-w-0">
            <h4 class="text-xs font-extrabold truncate">⚠️ Potential Duplicate Payment Slip Detected!</h4>
            <p class="text-[11px] text-rose-700 dark:text-rose-300 truncate">
              Already recorded for Order <b>${tfEscapeHtml(esc(existing.order_id || existing.orderRef || 'Registered'))}</b> (${tfEscapeHtml(esc(existing.party_name || existing.partyName || ''))}, ₹${tfEscapeHtml(esc(existing.amount || ''))}).
            </p>
          </div>
        </div>
        <button type="button" onclick="TradeFlowSmartFill.openDualSlipFromWarning()" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm shrink-0 flex items-center gap-1.5">
          <span>Compare Both Slips Side-by-Side</span>
        </button>
      `;
      banner.classList.remove('hidden');
    }

    hideDuplicateWarning() {
      node('smart-fill-duplicate-banner')?.remove();
    }

    openDualSlipFromWarning() {
      if (!this.duplicateConflict || !window.app?.openDualSlipComparison) return;
      const dupRecord = this.duplicateConflict.duplicate || this.duplicateConflict.existing;
      window.app.openDualSlipComparison(dupRecord, {
        orderRef: this.extracted?.orderRef,
        partyName: this.extracted?.party,
        amount: this.extracted?.amount,
        date: this.extracted?.date,
        utr: this.extracted?.utr,
        dataUrl: this.originalDataUrl || this.visionDataUrl || this.fileUrl,
        fileName: this.originalFile?.name
      });
    }

    persistDraft() {
      try {
        if (!this.extracted && !this.originalDataUrl && !this.fileUrl) return;
        const reviewInputs = node('smart-fill-review')?.querySelectorAll('[data-smart-fill-field]');
        const reviewValues = {};
        if (reviewInputs) {
          reviewInputs.forEach(inp => {
            const field = inp.getAttribute('data-smart-fill-field');
            if (field) reviewValues[field] = inp.value;
          });
        }
        
        let saveOriginalDataUrl = this.originalDataUrl;
        let saveVisionDataUrl = this.visionDataUrl;
        if (this.fileUrl) {
          if (saveOriginalDataUrl && saveOriginalDataUrl.length > 50000) saveOriginalDataUrl = null;
          if (saveVisionDataUrl && saveVisionDataUrl.length > 50000) saveVisionDataUrl = null;
        } else if (saveOriginalDataUrl && saveOriginalDataUrl.length > 2000000) {
          saveOriginalDataUrl = null;
          saveVisionDataUrl = null;
        }

        const isPdf = this.isPdf || Boolean(this.originalFile?.type === 'application/pdf' || this.originalFile?.name?.toLowerCase().endsWith('.pdf'));
        const fileName = this.originalFile?.name || (isPdf ? 'document.pdf' : 'document.jpg');
        const fileType = this.originalFile?.type || (isPdf ? 'application/pdf' : 'image/jpeg');

        const draft = {
          context: this.context || 'payment',
          targetView: 'smart_fill',
          fileName,
          fileType,
          isPdf,
          fileSize: this.originalFile?.size || 0,
          fileUrl: this.fileUrl || null,
          originalDataUrl: saveOriginalDataUrl,
          visionDataUrl: saveVisionDataUrl,
          visionMimeType: this.visionMimeType || fileType,
          extracted: {
            ...(this.extracted || {}),
            ...(reviewValues.party ? { party: reviewValues.party } : {}),
            ...(reviewValues.amount ? { amount: reviewValues.amount } : {}),
            ...(reviewValues.date ? { date: reviewValues.date } : {}),
            ...(reviewValues.utr ? { utr: reviewValues.utr } : {}),
            ...(reviewValues.orderRef ? { orderRef: reviewValues.orderRef } : {}),
            ...(reviewValues.direction ? { direction: reviewValues.direction } : {})
          },
          reviewValues,
          duplicateConflict: this.duplicateConflict || null,
          updatedAt: new Date().toISOString()
        };

        localStorage.setItem('tradeflow_pending_intake_draft', JSON.stringify(draft));
        window.app?.updateSidebarUI?.();
        window.app?.renderDashboard?.();
      } catch (e) {
        console.warn('Draft persistence error:', e);
      }
    }

    restoreFromDraft(draft) {
      if (!draft) return;
      this.context = draft.context || 'payment';
      this.fileUrl = draft.fileUrl || null;
      this.originalDataUrl = draft.originalDataUrl || draft.fileUrl || null;
      this.visionDataUrl = draft.visionDataUrl || draft.fileUrl || null;
      const isPdf = Boolean(draft.isPdf || (draft.fileType === 'application/pdf') || (draft.fileName && draft.fileName.toLowerCase().endsWith('.pdf')));
      this.isPdf = isPdf;
      this.pdfDoc = null;
      this.pdfCurrentPage = 1;
      this.pdfTotalPages = 1;
      this.visionMimeType = draft.visionMimeType || draft.fileType || (isPdf ? 'application/pdf' : 'image/jpeg');
      this.originalFile = {
        name: draft.fileName || (isPdf ? 'document.pdf' : 'scanned_draft_document.jpg'),
        type: draft.fileType || (isPdf ? 'application/pdf' : 'image/jpeg'),
        size: draft.fileSize || 120000
      };
      this.busy = false;
      this.extracted = {
        ...(draft.extracted || {}),
        ...(draft.reviewValues || {})
      };
      this.duplicateConflict = draft.duplicateConflict || null;

      const modal = node('smart-fill-modal');
      if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
      }

      const label = node('smart-fill-file-label');
      if (label) label.textContent = `📂 ${this.originalFile.name} (Restored Draft)`;

      this.renderPreviewContent();
      if (this.visionDataUrl || this.originalDataUrl || this.fileUrl) {
        this.togglePreview(true);
      }

      this.renderReview();

      // Restore specific input values
      if (draft.reviewValues) {
        const review = node('smart-fill-review');
        if (review) {
          Object.entries(draft.reviewValues).forEach(([field, val]) => {
            const inp = review.querySelector(`[data-smart-fill-field="${field}"]`);
            if (inp) inp.value = val;
          });
        }
      }

      // Restore duplicate warning if present
      if (this.duplicateConflict && this.duplicateConflict.isDuplicate) {
        this.showDuplicateWarning(this.duplicateConflict);
      }

      this.showDraftRestoredBanner(draft);
      this.setStatus('📂 Unsaved draft restored. You can continue editing right where you left off.', 'emerald');
      if (window.lucide) window.lucide.createIcons();
    }

    showDraftRestoredBanner(draft) {
      let banner = node('smart-fill-draft-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'smart-fill-draft-banner';
        const reviewSection = node('smart-fill-review')?.closest('section');
        if (reviewSection) {
          reviewSection.insertAdjacentElement('beforebegin', banner);
        }
      }
      const timeAgo = draft.updatedAt ? new Date(draft.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'recently';
      banner.className = 'p-2.5 px-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 mb-2.5 shadow-2xs';
      banner.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="p-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
          <span class="text-xs font-semibold truncate">In-progress draft restored (${tfEscapeHtml(timeAgo)})</span>
        </div>
        <button type="button" onclick="TradeFlowSmartFill.discardDraft()" class="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded border border-rose-200 dark:border-rose-800 shrink-0">
          Discard Draft
        </button>
      `;
      banner.classList.remove('hidden');
    }

    discardDraft() {
      this.clearDraft();
      this.clearInput();
      this.close(true);
      window.app?.showToast?.('Draft discarded.');
    }

    init() {
      const file = node('smart-fill-file');
      const modal = node('smart-fill-modal');
      file?.addEventListener('change', (event) => {
        const selected = event.target.files && event.target.files[0];
        if (selected) this.loadFile(selected);
      });
      modal?.addEventListener('dragover', (event) => {
        if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
      });
      modal?.addEventListener('drop', (event) => {
        const selected = event.dataTransfer?.files?.[0];
        if (!selected) return;
        event.preventDefault();
        this.loadFile(selected);
      });
      modal?.addEventListener('paste', (event) => {
        if (!modal.classList.contains('hidden')) this.handleClipboardPaste(event);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !node('smart-fill-nvidia-settings')?.classList.contains('hidden')) this.closeNvidiaSettings();
        else if (event.key === 'Escape' && !node('smart-fill-modal')?.classList.contains('hidden')) this.close();
      });
      node('smart-fill-nvidia-settings')?.addEventListener('click', (event) => {
        if (event.target === node('smart-fill-nvidia-settings')) this.closeNvidiaSettings();
      });
      this.setContext('auto');

      node('smart-fill-nvidia-key-toggle')?.addEventListener('click', () => {
        const input = node('smart-fill-nvidia-key');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        node('smart-fill-nvidia-key-toggle').textContent = input.type === 'password' ? 'Show' : 'Hide';
      });
      node('smart-fill-nvidia-test')?.addEventListener('click', () => this.testNvidiaConnection());
      node('smart-fill-nvidia-refresh')?.addEventListener('click', () => this.refreshNvidiaModels());
      node('smart-fill-nvidia-save')?.addEventListener('click', () => this.saveNvidiaSettings());
      node('smart-fill-nvidia-key')?.addEventListener('input', () => this.setNvidiaState('setup', 'Not tested'));
      node('smart-fill-nvidia-model')?.addEventListener('change', () => this.setNvidiaState('setup', 'Model changed · test to verify'));

      if (localStorage.getItem('tradeflow_test_api_key')) {
        if (localStorage.getItem('tradeflow_nvidia_verified') === 'true') this.setNvidiaState('connected', 'NVIDIA connected');
        else this.setNvidiaState('setup', 'Saved key · verify connection');
      } else {
        this.setNvidiaState('setup', 'NVIDIA setup required');
      }

      node('smart-fill-review')?.addEventListener('input', () => this.persistDraft());
      node('smart-fill-review')?.addEventListener('change', () => this.persistDraft());

      const viewport = node('smart-fill-preview-viewport');
      if (viewport) {
        viewport.addEventListener('wheel', (e) => {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
          this.zoomAtPoint(this.previewZoom * zoomFactor, e.clientX, e.clientY);
        }, { passive: false });

        viewport.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          this.isPanning = true;
          this.panStartX = e.clientX;
          this.panStartY = e.clientY;
          this.scrollStartX = viewport.scrollLeft;
          this.scrollStartY = viewport.scrollTop;
          viewport.classList.add('cursor-grabbing');
          viewport.classList.remove('cursor-grab');
        });

        window.addEventListener('mousemove', (e) => {
          if (!this.isPanning) return;
          const dx = e.clientX - this.panStartX;
          const dy = e.clientY - this.panStartY;
          viewport.scrollLeft = this.scrollStartX - dx;
          viewport.scrollTop = this.scrollStartY - dy;
        });

        window.addEventListener('mouseup', () => {
          if (this.isPanning) {
            this.isPanning = false;
            viewport.classList.remove('cursor-grabbing');
            viewport.classList.add('cursor-grab');
          }
        });
      }
    }

    openNvidiaSettings() {
      const savedKey = localStorage.getItem('tradeflow_test_api_key') || '';
      const savedModel = localStorage.getItem('tradeflow_test_model') || 'meta/llama-3.2-11b-vision-instruct';
      const key = node('smart-fill-nvidia-key');
      const model = node('smart-fill-nvidia-model');
      if (key) key.value = savedKey;
      if (model && !Array.from(model.options).some(option => option.value === savedModel)) {
        const option = document.createElement('option');
        option.value = savedModel;
        option.textContent = savedModel;
        model.appendChild(option);
      }
      if (model) model.value = savedModel;
      node('smart-fill-nvidia-settings')?.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
      key?.focus();
    }

    closeNvidiaSettings() {
      node('smart-fill-nvidia-settings')?.classList.add('hidden');
    }

    setNvidiaState(state, label) {
      const dot = node('smart-fill-nvidia-status-dot');
      const text = node('smart-fill-nvidia-status-label');
      if (dot) {
        const color = state === 'connected' ? 'bg-emerald-500' : state === 'error' ? 'bg-rose-500' : state === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-amber-400';
        dot.className = `inline-block w-2 h-2 rounded-full ${color}`;
      }
      if (text) text.textContent = label || (state === 'connected' ? 'NVIDIA connected' : 'NVIDIA AI settings');
    }

    showNvidiaFeedback(message, state = 'info', latencyMs = null) {
      const feedback = node('smart-fill-nvidia-feedback');
      if (!feedback) return;
      const theme = state === 'success'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
        : state === 'error'
          ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
          : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
      feedback.className = `rounded-lg border px-3 py-2.5 text-xs break-words ${theme}`;
      feedback.textContent = `${message}${latencyMs !== null ? ` · ${latencyMs} ms` : ''}`;
    }

    async testNvidiaConnection() {
      if (this.nvidiaBusy) return false;
      const apiKey = clean(node('smart-fill-nvidia-key')?.value);
      const model = clean(node('smart-fill-nvidia-model')?.value) || 'meta/llama-3.2-11b-vision-instruct';
      if (!apiKey) {
        this.setNvidiaState('error', 'NVIDIA key required');
        this.showNvidiaFeedback('Enter your NVIDIA NIM API key before testing.', 'error');
        node('smart-fill-nvidia-key')?.focus();
        return false;
      }
      this.nvidiaBusy = true;
      const button = node('smart-fill-nvidia-test');
      if (button) { button.disabled = true; button.textContent = 'Testing…'; }
      this.setNvidiaState('checking', 'Checking NVIDIA connection…');
      this.showNvidiaFeedback('Checking API key and selected model…', 'info');
      try {
        const response = await postAi('test-ping', { provider: 'nvidia', apiKey, baseUrl: 'https://integrate.api.nvidia.com/v1', model });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          let errStr = result.error || `Connection check failed with HTTP ${response.status}.`;
          try {
            if (typeof errStr === 'string' && errStr.includes('{') && errStr.includes('}')) {
              const parsed = JSON.parse(errStr.slice(errStr.indexOf('{'), errStr.lastIndexOf('}') + 1));
              errStr = parsed.detail || parsed.error?.message || parsed.message || errStr;
            }
          } catch (_) {}
          throw new Error(errStr);
        }
        this.setNvidiaState('connected', 'NVIDIA connected');
        this.showNvidiaFeedback(result.message || `Connection succeeded with ${model}.`, 'success', result.latencyMs);
        return true;
      } catch (error) {
        localStorage.setItem('tradeflow_nvidia_verified', 'false');
        this.setNvidiaState('error', 'NVIDIA connection failed');
        this.showNvidiaFeedback(error.message || 'Could not reach NVIDIA NIM.', 'error');
        return false;
      } finally {
        this.nvidiaBusy = false;
        if (button) { button.disabled = false; button.textContent = 'Test connection'; }
      }
    }

    async refreshNvidiaModels() {
      if (this.nvidiaBusy) return;
      const apiKey = clean(node('smart-fill-nvidia-key')?.value);
      if (!apiKey) {
        this.setNvidiaState('error', 'NVIDIA key required');
        this.showNvidiaFeedback('Enter your NVIDIA NIM API key before refreshing the model list.', 'error');
        node('smart-fill-nvidia-key')?.focus();
        return;
      }
      this.nvidiaBusy = true;
      const button = node('smart-fill-nvidia-refresh');
      if (button) { button.disabled = true; button.classList.add('animate-spin'); }
      this.setNvidiaState('checking', 'Loading NVIDIA models…');
      this.showNvidiaFeedback('Requesting the available NVIDIA model list…', 'info');
      try {
        const response = await postAi('models', { provider: 'nvidia', apiKey, baseUrl: 'https://integrate.api.nvidia.com/v1' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || !Array.isArray(result.models) || result.models.length === 0) throw new Error(result.error || 'NVIDIA returned no available models.');
        const select = node('smart-fill-nvidia-model');
        const prior = clean(select?.value) || localStorage.getItem('tradeflow_test_model') || '';
        const sorted = [...result.models].sort((a, b) => Number(/vision|vl|multimodal/i.test(b.id)) - Number(/vision|vl|multimodal/i.test(a.id)) || a.id.localeCompare(b.id));
        select.innerHTML = tfSanitizeHtml('');
        sorted.forEach(item => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.id;
          select.appendChild(option);
        });
        select.value = sorted.some(item => item.id === prior) ? prior : sorted[0].id;
        this.showNvidiaFeedback(`Loaded ${sorted.length} NVIDIA models. Choose a model and test the connection.`, 'success');
        this.setNvidiaState('setup', 'Models refreshed · test to verify');
      } catch (error) {
        this.setNvidiaState('error', 'Could not refresh NVIDIA models');
        this.showNvidiaFeedback(error.message || 'Could not load NVIDIA models.', 'error');
      } finally {
        this.nvidiaBusy = false;
        if (button) { button.disabled = false; button.classList.remove('animate-spin'); }
      }
    }

    async saveNvidiaSettings() {
      const key = clean(node('smart-fill-nvidia-key')?.value);
      if (!key) {
        this.setNvidiaState('error', 'NVIDIA key required');
        this.showNvidiaFeedback('Enter your NVIDIA NIM API key before saving.', 'error');
        node('smart-fill-nvidia-key')?.focus();
        return;
      }
      const connected = await this.testNvidiaConnection();
      if (!connected) return;
      const model = clean(node('smart-fill-nvidia-model')?.value) || 'meta/llama-3.2-11b-vision-instruct';
      localStorage.setItem('tradeflow_test_api_key', key);
      localStorage.setItem('tradeflow_test_provider', 'nvidia');
      localStorage.setItem('tradeflow_test_model', model);
      localStorage.setItem('tradeflow_nvidia_verified', 'true');
      this.setNvidiaState('connected', 'NVIDIA connected');
      this.showNvidiaFeedback(`Saved and reconnected with ${model}.`, 'success');
      this.setStatus('NVIDIA settings saved and verified. Smart Fill is ready.', 'emerald');
      setTimeout(() => this.closeNvidiaSettings(), 700);
    }

    open(context = 'auto', file = null, rawText = '', preserveState = false) {
      const modal = node('smart-fill-modal');
      if (!modal) return;
      if (!preserveState) {
        this.clearInput();
        this.removeUndoPill();
        this.lastSnapshot = null;
        this.pendingPartnerArchive = null;
      }
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      this.setContext(context);
      if (rawText) node('smart-fill-text').value = rawText;
      if (window.lucide) window.lucide.createIcons();
      if (!preserveState) node('smart-fill-text')?.focus();
      if (file) return this.loadFile(file);
      if (preserveState && this.extracted) {
        this.renderReview();
      }
      return Promise.resolve();
    }

    close(isDiscarding = false) {
      if (!isDiscarding && (this.extracted || this.originalDataUrl || this.fileUrl)) {
        this.persistDraft();
      }
      this.closeNvidiaSettings();
      node('smart-fill-modal')?.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    setContext(context) {
      if (!['auto', 'partner', 'payment'].includes(context)) context = 'auto';
      if (context === 'payment' && this.isInvoice) {
        this.setStatus('This looks like an invoice, so it cannot be applied to Payment Log. Choose Partner Details or clear the draft.', 'amber');
        return;
      }
      this.context = context;
      document.querySelectorAll('.smart-fill-tab').forEach((button) => {
        const active = button.dataset.smartFillContext === context;
        button.className = `smart-fill-tab px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`;
        button.setAttribute('aria-selected', String(active));
      });
      if (this.extracted) this.renderReview();
    }

    setStatus(message, tone = 'slate') {
      const el = node('smart-fill-status');
      if (!el) return;
      const tones = {
        slate: 'text-slate-500 dark:text-slate-400',
        emerald: 'text-emerald-700 dark:text-emerald-300',
        amber: 'text-amber-700 dark:text-amber-300',
        rose: 'text-rose-700 dark:text-rose-300'
      };
      el.className = `min-h-8 text-xs ${tones[tone] || tones.slate}`;
      el.textContent = message;
    }

    async handleClipboardPaste(event) {
      const target = event.target;
      const clipboardFiles = Array.from(event.clipboardData?.items || []).map((item) => item.getAsFile?.()).filter(Boolean);
      const image = clipboardFiles.find((file) => file.type.startsWith('image/'));
      if (image) {
        event.preventDefault();
        await this.loadFile(image, 'Clipboard image');
      }
    }

    clearInput() {
      node('smart-fill-text').value = '';
      node('smart-fill-file').value = '';
      this.originalFile = null;
      this.originalDataUrl = '';
      this.visionDataUrl = '';
      this.visionMimeType = '';
      this.fileUrl = null;
      this.rawText = '';
      this.extracted = null;
      this.isInvoice = false;
      this.isPdf = false;
      this.pdfDoc = null;
      this.pdfCurrentPage = 1;
      this.pdfTotalPages = 1;
      this.hidePdfPageControls();
      this.hideDuplicateWarning();
      this.duplicateConflict = null;
      if (this.customReviewFields) this.customReviewFields.clear();
      this.togglePreview(false);
      node('smart-fill-file-label').textContent = 'No document selected';
      node('smart-fill-invoice-notice').classList.add('hidden');
      node('smart-fill-review').textContent = 'Nothing analyzed yet.';
      node('smart-fill-actions').classList.add('hidden');
      node('smart-fill-header-apply')?.classList.add('hidden');
      document.querySelector('[data-smart-fill-context="payment"]')?.removeAttribute('disabled');
      this.setStatus('Input cleared. Paste text or choose another file.');
    }

    clearDraft() {
      this.extracted = null;
      this.originalDataUrl = null;
      this.visionDataUrl = null;
      this.fileUrl = null;
      this.originalFile = null;
      this.rawText = '';
      this.isInvoice = false;
      this.isPdf = false;
      this.pdfDoc = null;
      this.pdfCurrentPage = 1;
      this.pdfTotalPages = 1;
      this.hidePdfPageControls();
      this.duplicateConflict = null;
      this.hideDuplicateWarning();
      if (this.customReviewFields) this.customReviewFields.clear();
      localStorage.removeItem('tradeflow_pending_intake_draft');
      node('smart-fill-draft-banner')?.remove();
      node('smart-fill-invoice-notice')?.classList.add('hidden');
      node('smart-fill-review').textContent = 'Draft cleared. Your source input is still available.';
      node('smart-fill-actions')?.classList.add('hidden');
      node('smart-fill-header-apply')?.classList.add('hidden');
      this.setStatus('Draft cleared. You can analyze again or replace the input.');
      window.app?.updateSidebarUI?.();
      window.app?.renderDashboard?.();
    }

    async loadFile(file, labelPrefix = '') {
      if (!file) return;
      const ext = file.name.split('.').pop()?.toLowerCase();
      const accepted = file.type === 'application/pdf' || ['pdf'].includes(ext) || file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
      if (!accepted) {
        this.setStatus('Choose a PDF, JPG, PNG, or WebP file.', 'rose');
        return;
      }
      this.originalFile = file;
      node('smart-fill-file-label').textContent = `${labelPrefix ? `${labelPrefix}: ` : ''}${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
      this.extracted = null;
      this.hideDuplicateWarning();
      this.duplicateConflict = null;
      node('smart-fill-actions').classList.add('hidden');
      node('smart-fill-header-apply')?.classList.add('hidden');
      this.setStatus('Reading document locally…');

      try {
        this.originalDataUrl = await this.readAsDataUrl(file);
        this.visionDataUrl = '';
        this.visionMimeType = '';
        this.rawText = clean(node('smart-fill-text').value);

        if (file.type === 'application/pdf' || ext === 'pdf') {
          if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js is not available. Restart TradeFlow and try again.');
          const pdf = await pdfjsLib.getDocument({ isEvalSupported: false, data: new Uint8Array(await file.arrayBuffer()) }).promise;
          this.isPdf = true;
          this.pdfDoc = pdf;
          this.pdfTotalPages = pdf.numPages;
          this.pdfCurrentPage = 1;
          const maxPages = Math.min(pdf.numPages, 5);
          const textParts = [];
          const pageCanvases = [];
          for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const pageText = content.items.map((item) => item.str).join(' ').trim();
            if (pageText) textParts.push(`--- Page ${pageNumber} ---\n${pageText}`);
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(1.35, 1050 / Math.max(base.width, base.height, 1));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            pageCanvases.push({ canvas, pageNumber });
          }
          if (pageCanvases.length) {
            const cellWidth = Math.max(...pageCanvases.map(item => item.canvas.width));
            const cellHeight = Math.max(...pageCanvases.map(item => item.canvas.height));
            const sheet = document.createElement('canvas');
            const columns = pageCanvases.length > 1 ? 2 : 1;
            const rows = Math.ceil(pageCanvases.length / columns);
            sheet.width = columns * cellWidth;
            sheet.height = rows * (cellHeight + 24);
            const ctx = sheet.getContext('2d');
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(0, 0, sheet.width, sheet.height);
            pageCanvases.forEach(({ canvas, pageNumber }, index) => {
              const x = (index % columns) * cellWidth;
              const y = Math.floor(index / columns) * (cellHeight + 24);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x, y, cellWidth, cellHeight + 24);
              ctx.fillStyle = '#334155';
              ctx.font = 'bold 16px sans-serif';
              ctx.fillText(`Page ${pageNumber}`, x + 8, y + 18);
              ctx.drawImage(canvas, x, y + 24);
              canvas.width = 0;
              canvas.height = 0;
            });
            this.visionDataUrl = sheet.toDataURL('image/jpeg', 0.82);
            this.visionMimeType = 'image/jpeg';
            sheet.width = 0;
            sheet.height = 0;
          }
          const pdfText = textParts.join('\n\n');
          if (pdfText) {
            this.rawText = [this.rawText, pdfText].filter(Boolean).join('\n\n');
            node('smart-fill-text').value = this.rawText;
          }
          this.setStatus(`PDF document ready: ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} loaded in sharp vector format.`, 'emerald');
        } else {
          this.isPdf = false;
          this.pdfDoc = null;
          this.pdfTotalPages = 1;
          this.pdfCurrentPage = 1;
          this.visionDataUrl = this.originalDataUrl;
          this.visionMimeType = file.type || (ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg');
          this.setStatus('Image ready for NVIDIA vision analysis.', 'emerald');
        }

        // Automatically open side-by-side preview with zoom controls
        this.renderPreviewContent();
        this.togglePreview(true);

        // Run RapidOCR locally to extract and clean commercial text
        this.runRapidOcrIntake(file);
      } catch (error) {
        this.setStatus(error.message || 'Could not read this file.', 'rose');
      }
    }

    async runRapidOcrIntake(file) {
      try {
        this.resetLogBox();
        this.setLogProgress(10, '10%');
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        this.addLogLine('📥', `Document Received: ${file.name} (${sizeMb} MB, ${file.type || 'document'})`, 'blue');
        this.setLogProgress(25, '25%');
        this.addLogLine('⚡', `RapidOCR Engine (Local ONNX): Scanning image/document locally on CPU...`, 'blue');
        this.setStatus(`Scanning ${file.name} with RapidOCR engine...`);
        const res = await postAi('rapidocr', {
          fileData: this.originalDataUrl,
          mimeType: file.type || (this.isPdf ? 'application/pdf' : 'image/jpeg'),
          filename: file.name
        });
        const ocrData = await res.json().catch(() => ({}));
        if (ocrData && ocrData.success && ocrData.text) {
          this.rawText = ocrData.text;
          const textInput = node('smart-fill-text');
          if (textInput) textInput.value = ocrData.text;

          const inspectorText = node('smart-fill-inspector-raw-text');
          if (inspectorText) inspectorText.value = ocrData.text;

          const linesCount = (ocrData.text.match(/\n/g) || []).length + 1;
          const countEl = node('smart-fill-inspector-lines-count');
          if (countEl) countEl.textContent = `${ocrData.items?.length || linesCount} items (${linesCount} lines)`;

          const conf = (ocrData.confidence * 100).toFixed(1);
          const confEl = node('smart-fill-inspector-conf-score');
          if (confEl) confEl.textContent = `${conf}% conf`;

          // Activate glowing "Show Extracted Text" buttons
          const inspectBtn = node('smart-fill-btn-inspect-text');
          if (inspectBtn) inspectBtn.classList.remove('hidden');

          const prominentBtn = node('smart-fill-btn-inspect-text-prominent');
          if (prominentBtn) {
            prominentBtn.classList.remove('hidden');
            const lbl = node('smart-fill-btn-inspect-text-prominent-label');
            if (lbl) lbl.textContent = `📄 Show Extracted Text (${linesCount} lines)`;
          }

          this.setLogProgress(50, '50%');
          this.addLogLine('📄', `RapidOCR Completed: Extracted ${linesCount} lines (${conf}% confidence, ${ocrData.duration_ms}ms)`, 'emerald');
          this.addLogLine('👁️', '“Show Extracted Text” enabled. Ready for side-by-side inspection.', 'amber');
          this.setStatus(`✅ RapidOCR scan complete (${conf}% confidence). Ready to analyze.`, 'emerald');
        }
      } catch (err) {
        console.warn('RapidOCR background scan notice:', err);
      }
    }

    readAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });
    }

    resetLogBox() {
      const box = node('smart-fill-log-box');
      const lines = node('smart-fill-log-lines');
      const bar = node('smart-fill-log-progress-bar');
      const pct = node('smart-fill-log-progress-text');
      if (lines) lines.innerHTML = tfSanitizeHtml('');
      if (bar) bar.style.width = '0%';
      if (pct) pct.textContent = '0%';
      if (box) box.classList.remove('hidden');
    }

    addLogLine(icon, message, tone = 'slate') {
      const lines = node('smart-fill-log-lines');
      if (!lines) return;
      const tones = {
        slate: 'text-slate-300',
        emerald: 'text-emerald-400 font-semibold',
        violet: 'text-violet-300',
        blue: 'text-sky-300',
        amber: 'text-amber-300',
        rose: 'text-rose-400'
      };
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const div = document.createElement('div');
      div.className = `flex items-start gap-1.5 leading-tight ${tones[tone] || tones.slate}`;
      div.innerHTML = `<span class="text-slate-500 shrink-0 font-mono text-[10px]">[${tfEscapeHtml(timeStr)}]</span> <span class="shrink-0">${tfEscapeHtml(icon)}</span> <span class="break-words">${tfEscapeHtml(esc(message))}</span>`;
      lines.appendChild(div);
      lines.scrollTop = lines.scrollHeight;
    }

    setLogProgress(percent, label = null) {
      const bar = node('smart-fill-log-progress-bar');
      const pct = node('smart-fill-log-progress-text');
      const p = Math.max(0, Math.min(100, percent));
      if (bar) bar.style.width = `${p}%`;
      if (pct) pct.textContent = label || `${p}%`;
    }

    toggleLogBox() {
      const lines = node('smart-fill-log-lines');
      const icon = node('smart-fill-log-toggle-icon');
      if (!lines) return;
      lines.classList.toggle('hidden');
      if (icon) {
        icon.setAttribute('data-lucide', lines.classList.contains('hidden') ? 'chevron-right' : 'chevron-down');
        if (window.lucide) window.lucide.createIcons();
      }
    }

    onDirectionChanged(newDir) {
      const catSelect = node('smart-fill-review')?.querySelector('[data-smart-fill-field="category"]');
      if (!catSelect) return;
      const isOut = /out|paid/i.test(newDir);
      if (isOut && (catSelect.value === 'Buyer / Retailer' || !catSelect.value)) {
        catSelect.value = 'Manufacturer / Supplier';
      } else if (!isOut && (catSelect.value === 'Manufacturer / Supplier' || !catSelect.value)) {
        catSelect.value = 'Buyer / Retailer';
      }
    }

    async analyze() {
      if (this.busy) return;
      const typedText = clean(node('smart-fill-text').value);
      const rawText = [this.rawText, typedText].filter((value, index, values) => value && values.indexOf(value) === index).join('\n\n').trim();
      if (!rawText && !this.visionDataUrl) {
        this.setStatus('Paste text or choose a document before analyzing.', 'amber');
        return;
      }
      this.busy = true;
      const button = node('smart-fill-analyze');
      button.disabled = true;
      button.textContent = 'Analyzing…';
      this.setStatus('Processing document through AI Engine…');

      this.resetLogBox();
      this.setLogProgress(15, '15%');
      this.addLogLine('⚡', 'Initializing AI Vision & Extraction Engine pipeline...', 'violet');

      try {
        const isAiOn = !window.app || window.app.isAIEnabled !== false;
        const apiKey = isAiOn ? (localStorage.getItem('tradeflow_test_api_key') || '') : '';
        const model = isAiOn ? (localStorage.getItem('tradeflow_test_model') || 'meta/llama-3.2-11b-vision-instruct') : 'offline-deterministic';

        this.setLogProgress(65, '65%');
        if (isAiOn && apiKey) {
          this.addLogLine('🌐', `NVIDIA NIM (Cloud API): Connecting to integrate.api.nvidia.com...`, 'blue');
          this.addLogLine('🤖', `Model Active: ${model} (Structuring commercial coordinates)...`, 'blue');
        } else {
          this.addLogLine('🛡️', 'AI Assistance is OFF (Offline Deterministic Mode) — Running Local Commercial Parser...', 'amber');
        }

        const response = await postAi('test-scan', {
            provider: isAiOn && apiKey ? 'nvidia' : 'local',
            apiKey: isAiOn ? apiKey : '',
            baseUrl: 'https://integrate.api.nvidia.com/v1',
            model,
            fileData: this.visionDataUrl || undefined,
            mimeType: this.visionMimeType || undefined,
            rawText: rawText || undefined
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || !result.extracted) {
          let errStr = result.error || 'The scanner did not return extracted details.';
          try {
            if (typeof errStr === 'string' && errStr.includes('{') && errStr.includes('}')) {
              const parsed = JSON.parse(errStr.slice(errStr.indexOf('{'), errStr.lastIndexOf('}') + 1));
              errStr = parsed.detail || parsed.error?.message || parsed.message || errStr;
            }
          } catch (_) {}
          throw new Error(errStr);
        }
        this.extracted = result.extracted;
        this.rawText = rawText;
        if (result.source !== 'local_intelligent_parser') {
          localStorage.setItem('tradeflow_nvidia_verified', 'true');
          this.setNvidiaState('connected', 'NVIDIA connected');
        }

        this.setLogProgress(80, '80%');
        const ext = this.extracted;
        if (ext.bankName) {
          this.addLogLine('💳', `Detected Bank: ${ext.bankName}`, 'amber');
        }
        if (/out|paid/i.test(ext.direction)) {
          this.addLogLine('🏢', `Payer: ${ext.payFromAccount || 'MAGIC ROOTS ENTERPRISES'} (Company Account -> Money Out / Paid)`, 'emerald');
        } else {
          this.addLogLine('📥', 'Direction: Money In (Received from Customer)', 'emerald');
        }
        if (ext.party || ext.beneficiaryAccount) {
          const pName = ext.beneficiaryAccount || ext.party;
          const accStr = ext.beneficiaryAccountNumber ? ` (A/c: ${ext.beneficiaryAccountNumber})` : '';
          this.addLogLine('👤', `Beneficiary / Counterparty: ${pName}${accStr}`, 'emerald');
        }
        if (ext.amount) {
          this.addLogLine('💰', `Amount: ₹${Number(ext.amount).toLocaleString('en-IN')} | Mode: ${ext.paymentMode || 'NEFT'} | UTR: ${ext.utr || 'Auto-detected'}`, 'emerald');
        }
        if (ext.notes) {
          this.addLogLine('📋', `Remarks / Purpose: “${ext.notes}” -> Category: ${ext.category || 'Manufacturer / Supplier'}`, 'violet');
        }

        const corpus = `${rawText}\n${clean(this.extracted.transcribedSummary)}\n${clean(this.extracted.notes)}`;
        const invoiceSignals = /\b(?:tax invoice|gst invoice|bill of supply|vendor invoice|invoice no\.?|invoice number|buyer.?s order no|terms of delivery)\b/i.test(corpus);
        const paymentSignals = /\b(?:utr|transaction id|txn id|payment advice|fund transfer|debited|credited|neft|rtgs|imps|upi transaction|amount transferred|payment received)\b/i.test(corpus);
        this.isInvoice = invoiceSignals && !paymentSignals;

        if (this.context === 'auto') {
          this.context = this.isInvoice ? 'partner' : (this.extracted.documentType === 'payment_settlement' ? 'payment' : 'partner');
        }
        if (this.isInvoice) {
          node('smart-fill-invoice-notice').textContent = 'Vendor invoice detected. This is a billing document, not proof that payment occurred. It cannot be applied to Payment Log. Choose Partner Details to review supplier contact fields, or leave it unmapped.';
          node('smart-fill-invoice-notice').classList.remove('hidden');
          document.querySelector('[data-smart-fill-context="payment"]')?.setAttribute('disabled', 'disabled');
          node('smart-fill-invoice-notice').insertAdjacentHTML('beforeend', ' <button type="button" class="ml-2 font-bold underline" onclick="TradeFlowSmartFill.setContext(\'partner\')">Review supplier details</button>');
        } else {
          node('smart-fill-invoice-notice').classList.add('hidden');
          document.querySelector('[data-smart-fill-context="payment"]')?.removeAttribute('disabled');
        }
        this.setContext(this.context);

        this.setLogProgress(90, '90%');
        if (this.context === 'payment' || this.extracted.documentType === 'payment_settlement') {
          this.addLogLine('🏦', `Classification: Payment Settlement (Rail: ${this.extracted.paymentMode || 'NEFT'} detected)`, 'emerald');
          this.dismissPartnerMerge();
        } else {
          this.addLogLine('👤', `Classification: Partner Dossier (Visiting Card / Business Profile detected)`, 'emerald');
          this.hideDuplicateWarning();
        }

        // System-wide Duplicate Registry Check for Payment Slips
        if (!this.duplicateOverride && (this.context === 'payment' || this.extracted.documentType === 'payment_settlement' || this.extracted.utr)) {
          try {
            this.addLogLine('🛡️', `System Integrity: Checking UTR ${this.extracted.utr || 'Reference'} in payment ledger...`, 'blue');
            const dupRes = await fetch('/api/payments/check-duplicate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                utr: this.extracted.utr,
                amount: this.extracted.amount,
                date: this.extracted.date,
                party: this.extracted.party,
                fileData: this.originalDataUrl
              })
            });
            const dupCheck = await dupRes.json();
            if (dupCheck && dupCheck.isDuplicate) {
              this.duplicateConflict = dupCheck;
              this.showDuplicateWarning(dupCheck);
              const existingRef = dupCheck.duplicate?.order_id || dupCheck.duplicate?.orderRef || dupCheck.existing?.orderRef || dupCheck.existing?.order_id || 'Ref';
              this.addLogLine('⚠️', `Duplicate Warning: Recorded previously in Order ${existingRef}`, 'rose');
            } else {
              this.duplicateConflict = null;
              this.hideDuplicateWarning();
            }
          } catch (e) {
            console.warn('Duplicate check warning:', e);
          }
        } else {
          this.duplicateConflict = null;
          this.hideDuplicateWarning();
        }

        // Partner Collision & Smart Merge Check for Visiting Cards & Bios
        if (this.context === 'partner' && this.extracted.documentType === 'partner_profile') {
          this.addLogLine('🛡️', `System Integrity: Checking phone/name collision in contact registry...`, 'blue');
          const collision = this.checkPartnerCollision(this.extracted);
          if (collision.match) {
            this.showPartnerCollision(collision);
          } else {
            this.dismissPartnerMerge();
          }
        } else {
          this.dismissPartnerMerge();
        }

        this.setLogProgress(100, '100%');
        this.addLogLine('✅', 'Adaptive commercial coordinates populated in Review Draft. 1-Click Apply ready.', 'emerald');

        this.renderReview();
        this.persistDraft();
        this.setStatus(result.source === 'local_intelligent_parser' ? 'Draft prepared by TradeFlow’s local text parser. Review every value.' : 'Draft prepared by NVIDIA extraction. Review every value before applying.', 'emerald');
      } catch (error) {
        localStorage.setItem('tradeflow_nvidia_verified', 'false');
        this.setNvidiaState('error', 'NVIDIA connection failed');
        this.showNvidiaFeedback(error.message || 'NVIDIA analysis failed.', 'error');
        this.addLogLine('❌', `Extraction Error: ${error.message}`, 'rose');
        this.setStatus(`${error.message} Open NVIDIA AI settings to test the key and selected model.`, 'rose');
      } finally {
        this.busy = false;
        button.disabled = false;
        button.innerHTML = '<i data-lucide="scan-text" class="w-4 h-4"></i>Analyze and prepare draft';
        if (window.lucide) window.lucide.createIcons();
      }
    }

    checkPartnerCollision(ext) {
      if (!ext) return { match: false };
      const isOurName = (n) => /magic\s*roots|amrit\s*ras/i.test(String(n || ''));
      if (isOurName(ext.name) || isOurName(ext.party)) return { match: false };
      const contacts = window.app?.data?.contacts || [];
      if (!contacts.length) return { match: false };

      const cleanDigits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
      const extPhone = cleanDigits(ext.phone || ext.altPhone);
      const extGstin = clean(ext.gstin).toUpperCase();
      const extPan = clean(ext.pan).toUpperCase();
      const extEmail = clean(ext.email).toLowerCase();
      const extName = clean(ext.name).toLowerCase();
      const extPerson = clean(ext.contactPerson).toLowerCase();

      const stopWords = new Set(['and', 'pvt', 'ltd', 'limited', 'private', 'enterprises', 'industries', 'traders', 'trade', 'company', 'co', 'shree', 'shri', 'ms', 'm/s', 'group', 'corp', 'corporation', 'llp', 'processing', 'processors', 'food', 'foods', 'products']);
      const getTokens = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
      const extTokens = getTokens(ext.name);

      for (const c of contacts) {
        const cPhone = cleanDigits(c.phone || c.altPhone);
        const cGstin = clean(c.gstin).toUpperCase();
        const cPan = clean(c.pan).toUpperCase();
        const cEmail = clean(c.email).toLowerCase();
        const cName = clean(c.name).toLowerCase();
        const cPerson = clean(c.contactPerson).toLowerCase();
        const cTokens = getTokens(c.name);

        const phoneMatch = Boolean(extPhone && cPhone && extPhone.length >= 10 && extPhone === cPhone);
        const gstinMatch = Boolean(extGstin && cGstin && extGstin.length >= 15 && extGstin === cGstin);
        const panMatch = Boolean(extPan && cPan && extPan.length >= 10 && extPan === cPan);
        const emailMatch = Boolean(extEmail && cEmail && extEmail.length >= 5 && extEmail === cEmail);

        const sharedTokens = extTokens.filter(t => cTokens.includes(t));
        const tokenMatch = sharedTokens.length >= 2 || (sharedTokens.length === 1 && sharedTokens[0].length >= 6);
        const nameMatch = Boolean(extName && cName && (cName === extName || cName.includes(extName) || extName.includes(cName) || tokenMatch));
        const personMatch = Boolean(extPerson && cPerson && extPerson.length > 4 && (cPerson === extPerson || cPerson.includes(extPerson)));

        if (phoneMatch || gstinMatch || panMatch || emailMatch || (nameMatch && personMatch) || (nameMatch && (phoneMatch || extPhone.length >= 10)) || tokenMatch) {
          return {
            match: true,
            contact: c,
            extracted: ext,
            reason: phoneMatch ? `Phone match (+91 ${extPhone})` : gstinMatch ? `GSTIN match (${extGstin})` : emailMatch ? `Email match (${cEmail})` : `Partner name match (${c.name})`
          };
        }
      }
      return { match: false };
    }

    showPartnerCollision(collision) {
      this.partnerCollision = collision;
      const view = node('smart-fill-partner-merge-view');
      if (!view) return;

      const c = collision.contact;
      node('smart-fill-partner-merge-title').textContent = `🤝 Existing Trade Partner Detected: "${c.name}"`;
      node('smart-fill-partner-merge-desc').textContent = `${collision.reason} matches contact record ${c.id || ''} in system.`;
      node('smart-fill-partner-merge-badge').textContent = `ID: ${c.id || 'MATCH'}`;

      const existingEl = node('smart-fill-partner-existing-details');
      const extractedEl = node('smart-fill-partner-extracted-details');

      const ext = this.extracted || collision.extracted || {};
      const rows = [
        ['Name', c.name || '', ext.name || ''],
        ['Contact', c.contactPerson || '', ext.contactPerson || ''],
        ['Phone', c.phone || '', ext.phone || ''],
        ['Email', c.email || '', ext.email || ''],
        ['GSTIN', c.gstin || '', ext.gstin || ''],
        ['Address', c.billingAddress || c.address || '', ext.address || ''],
        ['Bank', c.bankName ? `${c.bankName} (${c.accountNumber || ''})` : '', ext.bankName ? `${ext.bankName} (${ext.accountNumber || ''})` : '']
      ];

      if (existingEl) {
        existingEl.innerHTML = rows.map(([label, val]) => `
          <div class="flex items-start justify-between gap-1 py-0.5 border-b border-slate-100 dark:border-slate-800/50">
            <span class="text-slate-500 font-semibold shrink-0">${tfEscapeHtml(esc(label))}:</span>
            <span class="font-medium text-right truncate max-w-[190px]" title="${tfEscapeHtml(esc(val))}">${tfEscapeHtml(esc(val || '(Not set)'))}</span>
          </div>
        `).join('');
      }

      if (extractedEl) {
        extractedEl.innerHTML = rows.map(([label, oldVal, newVal]) => {
          const isChanged = newVal && clean(newVal) !== clean(oldVal);
          const isNewVal = isChanged && !clean(oldVal);
          const badge = isNewVal ? `<span class="px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-1">✨ New</span>`
                      : isChanged ? `<span class="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 ml-1">Update</span>` : '';
          return `
            <div class="flex items-start justify-between gap-1 py-0.5 border-b border-slate-100 dark:border-slate-800/50">
              <span class="text-slate-500 font-semibold shrink-0">${tfEscapeHtml(esc(label))}:</span>
              <span class="font-semibold text-right truncate max-w-[190px] ${tfEscapeHtml(isChanged ? 'text-emerald-600 dark:text-emerald-400 font-bold' : '')}" title="${tfEscapeHtml(esc(newVal))}">${tfEscapeHtml(esc(newVal || '(None)'))}${badge}</span>
            </div>
          `;
        }).join('');
      }

      view.classList.remove('hidden');
      this.addLogLine('🤝', `Partner Collision Detected: "${c.name}" (${collision.reason})`, 'violet');
    }

    mergePartnerDetails() {
      if (!this.partnerCollision || !this.partnerCollision.contact) return;
      const c = this.partnerCollision.contact;
      const ext = this.extracted || this.partnerCollision.extracted || {};

      if (ext.name && clean(ext.name)) c.name = ext.name;
      if (ext.contactPerson && clean(ext.contactPerson)) c.contactPerson = ext.contactPerson;
      if (ext.phone && clean(ext.phone)) c.phone = ext.phone;
      if (ext.altPhone && clean(ext.altPhone)) c.altPhone = ext.altPhone;
      if (ext.email && clean(ext.email)) c.email = ext.email;
      if (ext.website && clean(ext.website)) c.website = ext.website;
      if (ext.address && clean(ext.address)) {
        c.address = ext.address;
        c.billingAddress = ext.address;
      }
      if (ext.gstin && clean(ext.gstin)) c.gstin = ext.gstin;
      if (ext.pan && clean(ext.pan)) c.pan = ext.pan;
      if (ext.fssai && clean(ext.fssai)) c.fssai = ext.fssai;
      if (ext.bankName && clean(ext.bankName)) c.bankName = ext.bankName;
      if (ext.accountNumber && clean(ext.accountNumber)) c.accountNumber = ext.accountNumber;
      if (ext.ifsc && clean(ext.ifsc)) c.ifsc = ext.ifsc;
      if (ext.paymentTerms && clean(ext.paymentTerms)) c.paymentTerms = ext.paymentTerms;

      window.app?.saveData?.();
      window.app?.updateSidebarUI?.();
      window.app?.renderActiveView?.();

      this.archivePendingPartnerDocument(c);
      this.dismissPartnerMerge();
      this.clearDraft();
      this.close();
      window.app?.showToast?.(`🤝 Successfully merged new details into "${c.name}" (${c.id || 'Partner'}).`);
    }

    saveAsNewPartner() {
      this.dismissPartnerMerge();
      this.apply();
    }

    dismissPartnerMerge() {
      this.partnerCollision = null;
      node('smart-fill-partner-merge-view')?.classList.add('hidden');
    }

    isValue(value) {
      if (value === null || value === undefined) return false;
      const text = clean(value);
      return !!text && !['null', 'undefined', 'n/a', 'not specified'].includes(text.toLowerCase());
    }

    getPartnerFields() {
      const x = this.extracted || {};
      return [
        ['name', 'Company / Trade Name', x.name],
        ['contactPerson', 'Contact Person', x.contactPerson],
        ['phone', 'Phone', x.phone],
        ['altPhone', 'Alt Phone', x.altPhone],
        ['email', 'Email', x.email],
        ['website', 'Website', x.website],
        ['address', 'Business Address', x.address],
        ['gstin', 'GSTIN', x.gstin],
        ['pan', 'PAN', x.pan],
        ['fssai', 'FSSAI', x.fssai],
        ['cin', 'CIN', x.cin],
        ['paymentTerms', 'Payment Terms', x.paymentTerms],
        ['bankName', 'Bank Name', x.bankName],
        ['accountNumber', 'Account Number', x.accountNumber],
        ['ifsc', 'IFSC', x.ifsc]
      ].filter((row) => this.isValue(row[2]));
    }

    detectPaymentRail() {
      const x = this.extracted || {};
      const mode = clean(x.paymentMode).toUpperCase();
      const text = clean(this.rawText || x.transcribedSummary || '').toLowerCase();
      if (this.isValue(x.upiId) || mode.includes('UPI') || /google\s*pay|gpay|phonepe|paytm|bhim|upi\s*ref/i.test(text)) {
        return 'UPI';
      }
      if (this.isValue(x.chequeNumber) || mode.includes('CHEQUE') || mode.includes('CHECK') || /cheque\s*no|chq\s*no/i.test(text)) {
        return 'CHEQUE';
      }
      return 'NET_BANKING';
    }

    addOptionalField(key) {
      if (!this.customReviewFields) this.customReviewFields = new Set();
      this.customReviewFields.add(key);
      this.renderReview();
    }

    removeOptionalField(key) {
      if (!this.customReviewFields) return;
      this.customReviewFields.delete(key);
      this.renderReview();
    }

    getPaymentFields() {
      const x = this.extracted || {};
      const isOut = /out|paid/i.test(clean(x.direction));
      const rail = this.detectPaymentRail();

      const ALL_FIELDS = {
        direction: ['direction', 'Direction', isOut ? 'Money Out (Paid)' : /in|received/i.test(clean(x.direction)) ? 'Money In (Received)' : 'Money Out (Paid)'],
        amount: ['amount', 'Amount (₹)', x.amount || ''],
        utr: ['utr', rail === 'UPI' ? 'UPI Ref / UTR No.' : 'UTR / Reference Number', x.utr || ''],
        date: ['date', 'Date', x.date || ''],
        party: ['party', rail === 'NET_BANKING' ? 'Beneficiary Name' : rail === 'CHEQUE' ? 'Payee Name' : 'Counterparty Name', x.party || x.beneficiaryAccount || ''],
        category: ['category', 'Party Category', x.category || (isOut ? 'Manufacturer / Supplier' : 'Buyer / Retailer')],
        paymentMode: ['paymentMode', 'Payment Method / Rail', x.paymentMode || (rail === 'UPI' ? 'UPI' : rail === 'CHEQUE' ? 'Cheque' : 'NEFT')],
        orderRef: ['orderRef', 'Linked Order', x.orderRef || ''],
        transactionStatus: ['transactionStatus', 'Status', x.transactionStatus || 'Success'],
        
        upiId: ['upiId', 'UPI ID / VPA', x.upiId || ''],
        bankTxnId: ['bankTxnId', 'Reference ID / Txn ID', x.bankTxnId || ''],
        bankName: ['bankName', 'Bank Name', x.bankName || ''],
        beneficiaryAccountNumber: ['beneficiaryAccountNumber', 'Beneficiary Account No.', x.beneficiaryAccountNumber || x.beneficiaryAccount || ''],
        payFromAccountNumber: ['payFromAccountNumber', 'Debited From Account No.', x.payFromAccountNumber || x.payFromAccount || ''],
        chequeNumber: ['chequeNumber', 'Cheque Number', x.chequeNumber || ''],
        transactionTime: ['transactionTime', 'Transaction Time', x.transactionTime || ''],
        frequency: ['frequency', 'Frequency', x.frequency || 'One Time'],
        notes: ['notes', 'Remarks / Purpose', x.notes || '']
      };

      let activeKeys = [];
      if (rail === 'UPI') {
        activeKeys = ['direction', 'amount', 'utr', 'upiId', 'party', 'category', 'paymentMode', 'date', 'orderRef', 'transactionStatus'];
      } else if (rail === 'CHEQUE') {
        activeKeys = ['direction', 'amount', 'chequeNumber', 'party', 'category', 'bankName', 'paymentMode', 'date', 'orderRef', 'transactionStatus', 'notes'];
      } else {
        activeKeys = ['direction', 'amount', 'utr', 'bankTxnId', 'party', 'category', 'beneficiaryAccountNumber', 'payFromAccountNumber', 'bankName', 'paymentMode', 'date', 'orderRef', 'transactionStatus', 'notes'];
      }

      Object.keys(ALL_FIELDS).forEach(key => {
        if (!activeKeys.includes(key)) {
          if (this.isValue(x[key]) || (this.customReviewFields && this.customReviewFields.has(key))) {
            activeKeys.push(key);
          }
        }
      });

      return activeKeys.map(k => ALL_FIELDS[k]).filter(Boolean);
    }

    evidenceFor(value) {
      const val = clean(value);
      const corpus = this.rawText || clean(this.extracted?.transcribedSummary);
      const lines = corpus.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const normalized = val.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const found = lines.find((line) => {
        const lineNorm = line.replace(/[^a-z0-9]/gi, '').toLowerCase();
        return val.length > 1 && (line.toLowerCase().includes(val.toLowerCase()) || (normalized.length >= 4 && lineNorm.includes(normalized)));
      });
      if (found) return `Text: “${found.slice(0, 180)}”`;
      return this.visionDataUrl ? 'Vision extraction — verify against the source image.' : 'Model/parser suggestion — verify before applying.';
    }

    renderReview() {
      if (!this.extracted) return;
      if (this.context === 'auto') {
        this.context = this.isInvoice ? 'partner' : (this.extracted.documentType === 'payment_settlement' ? 'payment' : 'partner');
        this.setContext(this.context);
      }
      const type = this.isInvoice ? 'Vendor invoice' : this.extracted.documentType === 'payment_settlement' ? 'Payment document' : 'Partner document';
      node('smart-fill-review-subtitle').textContent = `${type} · Destination: ${this.context === 'payment' ? 'Payment Log' : this.context === 'partner' ? 'Partner Details' : 'Choose a destination'}`;
      const fields = this.context === 'payment' ? this.getPaymentFields() : this.getPartnerFields();
      if (!fields.length) {
        node('smart-fill-review').textContent = this.isInvoice && this.context === 'payment' ? 'Invoices cannot be applied to Payment Log.' : 'No compatible fields were extracted for this destination. Choose another tab or fill the form manually.';
        node('smart-fill-actions')?.classList.add('hidden');
        node('smart-fill-header-apply')?.classList.add('hidden');
        return;
      }
      // Clean, compact 2-column input grid with interactive dropdowns
      const gridHtml = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">` + fields.map(([key, label, value]) => {
        let inputHtml = '';
        if (key === 'direction') {
          const isOut = /out|paid/i.test(value);
          inputHtml = `
            <select data-smart-fill-field="direction" onchange="TradeFlowSmartFill.onDirectionChanged(this.value)" class="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer">
              <option value="Money Out (Paid)" ${tfEscapeHtml(isOut ? 'selected' : '')}>Money Out (Paid) - Company Paid Counterparty</option>
              <option value="Money In (Received)" ${tfEscapeHtml(!isOut ? 'selected' : '')}>Money In (Received) - Received from Customer</option>
            </select>
          `;
        } else if (key === 'category') {
          inputHtml = `
            <select data-smart-fill-field="category" class="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer">
              <option value="Manufacturer / Supplier" ${tfEscapeHtml(/manufacturer|supplier|factory|mfg/i.test(value) ? 'selected' : '')}>Manufacturer / Supplier (Factory)</option>
              <option value="Packaging & Labels" ${tfEscapeHtml(/packag|label|jar/i.test(value) ? 'selected' : '')}>Packaging & Labels Vendor</option>
              <option value="Transport & Logistics" ${tfEscapeHtml(/transport|freight|logistics/i.test(value) ? 'selected' : '')}>Transport & Logistics</option>
              <option value="Buyer / Retailer" ${tfEscapeHtml(/buyer|retail|store/i.test(value) ? 'selected' : '')}>Buyer / Retailer (Customer)</option>
              <option value="Sales Marketeer" ${tfEscapeHtml(/marketeer|broker|agent/i.test(value) ? 'selected' : '')}>Sales Marketeer / Channel</option>
              <option value="Other" ${tfEscapeHtml(/other|misc/i.test(value) ? 'selected' : '')}>Other / Misc Expense</option>
            </select>
          `;
        } else if (key === 'orderRef') {
          const orders = window.app?.data?.orders || [];
          const currentOrder = clean(value);
          const optionsHtml = [
            `<option value="">-- No Order Attached --</option>`,
            ...orders.map(o => {
              const oId = esc(o.id);
              const pName = esc(o.manufacturerName || o.retailerName || '');
              const amt = Number(o.totalAmount || 0).toLocaleString('en-IN');
              const isSelected = (currentOrder && (currentOrder === o.id || currentOrder.toLowerCase() === o.id.toLowerCase())) ? 'selected' : '';
              return `<option value="${tfEscapeHtml(oId)}" ${tfEscapeHtml(isSelected)}>${tfEscapeHtml(oId)} · ${tfEscapeHtml(pName)} (₹${tfEscapeHtml(amt)})</option>`;
            })
          ].join('');
          inputHtml = `
            <select data-smart-fill-field="orderRef" class="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer">
              ${optionsHtml}
            </select>
          `;
        } else if (key === 'utr') {
          const hasDup = this.duplicateConflict && this.duplicateConflict.isDuplicate;
          const badgeClass = hasDup ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
          const badgeText = hasDup ? '⚠️ DUPLICATE' : 'VERIFIED';
          return `
            <div class="rounded-lg border ${tfEscapeHtml(hasDup ? 'border-rose-400 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90')} p-2 shadow-2xs">
              <div class="flex items-center justify-between gap-1 mb-1">
                <span class="font-bold text-[11px] text-slate-700 dark:text-slate-300 truncate">${tfEscapeHtml(esc(label))}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${tfEscapeHtml(badgeClass)}">${tfEscapeHtml(badgeText)}</span>
              </div>
              <input data-smart-fill-field="${tfEscapeHtml(esc(key))}" value="${tfEscapeHtml(esc(value))}" class="w-full px-2 py-1 text-xs rounded-md border ${tfEscapeHtml(hasDup ? 'border-rose-400 bg-rose-50 dark:bg-rose-950' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950')} text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500 font-mono font-bold">
            </div>
          `;
        } else {
          inputHtml = `<input data-smart-fill-field="${tfEscapeHtml(esc(key))}" value="${tfEscapeHtml(esc(value))}" class="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500 font-medium">`;
        }
        return `
          <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2 shadow-2xs">
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-bold text-[11px] text-slate-700 dark:text-slate-300 truncate">${tfEscapeHtml(esc(label))}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">Extracted</span>
            </div>
            ${inputHtml}
          </div>
        `;
      }).join('') + `</div>`;

      let optionalFieldsBar = '';
      if (this.context === 'payment') {
        const rail = this.detectPaymentRail();
        const allPossiblePaymentKeys = [
          ['utr', 'UTR / Reference Number'],
          ['bankTxnId', 'Reference ID / Txn ID'],
          ['beneficiaryAccountNumber', 'Beneficiary Account No.'],
          ['payFromAccountNumber', 'Debited From Account No.'],
          ['bankName', 'Bank Name'],
          ['upiId', 'UPI ID / VPA'],
          ['chequeNumber', 'Cheque Number'],
          ['transactionTime', 'Transaction Time'],
          ['frequency', 'Frequency'],
          ['notes', 'Remarks / Purpose']
        ];
        const activeKeySet = new Set(fields.map(f => f[0]));
        const remaining = allPossiblePaymentKeys.filter(([k]) => !activeKeySet.has(k));
        if (remaining.length > 0) {
          const optionsHtml = remaining.map(([k, lbl]) => `<option value="${tfEscapeHtml(k)}">${tfEscapeHtml(esc(lbl))}</option>`).join('');
          optionalFieldsBar = `
            <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">+ Add Optional Field:</span>
                <select onchange="if(this.value){ TradeFlowSmartFill.addOptionalField(this.value); this.value=''; }" class="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer">
                  <option value="">Choose field to add...</option>
                  ${optionsHtml}
                </select>
              </div>
              <span class="text-[10px] font-mono text-slate-400 font-semibold">${tfEscapeHtml(fields.length)} active fields (${tfEscapeHtml(rail)})</span>
            </div>
          `;
        }
      }

      node('smart-fill-review').innerHTML = gridHtml + optionalFieldsBar;
      
      node('smart-fill-actions')?.classList.remove('hidden');
      const headerApply = node('smart-fill-header-apply');
      if (headerApply) {
        headerApply.classList.remove('hidden');
        headerApply.disabled = this.isInvoice && this.context === 'payment';
        headerApply.classList.toggle('opacity-50', headerApply.disabled);
      }
      const apply = node('smart-fill-apply');
      if (apply) {
        apply.disabled = this.isInvoice && this.context === 'payment';
        apply.classList.toggle('opacity-50', apply.disabled);
      }
    }

    currentModal(context) {
      return node(context === 'payment' ? 'payment-modal' : 'contact-edit-modal');
    }

    snapshotModal(modal) {
      const elements = Array.from(modal.querySelectorAll('input,select,textarea,button,[data-autofilled],.autofill-badge'));
      return {
        modal,
        elements: elements.map((el) => ({ el, value: el.value, checked: el.checked, className: el.className, style: el.getAttribute('style'), dataset: { ...el.dataset }, text: el.matches('button') ? el.textContent : undefined })),
        direction: window.app?.paymentsState?.paymentFormDirection
      };
    }

    restoreSnapshot() {
      if (!this.lastSnapshot) return;
      const snap = this.lastSnapshot;
      this.pendingPartnerArchive = null;
      if (snap.direction && window.app?.setPaymentFormDirection) window.app.setPaymentFormDirection(snap.direction);
      snap.elements.forEach(({ el, value, checked, className, style, dataset, text }) => {
        if (!el.isConnected) return;
        if ('value' in el) el.value = value;
        if ('checked' in el) el.checked = checked;
        el.className = className;
        if (style === null) el.removeAttribute('style'); else el.setAttribute('style', style);
        Object.keys(el.dataset).forEach((key) => delete el.dataset[key]);
        Object.entries(dataset).forEach(([key, val]) => { el.dataset[key] = val; });
        if (text !== undefined) el.textContent = text;
      });
      this.lastSnapshot = null;
      this.removeUndoPill();
      window.app?.showToast?.('Smart Fill was undone. No record was saved.');
    }

    showUndoPill() {
      this.removeUndoPill();
      const pill = document.createElement('button');
      pill.id = 'smart-fill-undo-pill';
      pill.type = 'button';
      pill.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[150] px-4 py-2.5 rounded-full bg-slate-900 text-white shadow-xl border border-violet-400/60 text-xs font-bold';
      pill.textContent = '✨ Smart Fill applied · Undo';
      pill.addEventListener('click', () => this.restoreSnapshot());
      document.body.appendChild(pill);
    }

    removeUndoPill() {
      node('smart-fill-undo-pill')?.remove();
    }

    apply() {
      if (!this.extracted || (this.isInvoice && this.context === 'payment')) return;
      const context = this.context === 'payment' ? 'payment' : 'partner';
      if (context === 'payment' && window.app) {
        window.app.paymentModalOpenedFrom = 'smart-fill';
      }
      let modal = this.currentModal(context);
      if (modal?.classList.contains('hidden')) {
        if (context === 'payment') window.app?.openPaymentModal();
        else window.app?.openEditContactModal(null, 'retailer');
        modal = this.currentModal(context);
      }
      if (!modal) {
        this.setStatus('Could not open the TradeFlow form. Please choose the form manually.', 'rose');
        return;
      }

      this.lastSnapshot = this.snapshotModal(modal);
      const overwrite = node('smart-fill-overwrite')?.checked;

      const normalizeDateForInput = (dStr) => {
        if (!dStr) return '';
        const s = String(dStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (m1) {
          const day = m1[1].padStart(2, '0');
          const month = m1[2].padStart(2, '0');
          const year = m1[3];
          return `${year}-${month}-${day}`;
        }
        try {
          const parsed = new Date(s);
          if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
        } catch (_) {}
        return s;
      };

      const fill = (id, value, tagId = null) => {
        const el = node(id);
        let val = clean(value);
        if (el && (el.type === 'date' || id === 'pay-input-date')) {
          val = normalizeDateForInput(val);
        }
        if (!el || !val || (!overwrite && clean(el.value))) return false;
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (tagId && window.app?.setFieldHighlight) window.app.setFieldHighlight(id, tagId, true);
        else if (window.app?.markFieldAutofilled) window.app.markFieldAutofilled(el);
        return true;
      };
      let count = 0;

      if (context === 'partner') {
        const mappings = {
          name: 'edit-contact-name', brandName: 'edit-contact-brand-name', contactPerson: 'edit-contact-person',
          designation: 'edit-contact-designation', phone: 'edit-contact-phone', altPhone: 'edit-contact-alt-phone',
          email: 'edit-contact-email', billingEmail: 'edit-contact-billing-email', website: 'edit-contact-website',
          gstin: 'edit-contact-gstin', pan: 'edit-contact-pan', fssai: 'edit-contact-fssai',
          cin: 'edit-contact-cin', msme: 'edit-contact-msme', factoryLicense: 'edit-contact-factory-license',
          city: 'edit-contact-city', state: 'edit-contact-state', pincode: 'edit-contact-pincode',
          paymentTerms: 'edit-contact-terms', bankName: 'edit-contact-bank-name',
          beneficiaryName: 'edit-contact-beneficiary-name', accountNumber: 'edit-contact-acc-no',
          ifsc: 'edit-contact-ifsc', branch: 'edit-contact-branch', upiId: 'edit-contact-upi'
        };
        for (const [key, id] of Object.entries(mappings)) {
          const proposed = node('smart-fill-review').querySelector(`[data-smart-fill-field="${key}"]`)?.value || this.extracted?.[key];
          if (fill(id, proposed)) count++;
        }
        const address = node('smart-fill-review').querySelector('[data-smart-fill-field="address"]')?.value || this.extracted?.address || '';
        if (address) {
          if (fill('edit-contact-billing', address)) count++;
          if (fill('edit-contact-shipping', address)) count++;
        }
        if (this.originalFile && this.originalDataUrl) {
          this.pendingPartnerArchive = { fileData: this.originalDataUrl, fileName: this.originalFile.name, mimeType: this.originalFile.type, name: node('edit-contact-name')?.value || this.extracted.name || 'Partner' };
          window.app?.updateProfileLogoPreview?.(this.originalDataUrl, node('edit-contact-name')?.value || 'Partner');
        }
      } else {
        const directionText = node('smart-fill-review').querySelector('[data-smart-fill-field="direction"]')?.value || '';
        const isPaid = /out|paid/i.test(directionText) || /paid|out/i.test(clean(this.extracted.direction));
        if (isPaid) window.app?.setPaymentFormDirection?.('paid');
        else window.app?.setPaymentFormDirection?.('received');

        const mappings = {
          date: ['pay-input-date', 'pay-tag-date'], amount: ['pay-input-amount', 'pay-tag-amount'],
          party: ['pay-input-party', 'pay-tag-party'], utr: ['pay-input-utr', 'pay-tag-utr'],
          bankName: ['pay-input-bank', 'pay-tag-bank'], bankTxnId: ['pay-input-txnid', 'pay-tag-txnid'],
          beneficiaryAccountNumber: ['pay-input-beneficiary-acc', 'pay-tag-beneficiary-acc'],
          payFromAccountNumber: ['pay-input-payer-acc', 'pay-tag-payer-acc'],
          notes: ['pay-input-notes', 'pay-tag-notes']
        };
        for (const [key, [id, tag]] of Object.entries(mappings)) {
          let proposed = node('smart-fill-review').querySelector(`[data-smart-fill-field="${key}"]`)?.value;
          if (!proposed && key === 'beneficiaryAccountNumber') {
            proposed = this.extracted?.beneficiaryAccountNumber || this.extracted?.beneficiaryAccount || '';
          }
          if (!proposed && key === 'payFromAccountNumber') {
            proposed = this.extracted?.payFromAccountNumber || this.extracted?.payFromAccount || this.extracted?.payerAccount || '';
          }
          if (fill(id, proposed, tag)) count++;
        }

        // Ecosystem Role / Category auto-resolution
        const categoryText = node('smart-fill-review').querySelector('[data-smart-fill-field="category"]')?.value || this.extracted?.category || '';
        let category = 'retailer';
        if (/transport|freight|logistics/i.test(categoryText)) category = 'transporter';
        else if (/packag|jar|box|label/i.test(categoryText)) category = 'packaging';
        else if (/manufacturer|supplier|factory|mfg/i.test(categoryText)) category = 'manufacturer';
        else if (/retail|buyer|customer/i.test(categoryText)) category = 'retailer';
        else if (isPaid || /sonipat|anil|pickle|factory|oil/i.test(clean(this.extracted?.party) + ' ' + clean(this.extracted?.notes))) category = 'manufacturer';
        
        const categorySelect = node('pay-select-category');
        if (category && categorySelect && (overwrite || !categorySelect.value)) {
          categorySelect.value = category;
          window.app?.onPaymentCategoryChanged?.(category);
          window.app?.setFieldHighlight?.('pay-select-category', 'pay-tag-category', true);
          count++;
        }

        const modeText = node('smart-fill-review').querySelector('[data-smart-fill-field="paymentMode"]')?.value || '';
        const modeSelect = node('pay-select-mode');
        if (modeText && modeSelect && (overwrite || !modeSelect.value)) {
          const option = Array.from(modeSelect.options).find((o) => o.value.toLowerCase() === modeText.toLowerCase() || o.textContent.toLowerCase().includes(modeText.toLowerCase()));
          if (option) { modeSelect.value = option.value; window.app?.setFieldHighlight?.('pay-select-mode', 'pay-tag-mode', true); count++; }
        }

        // Order attachment: auto-match order reference or remarks
        const orderText = node('smart-fill-review').querySelector('[data-smart-fill-field="orderRef"]')?.value || this.extracted?.orderRef || '';
        const orderSelect = node('pay-select-order');
        if (orderSelect && (overwrite || !orderSelect.value)) {
          let matchedOption = null;
          if (orderText) {
            const q = orderText.toLowerCase().trim();
            matchedOption = Array.from(orderSelect.options).find(o => 
              o.value.toLowerCase() === q ||
              o.textContent.toLowerCase().includes(q) ||
              (o.dataset && o.dataset.orderid && o.dataset.orderid.toLowerCase() === q)
            );
          }
          if (!matchedOption) {
            const corpus = `${clean(this.extracted?.notes)} ${clean(this.extracted?.party)}`.toLowerCase();
            matchedOption = Array.from(orderSelect.options).find(o => {
              const txt = o.textContent.toLowerCase();
              return (corpus.includes('aadivasi') && txt.includes('aadivasi')) ||
                     (corpus.includes('oil') && txt.includes('oil')) ||
                     (corpus.includes('sonipat') && txt.includes('sonipat')) ||
                     (corpus.includes('ord-1009') && txt.includes('ord-1009'));
            });
          }
          if (matchedOption) {
            orderSelect.value = matchedOption.value;
            window.app?.onPaymentOrderChanged?.(matchedOption.value);
            window.app?.setFieldHighlight?.('pay-select-order', 'pay-tag-order', true);
            const badge = node('payment-modal-order-badge');
            if (badge) { badge.textContent = matchedOption.textContent.trim(); badge.classList.remove('hidden'); }
            count++;
          }
        }

        // Attach proof file and initialize side preview in payment modal
        if (this.originalFile && this.originalDataUrl) {
          const fileName = this.originalFile.name;
          const isPdf = this.isPdf || fileName.toLowerCase().endsWith('.pdf') || (typeof this.originalDataUrl === 'string' && this.originalDataUrl.startsWith('data:application/pdf'));
          const fileType = isPdf ? 'application/pdf' : (this.originalFile.type || 'image/jpeg');

          node('pay-hidden-filedata').value = this.originalDataUrl;
          node('pay-hidden-filename').value = fileName;
          node('pay-hidden-filetype').value = fileType;
          const preview = node('payment-preview-wrap');
          const zone = node('payment-dropzone');
          if (zone) zone.classList.add('hidden');
          if (preview) preview.classList.remove('hidden');
          if (node('payment-preview-name')) node('payment-preview-name').textContent = fileName;
          
          if (window.app?.renderPaymentPreview) {
            window.app.renderPaymentPreview(fileName, this.originalDataUrl, fileType);
          }
          if (window.app?.togglePaymentSidePreview) {
            window.app.togglePaymentSidePreview(true);
          }
        }

        // Live balance recalculation
        if (window.app?.recalcPaymentLiveBalance) {
          window.app.recalcPaymentLiveBalance();
        }
      }

      this.close();
      if (count) {
        this.showUndoPill();
        window.app?.showToast?.(`Smart Fill applied ${count} field${count === 1 ? '' : 's'}. Review before saving.`);
      } else {
        this.lastSnapshot = null;
        window.app?.showToast?.('No fields were applied. Clear existing values or check Replace existing form values.');
      }
    }

    async archivePendingPartnerDocument(contact) {
      const source = this.pendingPartnerArchive;
      this.pendingPartnerArchive = null;
      if (!source?.fileData || !contact?.id) return;
      try {
        const response = await fetch('/api/smart-fill/archive', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'partner', partnerId: contact.id, partnerName: contact.name, fileData: source.fileData, fileName: source.fileName, mimeType: source.mimeType })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Archive failed');
        window.app?.showToast?.(`Original document filed as ${result.fileName}`);
      } catch (error) {
        window.app?.showToast?.(`Partner saved; source document could not be archived: ${error.message}`);
      }
    }

    discardPendingPartnerArchive() {
      this.pendingPartnerArchive = null;
    }

    markSaved() {
      this.lastSnapshot = null;
      this.removeUndoPill();
      this.clearDraft();
    }
  }

  const controller = new TradeFlowSmartFillController();
  window.TradeFlowSmartFill = {
    open: (...args) => controller.open(...args),
    close: () => controller.close(),
    openNvidiaSettings: () => controller.openNvidiaSettings(),
    closeNvidiaSettings: () => controller.closeNvidiaSettings(),
    testNvidiaConnection: () => controller.testNvidiaConnection(),
    setContext: (...args) => controller.setContext(...args),
    analyze: () => controller.analyze(),
    clearInput: () => controller.clearInput(),
    clearDraft: () => controller.clearDraft(),
    discardDraft: () => controller.discardDraft(),
    restoreFromDraft: (draft) => controller.restoreFromDraft(draft),
    persistDraft: () => controller.persistDraft(),
    apply: () => controller.apply(),
    undo: () => controller.restoreSnapshot(),
    togglePreview: (force) => controller.togglePreview(force),
    zoomIn: () => controller.zoomIn(),
    zoomOut: () => controller.zoomOut(),
    resetZoom: () => controller.resetZoom(),
    fitWidth: () => controller.fitWidth(),
    fitPage: () => controller.fitPage(),
    toggleTextInspector: (force) => controller.toggleTextInspector(force),
    copyExtractedText: () => controller.copyExtractedText(),
    applyInspectorTextAndAnalyze: () => controller.applyInspectorTextAndAnalyze(),
    mergePartnerDetails: () => controller.mergePartnerDetails(),
    saveAsNewPartner: () => controller.saveAsNewPartner(),
    dismissPartnerMerge: () => controller.dismissPartnerMerge(),
    checkPartnerCollision: (ext) => controller.checkPartnerCollision(ext),
    prevPdfPage: () => controller.prevPdfPage(),
    nextPdfPage: () => controller.nextPdfPage(),
    downloadOriginalFile: () => controller.downloadOriginalFile(),
    openPreviewNewTab: () => controller.openPreviewNewTab(),
    openDualSlipFromWarning: () => controller.openDualSlipFromWarning(),
    hideDuplicateWarning: () => controller.hideDuplicateWarning(),
    discardCurrentDraft: () => controller.discardDraft(),
    get duplicateOverride() { return controller.duplicateOverride; },
    set duplicateOverride(val) { controller.duplicateOverride = val; },
    get duplicateConflict() { return controller.duplicateConflict; },
    set duplicateConflict(val) { controller.duplicateConflict = val; },
    processContactText: (text) => controller.open('partner', null, text),
    processFile: (context, file) => controller.open(context, file),
    loadFromMobileSnap: (data) => controller.loadFromMobileSnap(data),
    renderReview: () => controller.renderReview(),
    addOptionalField: (key) => controller.addOptionalField(key),
    rotatePreview: (deg) => controller.rotatePreview(deg),
    toggleCropMode: (state) => controller.toggleCropMode(state),
    applyDesktopCrop: () => controller.applyDesktopCrop(),
    detectPaymentRail: () => controller.detectPaymentRail(),
    getPaymentFields: () => controller.getPaymentFields(),
    toggleLogBox: () => controller.toggleLogBox(),
    onDirectionChanged: (val) => controller.onDirectionChanged(val),
    get extracted() { return controller.extracted; },
    set extracted(val) { controller.extracted = val; },
    get context() { return controller.context; },
    set context(val) { controller.context = val; },
    get controller() { return controller; },
    archivePendingPartnerDocument: (contact) => controller.archivePendingPartnerDocument(contact),
    discardPendingPartnerArchive: () => controller.discardPendingPartnerArchive(),
    markSaved: () => controller.markSaved()
  };
  window.addEventListener('DOMContentLoaded', () => controller.init());
})();
