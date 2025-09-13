// app/components/VoiceInputUI.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface VoiceInputUIProps {
  onTranscript: (transcript: string) => void;
  onCommand?: (command: string) => void;
  position?: 'floating' | 'inline';
}

export default function VoiceInputUI({ 
  onTranscript, 
  onCommand,
  position = 'floating' 
}: VoiceInputUIProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for browser support
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser');
    }
  }, []);

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Voice input not supported. Please use Chrome or Edge.');
      return;
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setIsExpanded(true);
        setTranscript('');
        setInterimTranscript('');
        toast('Listening...', { icon: '🎤', duration: 2000 });
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (final) {
          const fullTranscript = transcript + (transcript ? ' ' : '') + final;
          setTranscript(fullTranscript);
          setInterimTranscript('');
          
          // Check for voice commands
          const lowerFinal = final.toLowerCase().trim();
          if (onCommand) {
            if (lowerFinal.includes('send') || lowerFinal.includes('submit')) {
              onCommand('send');
            } else if (lowerFinal.includes('clear') || lowerFinal.includes('reset')) {
              onCommand('clear');
            } else if (lowerFinal.includes('help')) {
              onCommand('help');
            }
          }

          // Auto-stop after 3 seconds of final transcript
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            stopRecording();
          }, 3000);
        } else {
          setInterimTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        let errorMessage = 'Voice input error';
        if (event.error === 'no-speech') {
          errorMessage = 'No speech detected';
        } else if (event.error === 'network') {
          errorMessage = 'Network error';
        } else if (event.error === 'not-allowed') {
          errorMessage = 'Microphone access denied';
        }
        
        toast.error(errorMessage);
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      toast.error('Failed to start voice input');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      
      // Send the final transcript
      if (transcript) {
        onTranscript(transcript);
        toast.success('Voice input added', { icon: '✅' });
      }
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Collapse after a delay
      setTimeout(() => {
        setIsExpanded(false);
        setTranscript('');
        setInterimTranscript('');
      }, 1000);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (position === 'inline') {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          onClick={toggleRecording}
          className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
            isRecording
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          <span className="text-sm">{isRecording ? 'Stop' : 'Voice'}</span>
        </button>
        
        {(transcript || interimTranscript) && (
          <div className="text-sm text-gray-400">
            {transcript}
            <span className="text-gray-600">{interimTranscript}</span>
          </div>
        )}
      </div>
    );
  }

  // Floating position (mobile)
  return (
    <>
      {/* Floating Voice Button */}
      <div className="fixed bottom-24 right-4 z-50">
        <button
          onClick={toggleRecording}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all transform ${
            isRecording
              ? 'bg-red-600 text-white animate-pulse scale-110'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
          }`}
        >
          {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
      </div>

      {/* Expanded Voice Panel */}
      {isExpanded && (
        <div className="fixed bottom-32 right-4 left-4 max-w-sm mx-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 z-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm text-gray-400">
                {isRecording ? 'Listening...' : 'Voice Input'}
              </span>
            </div>
            <button
              onClick={() => {
                stopRecording();
                setIsExpanded(false);
              }}
              className="text-gray-500 hover:text-gray-300"
            >
              <X size={18} />
            </button>
          </div>

          {/* Transcript Display */}
          <div className="bg-gray-800 rounded p-3 min-h-[60px] max-h-[120px] overflow-y-auto">
            {transcript || interimTranscript ? (
              <p className="text-sm">
                <span className="text-white">{transcript}</span>
                <span className="text-gray-500">{interimTranscript}</span>
              </p>
            ) : (
              <p className="text-gray-500 text-sm">
                {isRecording ? 'Start speaking...' : 'Tap the mic to start'}
              </p>
            )}
          </div>

          {/* Voice Commands Help */}
          {isRecording && (
            <div className="mt-3 text-xs text-gray-500">
              Say "send" to submit • "clear" to reset • "help" for commands
            </div>
          )}
        </div>
      )}
    </>
  );
}