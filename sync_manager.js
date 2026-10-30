const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const DBManager = require('./db_manager');
const BackupManager = require('./backup_manager');

class SyncManager {
  constructor(baseDir) {
    this.baseDir = baseDir || __dirname;
    this.dataPath = path.join(this.baseDir, 'data');
    this.mockDataPath = path.join(this.dataPath, 'mock-data.js');
    this.excelPath = path.join(this.dataPath, 'TradeFlow_Master_Database.xlsx');
    this.ordersDir = path.join(this.dataPath, 'orders');
    this.isExporting = false;
    this.lastExportTime = 0;
    this.lastImportTime = 0;
    this.excelStatus = 'synced'; // 'synced' | 'locked' | 'error' | 'pending'
    this.lastError = null;
    this.changeListeners = [];

    // Ensure required directories exist
    if (!fs.existsSync(this.dataPath)) fs.mkdirSync(this.dataPath, { recursive: true });
    if (!fs.existsSync(this.ordersDir)) fs.mkdirSync(this.ordersDir, { recursive: true });
    // Keep the committed example immutable; all live state belongs under ignored data/.
    const exampleDataPath = path.join(this.baseDir, 'examples', 'demo-data.js');
    if (!fs.existsSync(this.mockDataPath) && fs.existsSync(exampleDataPath)) {
      fs.copyFileSync(exampleDataPath, this.mockDataPath);
    }

    // Initialize Database & Backup Managers
    this.dbManager = new DBManager(this.baseDir);
    this.backupManager = new BackupManager(this.baseDir);

    // Ensure SQLite database has initial data
    if (!this.dbManager.isSeeded() && fs.existsSync(this.mockDataPath)) {
      try {
        const resolved = path.resolve(this.mockDataPath);
        delete require.cache[resolved];
        const seedData = require(resolved);
        this.dbManager.migrateFromData(seedData);
        console.log('[SyncManager] Auto-seeded SQLite DB from mock-data.js');
      } catch (err) {
        console.error('[SyncManager] Error seeding SQLite DB:', err);
      }
    }
  }

  // Register listener for real-time notifications
  onDataChange(callback) {
    this.changeListeners.push(callback);
  }

  notifyChange(source, details) {
    this.changeListeners.forEach(cb => {
      try {
        cb({ source, timestamp: new Date().toISOString(), details });
      } catch (err) {
        console.error('Error in change listener:', err);
      }
    });
  }

  // Load authoritative data from SQLite Database
  loadData() {
    try {
      if (this.dbManager && this.dbManager.isSeeded()) {
        return this.dbManager.getFullData();
      }
    } catch (e) {
      console.warn('[SyncManager] DB read failed, falling back to mock-data.js:', e.message);
    }

    const resolved = path.resolve(this.mockDataPath);
    delete require.cache[resolved];
    return require(resolved);
  }

  // Save updated data to SQLite Database and sync with mock-data.js
  saveData(data, userName = 'Admin', reason = 'Data Update') {
    this.dbManager.saveSnapshot(data, userName);

    // Also update mock-data.js for filesystem consistency
    const fileContent = `// Mock Data for TradeFlow - Authoritative Store: tradeflow.db\nconst INITIAL_DATA = ${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')};\n\nif (typeof module !== 'undefined') {\n  module.exports = INITIAL_DATA;\n}\n`;
    const temporary = this.mockDataPath + '.tmp';
    fs.writeFileSync(temporary, fileContent, 'utf8');
    fs.renameSync(temporary, this.mockDataPath);
  }

  getSyncStatus() {
    return {
      authoritativeStore: 'TradeFlow Master SQLite Store (tradeflow.db)',
      excelStatus: this.excelStatus,
      lastExportTime: this.lastExportTime,
      lastImportTime: this.lastImportTime,
      excelPath: this.excelPath,
      exists: fs.existsSync(this.excelPath),
      lastError: this.lastError
    };
  }

  // Format descriptive order folder name
  getOrderFolderName(order) {
    if (!order) return 'general';
    const orderId = String(order.id || order.invoiceNumber || 'ORDER').replace(/[^a-zA-Z0-9_-]/g, '_');
    const party = (order.retailerName || order.buyerName || 'Direct').replace(/[^a-zA-Z0-9\s]/g, '').trim().slice(0, 24);
    let itemSummary = 'Pickle';
    if (order.items && order.items.length > 0) {
      itemSummary = order.items.map(i => i.shortName || i.name || '').filter(Boolean).join(' & ');
      itemSummary = itemSummary.replace(/[^a-zA-Z0-9\s&]/g, '').trim().slice(0, 30);
    }
    return `${orderId} - ${party} - ${itemSummary}`;
  }

  // Get or create order folder
  resolveOrderFolder(orderIdOrFolder) {
    if (!orderIdOrFolder || orderIdOrFolder.toLowerCase() === 'general') {
      const genDir = path.join(this.ordersDir, 'general');
      if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
      return { folderName: 'general', fullPath: genDir };
    }

    const cleanId = orderIdOrFolder.trim();
    const existing = fs.readdirSync(this.ordersDir).find(d => {
      const lower = d.toLowerCase();
      const targetLower = cleanId.toLowerCase();
      return lower.startsWith(targetLower + ' ') || 
             lower.startsWith(targetLower + '-') ||
             lower === targetLower;
    });

    if (existing) {
      return { folderName: existing, fullPath: path.join(this.ordersDir, existing) };
    }

    const data = this.loadData();
    const order = (data.orders || []).find(o => 
      (o.id && o.id.toLowerCase() === cleanId.toLowerCase()) || 
      (o.invoiceNumber && o.invoiceNumber.toLowerCase() === cleanId.toLowerCase())
    );

    if (order) {
      const orderMatch = fs.readdirSync(this.ordersDir).find(d => {
        const lower = d.toLowerCase();
        return (order.id && (lower.startsWith(order.id.toLowerCase() + ' ') || lower.startsWith(order.id.toLowerCase() + '-'))) ||
               (order.invoiceNumber && (lower.startsWith(order.invoiceNumber.toLowerCase() + ' ') || lower.startsWith(order.invoiceNumber.toLowerCase() + '-')));
      });
      if (orderMatch) {
        return { folderName: orderMatch, fullPath: path.join(this.ordersDir, orderMatch) };
      }
    }

    let folderName;
    if (order) {
      folderName = this.getOrderFolderName(order);
    } else {
      folderName = cleanId.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    const fullPath = path.join(this.ordersDir, folderName);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
    return { folderName, fullPath };
  }

  formatDateOption4(dateInput) {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      const [y, m, d] = dateInput.trim().split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(m, 10) - 1;
      const mmm = months[mIdx] || m;
      return `${d.padStart(2, '0')}-${mmm}-${y}`;
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd}-${mmm}-${yyyy}`;
  }

  // 1. Export Data to Excel with EBUSY / Lock Resilience
  exportToExcel(dataOverride = null) {
    this.isExporting = true;
    try {
      const data = dataOverride || this.loadData();

      // Sheet 1: Orders Master
      const ordersSheet = (data.orders || []).map(o => ({
        'Order ID': o.id || '',
        'Invoice #': o.invoiceNumber || o.id || '',
        'Date': this.formatDateOption4(o.date) || o.date || '',
        'Time': o.time || '',
        'Status': (o.status || '').toUpperCase(),
        'Retailer / Buyer': o.retailerName || o.buyerName || '',
        'Marketeer / Agent': o.marketeerName || 'Direct',
        'Payment Terms': o.paymentTerms || '',
        'Due Date': this.formatDateOption4(o.dueDate) || o.dueDate || '',
        'Subtotal (₹)': o.taxableSubtotal || o.subtotal || 0,
        'CGST (₹)': o.cgstAmount || 0,
        'SGST (₹)': o.sgstAmount || 0,
        'IGST (₹)': o.igstAmount || 0,
        'Total Invoice Amount (₹)': o.totalInvoiceAmount || o.totalAmount || 0,
        'Advance Received (₹)': o.customerAdvanceReceived || o.paidAmount || 0,
        'Balance Due (₹)': o.customerBalanceDue !== undefined ? o.customerBalanceDue : Math.max(0, (o.totalInvoiceAmount || o.totalAmount || 0) - (o.customerAdvanceReceived || o.paidAmount || 0)),
        'Packaging Vendor': o.packagingVendorName || '',
        'Packaging Cost (₹)': o.packagingCost || 0,
        'Packaging Advance Paid (₹)': o.packagingAdvancePaid || 0,
        'Packaging Status': o.packagingStatus || '',
        'Manufacturer': o.manufacturerName || '',
        'Mfg Total Cost (₹)': o.manufacturerTotalCost || 0,
        'Mfg Advance Paid (₹)': o.manufacturerAdvancePaid || 0,
        'Mfg Status': o.manufacturerStatus || '',
        'Transporter': o.transporterName || '',
        'Total Transport Cost (₹)': o.totalTransportCost || 0,
        'LR Number': o.lrNumber || '',
        'Vehicle Number': o.vehicleNumber || '',
        'Marketeer Commission (₹)': o.marketeerCommissionAmount || 0,
        'Total Direct Costs (COGS) (₹)': o.totalDirectCosts || 0,
        'Net Profit (₹)': o.netProfit || 0,
        'Profit Margin %': o.profitMarginPercent ? `${o.profitMarginPercent}%` : '0%',
        'Urgent Alert': o.urgentAlert || 'None'
      }));

      // Sheet 2: Order Line Items
      const lineItemsSheet = [];
      (data.orders || []).forEach(o => {
        (o.items || []).forEach((item, idx) => {
          lineItemsSheet.push({
            'Order ID': o.id || '',
            'Invoice #': o.invoiceNumber || o.id || '',
            'Item #': idx + 1,
            'Product ID': item.productId || '',
            'Product Name': item.name || '',
            'Short Name': item.shortName || '',
            'Variant': item.variant || '',
            'Pack Size': item.packSize || '',
            'Case Pack (Units/Case)': item.casePack || 12,
            'Cases': item.cases || 0,
            'Total Quantity (Units)': item.quantity || 0,
            'Unit Selling Rate (₹)': item.unitRate || 0,
            'Total Line Amount (₹)': item.totalAmount || 0,
            'Base Cost Per Unit (₹)': item.baseCostPerUnit || 0,
            'Pkg Cost Per Unit (₹)': item.pkgCostPerUnit || 0
          });
        });
      });

      // Sheet 3: Payments Ledger
      const paymentsSheet = (data.payments || []).map(p => ({
        'Payment ID': p.id || '',
        'Date': this.formatDateOption4(p.date) || p.date || '',
        'Direction': (p.direction || '').toUpperCase(),
        'Party Name': p.partyName || '',
        'Party Type': (p.partyType || '').toUpperCase(),
        'Payment Mode': p.mode || '',
        'Order / Invoice Ref': p.orderRef || '',
        'Amount (₹)': p.amount || 0,
        'UTR / Reference Number': p.utr || '',
        'Notes & Remarks': p.notes || '',
        'Has Proof Document': p.hasProof ? 'YES' : 'NO',
        'Document Filename': p.pn || '',
        'Document Path': p.pd || '',
        'Storage Folder': p.orderFolder || p.orderRef || 'general',
        'Created Timestamp': p.createdAt || ''
      }));

      // Sheet 4: Supply Chain Partners
      const partnersSheet = (data.contacts || []).map(c => ({
        'Partner ID': c.id || '',
        'Name': c.name || '',
        'Contact Person': c.contactPerson || '',
        'Role / Category': (c.role || c.type || '').toUpperCase(),
        'Phone': c.phone || '',
        'Email': c.email || '',
        'GSTIN': c.gstin || '',
        'Billing Address': c.billingAddress || '',
        'Shipping Address': c.shippingAddress || '',
        'State': c.state || '',
        'State Code': c.stateCode || '',
        'Payment Terms': c.paymentTerms || '',
        'Total Orders': c.totalOrders || 0,
        'Current Balance Due (₹)': c.currentBalanceDue || 0,
        'Alternate Phones': Array.isArray(c.altPhones) ? c.altPhones.join(', ') : (c.altPhones || ''),
        'Alternate Emails': Array.isArray(c.altEmails) ? c.altEmails.join(', ') : (c.altEmails || ''),
        'Secondary Contact Names': Array.isArray(c.altContacts) ? c.altContacts.join(', ') : (c.altContacts || ''),
        'Visiting Card Notes': c.cardNotes || ''
      }));

      // Sheet 5: Pickle SKU Catalog
      const skusSheet = (data.products || []).map(p => ({
        'Product ID': p.id || '',
        'Product Name': p.name || '',
        'Short Name': p.shortName || '',
        'Variant': p.variant || '',
        'Pack Size': p.packSize || '',
        'SKU Code': p.sku || '',
        'HSN Code': p.hsn || '',
        'GST Rate %': p.gstRate || 12,
        'Packaging Type': p.pkgType || '',
        'Case Pack': p.casePack || 12,
        'Base Mfg Cost (₹)': p.baseMfgCost || 0,
        'Packaging Cost (₹)': p.packagingCost || 0,
        'Standard Selling Rate (₹)': p.standardSellingRate || 0,
        'MRP (₹)': p.mrp || 0
      }));

      // Sheet 6: Financial Summary
      const totalRevenue = (data.orders || []).reduce((s, o) => s + (o.totalInvoiceAmount || o.totalAmount || 0), 0);
      const totalCOGS = (data.orders || []).reduce((s, o) => s + (o.totalDirectCosts || 0), 0);
      const totalProfit = (data.orders || []).reduce((s, o) => s + (o.netProfit || 0), 0);
      const totalAdvance = (data.orders || []).reduce((s, o) => s + (o.customerAdvanceReceived || o.paidAmount || 0), 0);
      const totalBalanceDue = (data.orders || []).reduce((s, o) => s + (o.customerBalanceDue || 0), 0);
      const totalInflow = (data.payments || []).filter(p => p.direction === 'received').reduce((s, p) => s + (p.amount || 0), 0);
      const totalOutflow = (data.payments || []).filter(p => p.direction === 'paid').reduce((s, p) => s + (p.amount || 0), 0);

      const summarySheet = [
        { 'Metric': 'Total Orders Managed', 'Value': (data.orders || []).length, 'Notes': 'All active and completed orders' },
        { 'Metric': 'Total Gross Revenue', 'Value': `₹${totalRevenue.toLocaleString('en-IN')}`, 'Notes': 'Gross invoiced sales' },
        { 'Metric': 'Total Direct Costs (COGS)', 'Value': `₹${totalCOGS.toLocaleString('en-IN')}`, 'Notes': 'Factory + Packaging + Logistics + Brokerage' },
        { 'Metric': 'Total Net Profit', 'Value': `₹${totalProfit.toLocaleString('en-IN')}`, 'Notes': 'Trade margin earned' },
        { 'Metric': 'Overall Profit Margin', 'Value': totalRevenue ? `${((totalProfit / totalRevenue) * 100).toFixed(2)}%` : '0%', 'Notes': 'Profit % on revenue' },
        { 'Metric': 'Customer Advances Received', 'Value': `₹${totalAdvance.toLocaleString('en-IN')}`, 'Notes': 'Cash collected against orders' },
        { 'Metric': 'Outstanding Customer Balance Due', 'Value': `₹${totalBalanceDue.toLocaleString('en-IN')}`, 'Notes': 'Accounts receivable pending collection' },
        { 'Metric': 'Total Payment Inflow (Payments Tab)', 'Value': `₹${totalInflow.toLocaleString('en-IN')}`, 'Notes': 'Total bank credits' },
        { 'Metric': 'Total Payment Outflow (Payments Tab)', 'Value': `₹${totalOutflow.toLocaleString('en-IN')}`, 'Notes': 'Total bank debits' },
        { 'Metric': 'Net Cash Flow', 'Value': `₹${(totalInflow - totalOutflow).toLocaleString('en-IN')}`, 'Notes': 'Inflows minus Outflows' },
        { 'Metric': 'Last Synchronized', 'Value': new Date().toLocaleString('en-IN'), 'Notes': 'Real-time sync timestamp' }
      ];

      function setColWidths(ws, rows) {
        if (!rows || !rows.length) return;
        ws['!cols'] = Object.keys(rows[0]).map(key => {
          const max = Math.max(key.length, ...rows.map(r => (r[key] ? String(r[key]).length : 0)));
          return { wch: Math.min(Math.max(max + 3, 12), 45) };
        });
      }

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summarySheet);
      const wsOrders = XLSX.utils.json_to_sheet(ordersSheet);
      const wsLineItems = XLSX.utils.json_to_sheet(lineItemsSheet);
      const wsPayments = XLSX.utils.json_to_sheet(paymentsSheet);
      const wsPartners = XLSX.utils.json_to_sheet(partnersSheet);
      const wsSKUs = XLSX.utils.json_to_sheet(skusSheet);

      setColWidths(wsSummary, summarySheet);
      setColWidths(wsOrders, ordersSheet);
      setColWidths(wsLineItems, lineItemsSheet);
      setColWidths(wsPayments, paymentsSheet);
      setColWidths(wsPartners, partnersSheet);
      setColWidths(wsSKUs, skusSheet);

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Financial_Summary');
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders_Master');
      XLSX.utils.book_append_sheet(wb, wsLineItems, 'Order_Line_Items');
      XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments_Ledger');
      XLSX.utils.book_append_sheet(wb, wsPartners, 'Supply_Chain_Partners');
      XLSX.utils.book_append_sheet(wb, wsSKUs, 'Pickle_SKU_Catalog');

      // Write to Excel File
      XLSX.writeFile(wb, this.excelPath);
      this.lastExportTime = Date.now();
      this.excelStatus = 'synced';
      this.lastError = null;
      console.log(`[SyncManager] Successfully exported to ${this.excelPath} at ${new Date().toLocaleTimeString()}`);
      
      this.notifyChange('sync_status', { excelStatus: 'synced', timestamp: this.lastExportTime });
      return { success: true, timestamp: this.lastExportTime, excelStatus: 'synced' };
    } catch (err) {
      const isLocked = err.code === 'EBUSY' || (err.message && (err.message.includes('EBUSY') || err.message.includes('locked') || err.message.includes('permission denied')));
      this.excelStatus = isLocked ? 'locked' : 'error';
      this.lastError = isLocked
        ? 'TradeFlow_Master_Database.xlsx is currently open in Microsoft Excel. Close it in Excel to resume live sync.'
        : `Excel sync failed: ${err.message}`;
      
      console.warn(`[SyncManager] Excel export paused (${this.excelStatus}):`, this.lastError);
      this.notifyChange('sync_status', { excelStatus: this.excelStatus, error: this.lastError, timestamp: Date.now() });
      return { success: false, locked: isLocked, excelStatus: this.excelStatus, error: this.lastError };
    } finally {
      setTimeout(() => { this.isExporting = false; }, 1000);
    }
  }

  // 2. Preview Excel Import (Preview-and-Confirm Pattern)
  previewImportFromExcel() {
    if (!fs.existsSync(this.excelPath)) {
      return { success: false, error: 'Excel file not found' };
    }

    try {
      const wb = XLSX.readFile(this.excelPath);
      const data = this.loadData();
      const diffs = [];
      const warnings = [];

      // 1. Check Orders_Master Sheet
      if (wb.Sheets['Orders_Master']) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Orders_Master']);
        rows.forEach(row => {
          const orderId = row['Order ID'] || row['Invoice #'];
          if (!orderId) return;
          const order = (data.orders || []).find(o => o.id === orderId || o.invoiceNumber === orderId);
          if (order) {
            const changes = [];
            const checkDiff = (field, oldVal, newVal, label) => {
              if (newVal !== undefined && newVal !== null && String(newVal).trim() !== String(oldVal || '').trim()) {
                changes.push({ field, label, oldValue: oldVal, newValue: newVal });
              }
            };

            if (row['Status']) {
              const newStatus = row['Status'].toLowerCase().replace(/\s+/g, '_');
              if (newStatus !== (order.status || '').toLowerCase()) {
                changes.push({ field: 'status', label: 'Status', oldValue: order.status, newValue: newStatus });
              }
            }
            if (row['Due Date']) checkDiff('dueDate', order.dueDate, row['Due Date'], 'Due Date');
            if (row['Payment Terms']) checkDiff('paymentTerms', order.paymentTerms, row['Payment Terms'], 'Payment Terms');
            if (row['Total Invoice Amount (₹)'] !== undefined) {
              const newAmt = Number(row['Total Invoice Amount (₹)']) || 0;
              if (Math.abs(newAmt - (order.totalInvoiceAmount || 0)) > 0.01) {
                changes.push({ field: 'totalInvoiceAmount', label: 'Total Amount (₹)', oldValue: order.totalInvoiceAmount, newValue: newAmt });
              }
            }
            if (row['Advance Received (₹)'] !== undefined) {
              const newAdv = Number(row['Advance Received (₹)']) || 0;
              if (Math.abs(newAdv - (order.customerAdvanceReceived || 0)) > 0.01) {
                changes.push({ field: 'customerAdvanceReceived', label: 'Advance Received (₹)', oldValue: order.customerAdvanceReceived, newValue: newAdv });
              }
            }
            if (row['Balance Due (₹)'] !== undefined) {
              const newBal = Number(row['Balance Due (₹)']) || 0;
              if (Math.abs(newBal - (order.customerBalanceDue || 0)) > 0.01) {
                changes.push({ field: 'customerBalanceDue', label: 'Balance Due (₹)', oldValue: order.customerBalanceDue, newValue: newBal });
              }
            }
            if (row['LR Number']) checkDiff('lrNumber', order.lrNumber, row['LR Number'], 'LR Number');
            if (row['Vehicle Number']) checkDiff('vehicleNumber', order.vehicleNumber, row['Vehicle Number'], 'Vehicle Number');
            if (row['Transporter']) checkDiff('transporterName', order.transporterName, row['Transporter'], 'Transporter');
            if (row['Manufacturer']) checkDiff('manufacturerName', order.manufacturerName, row['Manufacturer'], 'Manufacturer');
            if (row['Packaging Vendor']) checkDiff('packagingVendorName', order.packagingVendorName, row['Packaging Vendor'], 'Packaging Vendor');

            if (changes.length > 0) {
              diffs.push({
                type: 'ORDER',
                id: order.id,
                title: `Order ${order.id} (${order.retailerName || order.buyerName || 'Buyer'})`,
                changes
              });
            }
          }
        });
      }

      // 2. Check Payments_Ledger Sheet
      if (wb.Sheets['Payments_Ledger']) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Payments_Ledger']);
        rows.forEach(row => {
          const payId = row['Payment ID'];
          if (!payId) return;
          const p = (data.payments || []).find(item => item.id === payId);
          if (p) {
            const changes = [];
            const checkDiff = (field, oldVal, newVal, label) => {
              if (newVal !== undefined && newVal !== null && String(newVal).trim() !== String(oldVal || '').trim()) {
                changes.push({ field, label, oldValue: oldVal, newValue: newVal });
              }
            };
            if (row['Amount (₹)'] !== undefined) {
              const newAmt = Number(row['Amount (₹)']) || 0;
              if (Math.abs(newAmt - (p.amount || 0)) > 0.01) {
                changes.push({ field: 'amount', label: 'Amount (₹)', oldValue: p.amount, newValue: newAmt });
              }
            }
            if (row['Party Name']) checkDiff('partyName', p.partyName, row['Party Name'], 'Party Name');
            if (row['Payment Mode']) checkDiff('mode', p.mode, row['Payment Mode'], 'Payment Mode');
            if (row['UTR / Reference Number']) checkDiff('utr', p.utr, row['UTR / Reference Number'], 'UTR / Reference');

            if (changes.length > 0) {
              diffs.push({
                type: 'PAYMENT',
                id: p.id,
                title: `Payment ${p.id} (${p.partyName})`,
                changes
              });
            }
          }
        });
      }

      // 3. Check Supply_Chain_Partners Sheet
      if (wb.Sheets['Supply_Chain_Partners']) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Supply_Chain_Partners']);
        rows.forEach(row => {
          const partnerId = row['Partner ID'];
          if (!partnerId) return;
          const c = (data.contacts || []).find(item => item.id === partnerId);
          if (c) {
            const changes = [];
            const checkDiff = (field, oldVal, newVal, label) => {
              if (newVal !== undefined && newVal !== null && String(newVal).trim() !== String(oldVal || '').trim()) {
                changes.push({ field, label, oldValue: oldVal, newValue: newVal });
              }
            };
            if (row['Name']) checkDiff('name', c.name, row['Name'], 'Name');
            if (row['Contact Person']) checkDiff('contactPerson', c.contactPerson, row['Contact Person'], 'Contact Person');
            if (row['Phone']) checkDiff('phone', c.phone, row['Phone'], 'Phone');
            if (row['Email']) checkDiff('email', c.email, row['Email'], 'Email');
            if (row['GSTIN']) checkDiff('gstin', c.gstin, row['GSTIN'], 'GSTIN');
            if (row['Alternate Phones'] !== undefined) checkDiff('altPhones', Array.isArray(c.altPhones) ? c.altPhones.join(', ') : (c.altPhones || ''), row['Alternate Phones'], 'Alternate Phones');
            if (row['Alternate Emails'] !== undefined) checkDiff('altEmails', Array.isArray(c.altEmails) ? c.altEmails.join(', ') : (c.altEmails || ''), row['Alternate Emails'], 'Alternate Emails');
            if (row['Secondary Contact Names'] !== undefined) checkDiff('altContacts', Array.isArray(c.altContacts) ? c.altContacts.join(', ') : (c.altContacts || ''), row['Secondary Contact Names'], 'Secondary Contacts');
            if (row['Visiting Card Notes'] !== undefined) checkDiff('cardNotes', c.cardNotes || '', row['Visiting Card Notes'], 'Visiting Card Notes');

            if (changes.length > 0) {
              diffs.push({
                type: 'PARTNER',
                id: c.id,
                title: `Partner ${c.name} (${c.id})`,
                changes
              });
            }
          }
        });
      }

      return {
        success: true,
        diffsCount: diffs.length,
        totalFieldChanges: diffs.reduce((sum, d) => sum + d.changes.length, 0),
        diffs,
        warnings,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('[SyncManager] Error creating preview from Excel:', err);
      return { success: false, error: err.message };
    }
  }

  // 3. Apply Excel Import with Automatic Safety Backup
  applyExcelImport(approvedEntityIds = null, userName = 'Excel User') {
    if (!fs.existsSync(this.excelPath)) return { success: false, error: 'Excel file not found' };

    try {
      const wb = XLSX.readFile(this.excelPath);
      const data = this.loadData();
      let updatedCount = 0;

      // 1. Create Pre-Import Safety Snapshot!
      const backupRes = this.backupManager.createBackup('pre-excel-import', data);
      console.log(`[SyncManager] Created safety backup before applying Excel import: ${backupRes.backup?.id}`);

      // 2. Update Orders
      if (wb.Sheets['Orders_Master']) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Orders_Master']);
        rows.forEach(row => {
          const orderId = row['Order ID'] || row['Invoice #'];
          if (!orderId) return;
          if (approvedEntityIds && !approvedEntityIds.includes(orderId)) return;

          const order = (data.orders || []).find(o => o.id === orderId || o.invoiceNumber === orderId);
          if (order) {
            if (row['Status']) order.status = row['Status'].toLowerCase().replace(/\s+/g, '_');
            if (row['Due Date']) order.dueDate = String(row['Due Date']);
            if (row['Payment Terms']) order.paymentTerms = String(row['Payment Terms']);
            if (row['Urgent Alert']) order.urgentAlert = row['Urgent Alert'] === 'None' ? null : String(row['Urgent Alert']);
            if (row['Total Invoice Amount (₹)'] !== undefined) order.totalInvoiceAmount = Number(row['Total Invoice Amount (₹)']) || order.totalInvoiceAmount;
            if (row['Advance Received (₹)'] !== undefined) order.customerAdvanceReceived = Number(row['Advance Received (₹)']) || 0;
            if (row['Balance Due (₹)'] !== undefined) order.customerBalanceDue = Number(row['Balance Due (₹)']) || 0;
            if (row['LR Number']) order.lrNumber = String(row['LR Number']);
            if (row['Vehicle Number']) order.vehicleNumber = String(row['Vehicle Number']);
            if (row['Transporter']) order.transporterName = String(row['Transporter']);
            if (row['Manufacturer']) order.manufacturerName = String(row['Manufacturer']);
            if (row['Packaging Vendor']) order.packagingVendorName = String(row['Packaging Vendor']);
            if (row['Mfg Total Cost (₹)'] !== undefined) order.manufacturerTotalCost = Number(row['Mfg Total Cost (₹)']) || 0;
            if (row['Packaging Cost (₹)'] !== undefined) order.packagingCost = Number(row['Packaging Cost (₹)']) || 0;
            if (row['Total Transport Cost (₹)'] !== undefined) order.totalTransportCost = Number(row['Total Transport Cost (₹)']) || 0;
            if (row['Marketeer Commission (₹)'] !== undefined) order.marketeerCommissionAmount = Number(row['Marketeer Commission (₹)']) || 0;
            if (row['Total Direct Costs (COGS) (₹)'] !== undefined) order.totalDirectCosts = Number(row['Total Direct Costs (COGS) (₹)']) || 0;
            if (row['Net Profit (₹)'] !== undefined) order.netProfit = Number(row['Net Profit (₹)']) || 0;
            
            if (this.dbManager) this.dbManager.saveOrder(order, userName, 'EXCEL_IMPORT');
            updatedCount++;
          }
        });
      }

      // 3. Update Payments
      if (wb.Sheets['Payments_Ledger']) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Payments_Ledger']);
        rows.forEach(row => {
          const payId = row['Payment ID'];
          if (!payId) return;
          if (approvedEntityIds && !approvedEntityIds.includes(payId)) return;

          const p = (data.payments || []).find(item => item.id === payId);
          if (p) {
            if (row['Date']) p.date = String(row['Date']);
            if (row['Amount (₹)'] !== undefined) p.amount = Number(row['Amount (₹)']) || p.amount;
            if (row['Party Name']) p.partyName = String(row['Party Name']);
            if (row['Payment Mode']) p.mode = String(row['Payment Mode']);
            if (row['UTR / Reference Number']) p.utr = String(row['UTR / Reference Number']);
            if (row['Notes & Remarks']) p.notes = String(row['Notes & Remarks']);
            if (row['Has Proof Document']) p.hasProof = String(row['Has Proof Document']).toUpperCase() === 'YES';
            
            if (this.dbManager) this.dbManager.savePayment(p, userName);
            updatedCount++;
          }
        });
      }

      // 4. Update Partners
      if (wb.Sheets['Supply_Chain_Partners']) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Supply_Chain_Partners']);
        rows.forEach(row => {
          const partnerId = row['Partner ID'];
          if (!partnerId) return;
          if (approvedEntityIds && !approvedEntityIds.includes(partnerId)) return;

          const c = (data.contacts || []).find(item => item.id === partnerId);
          if (c) {
            if (row['Name']) c.name = String(row['Name']);
            if (row['Contact Person']) c.contactPerson = String(row['Contact Person']);
            if (row['Phone']) c.phone = String(row['Phone']);
            if (row['Email']) c.email = String(row['Email']);
            if (row['GSTIN']) c.gstin = String(row['GSTIN']);
            if (row['Payment Terms']) c.paymentTerms = String(row['Payment Terms']);
            if (row['Current Balance Due (₹)'] !== undefined) c.currentBalanceDue = Number(row['Current Balance Due (₹)']) || 0;
            if (row['Alternate Phones'] !== undefined) {
              const val = String(row['Alternate Phones']).trim();
              c.altPhones = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
            }
            if (row['Alternate Emails'] !== undefined) {
              const val = String(row['Alternate Emails']).trim();
              c.altEmails = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
            }
            if (row['Secondary Contact Names'] !== undefined) {
              const val = String(row['Secondary Contact Names']).trim();
              c.altContacts = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
            }
            if (row['Visiting Card Notes'] !== undefined) {
              c.cardNotes = String(row['Visiting Card Notes']).trim();
            }
            
            if (this.dbManager) this.dbManager.saveContact(c, userName);
            updatedCount++;
          }
        });
      }

      // Save merged updates back to mock-data.js for filesystem consistency
      const fileContent = `// Mock Data for TradeFlow - Synced from Excel\nconst INITIAL_DATA = ${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')};\n\nif (typeof module !== 'undefined') {\n  module.exports = INITIAL_DATA;\n}\n`;
      fs.writeFileSync(this.mockDataPath, fileContent, 'utf8');

      this.lastImportTime = Date.now();
      console.log(`[SyncManager] Successfully imported changes from Excel: ${updatedCount} records updated.`);

      this.notifyChange('excel_import', { updatedCount, timestamp: this.lastImportTime });
      return { success: true, updatedCount, timestamp: this.lastImportTime, backupId: backupRes.backup?.id };
    } catch (err) {
      console.error('[SyncManager] Import error:', err);
      return { success: false, error: err.message };
    }
  }

  // Backward-compatible importFromExcel
  importFromExcel() {
    return this.applyExcelImport();
  }

  // 4. File Watcher for Real-time Excel Changes
  startWatcher() {
    let debounceTimer = null;
    let isReading = false;

    try {
      fs.watch(this.dataPath, (eventType, filename) => {
        if (!filename) return;
        if (filename.startsWith('~$') || !filename.includes('TradeFlow_Master_Database.xlsx')) return;
        if (this.isExporting) return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (isReading) return;
          try {
            const stats = fs.statSync(this.excelPath);
            if (Date.now() - this.lastExportTime < 2000) return;

            isReading = true;
            console.log('[SyncManager] External change in Excel file detected. Generating preview...');
            
            const preview = this.previewImportFromExcel();
            if (preview.success && preview.diffsCount > 0) {
              this.notifyChange('excel_changes_available', {
                preview,
                message: `Excel file modified: ${preview.diffsCount} records have pending changes.`
              });
            }
          } catch (e) {
            // File might be locked while Excel is saving
          } finally {
            isReading = false;
          }
        }, 800);
      });
      console.log('[SyncManager] File watcher active with Preview-and-Confirm detection.');
    } catch (err) {
      console.error('[SyncManager] Could not start file watcher:', err);
    }
  }

  // Scan and detect all missing items & files across the system
  auditMissingItems() {
    const data = this.loadData();
    const missing = [];

    (data.orders || []).forEach(o => {
      const folderInfo = this.resolveOrderFolder(o.id);
      const manifestPath = path.join(folderInfo.fullPath, 'index.json');
      let docs = [];
      if (fs.existsSync(manifestPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          docs = Array.isArray(parsed) ? parsed : (parsed.documents || []);
        } catch (e) {
          docs = [];
        }
      }

      const hasInvoice = docs.some(d => d.category === 'invoice' || (d.storedFileName && d.storedFileName.includes('invoice')));
      if (!hasInvoice) {
        missing.push({
          id: `MISS-INV-${o.id}`,
          type: 'missing_invoice',
          severity: 'high',
          orderId: o.id,
          title: `Missing Tax Invoice Copy`,
          entityName: o.retailerName || o.buyerName || 'Buyer',
          orderRef: o.invoiceNumber || o.id,
          amount: o.totalInvoiceAmount || o.totalAmount,
          folder: folderInfo.folderName,
          description: `No tax invoice PDF uploaded in order vault (${folderInfo.folderName})`
        });
      }

      if (o.customerAdvanceReceived > 0) {
        const hasProof = docs.some(d => d.category === 'bank_receipt' || (d.storedFileName && (d.storedFileName.includes('PaidTo') || d.storedFileName.includes('RecvFrom'))));
        if (!hasProof) {
          missing.push({
            id: `MISS-ADV-${o.id}`,
            type: 'missing_bank_proof',
            severity: 'medium',
            orderId: o.id,
            title: `Missing Customer Advance Receipt`,
            entityName: o.retailerName || o.buyerName || 'Buyer',
            orderRef: o.invoiceNumber || o.id,
            amount: o.customerAdvanceReceived,
            folder: folderInfo.folderName,
            description: `Advance of ₹${Number(o.customerAdvanceReceived).toLocaleString('en-IN')} received without attached bank voucher`
          });
        }
      }

      if (o.status === 'dispatched' || o.status === 'delivered') {
        const hasLR = docs.some(d => d.category === 'lr_copy' || (d.storedFileName && d.storedFileName.toLowerCase().includes('lr')));
        if (!hasLR && !o.lrNumber) {
          missing.push({
            id: `MISS-LR-${o.id}`,
            type: 'missing_lr',
            severity: 'medium',
            orderId: o.id,
            title: `Missing Lorry Receipt (LR Copy)`,
            entityName: o.transporterName || 'Transporter',
            orderRef: o.invoiceNumber || o.id,
            amount: o.totalTransportCost,
            folder: folderInfo.folderName,
            description: `Order in transit/delivered without LR consignment slip or tracking document`
          });
        }
      }

      if (o.manufacturerTotalCost > 0 && o.manufacturerAdvancePaid > 0) {
        const hasMfgBill = docs.some(d => d.category === 'mfg_invoice' || (d.storedFileName && d.storedFileName.toLowerCase().includes('mfg')));
        if (!hasMfgBill) {
          missing.push({
            id: `MISS-MFG-${o.id}`,
            type: 'missing_mfg_bill',
            severity: 'low',
            orderId: o.id,
            title: `Missing Factory Jobwork Bill`,
            entityName: o.manufacturerName || 'Contract Manufacturer',
            orderRef: o.invoiceNumber || o.id,
            amount: o.manufacturerAdvancePaid,
            folder: folderInfo.folderName,
            description: `Advance of ₹${Number(o.manufacturerAdvancePaid).toLocaleString('en-IN')} paid to factory without uploaded jobwork tax bill`
          });
        }
      }
    });

    (data.payments || []).forEach(p => {
      if (!p.hasProof && p.amount >= 25000) {
        missing.push({
          id: `MISS-PAY-${p.id}`,
          type: 'missing_payment_voucher',
          severity: p.amount >= 100000 ? 'high' : 'medium',
          paymentId: p.id,
          orderId: p.orderRef || 'general',
          title: `Unverified ${p.direction === 'paid' ? 'Payout' : 'Inflow'} Voucher`,
          entityName: p.partyName,
          orderRef: p.orderRef || 'General',
          amount: p.amount,
          folder: p.orderFolder || p.orderRef || 'general',
          description: `${p.direction.toUpperCase()} ₹${Number(p.amount).toLocaleString('en-IN')} via ${p.mode}${p.utr ? ' (UTR: ' + p.utr + ')' : ''} lacks attached bank confirmation slip`
        });
      }
    });

    return {
      timestamp: new Date().toISOString(),
      totalIssues: missing.length,
      highSeverity: missing.filter(m => m.severity === 'high').length,
      mediumSeverity: missing.filter(m => m.severity === 'medium').length,
      lowSeverity: missing.filter(m => m.severity === 'low').length,
      issues: missing
    };
  }
}

module.exports = SyncManager;
