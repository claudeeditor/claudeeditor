// app/hooks/useMobileView.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from 'app/lib/stores/editorStore';

interface MobileViewConfig {
  isMobile: boolean;
  isTablet: boolean;
  viewMode: 'auto' | 'manual';
  forcedView: 'desktop' | 'mobile' | null;
  activePanel: 'files' | 'editor' | 'chat';
  screenWidth: number;
  screenHeight: number;
}

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useMobileView() {
  const [config, setConfig] = useState<MobileViewConfig>({
    isMobile: false,
    isTablet: false,
    viewMode: 'auto',
    forcedView: null,
    activePanel: 'editor',
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1920,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 1080
  });

  // Detect device type and screen size
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateScreenSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setConfig(prev => {
        // If in manual mode and forced view is set, keep it
        if (prev.viewMode === 'manual' && prev.forcedView) {
          return {
            ...prev,
            screenWidth: width,
            screenHeight: height,
            isMobile: prev.forcedView === 'mobile',
            isTablet: false
          };
        }
        
        // Auto mode - detect based on screen size
        const isMobile = width < MOBILE_BREAKPOINT;
        const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
        
        return {
          ...prev,
          screenWidth: width,
          screenHeight: height,
          isMobile,
          isTablet
        };
      });
    };

    // Initial detection
    updateScreenSize();

    // Add resize listener
    window.addEventListener('resize', updateScreenSize);
    
    // Check for touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (hasTouch) {
      document.body.classList.add('touch-device');
    }

    return () => {
      window.removeEventListener('resize', updateScreenSize);
    };
  }, []);

  // Load saved preferences from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedPreferences = localStorage.getItem('claudeeditor-view-preferences');
    if (savedPreferences) {
      try {
        const prefs = JSON.parse(savedPreferences);
        setConfig(prev => ({
          ...prev,
          viewMode: prefs.viewMode || 'auto',
          forcedView: prefs.forcedView || null
        }));
      } catch (error) {
        console.error('Failed to load view preferences:', error);
      }
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((viewMode: 'auto' | 'manual', forcedView: 'desktop' | 'mobile' | null) => {
    const prefs = { viewMode, forcedView };
    localStorage.setItem('claudeeditor-view-preferences', JSON.stringify(prefs));
  }, []);

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    setConfig(prev => {
      const newMode = prev.viewMode === 'auto' ? 'manual' : 'auto';
      const newForcedView = newMode === 'manual' ? (prev.isMobile ? 'mobile' : 'desktop') : null;
      
      savePreferences(newMode, newForcedView);
      
      return {
        ...prev,
        viewMode: newMode,
        forcedView: newForcedView,
        isMobile: newMode === 'manual' && newForcedView === 'mobile' ? true : prev.screenWidth < MOBILE_BREAKPOINT
      };
    });
  }, [savePreferences]);

  // Force specific view (only works in manual mode)
  const forceView = useCallback((view: 'desktop' | 'mobile') => {
    setConfig(prev => {
      if (prev.viewMode !== 'manual') {
        // Switch to manual mode first
        savePreferences('manual', view);
        return {
          ...prev,
          viewMode: 'manual',
          forcedView: view,
          isMobile: view === 'mobile'
        };
      }
      
      savePreferences('manual', view);
      return {
        ...prev,
        forcedView: view,
        isMobile: view === 'mobile'
      };
    });
  }, [savePreferences]);

  // Switch active panel (for mobile view)
  const switchPanel = useCallback((panel: 'files' | 'editor' | 'chat') => {
    setConfig(prev => ({
      ...prev,
      activePanel: panel
    }));
  }, []);

  // Get panel visibility based on current view
  const getPanelVisibility = useCallback(() => {
    if (!config.isMobile) {
      // Desktop view - all panels visible
      return {
        files: true,
        editor: true,
        chat: true
      };
    }
    
    // Mobile view - only active panel visible
    return {
      files: config.activePanel === 'files',
      editor: config.activePanel === 'editor',
      chat: config.activePanel === 'chat'
    };
  }, [config.isMobile, config.activePanel]);

  // Get recommended layout based on screen size
  const getLayoutRecommendation = useCallback(() => {
    if (config.screenWidth < 640) {
      return 'single-panel'; // Phone
    } else if (config.screenWidth < MOBILE_BREAKPOINT) {
      return 'stacked'; // Large phone/small tablet
    } else if (config.screenWidth < TABLET_BREAKPOINT) {
      return 'two-panel'; // Tablet
    }
    return 'three-panel'; // Desktop
  }, [config.screenWidth]);

  return {
    ...config,
    toggleViewMode,
    forceView,
    switchPanel,
    getPanelVisibility,
    getLayoutRecommendation,
    isDesktop: !config.isMobile && !config.isTablet,
    isTouchDevice: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  };
}