// app/components/LoadingStates.tsx
'use client'
import { Loader2 } from 'lucide-react';

// Spinner component for inline loading
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <Loader2 
      size={size} 
      className={`animate-spin text-blue-500 ${className}`}
    />
  );
}

// Full page loading overlay
export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} />
          <p className="text-gray-300 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}

// Skeleton loader for file tree
export function FileTreeSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-700 rounded animate-pulse" />
          <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: `${60 + i * 20}px` }} />
        </div>
      ))}
    </div>
  );
}

// Skeleton loader for chat messages
export function ChatMessageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-3">
        <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
      </div>
    </div>
  );
}

// Loading dots animation
export function LoadingDots() {
  return (
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

// Progress bar for file operations
export function ProgressBar({ progress, message }: { progress: number; message?: string }) {
  return (
    <div className="w-full">
      {message && (
        <p className="text-sm text-gray-400 mb-2">{message}</p>
      )}
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{progress}%</p>
    </div>
  );
}

// Loading state for editor
export function EditorLoading() {
  return (
    <div className="h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Spinner size={32} className="mx-auto mb-4" />
        <p className="text-gray-400">Initializing editor...</p>
      </div>
    </div>
  );
}

// Saving indicator
export function SavingIndicator({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  
  return (
    <div className="fixed bottom-8 right-8 bg-gray-800 rounded-lg px-4 py-2 shadow-lg border border-gray-700 flex items-center gap-2 z-40 animate-fade-in">
      <Spinner size={14} />
      <span className="text-sm text-gray-300">Saving...</span>
    </div>
  );
}

// Claude thinking indicator
export function ClaudeThinking() {
  return (
    <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
      <div className="relative">
        <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse" />
        <div className="absolute inset-0 w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-30" />
      </div>
      <div className="flex-1">
        <p className="text-blue-400 text-sm font-medium">Claude is thinking...</p>
        <div className="mt-1">
          <LoadingDots />
        </div>
      </div>
    </div>
  );
}

// File operation loading
export function FileOperationLoading({ operation }: { operation: 'creating' | 'deleting' | 'renaming' | 'loading' }) {
  const messages = {
    creating: 'Creating file...',
    deleting: 'Deleting file...',
    renaming: 'Renaming file...',
    loading: 'Loading file...'
  };
  
  return (
    <div className="inline-flex items-center gap-2 text-sm text-gray-400">
      <Spinner size={14} />
      <span>{messages[operation]}</span>
    </div>
  );
}