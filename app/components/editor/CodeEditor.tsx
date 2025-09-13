'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Save, RotateCcw, AlertCircle, Zap, FileCode2, MessageSquare, FolderTree, Keyboard } from 'lucide-react';
import toast from 'react-hot-toast';
import FileTree from './FileTree';
import ChatPanel from './ChatPanel';
import StatusBar from './StatusBar';
import SnapshotPanel from './SnapshotPanel';
import { CodeTransformManager } from 'app/lib/claude/compression';
import { SnapshotManager } from 'app/lib/storage/snapshots';
import { useEditorStore } from 'app/lib/stores/editorStore';
import { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from 'app/hooks/useKeyboardShortcuts';
import { EditorLoading, SavingIndicator, LoadingOverlay } from 'app/components/LoadingStates';
// Fix 1: Import useMobileView directly as a hook
import { useMobileView } from 'app/hooks/useMobileView';

// Dynamic import for MobileLayout component only
const MobileLayout = dynamic(() => import('../MobileLayout'), { 
  ssr: false,
  loading: () => <LoadingOverlay message="Loading mobile view..." />
});

// ========== Constants ==========
const AUTO_SAVE_DELAY = 2000;
const INITIAL_CODE = `// Welcome to ClaudeEditor
// Safe AI coding that never breaks

function hello() {
  console.log("Never lose your code again!");
}`;

// ========== Helper Functions ==========
const getLanguageFromExtension = (filePath: string): string => {
  const extensionMap: Record<string, string> = {
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
  };

  const extension = Object.keys(extensionMap).find(ext => filePath.endsWith(ext));
  return extension ? extensionMap[extension] : 'typescript';
};

const getDefaultContent = (filePath: string): string => {
  const contentMap: Record<string, () => string> = {
    '.tsx': () => {
      const componentName = filePath.split('/').pop()?.replace('.tsx', '') || 'Component';
      return `export default function ${componentName}() {
  return (
    <div>
      {/* Your component */}
    </div>
  );
}`;
    },
    '.ts': () => '// TypeScript file\n',
    '.css': () => '/* CSS file */\n',
    '.json': () => '{\n  \n}',
    '.js': () => '// JavaScript file\n',
    '.jsx': () => '// React component\n',
    '.md': () => '# Title\n\n',
    '.yml': () => '# YAML configuration\n',
    '.yaml': () => '# YAML configuration\n',
  };

  const extension = Object.keys(contentMap).find(ext => filePath.endsWith(ext));
  return extension ? contentMap[extension]() : '// New file\n';
};

// ========== Main Component ==========
export default function CodeEditor() {
  // State Management
  const [code, setCode] = useState(INITIAL_CODE);
  const [compressedCode, setCompressedCode] = useState('');
  const [savedStatus, setSavedStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [panicMode, setPanicMode] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  
  // Use the mobile view hook
  const { 
    isMobile,
    isTablet,
    viewMode,
    forcedView,
    activePanel,
    toggleViewMode,
    forceView,
    switchPanel,
    getPanelVisibility,
    getLayoutRecommendation
  } = useMobileView();
  
  // Refs
  const transformManager = useRef(new CodeTransformManager());
  const snapshotManager = useRef(new SnapshotManager());
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const editorRef = useRef<any>(null);
  
  // Store hooks
  const { 
    currentFile, 
    files, 
    addSnapshot, 
    tokenStats,
    updateTokenStats,
    setCurrentFile,
    updateFile
  } = useEditorStore();

  // ========== Initialization ==========
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      try {
        await snapshotManager.current.init();
        
        // Load initial file content
        const initialContent = files.get(currentFile);
        if (initialContent) {
          setCode(initialContent);
        }
        
        // Check for crash recovery
        handleCrashRecovery();
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error('Failed to initialize editor');
      } finally {
        setIsInitializing(false);
      }
    };
    
    initialize();
  }, []);

  // ========== Auto-save to localStorage ==========
  useEffect(() => {
    const saveToLocal = () => {
      try {
        localStorage.setItem('claudeeditor-autosave', JSON.stringify({
          code,
          timestamp: new Date().toISOString(),
          file: currentFile
        }));
      } catch (e) {
        console.error('Failed to auto-save:', e);
      }
    };
    
    const timer = setTimeout(saveToLocal, 1000);
    return () => clearTimeout(timer);
  }, [code, currentFile]);

  // ========== Event Handlers ==========
  const handleCrashRecovery = () => {
    const crashBackup = localStorage.getItem('claudeeditor-backup-after-crash');
    if (crashBackup) {
      const shouldRestore = confirm('Found a backup from a previous crash. Would you like to restore it?');
      if (shouldRestore) {
        try {
          const data = JSON.parse(crashBackup);
          setCode(data.code || '');
          toast.success('Recovered from crash backup!', { icon: '🔄' });
        } catch (e) {
          console.error('Failed to restore backup:', e);
          toast.error('Failed to restore backup');
        }
      }
      localStorage.removeItem('claudeeditor-backup-after-crash');
    }
  };

  const handleFileSelect = useCallback((filePath: string) => {
    console.log('[FileSelect] Selected:', filePath);
    
    // Save current file content before switching
    if (currentFile && currentFile !== filePath) {
      console.log('[FileSelect] Saving current file:', currentFile);
      updateFile(currentFile, code);
    }
    
    // Get latest file content from store
    const latestFiles = useEditorStore.getState().files;
    const fileContent = latestFiles.get(filePath);
    
    console.log('[FileSelect] Content found:', fileContent !== undefined, 'Length:', fileContent?.length);
    
    if (fileContent !== undefined) {
      // File exists - load it
      setCode(fileContent);
      setCurrentFile(filePath);
      updateEditorLanguage(filePath);
      
      toast.success(`Opened: ${filePath}`, {
        icon: '📄',
        duration: 1000
      });
    } else {
      // File doesn't exist - create it
      console.log('[FileSelect] File not found, creating empty file:', filePath);
      const emptyContent = getDefaultContent(filePath);
      updateFile(filePath, emptyContent);
      setCode(emptyContent);
      setCurrentFile(filePath);
      updateEditorLanguage(filePath);
      
      toast(`Created new file: ${filePath}`, {
        icon: '✨',
        duration: 1500,
        style: {
          background: '#3B82F6',
          color: '#fff',
        },
      });
    }
  }, [currentFile, code, updateFile, setCurrentFile]);

  const updateEditorLanguage = (filePath: string) => {
    if (!editorRef.current) return;
    
    const language = getLanguageFromExtension(filePath);
    console.log('[FileSelect] Setting language mode:', language);
    
    const model = editorRef.current.getModel();
    if (model && (window as any).monaco) {
      (window as any).monaco.editor.setModelLanguage(model, language);
    }
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined) return;
    
    setCode(value);
    setSavedStatus('unsaved');
    
    // Transform for Claude - reduce frequency on mobile
    if (!isMobile || Math.random() > 0.5) {
      const result = transformManager.current.onUserEdit(value);
      setCompressedCode(result.compressed);
      
      // Update token stats
      updateTokenStats({
        original: value.length,
        compressed: result.compressed.length,
        saved: result.saved
      });
    }
    
    // Update the current file in store
    updateFile(currentFile, value);
    
    // Auto-save after delay
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleQuickSave();
    }, isMobile ? AUTO_SAVE_DELAY * 2 : AUTO_SAVE_DELAY);
  }, [currentFile, updateFile, updateTokenStats, isMobile]);

  const handleQuickSave = useCallback(async () => {
    setSavedStatus('saving');
    
    try {
      const snapshot = await snapshotManager.current.saveSnapshot({
        timestamp: new Date(),
        label: 'Auto-save',
        status: 'working',
        code,
        files: new Map([[currentFile, code]]),
        compressedSize: compressedCode.length,
        originalSize: code.length
      });
      
      addSnapshot(snapshot);
      setSavedStatus('saved');
      toast.success('Progress saved!', {
        icon: '💾',
        duration: 2000
      });
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save');
      setSavedStatus('unsaved');
    }
  }, [code, currentFile, compressedCode, addSnapshot]);

  const handleMilestoneSave = useCallback(async () => {
    const label = prompt('Name this milestone:');
    if (!label) return;
    
    try {
      const snapshot = await snapshotManager.current.saveSnapshot({
        timestamp: new Date(),
        label,
        status: 'working',
        code,
        files: new Map([[currentFile, code]]),
        compressedSize: compressedCode.length,
        originalSize: code.length,
        isMilestone: true
      });
      
      addSnapshot(snapshot);
      toast.success(`Milestone "${label}" saved!`, {
        icon: '📌',
        duration: 3000
      });
    } catch (error) {
      toast.error('Failed to save milestone');
    }
  }, [code, currentFile, compressedCode, addSnapshot]);

  const handleFormat = useCallback(async () => {
    if (editorRef.current) {
      await editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  const handlePanicRestore = useCallback(async () => {
    setPanicMode(true);
    
    try {
      const lastWorking = await snapshotManager.current.getLastWorkingSnapshot();
      if (lastWorking) {
        setCode(lastWorking.code);
        toast.success('Restored to last working version!', {
          icon: '✅',
          duration: 3000,
          style: {
            background: '#10B981',
            color: 'white',
          }
        });
      } else {
        toast.error('No working snapshot found');
      }
    } catch (error) {
      toast.error('Failed to restore');
    } finally {
      setTimeout(() => setPanicMode(false), 3000);
    }
  }, []);

  const handleClaudeResponse = useCallback(async (claudeCode: string) => {
    const beautified = await transformManager.current.onClaudeResponse(claudeCode);
    setCode(beautified);
    handleQuickSave();
  }, [handleQuickSave]);

  // ========== Keyboard Shortcuts ==========
  useKeyboardShortcuts({
    onSave: handleQuickSave,
    onMilestoneSave: handleMilestoneSave,
    onPanicRestore: handlePanicRestore,
    onFormat: handleFormat,
    onTogglePanel: (panel) => {
      if (panel === 'snapshots') {
        setShowSnapshots(!showSnapshots);
      }
    },
    onUndo: () => {
      if (editorRef.current) {
        editorRef.current.trigger('keyboard', 'undo');
      }
    },
    onRedo: () => {
      if (editorRef.current) {
        editorRef.current.trigger('keyboard', 'redo');
      }
    }
  });

  // Fix 2: Properly typed editor options with correct occurrencesHighlight value
  const editorOptions = useMemo(() => ({
    minimap: { enabled: !isMobile },
    fontSize: isMobile ? 12 : 14,
    formatOnPaste: !isMobile,
    formatOnType: !isMobile,
    automaticLayout: true,
    wordWrap: 'on' as const,
    scrollBeyondLastLine: false,
    smoothScrolling: !isMobile,
    cursorBlinking: 'smooth' as const,
    lineNumbers: isMobile ? 'off' as const : 'on' as const,
    folding: !isMobile,
    glyphMargin: !isMobile,
    renderLineHighlight: isMobile ? 'none' as const : 'all' as const,
    scrollbar: {
      vertical: 'auto' as const,
      horizontal: 'auto' as const,
      verticalScrollbarSize: isMobile ? 8 : 10,
      horizontalScrollbarSize: isMobile ? 8 : 10,
    },
    // Performance optimizations for mobile
    quickSuggestions: !isMobile,
    parameterHints: { enabled: !isMobile },
    suggestOnTriggerCharacters: !isMobile,
    hover: { enabled: !isMobile },
    // Fix: Use proper type for occurrencesHighlight
    occurrencesHighlight: isMobile ? 'off' as const : 'singleFile' as const,
    renderWhitespace: 'none' as const,
    renderControlCharacters: false,
    links: !isMobile,
    contextmenu: !isMobile,
  }), [isMobile]);

  // ========== Render ==========
  if (isInitializing) {
    return <LoadingOverlay message="Initializing ClaudeEditor..." />;
  }

  // Prepare components for mobile layout
  const fileTreeComponent = (
    <div className="h-full bg-gray-900 overflow-hidden">
      <FileTree onFileSelect={handleFileSelect} />
    </div>
  );

  const editorComponent = (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <span className="text-gray-400 text-sm truncate">{currentFile}</span>
        {isMobile && (
          <div className="flex gap-2">
            <button
              onClick={handleQuickSave}
              className={`px-3 py-1 rounded text-xs ${
                savedStatus === 'saved' 
                  ? 'bg-green-600' 
                  : savedStatus === 'saving'
                  ? 'bg-yellow-600'
                  : 'bg-blue-600 animate-pulse'
              } text-white`}
            >
              {savedStatus === 'saved' ? '✓' : savedStatus === 'saving' ? '...' : 'Save'}
            </button>
            <button
              onClick={handlePanicRestore}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs"
            >
              🆘
            </button>
          </div>
        )}
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          onMount={(editor) => {
            editorRef.current = editor;
            if (isMobile) {
              editor.updateOptions({
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
              });
            }
          }}
          loading={<EditorLoading />}
          options={editorOptions}
        />
      </div>
    </div>
  );

  const chatComponent = (
    <div className="h-full bg-gray-900 flex flex-col">
      <ChatPanel 
        compressedCode={compressedCode}
        currentCode={code}
        onCodeUpdate={handleClaudeResponse}
      />
    </div>
  );

  // Mobile layout
  if (isMobile || isTablet) {
    return (
      <div className="h-screen flex flex-col bg-gray-900">
        <MobileLayout>
          {{
            fileTree: fileTreeComponent,
            editor: editorComponent,
            chat: chatComponent
          }}
        </MobileLayout>
        {showSnapshots && <SnapshotPanel />}
        <SavingIndicator isVisible={savedStatus === 'saving'} />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Control Bar */}
      <ControlBar
        savedStatus={savedStatus}
        panicMode={panicMode}
        showShortcuts={showShortcuts}
        code={code}
        compressedCode={compressedCode}
        tokenStats={tokenStats}
        onQuickSave={handleQuickSave}
        onMilestoneSave={handleMilestoneSave}
        onPanicRestore={handlePanicRestore}
        onToggleShortcuts={() => setShowShortcuts(!showShortcuts)}
      />

      {/* Main Editor Layout */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* File Tree */}
        <Panel defaultSize={20} minSize={15}>
          <div className="h-full bg-gray-900 border-r border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FolderTree size={18} />
                Files
              </h3>
            </div>
            <FileTree onFileSelect={handleFileSelect} />
          </div>
        </Panel>
        
        <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors" />
        
        {/* Code Editor */}
        <Panel defaultSize={50}>
          <div className="h-full flex flex-col">
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
              <span className="text-gray-400 text-sm">{currentFile}</span>
            </div>
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={code}
              onChange={handleEditorChange}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              loading={<EditorLoading />}
              options={editorOptions}
            />
          </div>
        </Panel>
        
        <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors" />
        
        {/* Claude Chat Panel */}
        <Panel defaultSize={30} minSize={20}>
          <div className="h-full bg-gray-900 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <MessageSquare size={18} />
                AI Assistant
              </h3>
            </div>
            <ChatPanel 
              compressedCode={compressedCode}
              currentCode={code}
              onCodeUpdate={handleClaudeResponse}
            />
          </div>
        </Panel>
      </PanelGroup>
      
      {/* Status Bar */}
      <StatusBar 
        originalSize={code.length}
        compressedSize={compressedCode.length}
        savedStatus={savedStatus}
      />
      
      {/* Snapshot Timeline */}
      {showSnapshots && <SnapshotPanel />}
      
      {/* Saving Indicator */}
      <SavingIndicator isVisible={savedStatus === 'saving'} />
    </div>
  );
}

// ========== Sub Components ==========
interface ControlBarProps {
  savedStatus: 'saved' | 'unsaved' | 'saving';
  panicMode: boolean;
  showShortcuts: boolean;
  code: string;
  compressedCode: string;
  tokenStats: { saved: number };
  onQuickSave: () => void;
  onMilestoneSave: () => void;
  onPanicRestore: () => void;
  onToggleShortcuts: () => void;
}

function ControlBar({
  savedStatus,
  panicMode,
  showShortcuts,
  code,
  compressedCode,
  tokenStats,
  onQuickSave,
  onMilestoneSave,
  onPanicRestore,
  onToggleShortcuts,
}: ControlBarProps) {
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {/* Save Button */}
          <button
            onClick={onQuickSave}
            className={`px-4 py-2 rounded flex items-center gap-2 transition-all ${
              savedStatus === 'saved' 
                ? 'bg-green-600 hover:bg-green-700' 
                : savedStatus === 'saving'
                ? 'bg-yellow-600'
                : 'bg-blue-600 hover:bg-blue-700 animate-pulse'
            } text-white`}
          >
            <Save size={16} />
            <span className="hidden sm:inline">
              {savedStatus === 'saved' ? 'Saved' : savedStatus === 'saving' ? 'Saving...' : 'Save'}
            </span>
            <span className="kbd text-xs hidden lg:inline">⌘S</span>
          </button>
          
          {/* Milestone Button */}
          <button
            onClick={onMilestoneSave}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-2"
          >
            📌 <span className="hidden sm:inline">Milestone</span>
            <span className="kbd text-xs hidden lg:inline">⌘⇧S</span>
          </button>
          
          {/* Panic Button */}
          <button
            onClick={onPanicRestore}
            disabled={panicMode}
            className={`px-4 sm:px-6 py-2 rounded flex items-center gap-2 font-bold transition-all ${
              panicMode 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
            }`}
          >
            {panicMode ? (
              <>✅ <span className="hidden sm:inline">Restored!</span></>
            ) : (
              <>
                <AlertCircle size={16} className="hidden sm:inline" />
                🆘 <span className="hidden sm:inline">PANIC RESTORE</span>
                <span className="kbd text-xs hidden lg:inline">⌘⇧P</span>
              </>
            )}
          </button>
          
          {/* Shortcuts Button */}
          <button
            onClick={onToggleShortcuts}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-2"
          >
            <Keyboard size={16} />
            <span className="text-sm hidden sm:inline">Shortcuts</span>
          </button>
        </div>
        
        {/* Token Stats */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1 sm:gap-2 text-gray-400">
            <FileCode2 size={14} className="hidden sm:inline" />
            <span>{code.length.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-green-400">
            <Zap size={14} className="hidden sm:inline" />
            <span>{compressedCode.length.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-yellow-400">
            <span className="hidden sm:inline">💰</span> {tokenStats.saved}%
          </div>
        </div>
      </div>
      
      {/* Shortcuts Panel */}
      {showShortcuts && (
        <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-700 animate-slide-down">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {KEYBOARD_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.action} className="flex items-center gap-2">
                <span className="text-gray-500">{shortcut.icon}</span>
                <span className="kbd">{shortcut.keys.join(' + ')}</span>
                <span className="text-gray-400">→ {shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}