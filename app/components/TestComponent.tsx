'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function TestComponent() {
  const [count, setCount] = useState(0);
  const [testMessage, setTestMessage] = useState('');
  const [apiResponse, setApiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. 基本的なReact機能のテスト
  const handleCountTest = () => {
    setCount(prev => prev + 1);
    toast.success(`Count: ${count + 1}`);
  };

  // 2. Zustand Store のテスト
  const handleStoreTest = () => {
    try {
      const { useEditorStore } = require('app/lib/stores/editorStore');
      const store = useEditorStore.getState();
      const files = Array.from(store.files.keys());
      setTestMessage(`Files in store: ${files.join(', ')}`);
      toast.success('Store accessed successfully');
    } catch (error) {
      console.error('Store error:', error);
      toast.error('Store error: ' + error.message);
    }
  };

  // 3. Claude API のテスト
  const handleApiTest = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Say "Hello from API test"' }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setApiResponse(data.content || 'No content received');
      toast.success('API test successful');
    } catch (error) {
      console.error('API test error:', error);
      setApiResponse('Error: ' + error.message);
      toast.error('API test failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. ファイル操作のテスト
  const handleFileTest = () => {
    try {
      const { useEditorStore } = require('app/lib/stores/editorStore');
      const store = useEditorStore.getState();
      
      // テストファイルを作成
      store.updateFile('test.txt', 'Test content');
      
      // ファイルを取得
      const content = store.files.get('test.txt');
      
      if (content === 'Test content') {
        setTestMessage('File operation successful: test.txt created');
        toast.success('File test passed');
      } else {
        throw new Error('File content mismatch');
      }
    } catch (error) {
      console.error('File test error:', error);
      toast.error('File test failed');
    }
  };

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-8">System Diagnostics</h1>
      
      <div className="space-y-6">
        {/* React Test */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">1. React State Test</h2>
          <button
            onClick={handleCountTest}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
          >
            Test Counter: {count}
          </button>
        </div>

        {/* Store Test */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">2. Zustand Store Test</h2>
          <button
            onClick={handleStoreTest}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
          >
            Test Store Access
          </button>
          {testMessage && (
            <div className="mt-2 p-2 bg-gray-700 rounded text-sm">
              {testMessage}
            </div>
          )}
        </div>

        {/* File Test */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">3. File Operations Test</h2>
          <button
            onClick={handleFileTest}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
          >
            Test File Operations
          </button>
        </div>

        {/* API Test */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">4. Claude API Test</h2>
          <button
            onClick={handleApiTest}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test API'}
          </button>
          {apiResponse && (
            <div className="mt-2 p-2 bg-gray-700 rounded text-sm">
              API Response: {apiResponse}
            </div>
          )}
        </div>

        {/* Environment Info */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">5. Environment Info</h2>
          <div className="text-sm space-y-1">
            <div>Node Env: {process.env.NODE_ENV}</div>
            <div>API Key Set: {process.env.CLAUDE_API_KEY ? 'Yes (hidden)' : 'No'}</div>
            <div>Browser: {typeof window !== 'undefined' ? navigator.userAgent.slice(0, 50) + '...' : 'SSR'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}