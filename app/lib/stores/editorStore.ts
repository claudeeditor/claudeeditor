import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ========== Constants ==========
const MAX_SNAPSHOTS = 50;
const STORAGE_KEY = 'claude-editor-storage';

// ========== Type Definitions ==========
export interface TokenStats {
  original: number;
  compressed: number;
  saved: number;
}

export interface Snapshot {
  id: string;
  timestamp: Date;
  label: string;
  status: 'working' | 'broken' | 'testing' | 'milestone';
  code: string;
  files: Map<string, string>;
  compressedSize: number;
  originalSize: number;
  isMilestone?: boolean;
}

export type CompressionLevel = 'light' | 'medium' | 'maximum';

// ========== Initial Data ==========
const createInitialFiles = (): Map<string, string> => {
  const files = new Map<string, string>();
  
  files.set('.eslintrc.json', `{
  "extends": "next/core-web-vitals"
}`);

  files.set('README.md', `# ClaudeEditor

A safe, stable code editor with AI assistance.

## Features
- Never lose code with auto-save
- Safe Mode to filter experimental features
- Panic button to restore last working version
- Built-in AI assistant (Claude)
- File management with tree view

## Tech Stack
- Next.js 14 (stable)
- React 18 (stable)
- Tailwind CSS v3 (stable)
- Monaco Editor
- Zustand for state management

## Getting Started
\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)`);

  files.set('main.tsx', `// Welcome to ClaudeEditor
// Safe AI-powered code editor

export default function Main() {
  return (
    <div>
      <h1>Welcome to ClaudeEditor</h1>
      <p>Start coding with confidence!</p>
    </div>
  );
}`);

  files.set('next.config.js', `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig`);

  files.set('package.json', `{
  "name": "claudeeditor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "@monaco-editor/react": "^4.6.0",
    "react-resizable-panels": "^2.0.0",
    "react-hot-toast": "^2.4.1",
    "lucide-react": "^0.263.1",
    "zustand": "^4.5.0",
    "nanoid": "^5.0.0",
    "prettier": "^3.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.16",
    "eslint": "^8",
    "eslint-config-next": "14.2.3",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.4.0",
    "typescript": "^5"
  }
}`);

  files.set('postcss.config.js', `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`);

  files.set('tailwind.config.ts', `import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config`);

  files.set('tsconfig.json', `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "noImplicitAny": false,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`);

  console.log('[Store] Initial files created:', Array.from(files.keys()));
  return files;
};

// ========== Store Interface ==========
interface EditorState {
  // Current file and project
  currentFile: string;
  currentProject: string;
  files: Map<string, string>;
  
  // Snapshots
  snapshots: Snapshot[];
  currentSnapshotId: string | null;
  
  // Token usage
  tokenStats: TokenStats;
  totalTokensUsed: number;
  monthlyTokensUsed: number;
  
  // Cache stats
  cacheHits: number;
  cacheMisses: number;
  
  // Settings
  autoSaveEnabled: boolean;
  compressionLevel: CompressionLevel;
  safeModeEnabled: boolean;
  autoDocEnabled: boolean;
  
  // Actions
  setCurrentFile: (file: string) => void;
  setCurrentProject: (project: string) => void;
  updateFile: (file: string, content: string) => void;
  deleteFile: (file: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  
  // Snapshot actions
  addSnapshot: (snapshot: Snapshot) => void;
  removeSnapshot: (id: string) => void;
  setCurrentSnapshot: (id: string) => void;
  loadSnapshot: (id: string) => string | null;
  
  // Statistics
  updateTokenStats: (stats: TokenStats) => void;
  addToTokenUsage: (tokens: number) => void;
  resetMonthlyTokens: () => void;
  updateCacheHits: (hits: number) => void;
  updateCacheMisses: (misses: number) => void;
  
  // Settings
  setAutoSave: (enabled: boolean) => void;
  setCompressionLevel: (level: CompressionLevel) => void;
  setSafeMode: (enabled: boolean) => void;
  setAutoDoc: (enabled: boolean) => void;
  
  // Utility
  reset: () => void;
}

// ========== Store Implementation ==========
export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentFile: 'main.tsx',
      currentProject: 'untitled-project',
      files: createInitialFiles(),
      snapshots: [],
      currentSnapshotId: null,
      tokenStats: {
        original: 0,
        compressed: 0,
        saved: 0,
      },
      totalTokensUsed: 0,
      monthlyTokensUsed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      autoSaveEnabled: true,
      compressionLevel: 'medium',
      safeModeEnabled: true,
      autoDocEnabled: false,
      
      // Actions
      setCurrentFile: (file) => {
        console.log('[Store] Setting current file:', file);
        set({ currentFile: file });
      },
      
      setCurrentProject: (project) => set({ currentProject: project }),
      
      updateFile: (file, content) => set((state) => {
        const newFiles = new Map(state.files);
        newFiles.set(file, content);
        console.log('[Store] Updated file:', file, 'Size:', content.length);
        return { files: newFiles };
      }),
      
      deleteFile: (file) => set((state) => {
        const newFiles = new Map(state.files);
        newFiles.delete(file);
        console.log('[Store] Deleted file:', file);
        return { files: newFiles };
      }),
      
      renameFile: (oldPath, newPath) => set((state) => {
        const content = state.files.get(oldPath);
        if (!content) return state;
        
        const newFiles = new Map(state.files);
        newFiles.delete(oldPath);
        newFiles.set(newPath, content);
        
        return {
          files: newFiles,
          currentFile: state.currentFile === oldPath ? newPath : state.currentFile,
        };
      }),
      
      addSnapshot: (snapshot) => set((state) => ({
        snapshots: [snapshot, ...state.snapshots].slice(0, MAX_SNAPSHOTS),
      })),
      
      removeSnapshot: (id) => set((state) => ({
        snapshots: state.snapshots.filter(s => s.id !== id),
        currentSnapshotId: state.currentSnapshotId === id ? null : state.currentSnapshotId,
      })),
      
      setCurrentSnapshot: (id) => set({ currentSnapshotId: id }),
      
      loadSnapshot: (id) => {
        const snapshot = get().snapshots.find(s => s.id === id);
        if (snapshot) {
          set({ 
            files: new Map(snapshot.files),
            currentSnapshotId: id,
          });
          return snapshot.code;
        }
        return null;
      },
      
      updateTokenStats: (stats) => set({ tokenStats: stats }),
      
      addToTokenUsage: (tokens) => set((state) => ({
        totalTokensUsed: state.totalTokensUsed + tokens,
        monthlyTokensUsed: state.monthlyTokensUsed + tokens,
      })),
      
      resetMonthlyTokens: () => set({ monthlyTokensUsed: 0 }),
      
      updateCacheHits: (hits) => set({ cacheHits: hits }),
      
      updateCacheMisses: (misses) => set({ cacheMisses: misses }),
      
      setAutoSave: (enabled) => set({ autoSaveEnabled: enabled }),
      
      setCompressionLevel: (level) => set({ compressionLevel: level }),
      
      setSafeMode: (enabled) => set({ safeModeEnabled: enabled }),
      
      setAutoDoc: (enabled) => set({ autoDocEnabled: enabled }),
      
      reset: () => set({
        currentFile: 'main.tsx',
        currentProject: 'untitled-project',
        files: createInitialFiles(),
        snapshots: [],
        currentSnapshotId: null,
        tokenStats: {
          original: 0,
          compressed: 0,
          saved: 0,
        },
        totalTokensUsed: 0,
        monthlyTokensUsed: 0,
        cacheHits: 0,
        cacheMisses: 0,
        autoSaveEnabled: true,
        compressionLevel: 'medium',
        safeModeEnabled: true,
        autoDocEnabled: false,
      }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        // Custom storage that handles Map serialization
        return {
          getItem: (name: string) => {
            const str = typeof window !== 'undefined' ? localStorage.getItem(name) : null;
            if (!str) return null;
            
            try {
              const state = JSON.parse(str);
              
              // Convert arrays back to Maps
              if (state.state?.files) {
                state.state.files = new Map(state.state.files);
              }
              
              if (state.state?.snapshots) {
                state.state.snapshots = state.state.snapshots.map((s: any) => ({
                  ...s,
                  files: new Map(s.files || []),
                  timestamp: new Date(s.timestamp),
                }));
              }
              
              return JSON.stringify(state);
            } catch (error) {
              console.error('[Store] Failed to parse storage:', error);
              return null;
            }
          },
          setItem: (name: string, value: string) => {
            try {
              const state = JSON.parse(value);
              
              // Convert Maps to arrays for storage
              const serialized = {
                ...state,
                state: {
                  ...state.state,
                  files: state.state.files instanceof Map 
                    ? Array.from(state.state.files.entries())
                    : state.state.files,
                  snapshots: state.state.snapshots 
                    ? state.state.snapshots.map((s: any) => ({
                        ...s,
                        files: s.files instanceof Map 
                          ? Array.from(s.files.entries()) 
                          : s.files,
                      }))
                    : []
                }
              };
              
              if (typeof window !== 'undefined') {
                localStorage.setItem(name, JSON.stringify(serialized));
              }
            } catch (error) {
              console.error('[Store] Failed to save to storage:', error);
            }
          },
          removeItem: (name: string) => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem(name);
            }
          },
        };
      }),
      skipHydration: true, // This prevents hydration issues
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure files exist and have initial files if empty
          if (!state.files || state.files.size === 0) {
            state.files = createInitialFiles();
          }
          console.log('[Store] Rehydrated with', state.files.size, 'files');
          console.log('[Store] Files:', Array.from(state.files.keys()));
        }
      },
    }
  )
);