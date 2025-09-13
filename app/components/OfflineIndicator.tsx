// app/components/OfflineIndicator.tsx
'use client';

import { useOfflineDetection } from 'app/hooks/useOfflineDetection';
import { Wifi, WifiOff, RefreshCw, Clock, X } from 'lucide-react';
import { useState } from 'react';

// Type extension for Background Sync API
interface SyncManager {
  register(tag: string): Promise<void>;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync?: SyncManager;
}

export default function OfflineIndicator() {
  const { 
    isOnline, 
    isServiceWorkerReady, 
    queueSize, 
    queue,
    clearQueue,
    getQueueDetails 
  } = useOfflineDetection();
  
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && queueSize === 0) {
    return null; // Don't show when online with no queue
  }

  return (
    <>
      {/* Status Bar */}
      <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm font-medium text-white transition-all ${
        isOnline ? 'bg-blue-600' : 'bg-orange-500'
      }`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi size={16} />
                <span>Online</span>
                {queueSize > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded">
                    Syncing {queueSize} messages...
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff size={16} className="animate-pulse" />
                <span>Offline Mode</span>
                {queueSize > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded">
                    {queueSize} queued
                  </span>
                )}
              </>
            )}
          </div>
          
          {queueSize > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
            >
              {showDetails ? 'Hide' : 'Show'} Queue
            </button>
          )}
        </div>
      </div>

      {/* Queue Details Panel */}
      {showDetails && queueSize > 0 && (
        <div className="fixed top-12 right-4 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 animate-slide-down">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Clock size={16} />
                Offline Queue ({queueSize}/10)
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto p-4 space-y-2">
            {queue.map((item, index) => (
              <div key={item.id} className="p-2 bg-gray-800 rounded text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400">#{index + 1}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-300 truncate">
                  {item.data?.body?.messages?.[0]?.content || 'Message'}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-gray-700 flex gap-2">
            <button
              onClick={async () => {
                getQueueDetails();
                // Force sync attempt with proper type handling
                if ('serviceWorker' in navigator) {
                  try {
                    const registration = await navigator.serviceWorker.ready;
                    const swReg = registration as ServiceWorkerRegistrationWithSync;
                    
                    // Check if Background Sync API is available
                    if ('sync' in registration && swReg.sync) {
                      await swReg.sync.register('sync-offline-queue');
                      console.log('Background sync registered');
                    } else {
                      console.log('Background Sync API not available');
                      // Fallback: trigger manual sync
                      if (navigator.onLine) {
                        // You can implement a manual sync here if needed
                        console.log('Attempting manual sync...');
                      }
                    }
                  } catch (error) {
                    console.error('Failed to register sync:', error);
                  }
                }
              }}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              Retry Sync
            </button>
            
            <button
              onClick={() => {
                if (confirm('Clear all queued messages? This cannot be undone.')) {
                  clearQueue();
                  setShowDetails(false);
                }
              }}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
}