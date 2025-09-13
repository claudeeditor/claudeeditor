// components/editor/StatusBar.tsx
'use client';
import { Zap, Database, TrendingUp, HardDrive } from 'lucide-react';
import { useEditorStore } from 'app/lib/stores/editorStore';
import { useState, useEffect } from 'react';

interface StatusBarProps {
  originalSize: number;
  compressedSize: number;
  savedStatus: 'saved' | 'unsaved' | 'saving';
}

export default function StatusBar({ originalSize, compressedSize, savedStatus }: StatusBarProps) {
  const { 
    totalTokensUsed, 
    monthlyTokensUsed, 
    cacheHits, 
    cacheMisses,
    compressionLevel 
  } = useEditorStore();
  
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const compressionRate = originalSize > 0 
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : 0;

  const cacheHitRate = (cacheHits + cacheMisses) > 0
    ? Math.round((cacheHits / (cacheHits + cacheMisses)) * 100)
    : 0;

  const estimatedMonthlyCost = (monthlyTokensUsed * 0.000002).toFixed(2);

  return (
    <div className="bg-gray-900 border-t border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          {/* Save Status */}
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              savedStatus === 'saved' ? 'bg-green-500' :
              savedStatus === 'saving' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`} />
            <span>{savedStatus === 'saved' ? 'Saved' : savedStatus === 'saving' ? 'Saving...' : 'Unsaved'}</span>
          </div>

          {/* Compression Stats */}
          <div className="flex items-center gap-1">
            <Zap size={12} className="text-yellow-500" />
            <span>{compressionRate}% compressed</span>
            <span className="text-gray-600">|</span>
            <span>{compressionLevel}</span>
          </div>

          {/* Cache Stats */}
          <div className="flex items-center gap-1">
            <Database size={12} className="text-blue-500" />
            <span>{cacheHitRate}% cache hits</span>
            <span className="text-gray-600">|</span>
            <span>{cacheHits}/{cacheHits + cacheMisses}</span>
          </div>

          {/* Token Usage */}
          <div className="flex items-center gap-1">
            <TrendingUp size={12} className="text-green-500" />
            <span>{monthlyTokensUsed.toLocaleString()} tokens</span>
            <span className="text-gray-600">|</span>
            <span>${estimatedMonthlyCost}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Storage */}
          <div className="flex items-center gap-1">
            <HardDrive size={12} />
            <span>IndexedDB</span>
          </div>

          {/* Time */}
          <div>
            {time.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
