// app/hooks/useOfflineDetection.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

interface OfflineQueue {
  id: string;
  timestamp: string;
  data: any;
}

interface OfflineStatus {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  queueSize: number;
  queue: OfflineQueue[];
}

// Type extension for Background Sync API
interface SyncManager {
  register(tag: string): Promise<void>;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync?: SyncManager;
}

export function useOfflineDetection() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
    isServiceWorkerReady: false,
    queueSize: 0,
    queue: []
  });

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          console.log('[SW] Registration successful');
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  toast('New version available! Refresh to update.', {
                    icon: '🔄',
                    duration: 5000
                  });
                }
              });
            }
          });
          
          setStatus(prev => ({ ...prev, isServiceWorkerReady: true }));
          
        } catch (error) {
          console.error('[SW] Registration failed:', error);
          toast.error('Offline mode unavailable');
        }
      }
    };
    
    registerServiceWorker();
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = async () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Back online! Syncing queued messages...', {
        icon: '🌐',
        duration: 3000
      });
      
      // Request sync with proper type handling
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const swReg = registration as ServiceWorkerRegistrationWithSync;
          
          // Check if Background Sync API is available
          if ('sync' in registration && swReg.sync) {
            await swReg.sync.register('sync-offline-queue');
            console.log('Background sync registered for online event');
          } else {
            console.log('Background Sync API not available, attempting manual sync');
            // Fallback: Send message to service worker for manual sync
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({ 
                type: 'MANUAL_SYNC' 
              });
            }
          }
        } catch (error) {
          console.error('Failed to register sync:', error);
        }
      }
    };
    
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast('You are offline. Messages will be queued.', {
        icon: '🔴',
        duration: 4000,
        style: {
          background: '#F59E0B',
          color: 'white'
        }
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    setStatus(prev => ({ ...prev, isOnline: navigator.onLine }));
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for service worker messages
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.serviceWorker) return;
    
    const handleMessage = (event: MessageEvent) => {
      const { data } = event;
      
      switch (data.type) {
        case 'OFFLINE_QUEUE_UPDATED':
          setStatus(prev => ({ ...prev, queueSize: data.queueSize }));
          toast(`Message queued (${data.queueSize}/${10})`, {
            icon: '📥',
            duration: 2000
          });
          break;
          
        case 'OFFLINE_QUEUE_PROCESSED':
          setStatus(prev => ({ 
            ...prev, 
            queueSize: Math.max(0, prev.queueSize - 1) 
          }));
          toast.success('Queued message sent!', {
            icon: '✅',
            duration: 2000
          });
          break;
          
        case 'QUEUE_STATUS':
          setStatus(prev => ({ 
            ...prev, 
            queueSize: data.queueSize,
            queue: data.items || []
          }));
          break;
      }
    };
    
    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    // Check initial queue status
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CHECK_QUEUE' });
    }
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Force update service worker
  const updateServiceWorker = useCallback(() => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, []);

  // Clear offline queue
  const clearQueue = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(['offline_queue'], 'readwrite');
      const store = tx.objectStore('offline_queue');
      
      // Use proper IndexedDB request handling
      const clearRequest = store.clear();
      
      await new Promise<void>((resolve, reject) => {
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });
      
      setStatus(prev => ({ ...prev, queueSize: 0, queue: [] }));
      toast.success('Offline queue cleared');
    } catch (error) {
      console.error('Failed to clear queue:', error);
      toast.error('Failed to clear queue');
    }
  }, []);

  // Get queue details
  const getQueueDetails = useCallback(async () => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CHECK_QUEUE' });
    }
  }, []);

  return {
    ...status,
    updateServiceWorker,
    clearQueue,
    getQueueDetails
  };
}

// Helper function to open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ClaudeEditorOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id' });
      }
    };
  });
}