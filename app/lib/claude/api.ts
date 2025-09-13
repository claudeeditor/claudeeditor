// lib/claude/api.ts

// ========== Types ==========
interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ClaudeResponse {
  content: string;
  tokens?: number;
  cached?: boolean;
  code?: string;
}

interface CacheEntry {
  key: string;
  response: ClaudeResponse;
  timestamp: Date;
  hits: number;
}

interface CacheStats {
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  memoryCacheSize: number;
  estimatedSavings: number;
}

// ========== Configuration ==========
const CACHE_CONFIG = {
  dbName: 'ClaudeCache',
  storeName: 'responses',
  maxMemoryCacheSize: 100,
  topCacheEntries: 20,
  savingsPerHit: 0.002, // Estimated $ saved per cache hit
};

// ========== Main Class ==========
export class ClaudeAPI {
  private memoryCache: Map<string, CacheEntry>;
  private persistentCache: IDBDatabase | null = null;
  private totalRequests = 0;
  private cacheHits = 0;

  constructor() {
    this.memoryCache = new Map();
    this.initPersistentCache();
  }

  // ========== Cache Initialization ==========
  private async initPersistentCache(): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(CACHE_CONFIG.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open cache database');
        resolve();
      };

      request.onsuccess = () => {
        this.persistentCache = request.result;
        console.log('Cache database initialized');
        this.loadCacheToMemory();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(CACHE_CONFIG.storeName)) {
          const store = db.createObjectStore(CACHE_CONFIG.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('hits', 'hits', { unique: false });
        }
      };
    });
  }

  private async loadCacheToMemory(): Promise<void> {
    if (!this.persistentCache) return;

    const transaction = this.persistentCache.transaction([CACHE_CONFIG.storeName], 'readonly');
    const store = transaction.objectStore(CACHE_CONFIG.storeName);
    const index = store.index('hits');
    
    const request = index.openCursor(null, 'prev');
    let count = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      
      if (cursor && count < CACHE_CONFIG.topCacheEntries) {
        const entry = cursor.value;
        this.memoryCache.set(entry.key, entry);
        count++;
        cursor.continue();
      }
    };
  }

  // ========== Cache Operations ==========
  private generateCacheKey(messages: ClaudeMessage[], context?: Record<string, unknown>): string {
    const content = JSON.stringify({ messages, context });
    
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `claude_${hash.toString(36)}`;
  }

  async checkCache(query: string, context?: Record<string, unknown>): Promise<ClaudeResponse | null> {
    const messages: ClaudeMessage[] = [{ role: 'user', content: query }];
    const cacheKey = this.generateCacheKey(messages, context);
    
    this.totalRequests++;

    // Check memory cache
    if (this.memoryCache.has(cacheKey)) {
      const entry = this.memoryCache.get(cacheKey)!;
      entry.hits++;
      this.cacheHits++;
      console.log('Cache hit (memory):', cacheKey);
      return { ...entry.response, cached: true };
    }

    // Check persistent cache
    if (this.persistentCache) {
      const entry = await this.getPersistentCacheEntry(cacheKey);
      if (entry) {
        entry.hits++;
        this.cacheHits++;
        this.memoryCache.set(cacheKey, entry);
        await this.updatePersistentCacheHits(cacheKey, entry.hits);
        console.log('Cache hit (persistent):', cacheKey);
        return { ...entry.response, cached: true };
      }
    }

    // Check semantic similarity
    const similarEntry = await this.findSimilarCacheEntry(query);
    if (similarEntry) {
      this.cacheHits++;
      console.log('Cache hit (semantic):', cacheKey);
      return { ...similarEntry.response, cached: true };
    }

    console.log('Cache miss:', cacheKey);
    return null;
  }

  private async getPersistentCacheEntry(key: string): Promise<CacheEntry | null> {
    if (!this.persistentCache) return null;

    return new Promise((resolve) => {
      const transaction = this.persistentCache!.transaction([CACHE_CONFIG.storeName], 'readonly');
      const store = transaction.objectStore(CACHE_CONFIG.storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async updatePersistentCacheHits(key: string, hits: number): Promise<void> {
    if (!this.persistentCache) return;

    const transaction = this.persistentCache.transaction([CACHE_CONFIG.storeName], 'readwrite');
    const store = transaction.objectStore(CACHE_CONFIG.storeName);
    const request = store.get(key);

    request.onsuccess = () => {
      const entry = request.result;
      if (entry) {
        entry.hits = hits;
        store.put(entry);
      }
    };
  }

  private async findSimilarCacheEntry(query: string): Promise<CacheEntry | null> {
    const patterns = [
      { pattern: /fix.*error/i, category: 'error-fix' },
      { pattern: /explain.*code/i, category: 'code-explanation' },
      { pattern: /add.*feature/i, category: 'feature-addition' },
      { pattern: /refactor/i, category: 'refactoring' },
      { pattern: /optimize/i, category: 'optimization' },
      { pattern: /test/i, category: 'testing' },
    ];

    let category: string | null = null;
    for (const { pattern, category: cat } of patterns) {
      if (pattern.test(query)) {
        category = cat;
        break;
      }
    }

    if (!category) return null;

    const entries = Array.from(this.memoryCache.entries());
    for (const [key, entry] of entries) {
      if (key.includes(category)) {
        return entry;
      }
    }

    return null;
  }

  private async cacheResponse(key: string, response: ClaudeResponse): Promise<void> {
    const entry: CacheEntry = {
      key,
      response,
      timestamp: new Date(),
      hits: 0,
    };

    this.memoryCache.set(key, entry);

    if (this.memoryCache.size > CACHE_CONFIG.maxMemoryCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    if (this.persistentCache) {
      const transaction = this.persistentCache.transaction([CACHE_CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(CACHE_CONFIG.storeName);
      store.put(entry);
    }
  }

  // ========== API Communication ==========
  async sendMessage(
    messages: ClaudeMessage[],
    context?: Record<string, unknown>
  ): Promise<ClaudeResponse> {
    const cacheKey = this.generateCacheKey(messages, context);
    const cached = await this.checkCache(messages[messages.length - 1].content, context);
    
    if (cached) {
      return cached;
    }

    try {
      const systemMessage = this.buildSystemMessage(context);
      const allMessages = systemMessage 
        ? [{ role: 'system', content: systemMessage }, ...messages]
        : messages;

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: allMessages,
          max_tokens: 4000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('API.ts received:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const result: ClaudeResponse = {
        content: data.content || '',
        tokens: data.usage?.completion_tokens || data.usage?.total_tokens,
        cached: false,
      };

      const codeMatch = data.content?.match(/```(?:typescript|javascript|tsx|jsx)?\n([\s\S]*?)```/);
      if (codeMatch) {
        result.code = codeMatch[1];
      }

      await this.cacheResponse(cacheKey, result);
      return result;
      
    } catch (error) {
      console.error('Claude API error:', error);
      return this.getFallbackResponse(messages[messages.length - 1].content);
    }
  }

  private buildSystemMessage(context?: Record<string, unknown>): string {
    if (!context) return '';

    const parts: string[] = [];

    if (context.rules) {
      parts.push(`Important rules: ${context.rules}`);
    }

    if (context.code && typeof context.code === 'string') {
      parts.push(`Current code context (compressed): ${context.code.substring(0, 1000)}...`);
    }

    if (context.projectType) {
      parts.push(`Project type: ${context.projectType}`);
    }

    return parts.join('\n\n');
  }

  private getFallbackResponse(query: string): ClaudeResponse {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('module not found') || lowerQuery.includes('cannot find module')) {
      return {
        content: `To fix "Module not found" error:

1. Check if the package is installed:
\`\`\`bash
npm list [package-name]
\`\`\`

2. If not installed, run:
\`\`\`bash
npm install [package-name]
\`\`\`

3. Clear cache and rebuild:
\`\`\`bash
rm -rf .next node_modules
npm install
npm run dev
\`\`\``,
        cached: true,
      };
    }

    return {
      content: 'I apologize, but I encountered an issue processing your request. Please try again or rephrase your question.',
      cached: false,
    };
  }

  // ========== Statistics ==========
  getCacheStats(): CacheStats {
    const hitRate = this.totalRequests > 0 
      ? Math.round((this.cacheHits / this.totalRequests) * 100)
      : 0;

    return {
      hitRate,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.totalRequests - this.cacheHits,
      memoryCacheSize: this.memoryCache.size,
      estimatedSavings: this.cacheHits * CACHE_CONFIG.savingsPerHit,
    };
  }

  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.persistentCache) {
      const transaction = this.persistentCache.transaction([CACHE_CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(CACHE_CONFIG.storeName);
      store.clear();
    }

    this.cacheHits = 0;
    this.totalRequests = 0;
  }
}