// components/editor/SnapshotPanel.tsx
'use client';
import { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Download, Upload, Trash2, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from 'app/lib/stores/editorStore';
import { SnapshotManager } from 'app/lib/storage/snapshots';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function SnapshotPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const { snapshots, currentSnapshotId, setCurrentSnapshot } = useEditorStore();
  const snapshotManager = new SnapshotManager();

  const handleRestore = async (snapshotId: string) => {
    try {
      const snapshot = await snapshotManager.restoreSnapshot(snapshotId);
      setCurrentSnapshot(snapshotId);
      
      // Emit event to update editor
      window.dispatchEvent(new CustomEvent('restore-snapshot', { 
        detail: snapshot 
      }));
      
      toast.success('Snapshot restored!', {
        icon: '✅',
        duration: 3000,
      });
    } catch (error) {
      toast.error('Failed to restore snapshot');
    }
  };

  const handleDelete = async (snapshotId: string) => {
    if (!confirm('Delete this snapshot?')) return;
    
    try {
      await snapshotManager.deleteSnapshot(snapshotId);
      
      // Update store
      window.dispatchEvent(new CustomEvent('delete-snapshot', { 
        detail: { id: snapshotId } 
      }));
      
      toast.success('Snapshot deleted');
    } catch (error) {
      toast.error('Failed to delete snapshot');
    }
  };

  const handleExport = async () => {
    try {
      const json = await snapshotManager.exportSnapshots();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claudeeditor-snapshots-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Snapshots exported!');
    } catch (error) {
      toast.error('Failed to export snapshots');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const count = await snapshotManager.importSnapshots(text);
        
        toast.success(`Imported ${count} snapshots!`);
        
        // Refresh snapshots
        window.location.reload();
      } catch (error) {
        toast.error('Failed to import snapshots');
      }
    };
    
    input.click();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'broken':
        return <XCircle size={14} className="text-red-500" />;
      case 'testing':
        return <AlertCircle size={14} className="text-yellow-500" />;
      default:
        return <Clock size={14} className="text-gray-500" />;
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-20 right-4 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg shadow-lg flex items-center gap-2"
      >
        <Clock size={20} />
        <span className="text-sm">Snapshots ({snapshots.length})</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 w-96 max-h-[60vh] bg-gray-900 border border-gray-700 rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Clock size={18} />
          Snapshot Timeline
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="p-1 hover:bg-gray-800 rounded"
            title="Export snapshots"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleImport}
            className="p-1 hover:bg-gray-800 rounded"
            title="Import snapshots"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <EyeOff size={16} />
          </button>
        </div>
      </div>

      {/* Snapshot List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {snapshots.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No snapshots yet
          </div>
        ) : (
          snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className={`
                p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition-colors
                ${currentSnapshotId === snapshot.id ? 'ring-2 ring-blue-500' : ''}
              `}
              onClick={() => setSelectedSnapshot(
                selectedSnapshot === snapshot.id ? null : snapshot.id
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  {getStatusIcon(snapshot.status)}
                  <div className="flex-1">
                    <div className="font-medium text-sm text-white">
                      {snapshot.label}
                    </div>
                    <div className="text-xs text-gray-400">
                      {format(new Date(snapshot.timestamp), 'MMM d, HH:mm:ss')}
                    </div>
                    {snapshot.isMilestone && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-purple-900/50 text-purple-400 text-xs rounded">
                        Milestone
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(snapshot.originalSize / 1024)}KB
                </div>
              </div>

              {/* Expanded Actions */}
              {selectedSnapshot === snapshot.id && (
                <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(snapshot.id);
                    }}
                    className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                  >
                    Restore
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(snapshot.id);
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}