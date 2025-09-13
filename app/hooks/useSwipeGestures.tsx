// app/hooks/useSwipeGestures.ts
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import React from 'react'; // Fix: Add React import for JSX

interface SwipeGestureConfig {
  threshold: number; // Minimum distance for swipe
  restraint: number; // Maximum distance perpendicular to swipe
  allowedTime: number; // Maximum time for swipe
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  distX: number;
  distY: number;
  startTime: number;
  elapsedTime: number;
  isActive: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}

const DEFAULT_CONFIG: SwipeGestureConfig = {
  threshold: 75,
  restraint: 100,
  allowedTime: 500,
  enabled: true
};

export function useSwipeGestures(
  elementRef: React.RefObject<HTMLElement>,
  config: Partial<SwipeGestureConfig> = {}
) {
  const [touchState, setTouchState] = useState<TouchState>({
    startX: 0,
    startY: 0,
    distX: 0,
    distY: 0,
    startTime: 0,
    elapsedTime: 0,
    isActive: false,
    direction: null
  });

  const [swipeIndicator, setSwipeIndicator] = useState({
    visible: false,
    direction: null as 'left' | 'right' | 'up' | 'down' | null,
    progress: 0
  });

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const lastTapRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout>();

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!finalConfig.enabled) return;

    const touch = e.touches[0];
    const startTime = Date.now();
    
    touchStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
      time: startTime
    };

    setTouchState({
      startX: touch.pageX,
      startY: touch.pageY,
      distX: 0,
      distY: 0,
      startTime,
      elapsedTime: 0,
      isActive: true,
      direction: null
    });

    // Check for double tap
    const timeSinceLastTap = startTime - lastTapRef.current;
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      if (finalConfig.onDoubleTap) {
        finalConfig.onDoubleTap();
        e.preventDefault();
      }
    }
    lastTapRef.current = startTime;

    // Setup long press detection
    if (finalConfig.onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        finalConfig.onLongPress!();
        setTouchState(prev => ({ ...prev, isActive: false }));
      }, 500);
    }
  }, [finalConfig]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!finalConfig.enabled || !touchState.isActive) return;

    const touch = e.touches[0];
    const distX = touch.pageX - touchStartRef.current.x;
    const distY = touch.pageY - touchStartRef.current.y;
    
    // Clear long press timer if moved
    if (Math.abs(distX) > 10 || Math.abs(distY) > 10) {
      clearTimeout(longPressTimerRef.current);
    }

    // Determine swipe direction
    let direction: 'left' | 'right' | 'up' | 'down' | null = null;
    let progress = 0;

    if (Math.abs(distX) > Math.abs(distY)) {
      // Horizontal swipe
      if (Math.abs(distX) > 30) {
        direction = distX < 0 ? 'left' : 'right';
        progress = Math.min(Math.abs(distX) / finalConfig.threshold, 1);
      }
    } else {
      // Vertical swipe
      if (Math.abs(distY) > 30) {
        direction = distY < 0 ? 'up' : 'down';
        progress = Math.min(Math.abs(distY) / finalConfig.threshold, 1);
      }
    }

    setTouchState(prev => ({
      ...prev,
      distX,
      distY,
      direction
    }));

    // Update swipe indicator
    if (direction) {
      setSwipeIndicator({
        visible: true,
        direction,
        progress
      });
    }
  }, [finalConfig, touchState.isActive]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!finalConfig.enabled || !touchState.isActive) return;

    clearTimeout(longPressTimerRef.current);
    
    const elapsedTime = Date.now() - touchStartRef.current.time;
    const { distX, distY } = touchState;
    
    setTouchState(prev => ({ ...prev, isActive: false }));
    setSwipeIndicator({ visible: false, direction: null, progress: 0 });

    // Check if it's a tap
    if (Math.abs(distX) < 10 && Math.abs(distY) < 10 && elapsedTime < 200) {
      if (finalConfig.onTap) {
        finalConfig.onTap();
      }
      return;
    }

    // Check if it's a valid swipe
    if (elapsedTime <= finalConfig.allowedTime) {
      // Horizontal swipe
      if (Math.abs(distX) >= finalConfig.threshold && Math.abs(distY) <= finalConfig.restraint) {
        if (distX < 0 && finalConfig.onSwipeLeft) {
          finalConfig.onSwipeLeft();
          e.preventDefault();
        } else if (distX > 0 && finalConfig.onSwipeRight) {
          finalConfig.onSwipeRight();
          e.preventDefault();
        }
      }
      
      // Vertical swipe
      else if (Math.abs(distY) >= finalConfig.threshold && Math.abs(distX) <= finalConfig.restraint) {
        if (distY < 0 && finalConfig.onSwipeUp) {
          finalConfig.onSwipeUp();
          e.preventDefault();
        } else if (distY > 0 && finalConfig.onSwipeDown) {
          finalConfig.onSwipeDown();
          e.preventDefault();
        }
      }
    }
  }, [finalConfig, touchState]);

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    clearTimeout(longPressTimerRef.current);
    setTouchState(prev => ({ ...prev, isActive: false }));
    setSwipeIndicator({ visible: false, direction: null, progress: 0 });
  }, []);

  // Setup event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Passive event listeners for better performance
    const options = { passive: false };
    
    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchmove', handleTouchMove, options);
    element.addEventListener('touchend', handleTouchEnd, options);
    element.addEventListener('touchcancel', handleTouchCancel, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      clearTimeout(longPressTimerRef.current);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    touchState,
    swipeIndicator,
    isSwipeActive: touchState.isActive,
    currentDirection: touchState.direction
  };
}

// Swipe gesture indicator component
export function SwipeIndicator({ 
  direction, 
  progress, 
  visible 
}: { 
  direction: 'left' | 'right' | 'up' | 'down' | null;
  progress: number;
  visible: boolean;
}) {
  if (!visible || !direction) return null;

  const getTransform = () => {
    switch (direction) {
      case 'left':
        return `translateX(-${progress * 50}px)`;
      case 'right':
        return `translateX(${progress * 50}px)`;
      case 'up':
        return `translateY(-${progress * 50}px)`;
      case 'down':
        return `translateY(${progress * 50}px)`;
      default:
        return 'none';
    }
  };

  const getArrow = () => {
    switch (direction) {
      case 'left': return '←';
      case 'right': return '→';
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '';
    }
  };

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
      style={{ 
        opacity: progress * 0.8,
        transform: getTransform(),
        transition: 'none'
      }}
    >
      <div className="bg-white/20 backdrop-blur-sm rounded-full p-8 shadow-2xl">
        <div className="text-6xl text-white animate-pulse">
          {getArrow()}
        </div>
      </div>
    </div>
  );
}