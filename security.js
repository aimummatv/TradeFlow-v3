'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Readable } = require('stream');

const MAX_BODY = 50 * 1024 * 1024;
const documentExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.xls', '.csv', '.txt']);
function isWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function assertWithin(root, target) {
  if (!isWithin(root, target)) throw new Error('Path is outside the permitted data folder');
  let existing = path.resolve(target);
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error('Invalid path');
    existing = parent;
  }
  if (!isWithin(fs.realpathSync(root), fs.realpathSync(existing))) throw new Error('Linked paths outside the data folder are forbidden');
  if (path.relative(root, target).includes(':')) throw new Error('Alternate data streams are forbidden');
  return target;
}
function allowedDocument(target) { return documentExtensions.has(path.extname(target).toLowerCase()); }
function fail(res, status, error) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error }));
}
function createGuard(root, port) {
  const hosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const item of interfaces || []) if (item.family === 'IPv4') hosts.add(item.address);
  }
  return async function guard(req, res, handler) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "base-uri 'self'; object-src 'none'; frame-ancestors 'self'");
    try {
      const authority = new URL('http://' + req.headers.host);
      if (!hosts.has(authority.hostname) || Number(authority.port || 80) !== Number(port) || authority.username || authority.password) return fail(res, 403, 'Unrecognized Host header');
      const url = new URL(req.url, authority.origin);
      let decoded;
      try { decoded = decodeURIComponent(url.pathname); } catch { return fail(res, 400, 'Malformed URL encoding'); }
      if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').includes('..')) return fail(res, 403, 'Invalid path');
      const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      // Phones can access the capture page and submit a paired upload only.
      if (!local && !['/mobile-snap', '/mobile-snap/', '/mobile_snap.html', '/api/mobile-snap/upload', '/vendor/tailwind.js', '/vendor/lucide.js'].includes(decoded)) return fail(res, 403, 'The desktop API is accessible only on this computer');
      if (req.headers.origin && req.headers.origin !== authority.origin) return fail(res, 403, 'Cross-origin requests are forbidden');
      if (req.headers['sec-fetch-site'] === 'cross-site') return fail(res, 403, 'Cross-site requests are forbidden');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (!['GET', 'HEAD', 'POST'].includes(req.method)) return fail(res, 405, 'Method not allowed');
      if (req.method !== 'POST') return handler(req, res);
      const declared = Number(req.headers['content-length'] || 0);
      if (declared > MAX_BODY) return fail(res, 413, 'Request exceeds the 50MB limit');
      let size = 0;
      const chunks = [];
      req.setTimeout(30000, () => req.destroy());
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) { fail(res, 413, 'Request exceeds the 50MB limit'); return; }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      if (body.length && !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return fail(res, 415, 'JSON content type is required');
      try {
        const payload = JSON.parse(body.toString('utf8') || '{}', (key, value) => {
          if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe object key');
          return value;
        });
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JSON object required');
      } catch { return fail(res, 400, 'Invalid JSON object'); }
      const replay = Readable.from(body.length ? [body] : []);
      Object.assign(replay, { method: req.method, url: req.url, headers: req.headers, socket: req.socket });
      handler(replay, res);
    } catch (error) {
      if (!res.headersSent) fail(res, 400, 'Invalid request');
      else if (!res.writableEnded) res.end();
    }
  };
}
module.exports = { createGuard, assertWithin, isWithin, allowedDocument, MAX_BODY };
