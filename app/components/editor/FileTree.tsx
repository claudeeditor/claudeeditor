'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Plus, Trash2, Edit2 } from 'lucide-react';
import { useEditorStore } from 'app/lib/stores/editorStore';
import toast from 'react-hot-toast';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  path: string;
}

interface FileTreeProps {
  onFileSelect: (path: string) => void;
}

export default function FileTree({ onFileSelect }: FileTreeProps) {
  const { files, currentFile, updateFile, deleteFile, setCurrentFile } = useEditorStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [forceUpdate, setForceUpdate] = useState(0);

  // Force re-render when files change
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      setForceUpdate(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  const buildFileTree = (): FileNode[] => {
    const root: FileNode[] = [];
    const folders: Map<string, FileNode> = new Map();
    const sortedFiles = Array.from(files.keys()).sort();

    sortedFiles.forEach(filePath => {
      const parts = filePath.split('/');
      const fileName = parts[parts.length - 1];

      if (parts.length === 1) {
        root.push({
          name: fileName,
          type: 'file',
          path: filePath,
        });
      } else {
        let currentLevel = root;
        let currentPath = '';

        for (let i = 0; i < parts.length - 1; i++) {
          const folderName = parts[i];
          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

          let folder = folders.get(currentPath);
          if (!folder) {
            folder = {
              name: folderName,
              type: 'folder',
              children: [],
              path: currentPath,
            };
            folders.set(currentPath, folder);
            currentLevel.push(folder);
          }
          currentLevel = folder.children!;
        }

        currentLevel.push({
          name: fileName,
          type: 'file',
          path: filePath,
        });
      }
    });

    return root;
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleNewFile = () => {
    const fileName = prompt('Enter file name (e.g., app.tsx, components/Button.tsx):');
    if (!fileName) return;

    if (files.has(fileName)) {
      toast.error('File already exists');
      return;
    }

    let initialContent = '// New file\n';
    if (fileName.endsWith('.tsx')) {
      const componentName = fileName.split('/').pop()?.replace('.tsx', '') || 'Component';
      initialContent = `export default function ${componentName}() {
  return (
    <div>
      {/* Your component */}
    </div>
  );
}`;
    } else if (fileName.endsWith('.ts')) {
      initialContent = '// TypeScript file\n';
    } else if (fileName.endsWith('.css')) {
      initialContent = '/* CSS file */\n';
    } else if (fileName.endsWith('.json')) {
      initialContent = '{\n  \n}';
    }

    // Update store and immediately select the file
    updateFile(fileName, initialContent);
    setCurrentFile(fileName);
    onFileSelect(fileName);
    
    toast.success(`Created ${fileName}`, { icon: '📄' });
  };

  const handleDeleteFile = (path: string) => {
    if (confirm(`Delete ${path}?`)) {
      deleteFile(path);
      if (currentFile === path) {
        const remainingFiles = Array.from(files.keys());
        if (remainingFiles.length > 0) {
          const newFile = remainingFiles[0];
          setCurrentFile(newFile);
          onFileSelect(newFile);
        }
      }
      toast.success(`Deleted ${path}`);
    }
  };

  const handleRenameFile = (oldPath: string) => {
    const newName = prompt('Enter new name:', oldPath);
    if (!newName || newName === oldPath) return;

    const content = files.get(oldPath);
    if (!content) return;

    deleteFile(oldPath);
    updateFile(newName, content);
    
    if (currentFile === oldPath) {
      setCurrentFile(newName);
      onFileSelect(newName);
    }
    
    toast.success(`Renamed to ${newName}`);
  };

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'folder') {
      toggleFolder(node.path);
    } else {
      console.log(`[FileTree] Selecting file: ${node.path}`);
      setCurrentFile(node.path);
      onFileSelect(node.path);
    }
  };

  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = currentFile === node.path;

    return (
      <div key={`${node.path}-${forceUpdate}`}>
        <div
          className={`
            flex items-center gap-2 px-2 py-1 hover:bg-gray-800 cursor-pointer group
            ${isSelected ? 'bg-blue-900/30 text-blue-400' : 'text-gray-300'}
          `}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {node.type === 'folder' ? (
            <>
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              <Folder size={14} />
            </>
          ) : (
            <>
              <div className="w-[14px]" />
              <File size={14} />
            </>
          )}
          <span className="flex-1 text-sm truncate">{node.name}</span>
          {node.type === 'file' && (
            <div className="hidden group-hover:flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameFile(node.path);
                }}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFile(node.path);
                }}
                className="p-1 hover:bg-red-700 rounded"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const fileTree = buildFileTree();

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-2 border-b border-gray-700">
        <button
          onClick={handleNewFile}
          className="w-full px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm flex items-center gap-2 transition-colors"
        >
          <Plus size={14} />
          <span>New File</span>
        </button>
      </div>
      
      <div className="p-2">
        {fileTree.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-4">
            No files yet. Click "New File" to create one.
          </div>
        ) : (
          fileTree.map(node => renderNode(node))
        )}
      </div>
    </div>
  );
}