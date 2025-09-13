'use client'
import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state to show fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log error to console (you can send to error tracking service)
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Save error details for display
    this.setState({
      error,
      errorInfo
    });
    
    // Auto-save to localStorage for recovery
    try {
      const editorData = localStorage.getItem('claudeeditor-autosave');
      if (editorData) {
        localStorage.setItem('claudeeditor-backup-after-crash', editorData);
      }
    } catch (e) {
      console.error('Failed to backup data:', e);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Force reload the page
    window.location.reload();
  };

  handleSoftReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-gray-800 rounded-lg shadow-2xl p-8 border border-red-500/20">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertCircle className="text-red-500" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
                <p className="text-gray-400 text-sm">Don't worry, your code has been backed up</p>
              </div>
            </div>

            {/* Error Message */}
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <p className="text-red-400 font-mono text-sm mb-2">
                {this.state.error?.toString()}
              </p>
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-400 text-sm">
                    Show technical details
                  </summary>
                  <pre className="mt-2 text-xs text-gray-500 overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Recovery Actions */}
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={18} />
                Reload Application
              </button>
              
              <button
                onClick={this.handleSoftReset}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Home size={18} />
                Try Again
              </button>
            </div>

            {/* Help Message */}
            <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-blue-400 text-sm">
                💡 <strong>Tip:</strong> Your work has been automatically saved. 
                After reloading, you can restore it from the snapshot panel.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}