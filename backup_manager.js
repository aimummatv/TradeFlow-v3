const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

class BackupManager {
  constructor(baseDir) {
    this.baseDir = baseDir || __dirname;
    this.dataPath = path.join(this.baseDir, 'data');
    this.backupsDir = path.join(this.dataPath, 'backups');
    this.manifestPath = path.join(this.backupsDir, 'manifest.json');
    this.mockDataPath = path.join(this.dataPath, 'mock-data.js');
    this.excelPath = path.join(this.dataPath, 'TradeFlow_Master_Database.xlsx');
    this.sqlitePath = path.join(this.dataPath, 'tradeflow.db');
    this.maxBackups = 25; // Retain 25 recent backups

    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  getManifest() {
    if (fs.existsSync(this.manifestPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      } catch (e) {
        console.warn('[BackupManager] Error reading manifest, initializing new one:', e.message);
      }
    }
    return { version: 1, backups: [] };
  }

  saveManifest(manifest) {
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  // Generate safe timestamp string: YYYY-MM-DD_HH-mm-ss
  getTimestampString(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  }

  // Create a comprehensive timestamped backup
  createBackup(reason = 'manual', dataSnapshot = null) {
    try {
      const now = new Date();
      const tsStr = this.getTimestampString(now);
      const safeReason = String(reason || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const backupId = `TF-BKP-${tsStr}-${safeReason}-${crypto.randomBytes(4).toString('hex')}`;
      const jsonFileName = `${backupId}.json`;
      const jsonFilePath = path.join(this.backupsDir, jsonFileName);

      let payload = dataSnapshot;
      if (!payload) {
        if (fs.existsSync(this.sqlitePath)) {
          const DBManager = require('./db_manager');
          const dbMgr = new DBManager(this.baseDir);
          try { payload = dbMgr.getFullData(); } finally { dbMgr.db.close(); }
        } else if (fs.existsSync(this.mockDataPath)) {
          const resolved = path.resolve(this.mockDataPath);
          delete require.cache[resolved];
          payload = require(resolved);
        } else {
          throw new Error('No data source available to backup.');
        }
      }

      // Deep clone to ensure immutability
      const cleanData = JSON.parse(JSON.stringify(payload));
      const backupRecord = {
        id: backupId,
        timestamp: now.toISOString(),
        reason: reason,
        jsonFile: jsonFileName,
        recordCounts: {
          orders: Array.isArray(cleanData.orders) ? cleanData.orders.length : 0,
          contacts: Array.isArray(cleanData.contacts) ? cleanData.contacts.length : 0,
          products: Array.isArray(cleanData.products) ? cleanData.products.length : 0,
          payments: Array.isArray(cleanData.payments) ? cleanData.payments.length : 0,
          documents: Array.isArray(cleanData.documents) ? cleanData.documents.length : 0
        },
        hasExcelSnapshot: false,
        hasSqliteSnapshot: false,
        sizeBytes: 0
      };

      // Write JSON backup file
      const jsonContent = JSON.stringify(cleanData, null, 2);
      fs.writeFileSync(jsonFilePath, jsonContent, 'utf8');
      backupRecord.sizeBytes = Buffer.byteLength(jsonContent, 'utf8');

      // If SQLite DB exists, also copy it alongside
      if (fs.existsSync(this.sqlitePath)) {
        const sqliteBackupName = `${backupId}.db`;
        try {
          const source = new DatabaseSync(this.sqlitePath);
          try {
            const destination = path.join(this.backupsDir, sqliteBackupName).replace(/'/g, "''");
            source.exec("VACUUM INTO '" + destination + "'");
          } finally { source.close(); }
          backupRecord.hasSqliteSnapshot = true;
          backupRecord.sqliteFile = sqliteBackupName;
        } catch (e) {
          console.warn('[BackupManager] Could not copy SQLite database:', e.message);
        }
      }

      // If Excel master exists, snapshot it as well
      if (fs.existsSync(this.excelPath)) {
        const excelBackupName = `${backupId}.xlsx`;
        try {
          fs.copyFileSync(this.excelPath, path.join(this.backupsDir, excelBackupName));
          backupRecord.hasExcelSnapshot = true;
          backupRecord.excelFile = excelBackupName;
        } catch (e) {
          console.warn('[BackupManager] Could not snapshot Excel master:', e.message);
        }
      }

      // Update Manifest
      const manifest = this.getManifest();
      manifest.backups.unshift(backupRecord);

      // Rotation: prune if exceeding maxBackups
      if (manifest.backups.length > this.maxBackups) {
        const toRemove = manifest.backups.splice(this.maxBackups);
        toRemove.forEach(b => {
          try {
            if (b.jsonFile && fs.existsSync(path.join(this.backupsDir, b.jsonFile))) {
              fs.unlinkSync(path.join(this.backupsDir, b.jsonFile));
            }
            if (b.sqliteFile && fs.existsSync(path.join(this.backupsDir, b.sqliteFile))) {
              fs.unlinkSync(path.join(this.backupsDir, b.sqliteFile));
            }
            if (b.excelFile && fs.existsSync(path.join(this.backupsDir, b.excelFile))) {
              fs.unlinkSync(path.join(this.backupsDir, b.excelFile));
            }
          } catch (err) {
            console.warn('[BackupManager] Error pruning old backup:', err.message);
          }
        });
      }

      this.saveManifest(manifest);
      console.log(`[BackupManager] Backup created successfully: ${backupId} (${backupRecord.recordCounts.orders} orders, ${backupRecord.recordCounts.payments} payments)`);

      return {
        success: true,
        backup: backupRecord
      };
    } catch (err) {
      console.error('[BackupManager] Failed to create backup:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  // List all available backups
  listBackups() {
    const manifest = this.getManifest();
    return manifest.backups || [];
  }

  // Verify backup integrity
  verifyBackup(backupId) {
    const manifest = this.getManifest();
    const entry = manifest.backups.find(b => b.id === backupId || b.jsonFile === backupId);
    if (!entry) {
      return { valid: false, error: 'Backup not found in manifest' };
    }

    const filePath = path.join(this.backupsDir, entry.jsonFile);
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: `Backup file ${entry.jsonFile} is missing from disk` };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Backup contains invalid root structure' };
      }
      if (!Array.isArray(data.orders) || !Array.isArray(data.contacts)) {
        return { valid: false, error: 'Backup is missing required orders or contacts arrays' };
      }
      return {
        valid: true,
        backup: entry,
        dataSummary: {
          ordersCount: data.orders.length,
          contactsCount: data.contacts.length,
          productsCount: (data.products || []).length,
          paymentsCount: (data.payments || []).length
        }
      };
    } catch (e) {
      return { valid: false, error: `Backup JSON parsing failed: ${e.message}` };
    }
  }

  // Restore backup with automatic safety checkpoint before restoration
  restoreBackup(backupId, syncManager = null) {
    try {
      const verification = this.verifyBackup(backupId);
      if (!verification.valid) {
        throw new Error(`Cannot restore invalid backup: ${verification.error}`);
      }

      const filePath = path.join(this.backupsDir, verification.backup.jsonFile);
      const restoredData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // 1. Create safety snapshot of current data before overwriting!
      console.log('[BackupManager] Creating safety pre-restore checkpoint...');
      const checkpoint = this.createBackup('pre-restore-safety-checkpoint');
      if (!checkpoint.success) throw new Error('Could not create the safety checkpoint');

      // Restore through a transaction; never copy a database over a live WAL database.
      if (syncManager && syncManager.dbManager) {
        try {
          syncManager.dbManager.migrateFromData(restoredData);
          console.log('[BackupManager] Restored SQLite database tables from backup data');
        } catch (dbErr) {
          throw dbErr;
        }
      } else {
        const DBManager = require('./db_manager');
        const manager = new DBManager(this.baseDir);
        try { manager.migrateFromData(restoredData); } finally { manager.db.close(); }
      }

      const fileContent = `// TradeFlow restored data\nconst INITIAL_DATA = ${JSON.stringify(restoredData, null, 2).replace(/</g, '\\u003c')};\nif (typeof module !== 'undefined') module.exports = INITIAL_DATA;\n`;
      fs.writeFileSync(this.mockDataPath + '.tmp', fileContent, 'utf8');
      fs.renameSync(this.mockDataPath + '.tmp', this.mockDataPath);

      // 4. Trigger Excel sync if syncManager provided
      let excelResult = null;
      if (syncManager && typeof syncManager.exportToExcel === 'function') {
        try {
          excelResult = syncManager.exportToExcel();
        } catch (exErr) {
          console.warn('[BackupManager] Excel sync after restore encountered lock/warning:', exErr.message);
          excelResult = { success: false, locked: true, error: exErr.message };
        }
      }

      console.log(`[BackupManager] Successfully restored backup ${backupId}`);
      return {
        success: true,
        backupId: backupId,
        restoredDataSummary: verification.dataSummary,
        excelSync: excelResult
      };
    } catch (err) {
      console.error('[BackupManager] Restore failed:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = BackupManager;
