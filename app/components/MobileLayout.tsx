// app/components/MobileLayout.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FolderTree, MessageSquare, Code, Menu, X, Monitor, Smartphone, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMobileView } from 'app/hooks/useMobileView';
import toast from 'react-hot-toast';

interface MobileLayoutProps {
  children: {
    fileTree: React.ReactNode;
    editor: React.ReactNode;
    chat: React.ReactNode;
  };
}

// Swipe Indicator Component
interface SwipeIndicatorProps {
  visible: boolean;
  direction: 'left' | 'right' | null;
  offset: number;
}

function SwipeIndicator({ visible, direction, offset }: SwipeIndicatorProps) {
  if (!visible || !direction) return null;

  return (
    <div 
      className={`absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none transition-opacity ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        [direction === 'left' ? 'right' : 'left']: '20px',
        transform: `translateY(-50%) translateX(${offset}px)`
      }}
    >
      <div className="bg-blue-500/20 backdrop-blur-sm rounded-full p-3">
        {direction === 'left' ? <ChevronLeft size={32} /> : <ChevronRight size={32} />}
      </div>
    </div>
  );
}

export default function MobileLayout({ children }: MobileLayoutProps) {
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

  const [showMenu, setShowMenu] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const visibility = getPanelVisibility();
  const layoutType = getLayoutRecommendation();

  // New states for swipe functionality
  const panels: Array<'files' | 'editor' | 'chat'> = ['files', 'editor', 'chat'];
  const [currentPanelIndex, setCurrentPanelIndex] = useState(() => 
    panels.indexOf(activePanel)
  );
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [swipeIndicator, setSwipeIndicator] = useState<SwipeIndicatorProps>({
    visible: false,
    direction: null,
    offset: 0
  });

  // Touch handling for swipe
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  // Update panel index when activePanel changes
  useEffect(() => {
    setCurrentPanelIndex(panels.indexOf(activePanel));
  }, [activePanel]);

  // Auto-hide menu when switching panels
  useEffect(() => {
    setShowMenu(false);
  }, [activePanel]);

  // Handle keyboard shortcuts for panel switching
  useEffect(() => {
    if (!isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            switchPanel('files');
            break;
          case '2':
            e.preventDefault();
            switchPanel('editor');
            break;
          case '3':
            e.preventDefault();
            switchPanel('chat');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, switchPanel]);

  // Swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Determine if this is a horizontal swipe
    if (!isSwiping.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwiping.current = true;
    }

    if (isSwiping.current) {
      // Show swipe indicator
      const direction = deltaX > 0 ? 'left' : 'right';
      const canSwipe = (direction === 'left' && currentPanelIndex > 0) || 
                       (direction === 'right' && currentPanelIndex < panels.length - 1);
      
      if (canSwipe && Math.abs(deltaX) > 30) {
        setSwipeIndicator({
          visible: true,
          direction,
          offset: Math.min(Math.abs(deltaX) * 0.3, 50)
        });
      }
    }
  }, [currentPanelIndex]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    
    // Hide swipe indicator
    setSwipeIndicator({ visible: false, direction: null, offset: 0 });

    if (isSwiping.current && Math.abs(deltaX) > 100) {
      if (deltaX > 0 && currentPanelIndex > 0) {
        // Swipe right - go to previous panel
        switchPanel(panels[currentPanelIndex - 1]);
        toast(`Switched to ${panels[currentPanelIndex - 1]}`, { icon: '👈' });
      } else if (deltaX < 0 && currentPanelIndex < panels.length - 1) {
        // Swipe left - go to next panel
        switchPanel(panels[currentPanelIndex + 1]);
        toast(`Switched to ${panels[currentPanelIndex + 1]}`, { icon: '👉' });
      }
    }
    
    isSwiping.current = false;
  }, [currentPanelIndex, switchPanel]);

  // Desktop layout
  if (!isMobile && !isTablet) {
    return (
      <>
        {/* View Mode Toggle for Desktop */}
        <div className="fixed bottom-4 left-4 z-40">
          <button
            onClick={() => setShowViewOptions(!showViewOptions)}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg"
            title="View Options"
          >
            <Settings size={20} />
          </button>
          
          {showViewOptions && (
            <div className="absolute bottom-14 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 min-w-[200px]">
              <div className="space-y-3">
                <div className="text-sm text-gray-400 font-medium">View Mode</div>
                
                <button
                  onClick={toggleViewMode}
                  className={`w-full px-3 py-2 rounded text-sm flex items-center justify-between ${
                    viewMode === 'auto' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span>Auto-detect</span>
                  {viewMode === 'auto' && '✓'}
                </button>
                
                {viewMode === 'manual' && (
                  <div className="space-y-2 pt-2 border-t border-gray-700">
                    <button
                      onClick={() => forceView('desktop')}
                      className={`w-full px-3 py-2 rounded text-sm flex items-center gap-2 ${
                        forcedView === 'desktop'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Monitor size={16} />
                      Desktop View
                    </button>
                    
                    <button
                      onClick={() => forceView('mobile')}
                      className={`w-full px-3 py-2 rounded text-sm flex items-center gap-2 ${
                        forcedView === 'mobile'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Smartphone size={16} />
                      Mobile View
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Desktop three-panel layout */}
        <div className="flex h-full">
          <div className="w-64 border-r border-gray-700">{children.fileTree}</div>
          <div className="flex-1">{children.editor}</div>
          <div className="w-96 border-l border-gray-700">{children.chat}</div>
        </div>
      </>
    );
  }

  // Tablet layout (two panels)
  if (isTablet) {
    return (
      <div className="flex h-full">
        {activePanel !== 'chat' && (
          <div className="w-64 border-r border-gray-700">{children.fileTree}</div>
        )}
        <div className="flex-1">
          {activePanel === 'chat' ? children.chat : children.editor}
        </div>
        {/* Floating panel switcher */}
        <div className="fixed bottom-4 right-4 flex gap-2 z-40">
          <button
            onClick={() => switchPanel(activePanel === 'chat' ? 'editor' : 'chat')}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg"
          >
            {activePanel === 'chat' ? <Code size={20} /> : <MessageSquare size={20} />}
          </button>
        </div>
      </div>
    );
  }

  // Mobile layout (single panel with navigation)
  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Mobile Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          {showMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
        
        <div className="text-white font-semibold flex items-center gap-2">
          {/* Panel indicator dots */}
          <div className="flex gap-1 mr-2">
            {panels.map((panel, index) => (
              <div
                key={panel}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentPanelIndex ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
          
          {activePanel === 'files' && 'Files'}
          {activePanel === 'editor' && 'Code'}
          {activePanel === 'chat' && 'AI Assistant'}
        </div>
        
        <button
          onClick={() => setShowViewOptions(!showViewOptions)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* View Options Dropdown */}
      {showViewOptions && (
        <div className="absolute top-14 right-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 z-50 min-w-[200px]">
          <div className="space-y-3">
            <div className="text-sm text-gray-400 font-medium">View Mode</div>
            
            <button
              onClick={() => {
                toggleViewMode();
                setShowViewOptions(false);
                toast(viewMode === 'auto' ? 'Manual mode' : 'Auto mode', { icon: '📱' });
              }}
              className={`w-full px-3 py-2 rounded text-sm flex items-center justify-between ${
                viewMode === 'auto' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <span>{viewMode === 'auto' ? 'Auto-detect' : 'Manual'}</span>
            </button>
            
            {viewMode === 'manual' && (
              <div className="space-y-2 pt-2 border-t border-gray-700">
                <button
                  onClick={() => {
                    forceView('desktop');
                    setShowViewOptions(false);
                    toast('Switched to desktop view', { icon: '🖥️' });
                  }}
                  className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm flex items-center gap-2"
                >
                  <Monitor size={16} />
                  Force Desktop
                </button>
              </div>
            )}
            
            <div className="pt-2 border-t border-gray-700 text-xs text-gray-500">
              <div>Swipe left/right to navigate</div>
              <div>Double tap for fullscreen</div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {showMenu && (
        <div className="absolute inset-0 bg-black/50 z-40" onClick={() => setShowMenu(false)}>
          <div 
            className="w-72 h-full bg-gray-800 shadow-xl animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Navigation</h2>
            </div>
            
            <nav className="p-4 space-y-2">
              <button
                onClick={() => {
                  switchPanel('files');
                  setShowMenu(false);
                }}
                className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                  activePanel === 'files' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <FolderTree size={20} />
                <span>Files</span>
                <span className="ml-auto text-xs opacity-70">Ctrl+1</span>
              </button>
              
              <button
                onClick={() => {
                  switchPanel('editor');
                  setShowMenu(false);
                }}
                className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                  activePanel === 'editor' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Code size={20} />
                <span>Code Editor</span>
                <span className="ml-auto text-xs opacity-70">Ctrl+2</span>
              </button>
              
              <button
                onClick={() => {
                  switchPanel('chat');
                  setShowMenu(false);
                }}
                className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                  activePanel === 'chat' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <MessageSquare size={20} />
                <span>AI Assistant</span>
                <span className="ml-auto text-xs opacity-70">Ctrl+3</span>
              </button>
            </nav>
            
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
              <div className="text-xs text-gray-500 text-center">
                {viewMode === 'auto' ? 'Auto-detect mode' : 'Manual mode'}
              </div>
              <div className="text-xs text-gray-500 text-center mt-1">
                Swipe to navigate panels
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area with Swipe Support */}
      <main 
        ref={mainContentRef} 
        className="flex-1 overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe hint arrows */}
        {isMobile && !showMenu && (
          <>
            {currentPanelIndex > 0 && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <ChevronLeft size={24} className="text-gray-600 animate-pulse" />
              </div>
            )}
            {currentPanelIndex < panels.length - 1 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <ChevronRight size={24} className="text-gray-600 animate-pulse" />
              </div>
            )}
          </>
        )}
        
        {/* Panel content with transition */}
        <div className="h-full transition-transform duration-300 ease-out">
          {visibility.files && children.fileTree}
          {visibility.editor && children.editor}
          {visibility.chat && children.chat}
        </div>
        
        {/* Swipe Indicator */}
        <SwipeIndicator {...swipeIndicator} />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bg-gray-800 border-t border-gray-700 px-2 py-2 flex justify-around">
        <button
          onClick={() => switchPanel('files')}
          className={`flex-1 py-3 rounded-lg flex flex-col items-center gap-1 transition-colors ${
            activePanel === 'files' 
              ? 'bg-gray-700 text-blue-400' 
              : 'text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <FolderTree size={20} />
          <span className="text-xs">Files</span>
        </button>
        
        <button
          onClick={() => switchPanel('editor')}
          className={`flex-1 py-3 rounded-lg flex flex-col items-center gap-1 transition-colors ${
            activePanel === 'editor' 
              ? 'bg-gray-700 text-blue-400' 
              : 'text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <Code size={20} />
          <span className="text-xs">Code</span>
        </button>
        
        <button
          onClick={() => switchPanel('chat')}
          className={`flex-1 py-3 rounded-lg flex flex-col items-center gap-1 transition-colors ${
            activePanel === 'chat' 
              ? 'bg-gray-700 text-blue-400' 
              : 'text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <MessageSquare size={20} />
          <span className="text-xs">Chat</span>
        </button>
      </nav>
    </div>
  );
}