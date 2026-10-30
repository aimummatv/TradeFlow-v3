// Escape user and imported values at their HTML, JavaScript, and URL boundaries.
(function () {
  'use strict';
  window.tfEscapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  window.tfEscapeJs = value => JSON.stringify(String(value ?? '')).slice(1, -1).replace(/'/g, '\\x27').replace(/</g, '\\x3c').replace(/>/g, '\\x3e').replace(/&/g, '\\x26');
  window.tfSafeUrl = value => {
    const url = String(value ?? '').trim();
    const normalized = url.replace(/[\u0000-\u0020]/g, '');
    if (/^(?:javascript|vbscript|file):/i.test(normalized)) return 'about:blank';
    if (/^data:/i.test(normalized) && !/^data:(?:image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,/i.test(normalized)) return 'about:blank';
    return url;
  };
  window.tfSanitizeHtml = value => DOMPurify.sanitize(String(value ?? ''), { USE_PROFILES: { html: true } });
})();
