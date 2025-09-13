// public/service-worker.js
// ClaudeEditor Service Worker - Offline Queue System

const CACHE_NAME = 'claudeeditor-v1';
const OFFLINE_QUEUE_KEY = 'claudeeditor-offline-queue';
const MAX_QUEUE_SIZE = 10;

// Files to cache for offline use
const urlsToCache = [
  '/',
  '/globals.css',
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/pages/_app.js',
  '/_next/static/css/app.css'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[ServiceWorker] Cache failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Handle API calls to Claude
  if (request.url.includes('/api/claude')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle other requests
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(request).catch(() => {
          // If offline and not in cache, return offline page
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});

// Handle API requests with offline queue
async function handleApiRequest(request) {
  try {
    // Try to make the request
    const response = await fetch(request.clone());
    
    // If successful, process any queued requests
    if (response.ok) {
      processOfflineQueue();
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] API request failed, queuing for later');
    
    // Clone request and get body
    const requestClone = request.clone();
    const body = await requestClone.json();
    
    // Add to offline queue
    await addToOfflineQueue({
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body: body,
      timestamp: new Date().toISOString()
    });
    
    // Return offline response
    return new Response(JSON.stringify({
      content: "I'm currently offline, but your message has been saved. I'll respond as soon as you're back online!",
      mode: 'offline',
      queued: true,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Add request to offline queue
async function addToOfflineQueue(requestData) {
  try {
    // Get existing queue from IndexedDB
    const db = await openDB();
    const tx = db.transaction(['offline_queue'], 'readwrite');
    const store = tx.objectStore('offline_queue');
    
    // Get current queue
    const queue = await store.getAll();
    
    // Check queue size limit
    if (queue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest item
      await store.delete(queue[0].id);
    }
    
    // Add new request to queue
    await store.add({
      id: Date.now().toString(),
      data: requestData
    });
    
    await tx.complete;
    
    // Notify clients about queued request
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'OFFLINE_QUEUE_UPDATED',
          queueSize: Math.min(queue.length + 1, MAX_QUEUE_SIZE)
        });
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Failed to add to offline queue:', error);
  }
}

// Process offline queue when back online
async function processOfflineQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction(['offline_queue'], 'readwrite');
    const store = tx.objectStore('offline_queue');
    const queue = await store.getAll();
    
    if (queue.length === 0) return;
    
    console.log(`[ServiceWorker] Processing ${queue.length} queued requests`);
    
    for (const item of queue) {
      try {
        // Recreate request
        const headers = new Headers(item.data.headers);
        const response = await fetch(item.data.url, {
          method: item.data.method,
          headers: headers,
          body: JSON.stringify(item.data.body)
        });
        
        if (response.ok) {
          // Remove from queue if successful
          await store.delete(item.id);
          
          // Notify client about successful sync
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'OFFLINE_QUEUE_PROCESSED',
                request: item.data,
                response: response.clone()
              });
            });
          });
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to process queued request:', error);
      }
    }
    
    await tx.complete;
  } catch (error) {
    console.error('[ServiceWorker] Failed to process offline queue:', error);
  }
}

// Open IndexedDB for offline queue
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ClaudeEditorOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id' });
      }
    };
  });
}

// Listen for sync event
self.addEventListener('sync', event => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(processOfflineQueue());
  }
});

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CHECK_QUEUE') {
    checkQueueStatus();
  }
});

// Check queue status and notify clients
async function checkQueueStatus() {
  try {
    const db = await openDB();
    const tx = db.transaction(['offline_queue'], 'readonly');
    const store = tx.objectStore('offline_queue');
    const queue = await store.getAll();
    
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'QUEUE_STATUS',
          queueSize: queue.length,
          items: queue
        });
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Failed to check queue status:', error);
  }
}