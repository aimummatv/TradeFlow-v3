const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { isDeepStrictEqual } = require('util');

class DBManager {
  constructor(baseDir) {
    this.baseDir = baseDir || __dirname;
    this.dataPath = path.join(this.baseDir, 'data');
    this.dbPath = path.join(this.dataPath, 'tradeflow.db');
    this.db = null;
    this.init();
  }

  init() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Enable WAL mode for high concurrency & durability
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    // Schema Initialization
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        invoice_number TEXT,
        date TEXT,
        retailer_id TEXT,
        retailer_name TEXT,
        status TEXT,
        total_amount REAL DEFAULT 0,
        balance_due REAL DEFAULT 0,
        data_json TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
      CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(invoice_number);

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT,
        phone TEXT,
        email TEXT,
        gstin TEXT,
        data_json TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts(role);
      CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT,
        sku TEXT,
        hsn TEXT,
        mrp REAL DEFAULT 0,
        data_json TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        date TEXT,
        order_ref TEXT,
        party_name TEXT,
        direction TEXT,
        amount REAL DEFAULT 0,
        mode TEXT,
        utr TEXT,
        has_proof INTEGER DEFAULT 0,
        data_json TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_payments_order_ref ON payments(order_ref);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
      CREATE INDEX IF NOT EXISTS idx_payments_direction ON payments(direction);

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        category TEXT,
        file_name TEXT,
        file_url TEXT,
        data_json TEXT NOT NULL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        user_name TEXT DEFAULT 'Admin',
        action_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE, IMPORT, RESTORE, ROLLBACK
        entity_type TEXT NOT NULL, -- ORDER, PAYMENT, PARTNER, SKU, SYSTEM
        entity_id TEXT,
        summary TEXT NOT NULL,
        details_json TEXT,
        previous_state TEXT,
        new_state TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS payment_slip_registry (
        id TEXT PRIMARY KEY,
        file_hash TEXT,
        utr TEXT,
        order_id TEXT,
        party_name TEXT,
        amount REAL,
        date TEXT,
        file_url TEXT,
        file_name TEXT,
        created_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_slip_reg_utr ON payment_slip_registry(utr);
      CREATE INDEX IF NOT EXISTS idx_slip_reg_hash ON payment_slip_registry(file_hash);
      CREATE INDEX IF NOT EXISTS idx_slip_reg_order ON payment_slip_registry(order_id);
    `);

    // Safe column migrations for contacts multi-contact intelligence
    const safeAddColumn = (table, colDef) => {
      try { this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`); } catch (_) {}
    };
    safeAddColumn('contacts', 'alt_phones TEXT');
    safeAddColumn('contacts', 'alt_emails TEXT');
    safeAddColumn('contacts', 'alt_contacts TEXT');
    safeAddColumn('contacts', 'card_notes TEXT');
    safeAddColumn('payments', 'beneficiary_account TEXT');
    safeAddColumn('payments', 'payer_account TEXT');
    safeAddColumn('payments', 'bank_txn_id TEXT');
  }

  // Safe migration from in-memory / mock-data object to SQLite
  migrateFromData(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid data payload for migration');

    this.db.exec('BEGIN TRANSACTION;');
    try {
      // Clear existing records so deleted/extra records from mutations are removed
      this.db.exec(`
        DELETE FROM orders;
        DELETE FROM contacts;
        DELETE FROM products;
        DELETE FROM payments;
        DELETE FROM documents;
      `);

      // 1. Migrate Products
      const insertProduct = this.db.prepare(`
        INSERT OR REPLACE INTO products (id, name, short_name, sku, hsn, mrp, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      (data.products || []).forEach(p => {
        const now = new Date().toISOString();
        insertProduct.run(
          p.id,
          p.name || 'Unnamed Product',
          p.shortName || '',
          p.sku || '',
          p.hsn || '',
          Number(p.mrp || 0),
          JSON.stringify(p),
          p.createdAt || now,
          now
        );
      });

      // 2. Migrate Contacts (Partners)
      const insertContact = this.db.prepare(`
        INSERT OR REPLACE INTO contacts (id, name, role, phone, email, gstin, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      (data.contacts || []).forEach(c => {
        const now = new Date().toISOString();
        insertContact.run(
          c.id,
          c.name || 'Unnamed Contact',
          c.role || c.type || 'other',
          c.phone || '',
          c.email || '',
          c.gstin || '',
          JSON.stringify(c),
          c.createdAt || now,
          now
        );
      });

      // 3. Migrate Orders
      const insertOrder = this.db.prepare(`
        INSERT OR REPLACE INTO orders (id, invoice_number, date, retailer_id, retailer_name, status, total_amount, balance_due, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      (data.orders || []).forEach(o => {
        const now = new Date().toISOString();
        insertOrder.run(
          o.id,
          o.invoiceNumber || o.id,
          o.date || '',
          o.retailerId || '',
          o.retailerName || o.buyerName || '',
          (o.status || 'pending').toLowerCase(),
          Number(o.totalInvoiceAmount || o.totalAmount || 0),
          Number(o.customerBalanceDue !== undefined ? o.customerBalanceDue : 0),
          JSON.stringify(o),
          o.createdAt || now,
          now
        );
      });

      // 4. Migrate Payments
      const insertPayment = this.db.prepare(`
        INSERT OR REPLACE INTO payments (id, date, order_ref, party_name, direction, amount, mode, utr, has_proof, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      (data.payments || []).forEach(p => {
        const now = new Date().toISOString();
        insertPayment.run(
          p.id,
          p.date || '',
          p.orderRef || '',
          p.partyName || '',
          (p.direction || 'received').toLowerCase(),
          Number(p.amount || 0),
          p.mode || 'UPI',
          p.utr || '',
          p.hasProof ? 1 : 0,
          JSON.stringify(p),
          p.createdAt || now,
          now
        );
      });

      // 5. Migrate Documents
      const insertDoc = this.db.prepare(`
        INSERT OR REPLACE INTO documents (id, order_id, category, file_name, file_url, data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      (data.documents || []).forEach(d => {
        insertDoc.run(
          d.id,
          d.orderId || '',
          d.category || '',
          d.fileName || d.storedFileName || '',
          d.fileUrl || '',
          JSON.stringify(d),
          d.createdAt || new Date().toISOString()
        );
      });

      const metadata = Object.fromEntries(Object.entries(data).filter(([key]) => !['orders', 'contacts', 'products', 'payments', 'documents'].includes(key)));
      this.db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run('snapshotMetadata', JSON.stringify(metadata), new Date().toISOString());
      // 6. Save Business Profile in system settings
      if (data.businessProfile) {
        const insertSetting = this.db.prepare(`
          INSERT OR REPLACE INTO system_settings (key, value, updated_at)
          VALUES (?, ?, ?)
        `);
        insertSetting.run('businessProfile', JSON.stringify(data.businessProfile), new Date().toISOString());
      }
      this.db.exec('DELETE FROM payment_slip_registry');
      for (const entry of data.paymentSlipRegistry || []) this.registerPaymentSlip(entry);

      this.db.exec('COMMIT;');

      // Record migration in activity log
      this.logActivity({
        userName: 'System Setup',
        actionType: 'MIGRATION',
        entityType: 'SYSTEM',
        entityId: 'tradeflow.db',
        summary: `Initial data migration completed: ${(data.orders || []).length} orders, ${(data.contacts || []).length} contacts, ${(data.payments || []).length} payments migrated to SQLite.`,
        details: { ordersCount: (data.orders || []).length, paymentsCount: (data.payments || []).length }
      });

      return {
        success: true,
        counts: {
          orders: (data.orders || []).length,
          contacts: (data.contacts || []).length,
          products: (data.products || []).length,
          payments: (data.payments || []).length,
          documents: (data.documents || []).length
        }
      };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      console.error('[DBManager] Migration rollback due to error:', err);
      throw err;
    }
  }

  // Replace the full app snapshot atomically, including deletions and metadata.
  saveSnapshot(data, userName = 'Admin') {
    const groups = ['orders', 'contacts', 'products', 'payments', 'documents'];
    if (!data || typeof data !== 'object') throw new Error('Invalid dataset');
    for (const key of groups) {
      if (!Array.isArray(data[key])) throw new Error(key + ' must be an array');
      const ids = data[key].map(row => row && row.id);
      if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) throw new Error('Missing or duplicate IDs in ' + key);
      for (const row of data[key]) {
        for (const field of ['mrp', 'amount', 'totalInvoiceAmount', 'totalAmount', 'customerBalanceDue', 'customerAdvanceReceived']) {
          if (row[field] !== undefined && !Number.isFinite(Number(row[field]))) throw new Error('Invalid numeric field: ' + field);
        }
      }
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const [table, entity] of [['orders', 'ORDER'], ['contacts', 'PARTNER'], ['payments', 'PAYMENT'], ['products', 'SKU'], ['documents', 'DOCUMENT']]) {
        const keep = new Set(data[table].map(row => row.id));
        for (const row of this.db.prepare('SELECT id, data_json FROM ' + table).all()) {
          if (!keep.has(row.id)) {
            this.db.prepare('DELETE FROM ' + table + ' WHERE id = ?').run(row.id);
            this.logActivity({ userName, actionType: 'DELETE', entityType: entity, entityId: row.id, summary: 'Deleted ' + entity + ' ' + row.id, previousState: JSON.parse(row.data_json) });
          }
        }
      }
      data.orders.forEach(row => this.saveOrder(row, userName));
      data.contacts.forEach(row => this.saveContact(row, userName));
      data.payments.forEach(row => this.savePayment(row, userName));
      const now = new Date().toISOString();
      const product = this.db.prepare('INSERT OR REPLACE INTO products (id, name, short_name, sku, hsn, mrp, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      data.products.forEach(row => product.run(row.id, row.name || '', row.shortName || '', row.sku || '', row.hsn || '', Number(row.mrp || 0), JSON.stringify(row), row.createdAt || now, now));
      const document = this.db.prepare('INSERT OR REPLACE INTO documents (id, order_id, category, file_name, file_url, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      data.documents.forEach(row => document.run(row.id, row.orderId || '', row.category || '', row.fileName || row.storedFileName || '', row.fileUrl || '', JSON.stringify(row), row.createdAt || now));
      const setting = this.db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)');
      const metadata = Object.fromEntries(Object.entries(data).filter(([key]) => !groups.includes(key)));
      setting.run('snapshotMetadata', JSON.stringify(metadata), now);
      if (data.businessProfile) setting.run('businessProfile', JSON.stringify(data.businessProfile), now);
      else this.db.prepare("DELETE FROM system_settings WHERE key = 'businessProfile'").run();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // Load canonical full dataset
  getFullData() {
    const ordersRows = this.db.prepare('SELECT data_json FROM orders ORDER BY date DESC').all();
    const contactsRows = this.db.prepare('SELECT data_json FROM contacts ORDER BY name ASC').all();
    const productsRows = this.db.prepare('SELECT data_json FROM products ORDER BY name ASC').all();
    const paymentsRows = this.db.prepare('SELECT data_json FROM payments ORDER BY date DESC').all();
    const documentsRows = this.db.prepare('SELECT data_json FROM documents ORDER BY created_at DESC').all();
    const slipRegistry = this.db.prepare('SELECT * FROM payment_slip_registry').all().map(row => ({ id: row.id, fileHash: row.file_hash, utr: row.utr, orderId: row.order_id, partyName: row.party_name, amount: row.amount, date: row.date, fileUrl: row.file_url, fileName: row.file_name, createdAt: row.created_at }));

    let businessProfile = null;
    const profileRow = this.db.prepare("SELECT value FROM system_settings WHERE key = 'businessProfile'").get();
    if (profileRow && profileRow.value) {
      try { businessProfile = JSON.parse(profileRow.value); } catch (_) {}
    }

    return {
      ...JSON.parse(this.db.prepare("SELECT value FROM system_settings WHERE key = 'snapshotMetadata'").get()?.value || '{}'),
      businessProfile: businessProfile || { companyName: '', legalName: '', brandName: '', gstin: '', pan: '', fssai: '', address: '', state: '', stateCode: '', phone: '', email: '' },
      orders: ordersRows.map(r => JSON.parse(r.data_json)),
      contacts: contactsRows.map(r => JSON.parse(r.data_json)),
      products: productsRows.map(r => JSON.parse(r.data_json)),
      payments: paymentsRows.map(r => JSON.parse(r.data_json)),
      documents: documentsRows.map(r => JSON.parse(r.data_json)),
      paymentSlipRegistry: slipRegistry
    };
  }

  // Check if DB is already seeded with records
  isSeeded() {
    try {
      if (this.db.prepare("SELECT 1 FROM system_settings WHERE key = 'snapshotMetadata'").get()) return true;
      return ['orders', 'contacts', 'products', 'payments'].some(table => this.db.prepare('SELECT 1 FROM ' + table + ' LIMIT 1').get());
    } catch (_) {
      return false;
    }
  }

  // Order CRUD
  getOrder(orderId) {
    const row = this.db.prepare('SELECT data_json FROM orders WHERE id = ? OR invoice_number = ?').get(orderId, orderId);
    return row ? JSON.parse(row.data_json) : null;
  }

  saveOrder(order, userName = 'Admin', actionType = 'UPDATE') {
    if (!order || !order.id) throw new Error('Order must have an ID');
    const existing = this.getOrder(order.id);
    if (isDeepStrictEqual(existing, order)) return order;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO orders (id, invoice_number, date, retailer_id, retailer_name, status, total_amount, balance_due, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM orders WHERE id = ?), ?), ?)
    `);

    stmt.run(
      order.id,
      order.invoiceNumber || order.id,
      order.date || '',
      order.retailerId || '',
      order.retailerName || order.buyerName || '',
      (order.status || 'pending').toLowerCase(),
      Number(order.totalInvoiceAmount || order.totalAmount || 0),
      Number(order.customerBalanceDue !== undefined ? order.customerBalanceDue : 0),
      JSON.stringify(order),
      order.id,
      now,
      now
    );

    // Log Activity with before/after diff
    const summary = existing
      ? `Updated Order ${order.id} (${order.invoiceNumber || ''}): ${order.retailerName || ''}`
      : `Created New Order ${order.id} (${order.invoiceNumber || ''}) for ${order.retailerName || ''}`;

    this.logActivity({
      userName,
      actionType: existing ? actionType : 'CREATE',
      entityType: 'ORDER',
      entityId: order.id,
      summary,
      previousState: existing,
      newState: order
    });

    return order;
  }

  // Payment CRUD
  getPayment(paymentId) {
    const row = this.db.prepare('SELECT data_json FROM payments WHERE id = ?').get(paymentId);
    return row ? JSON.parse(row.data_json) : null;
  }

  savePayment(payment, userName = 'Admin') {
    if (!payment || !payment.id) throw new Error('Payment must have an ID');
    const existing = this.getPayment(payment.id);
    if (isDeepStrictEqual(existing, payment)) return payment;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO payments (id, date, order_ref, party_name, direction, amount, mode, utr, has_proof, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM payments WHERE id = ?), ?), ?)
    `);

    stmt.run(
      payment.id,
      payment.date || '',
      payment.orderRef || '',
      payment.partyName || '',
      (payment.direction || 'received').toLowerCase(),
      Number(payment.amount || 0),
      payment.mode || 'UPI',
      payment.utr || '',
      payment.hasProof ? 1 : 0,
      JSON.stringify(payment),
      payment.id,
      now,
      now
    );

    this.logActivity({
      userName,
      actionType: existing ? 'UPDATE' : 'CREATE',
      entityType: 'PAYMENT',
      entityId: payment.id,
      summary: existing
        ? `Updated Payment ${payment.id} (₹${payment.amount} - ${payment.partyName})`
        : `Recorded Payment ${payment.id} (₹${payment.amount} - ${payment.partyName})`,
      previousState: existing,
      newState: payment
    });

    return payment;
  }

  // Payment Slip Registry & Collision Detection
  registerPaymentSlip(entry) {
    if (!entry) return null;
    const id = entry.id || `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO payment_slip_registry (id, file_hash, utr, order_id, party_name, amount, date, file_url, file_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      entry.fileHash || '',
      (entry.utr || '').trim().toUpperCase(),
      entry.orderId || entry.orderRef || '',
      entry.partyName || '',
      Number(entry.amount || 0),
      entry.date || '',
      entry.fileUrl || '',
      entry.fileName || '',
      entry.createdAt || now
    );
    return { id, ...entry };
  }

  checkDuplicatePaymentSlip({ utr, fileHash, amount, date, partyName, currentOrderId = '' }) {
    const cleanUtr = (utr || '').trim().toUpperCase();
    const invalidUtrs = ['NUMBER', 'UTR', 'REF', 'TXN', 'ID', 'NULL', 'UNDEFINED', ''];
    
    // 1. Check exact UTR match (highest confidence)
    if (cleanUtr && cleanUtr.length >= 6 && !invalidUtrs.includes(cleanUtr)) {
      // Check in payment_slip_registry
      const regMatch = this.db.prepare(`
        SELECT * FROM payment_slip_registry 
        WHERE UPPER(utr) = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(cleanUtr);
      if (regMatch) {
        return {
          isDuplicate: true,
          matchType: 'utr',
          matchedOn: `UTR / Reference ${cleanUtr}`,
          existing: {
            id: regMatch.id,
            orderRef: regMatch.order_id,
            partyName: regMatch.party_name,
            amount: regMatch.amount,
            date: regMatch.date,
            utr: regMatch.utr,
            fileUrl: regMatch.file_url,
            fileName: regMatch.file_name,
            createdAt: regMatch.created_at
          }
        };
      }

      // Also check in payments table
      const payMatch = this.db.prepare(`
        SELECT * FROM payments 
        WHERE UPPER(utr) = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(cleanUtr);
      if (payMatch) {
        let pData = {};
        try { pData = JSON.parse(payMatch.data_json); } catch (_) {}
        return {
          isDuplicate: true,
          matchType: 'utr',
          matchedOn: `UTR / Reference ${cleanUtr}`,
          existing: {
            id: payMatch.id,
            orderRef: payMatch.order_ref,
            partyName: payMatch.party_name,
            amount: payMatch.amount,
            date: payMatch.date,
            utr: payMatch.utr,
            fileUrl: pData.pd || '',
            fileName: pData.pn || '',
            createdAt: payMatch.created_at
          }
        };
      }
    }

    // 2. Check File Hash match
    if (fileHash && fileHash.length > 8) {
      const hashMatch = this.db.prepare(`
        SELECT * FROM payment_slip_registry 
        WHERE file_hash = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(fileHash);
      if (hashMatch) {
        return {
          isDuplicate: true,
          matchType: 'file_hash',
          matchedOn: 'Identical file content already uploaded',
          existing: {
            id: hashMatch.id,
            orderRef: hashMatch.order_id,
            partyName: hashMatch.party_name,
            amount: hashMatch.amount,
            date: hashMatch.date,
            utr: hashMatch.utr,
            fileUrl: hashMatch.file_url,
            fileName: hashMatch.file_name,
            createdAt: hashMatch.created_at
          }
        };
      }
    }

    // 3. Check exact transaction signature: Amount + Date + Party
    const numAmount = Number(amount || 0);
    const cleanDate = (date || '').trim();
    const cleanParty = (partyName || '').trim().toLowerCase();
    if (numAmount > 0 && cleanDate && cleanParty && cleanParty.length > 2) {
      const sigMatch = this.db.prepare(`
        SELECT * FROM payments 
        WHERE amount = ? AND date = ? AND LOWER(party_name) LIKE ?
        ORDER BY created_at DESC LIMIT 1
      `).get(numAmount, cleanDate, `%${cleanParty}%`);
      if (sigMatch) {
        let pData = {};
        try { pData = JSON.parse(sigMatch.data_json); } catch (_) {}
        return {
          isDuplicate: true,
          matchType: 'pattern',
          matchedOn: `Identical settlement: ₹${numAmount} on ${cleanDate} to ${sigMatch.party_name}`,
          existing: {
            id: sigMatch.id,
            orderRef: sigMatch.order_ref,
            partyName: sigMatch.party_name,
            amount: sigMatch.amount,
            date: sigMatch.date,
            utr: sigMatch.utr,
            fileUrl: pData.pd || '',
            fileName: pData.pn || '',
            createdAt: sigMatch.created_at
          }
        };
      }
    }

    return { isDuplicate: false };
  }

  // Partner/Contact CRUD
  getContact(contactId) {
    const row = this.db.prepare('SELECT data_json FROM contacts WHERE id = ? OR name = ?').get(contactId, contactId);
    return row ? JSON.parse(row.data_json) : null;
  }

  saveContact(contact, userName = 'Admin') {
    if (!contact || !contact.id) throw new Error('Contact must have an ID');
    const existing = this.getContact(contact.id);
    if (isDeepStrictEqual(existing, contact)) return contact;
    const now = new Date().toISOString();

    const altPhonesStr = Array.isArray(contact.altPhones) ? contact.altPhones.join(', ') : (contact.altPhones || '');
    const altEmailsStr = Array.isArray(contact.altEmails) ? contact.altEmails.join(', ') : (contact.altEmails || '');
    const altContactsStr = Array.isArray(contact.altContacts) ? contact.altContacts.join(', ') : (contact.altContacts || '');
    const cardNotesStr = contact.cardNotes || '';

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO contacts (id, name, role, phone, email, gstin, data_json, alt_phones, alt_emails, alt_contacts, card_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM contacts WHERE id = ?), ?), ?)
    `);

    stmt.run(
      contact.id,
      contact.name || '',
      contact.role || contact.type || 'other',
      contact.phone || '',
      contact.email || '',
      contact.gstin || '',
      JSON.stringify(contact),
      altPhonesStr,
      altEmailsStr,
      altContactsStr,
      cardNotesStr,
      contact.id,
      now,
      now
    );

    this.logActivity({
      userName,
      actionType: existing ? 'UPDATE' : 'CREATE',
      entityType: 'PARTNER',
      entityId: contact.id,
      summary: existing ? `Updated Partner ${contact.name} (${contact.id})` : `Added Partner ${contact.name} (${contact.id})`,
      previousState: existing,
      newState: contact
    });

    return contact;
  }

  // Activity Log
  logActivity({ userName = 'Admin', actionType, entityType, entityId, summary, details = null, previousState = null, newState = null }) {
    try {
      const id = `ACT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO activity_log (id, timestamp, user_name, action_type, entity_type, entity_id, summary, details_json, previous_state, new_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        timestamp,
        userName,
        actionType.toUpperCase(),
        entityType.toUpperCase(),
        entityId || null,
        summary,
        details ? JSON.stringify(details) : null,
        previousState ? JSON.stringify(previousState) : null,
        newState ? JSON.stringify(newState) : null
      );
      return { id, timestamp };
    } catch (e) {
      console.error('[DBManager] Failed to record activity log:', e.message);
      return null;
    }
  }

  getActivityLogs(limit = 100, entityType = null, entityId = null) {
    let query = 'SELECT * FROM activity_log';
    const params = [];

    if (entityType && entityId) {
      query += ' WHERE entity_type = ? AND entity_id = ?';
      params.push(entityType.toUpperCase(), entityId);
    } else if (entityType) {
      query += ' WHERE entity_type = ?';
      params.push(entityType.toUpperCase());
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params);
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      userName: r.user_name,
      actionType: r.action_type,
      entityType: r.entity_type,
      entityId: r.entity_id,
      summary: r.summary,
      details: r.details_json ? JSON.parse(r.details_json) : null,
      previousState: r.previous_state ? JSON.parse(r.previous_state) : null,
      newState: r.new_state ? JSON.parse(r.new_state) : null
    }));
  }

  // Rollback to previous state from an activity log entry
  rollbackChange(logId, userName = 'Admin') {
    const row = this.db.prepare('SELECT * FROM activity_log WHERE id = ?').get(logId);
    if (!row) throw new Error(`Activity log entry ${logId} not found.`);
    if (!row.previous_state) throw new Error(`No previous snapshot available for log entry ${logId}.`);

    const prevState = JSON.parse(row.previous_state);
    const entityType = row.entity_type.toUpperCase();

    if (entityType === 'ORDER') {
      this.saveOrder(prevState, userName, 'ROLLBACK');
    } else if (entityType === 'PAYMENT') {
      this.savePayment(prevState, userName);
    } else if (entityType === 'PARTNER') {
      this.saveContact(prevState, userName);
    } else {
      throw new Error(`Unsupported rollback entity type: ${entityType}`);
    }

    this.logActivity({
      userName,
      actionType: 'ROLLBACK',
      entityType,
      entityId: row.entity_id,
      summary: `Rolled back ${entityType} ${row.entity_id} to snapshot from ${row.timestamp}`,
      details: { revertedFromLogId: logId }
    });

    return {
      success: true,
      entityType,
      entityId: row.entity_id,
      restoredState: prevState
    };
  }
}

module.exports = DBManager;
