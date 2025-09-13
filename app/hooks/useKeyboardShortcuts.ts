import { useEffect } from 'react';
import toast from 'react-hot-toast';

interface ShortcutHandlers {
  onSave?: () => void;
  onMilestoneSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSendToClaude?: () => void;
  onTogglePanel?: (panel: 'files' | 'chat' | 'snapshots') => void;
  onPanicRestore?: () => void;
  onSearch?: () => void;
  onFormat?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = 
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true';

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Save (Cmd/Ctrl + S)
      if (isCtrlOrCmd && e.key === 's') {
        e.preventDefault();
        handlers.onSave?.();
        toast.success('Saved!', { duration: 1000, icon: '💾' });
        return;
      }

      // Milestone Save (Cmd/Ctrl + Shift + S)
      if (isCtrlOrCmd && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handlers.onMilestoneSave?.();
        return;
      }

      // Send to Claude (Cmd/Ctrl + Enter)
      if (isCtrlOrCmd && e.key === 'Enter') {
        if (document.activeElement?.getAttribute('data-chat-input') === 'true') {
          e.preventDefault();
          handlers.onSendToClaude?.();
          return;
        }
      }

      // Don't process other shortcuts if in input field
      if (isInputActive && !isCtrlOrCmd) return;

      // Undo (Cmd/Ctrl + Z)
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handlers.onUndo?.();
        toast('Undo', { duration: 800, icon: '↶' });
        return;
      }

      // Redo (Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y)
      if ((isCtrlOrCmd && e.shiftKey && e.key === 'Z') || (isCtrlOrCmd && e.key === 'y')) {
        e.preventDefault();
        handlers.onRedo?.();
        toast('Redo', { duration: 800, icon: '↷' });
        return;
      }

      // Panic Restore (Cmd/Ctrl + Shift + P)
      if (isCtrlOrCmd && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        handlers.onPanicRestore?.();
        return;
      }

      // Search (Cmd/Ctrl + F) - Allow default browser search
      if (isCtrlOrCmd && e.key === 'f') {
        return;
      }

      // Format Code (Cmd/Ctrl + Shift + F)
      if (isCtrlOrCmd && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handlers.onFormat?.();
        toast('Code formatted', { duration: 800, icon: '✨' });
        return;
      }

      // Toggle Files (Cmd/Ctrl + B)
      if (isCtrlOrCmd && e.key === 'b') {
        e.preventDefault();
        handlers.onTogglePanel?.('files');
        return;
      }

      // Toggle Chat (Cmd/Ctrl + J)
      if (isCtrlOrCmd && e.key === 'j') {
        e.preventDefault();
        handlers.onTogglePanel?.('chat');
        return;
      }

      // Toggle Snapshots (Cmd/Ctrl + K)
      if (isCtrlOrCmd && e.key === 'k') {
        e.preventDefault();
        handlers.onTogglePanel?.('snapshots');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Removed automatic shortcut toast on first visit
    // Users can still see shortcuts via the Shortcuts button

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers]);
}

export const KEYBOARD_SHORTCUTS = [
  { keys: ['Cmd/Ctrl', 'S'], action: 'Save', icon: '💾' },
  { keys: ['Cmd/Ctrl', 'Shift', 'S'], action: 'Milestone Save', icon: '📌' },
  { keys: ['Cmd/Ctrl', 'Enter'], action: 'Send to Claude', icon: '🤖' },
  { keys: ['Cmd/Ctrl', 'Z'], action: 'Undo', icon: '↶' },
  { keys: ['Cmd/Ctrl', 'Shift', 'Z'], action: 'Redo', icon: '↷' },
  { keys: ['Cmd/Ctrl', 'Shift', 'P'], action: 'Panic Restore', icon: '🆘' },
  { keys: ['Cmd/Ctrl', 'Shift', 'F'], action: 'Format Code', icon: '✨' },
  { keys: ['Cmd/Ctrl', 'B'], action: 'Toggle Files', icon: '📁' },
  { keys: ['Cmd/Ctrl', 'J'], action: 'Toggle Chat', icon: '💬' },
  { keys: ['Cmd/Ctrl', 'K'], action: 'Toggle Snapshots', icon: '📸' },
];