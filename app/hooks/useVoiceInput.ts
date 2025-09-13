// app/hooks/useVoiceInput.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

interface VoiceInputConfig {
  language: 'en-US' | 'en-GB';
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: 1;
  confidence: number;
}

interface VoiceInputState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  confidence: number;
  volume: number;
}

interface VoiceCommand {
  pattern: RegExp;
  action: string;
  callback?: () => void;
}

const DEFAULT_CONFIG: VoiceInputConfig = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
  confidence: 0.5
};

// Voice commands for common coding tasks
const VOICE_COMMANDS: VoiceCommand[] = [
  { pattern: /^(hey |hi |hello )?claude/i, action: 'activate_claude' },
  { pattern: /^save( file)?$/i, action: 'save' },
  { pattern: /^run code$/i, action: 'run' },
  { pattern: /^format( code)?$/i, action: 'format' },
  { pattern: /^undo$/i, action: 'undo' },
  { pattern: /^redo$/i, action: 'redo' },
  { pattern: /^stop listening$/i, action: 'stop' },
  { pattern: /^clear( all)?$/i, action: 'clear' },
  { pattern: /^new file$/i, action: 'new_file' },
  { pattern: /^open file$/i, action: 'open_file' },
];

export function useVoiceInput(
  onTranscript?: (text: string, isFinal: boolean) => void,
  onCommand?: (action: string) => void,
  config: Partial<VoiceInputConfig> = {}
) {
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    confidence: 0,
    volume: 0
  });

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  const restartTimeoutRef = useRef<NodeJS.Timeout>();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Check browser support
  useEffect(() => {
    const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setState(prev => ({ ...prev, isSupported }));
    
    if (!isSupported) {
      console.warn('Speech recognition not supported in this browser');
    }
  }, []);

  // Volume level detection
  const detectVolume = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedVolume = Math.min(100, (average / 128) * 100);
    
    setState(prev => ({ ...prev, volume: normalizedVolume }));
    
    if (state.isListening) {
      animationFrameRef.current = requestAnimationFrame(detectVolume);
    }
  }, [state.isListening]);

  // Setup audio context for volume monitoring
  const setupAudioContext = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      detectVolume();
    } catch (error) {
      console.error('Failed to setup audio context:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Microphone access denied' 
      }));
    }
  }, [detectVolume]);

  // Cleanup audio context
  const cleanupAudioContext = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
  }, []);

  // Process detected speech
  const processSpeech = useCallback((transcript: string, isFinal: boolean, confidence: number) => {
    // Check for voice commands
    if (isFinal) {
      const trimmedTranscript = transcript.trim().toLowerCase();
      
      for (const command of VOICE_COMMANDS) {
        if (command.pattern.test(trimmedTranscript)) {
          console.log(`Voice command detected: ${command.action}`);
          
          if (onCommand) {
            onCommand(command.action);
          }
          
          // Visual feedback for command
          toast.success(`Command: ${command.action.replace('_', ' ')}`, {
            icon: '🎯',
            duration: 1500
          });
          
          // Stop listening if stop command
          if (command.action === 'stop') {
            stopListening();
          }
          
          return; // Don't process as regular transcript if it's a command
        }
      }
    }
    
    // Send transcript to handler
    if (onTranscript) {
      onTranscript(transcript, isFinal);
    }
    
    // Update state
    setState(prev => ({
      ...prev,
      transcript: isFinal ? transcript : prev.transcript,
      interimTranscript: isFinal ? '' : transcript,
      confidence
    }));
  }, [onCommand, onTranscript]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('Voice input not supported in this browser');
      return;
    }

    if (state.isListening) {
      console.log('Already listening');
      return;
    }

    try {
      // Setup audio context for volume monitoring
      await setupAudioContext();
      
      // Create speech recognition instance
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = finalConfig.language;
      recognition.continuous = finalConfig.continuous;
      recognition.interimResults = finalConfig.interimResults;
      recognition.maxAlternatives = finalConfig.maxAlternatives;

      recognition.onstart = () => {
        console.log('Voice recognition started');
        setState(prev => ({ 
          ...prev, 
          isListening: true, 
          error: null,
          transcript: '',
          interimTranscript: ''
        }));
        
        toast('Listening... Say "stop listening" to end', {
          icon: '🎤',
          duration: 3000
        });
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;
          
          if (result.isFinal) {
            finalTranscript += transcript + ' ';
            processSpeech(transcript, true, confidence);
          } else {
            interimTranscript += transcript;
            processSpeech(transcript, false, confidence);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        let errorMessage = 'Voice input error';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not available';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied';
            break;
          case 'network':
            errorMessage = 'Network error';
            break;
          case 'aborted':
            return; // Ignore aborted errors
        }
        
        setState(prev => ({ 
          ...prev, 
          error: errorMessage,
          isListening: false
        }));
        
        toast.error(errorMessage);
        cleanupAudioContext();
      };

      recognition.onend = () => {
        console.log('Voice recognition ended');
        
        // Auto-restart if still supposed to be listening (handles timeout)
        if (state.isListening && finalConfig.continuous) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (recognitionRef.current && state.isListening) {
              try {
                recognitionRef.current.start();
              } catch (error) {
                console.error('Failed to restart recognition:', error);
              }
            }
          }, 100);
        } else {
          setState(prev => ({ ...prev, isListening: false }));
          cleanupAudioContext();
        }
      };

      recognition.onspeechend = () => {
        console.log('Speech ended');
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start voice input',
        isListening: false
      }));
      toast.error('Failed to start voice input');
      cleanupAudioContext();
    }
  }, [state.isSupported, state.isListening, finalConfig, setupAudioContext, cleanupAudioContext, processSpeech]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    clearTimeout(restartTimeoutRef.current);
    cleanupAudioContext();
    
    setState(prev => ({ 
      ...prev, 
      isListening: false,
      volume: 0
    }));
    
    toast('Stopped listening', {
      icon: '🛑',
      duration: 1500
    });
  }, [cleanupAudioContext]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      transcript: '',
      interimTranscript: ''
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      clearTimeout(restartTimeoutRef.current);
      cleanupAudioContext();
    };
  }, [cleanupAudioContext]);

  return {
    // State
    ...state,
    
    // Actions
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    
    // Computed
    isActive: state.isListening,
    hasTranscript: state.transcript.length > 0 || state.interimTranscript.length > 0,
    fullTranscript: state.transcript + state.interimTranscript
  };
}