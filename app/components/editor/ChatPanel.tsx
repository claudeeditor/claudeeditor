'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader, AlertCircle, Sparkles, Mic, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { ClaudeAPI } from 'app/lib/claude/api';
import { useEditorStore } from 'app/lib/stores/editorStore';
import VoiceInputUI from '../VoiceInputUI';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  cached?: boolean;
}

interface ChatPanelProps {
  compressedCode: string;
  currentCode: string;
  onCodeUpdate: (code: string) => void;
}

export default function ChatPanel({ compressedCode, currentCode, onCodeUpdate }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Claude, your AI coding assistant. I'm here to help you write safe, stable code. I'll never suggest experimental features or risky dependencies. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [safeMode, setSafeMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const claudeAPI = useRef(new ClaudeAPI());
  const recognitionRef = useRef<any>(null);
  
  const { addToTokenUsage, cacheHits, updateCacheHits } = useEditorStore();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Direct inline handlers using native event
  const handleAutoModeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Force use native event to bypass any React interference
    (e.nativeEvent as any).stopImmediatePropagation?.();
    
    console.log('Auto Context button clicked!');
    const newState = !autoMode;
    setAutoMode(newState);
    
    // Show toast only once, after state is set
    setTimeout(() => {
      toast(newState ? 'Auto Context ON' : 'Auto Context OFF', {
        icon: newState ? '✅' : '❌',
        duration: 1500
      });
    }, 0);
  };

  const handleSafeModeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.nativeEvent as any).stopImmediatePropagation?.();
    
    console.log('Safe Mode button clicked!');
    const newState = !safeMode;
    setSafeMode(newState);
    
    // Show toast only once, after state is set
    setTimeout(() => {
      toast(newState ? 'Safe Mode ON' : 'Safe Mode OFF', {
        icon: newState ? '🛡️' : '⚠️',
        duration: 1500
      });
    }, 0);
  };

  const handleVoiceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.nativeEvent as any).stopImmediatePropagation?.();
    
    console.log('Voice button clicked!');
    
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Voice input not supported in this browser. Please use Chrome.');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
        toast('Recording stopped', { icon: '🛑' });
      }
    } else {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          console.log('Voice recognition started');
          setIsRecording(true);
          toast('Listening...', { icon: '🎤' });
        };

        recognition.onresult = (event: any) => {
          const last = event.results.length - 1;
          const transcript = event.results[last][0].transcript;
          
          if (event.results[last].isFinal) {
            setInput(prev => prev + ' ' + transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          toast.error('Voice input error: ' + event.error);
        };

        recognition.onend = () => {
          console.log('Voice recognition ended');
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (error) {
        console.error('Failed to start voice recognition:', error);
        toast.error('Failed to start voice input');
      }
    }
  };

  // Handler for voice transcript from VoiceInputUI
  const handleVoiceTranscript = (transcript: string) => {
    setInput(prev => prev + ' ' + transcript);
    toast('Voice input received', { icon: '🎙️' });
  };

  // Handler for voice commands from VoiceInputUI
  const handleVoiceCommand = (command: string) => {
    if (command === 'send' && input.trim()) {
      sendMessage();
    } else if (command === 'clear') {
      setInput('');
      toast('Input cleared', { icon: '🧹' });
    } else if (command === 'help') {
      const helpMessage = "Voice commands: 'send' to submit, 'clear' to clear input";
      toast(helpMessage, { icon: 'ℹ️', duration: 3000 });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = autoMode ? {
        code: compressedCode,
        rules: [
          'Use Next.js 14, NOT 15',
          'Use React 18, NOT 19',
          'Use Tailwind CSS v3, NOT v4',
          'No experimental features',
          'Prefer stable packages only'
        ].join(', ')
      } : {};

      const cachedResponse = await claudeAPI.current.checkCache(input, context);
      
      if (cachedResponse) {
        updateCacheHits(cacheHits + 1);
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: cachedResponse.content,
          timestamp: new Date(),
          cached: true
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        if (cachedResponse.code) {
          onCodeUpdate(cachedResponse.code);
        }
        
        toast.success('Response from cache!', { icon: '⚡', duration: 2000 });
      } else {
        const response = await claudeAPI.current.sendMessage(
          messages.map(m => ({ role: m.role, content: m.content })),
          context
        );

        let finalResponse = response.content;
        if (safeMode) {
          finalResponse = applySafeModeFilter(finalResponse);
        }

        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: finalResponse,
          timestamp: new Date(),
          tokens: response.tokens
        };

        setMessages(prev => [...prev, assistantMessage]);

        if (response.tokens) {
          addToTokenUsage(response.tokens);
        }

        const codeMatch = finalResponse.match(/```(?:typescript|javascript|tsx|jsx)?\n([\s\S]*?)```/);
        if (codeMatch) {
          onCodeUpdate(codeMatch[1]);
          toast.success('Code updated!', { icon: '✨', duration: 2000 });
        }
      }
    } catch (error) {
      console.error('Error calling Claude:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to get response');
    } finally {
      setIsLoading(false);
    }
  };

  const applySafeModeFilter = (content: string): string => {
    const replacements = [
      { pattern: /Next\.js 15/gi, replacement: 'Next.js 14' },
      { pattern: /React 19/gi, replacement: 'React 18' },
      { pattern: /--turbopack/gi, replacement: '' },
      { pattern: /experimental:\{[^}]*\}/gi, replacement: '' },
      { pattern: /tailwindcss@4/gi, replacement: 'tailwindcss@3' },
    ];

    let filtered = content;
    replacements.forEach(({ pattern, replacement }) => {
      filtered = filtered.replace(pattern, replacement);
    });

    return filtered;
  };

  const quickActions = [
    { label: 'Fix Error', prompt: 'Help me fix this error:' },
    { label: 'Explain Code', prompt: 'Can you explain what this code does?' },
    { label: 'Add Feature', prompt: 'I want to add a feature that' },
    { label: 'Refactor', prompt: 'Please refactor this code to be cleaner' },
    { label: 'Add Types', prompt: 'Add TypeScript types to this code' },
  ];

  // Debug - check if component is receiving interactions
  useEffect(() => {
    console.log('Component rendered with states:', { autoMode, safeMode, isRecording });
  }, [autoMode, safeMode, isRecording]);

  // Monitor file changes
  useEffect(() => {
    const files = useEditorStore.getState().files;
    console.log('Available files:', Array.from(files.keys()));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Control buttons */}
      <div className="p-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2 flex-wrap">
        <div
          onMouseDown={handleAutoModeClick}
          role="button"
          tabIndex={0}
          className={`px-3 py-1 rounded text-xs flex items-center gap-1 transition-colors select-none ${
            autoMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <Sparkles size={14} />
          <span>{!isMobile && 'Auto Context'}</span>
        </div>
        
        <div
          onMouseDown={handleSafeModeClick}
          role="button"
          tabIndex={0}
          className={`px-3 py-1 rounded text-xs flex items-center gap-1 transition-colors select-none ${
            safeMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <AlertCircle size={14} />
          <span>{!isMobile && 'Safe Mode'}</span>
        </div>
        
        <div
          onMouseDown={handleVoiceClick}
          role="button"
          tabIndex={0}
          className={`px-3 py-1 rounded text-xs flex items-center gap-1 transition-all select-none ${
            isRecording
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
          <span>{!isMobile && (isRecording ? 'Stop' : 'Voice')}</span>
        </div>
        
        <div className="ml-auto text-xs text-gray-400">
          {!isMobile && 'Cache Hits: '}{cacheHits}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`${isMobile ? 'max-w-[90%]' : 'max-w-[80%]'} rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              {message.cached && (
                <div className="text-xs text-green-400 mb-1">⚡ Cached Response</div>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs mt-2 opacity-70">
                {message.timestamp.toLocaleTimeString()}
                {message.tokens && ` • ${message.tokens} tokens`}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3">
              <Loader className="animate-spin" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {(!isMobile || !isRecording) && (
        <div className="p-2 border-t border-gray-700">
          <div className="flex gap-2 flex-wrap">
            {quickActions.map((action) => (
              <div
                key={action.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`Quick action: ${action.label}`);
                  setInput(action.prompt);
                  toast(`Prompt set: ${action.label}`, { 
                    icon: '📝', 
                    duration: 1000 
                  });
                }}
                role="button"
                tabIndex={0}
                className={`px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors select-none cursor-pointer ${
                  isMobile ? 'flex-1 min-h-[44px] flex items-center justify-center' : ''
                }`}
              >
                {action.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={isRecording ? "Speaking..." : "Ask Claude anything..."}
            disabled={isLoading}
            data-chat-input="true"
            className={`flex-1 bg-gray-800 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isRecording ? 'ring-2 ring-red-500' : ''
            } ${isMobile ? 'text-base min-h-[44px]' : ''}`}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded flex items-center gap-2 transition-colors ${
              isMobile ? 'min-w-[60px] min-h-[44px]' : ''
            }`}
          >
            {isLoading ? (
              <Loader className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Floating Voice Button */}
      {isMobile && (
        <VoiceInputUI 
          onTranscript={handleVoiceTranscript}
          onCommand={handleVoiceCommand}
          position="floating"
        />
      )}
    </div>
  );
}