import dynamic from 'next/dynamic';
import ClientWrapper from './components/ClientWrapper';

// Dynamic import with SSR disabled to prevent hydration issues
const CodeEditor = dynamic(
  () => import('./components/editor/CodeEditor'),
  { 
    ssr: false,
    loading: () => <EditorLoadingScreen />
  }
);

// Loading screen component
function EditorLoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 text-white">
          <svg 
            className="animate-spin h-8 w-8 text-blue-500" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <div>
            <div className="text-xl font-semibold">Initializing ClaudeEditor</div>
            <div className="text-sm text-gray-400 mt-1">Setting up your safe coding environment...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ClientWrapper>
      <CodeEditor />
    </ClientWrapper>
  );
}