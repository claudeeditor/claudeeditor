// lib/storage/snapshots.ts
import { nanoid } from 'nanoid';

export interface Snapshot {
  id: string;
  timestamp: Date;
  label: string;
  status: 'working' | 'broken' | 'testing';
  code: string;
  files: Map<string, string>;
  compressedSize: number;
  originalSize: number;
  isMilestone?: boolean;
  autoSave?: boolean;
  description?: string;
  error?: string;
  dependencies?: Record<string, string>;
}

export class SnapshotManager {
  private db: IDBDatabase | null = null;
  private dbName = 'ClaudeEditorDB';
  private storeName = 'snapshots';
  private maxSnapshots = 50; // Keep last 50 snapshots
  private maxAutoSaves = 10; // Keep last 10 auto-saves

  // Initialize IndexedDB
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create snapshots store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Create indexes for efficient queries
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('label', 'label', { unique: false });
          store.createIndex('isMilestone', 'isMilestone', { unique: false });
        }
      };
    });
  }

  // Save a new snapshot
  async saveSnapshot(snapshot: Omit<Snapshot, 'id'>): Promise<Snapshot> {
    if (!this.db) await this.init();

    // ✅ 修正: idは常に新規生成（snapshot.idは存在しないので削除）
    const newSnapshot: Snapshot = {
      ...snapshot,
      id: `snap_${nanoid(10)}`,  // 常に新規生成
      timestamp: new Date(snapshot.timestamp),
    };

    // Clean up old auto-saves if this is an auto-save
    if (newSnapshot.autoSave) {
      await this.cleanupAutoSaves();
    }

    // Clean up old snapshots if we're at the limit
    await this.cleanupOldSnapshots();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Convert Map to object for storage
      const storableSnapshot = {
        ...newSnapshot,
        files: Array.from(newSnapshot.files.entries()),
      };
      
      const request = store.add(storableSnapshot);

      request.onsuccess = () => {
        console.log('Snapshot saved:', newSnapshot.label);
        resolve(newSnapshot);
      };

      request.onerror = () => {
        console.error('Failed to save snapshot');
        reject(request.error);
      };
    });
  }

  // Get a specific snapshot
  async getSnapshot(id: string): Promise<Snapshot | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert array back to Map
          result.files = new Map(result.files);
          resolve(result);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get all snapshots
  async getAllSnapshots(): Promise<Snapshot[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const snapshots = request.result.map(s => ({
          ...s,
          files: new Map(s.files),
          timestamp: new Date(s.timestamp),
        }));
        
        // Sort by timestamp, newest first
        snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        resolve(snapshots);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get last working snapshot
  async getLastWorkingSnapshot(): Promise<Snapshot | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.getAll('working');

      request.onsuccess = () => {
        const workingSnapshots = request.result;
        
        if (workingSnapshots.length > 0) {
          // Sort by timestamp and get the most recent
          workingSnapshots.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          const latest = workingSnapshots[0];
          latest.files = new Map(latest.files);
          resolve(latest);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get milestones only
  async getMilestones(): Promise<Snapshot[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      // ✅ 修正: getAllで全件取得してからフィルタリング
      const request = store.getAll();

      request.onsuccess = () => {
        // isMilestone === true のものだけフィルタリング
        const milestones = request.result
          .filter(s => s.isMilestone === true)
          .map(s => ({
            ...s,
            files: new Map(s.files),
            timestamp: new Date(s.timestamp),
          }));
        
        milestones.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        resolve(milestones);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Restore a snapshot
  async restoreSnapshot(id: string): Promise<Snapshot> {
    const snapshot = await this.getSnapshot(id);
    
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    // Create a restore point before restoring
    await this.saveSnapshot({
      timestamp: new Date(),
      label: `Before restore to: ${snapshot.label}`,
      status: 'testing',
      code: snapshot.code, // This should be the current code
      files: snapshot.files,
      compressedSize: snapshot.compressedSize,
      originalSize: snapshot.originalSize,
      description: 'Automatic backup before restore',
    });

    return snapshot;
  }

  // Delete a snapshot
  async deleteSnapshot(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Snapshot deleted:', id);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Clean up old auto-saves
  private async cleanupAutoSaves(): Promise<void> {
    const allSnapshots = await this.getAllSnapshots();
    const autoSaves = allSnapshots.filter(s => s.autoSave);
    
    if (autoSaves.length > this.maxAutoSaves) {
      const toDelete = autoSaves.slice(this.maxAutoSaves);
      
      for (const snapshot of toDelete) {
        await this.deleteSnapshot(snapshot.id);
      }
    }
  }

  // Clean up old snapshots
  private async cleanupOldSnapshots(): Promise<void> {
    const allSnapshots = await this.getAllSnapshots();
    
    // Keep all milestones
    const nonMilestones = allSnapshots.filter(s => !s.isMilestone);
    
    if (nonMilestones.length > this.maxSnapshots) {
      const toDelete = nonMilestones.slice(this.maxSnapshots);
      
      for (const snapshot of toDelete) {
        await this.deleteSnapshot(snapshot.id);
      }
    }
  }

  // Export snapshots as JSON
  async exportSnapshots(): Promise<string> {
    const snapshots = await this.getAllSnapshots();
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      snapshots: snapshots.map(s => ({
        ...s,
        files: Array.from(s.files.entries()),
      })),
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // Import snapshots from JSON
  async importSnapshots(jsonData: string): Promise<number> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.snapshots || !Array.isArray(importData.snapshots)) {
        throw new Error('Invalid import data format');
      }
      
      let imported = 0;
      
      for (const snapshot of importData.snapshots) {
        // Convert arrays back to Maps
        snapshot.files = new Map(snapshot.files);
        snapshot.timestamp = new Date(snapshot.timestamp);
        
        await this.saveSnapshot(snapshot);
        imported++;
      }
      
      return imported;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  // Get storage usage stats
  async getStorageStats(): Promise<{
    totalSnapshots: number;
    milestones: number;
    autoSaves: number;
    totalSize: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
  }> {
    const snapshots = await this.getAllSnapshots();
    
    const milestones = snapshots.filter(s => s.isMilestone).length;
    const autoSaves = snapshots.filter(s => s.autoSave).length;
    
    const totalSize = snapshots.reduce((sum, s) => sum + s.originalSize, 0);
    
    const timestamps = snapshots.map(s => s.timestamp);
    const oldest = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null;
    const newest = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null;
    
    return {
      totalSnapshots: snapshots.length,
      milestones,
      autoSaves,
      totalSize,
      oldestSnapshot: oldest,
      newestSnapshot: newest,
    };
  }
}