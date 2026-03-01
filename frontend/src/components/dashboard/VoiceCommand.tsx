'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceCommandProps {
  onCommand: (text: string) => void;
  onResult?: (result: string) => void;
  isProcessing?: boolean;
}

export default function VoiceCommand({ onCommand, onResult, isProcessing = false }: VoiceCommandProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [volume, setVolume] = useState(0);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Verificar suporte ao Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSupported(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        const results = event.results;
        const lastResult = results[results.length - 1];
        const text = lastResult[0].transcript;
        setTranscript(text);

        if (lastResult.isFinal) {
          onCommand(text);
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        stopVolumeMonitoring();
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', (event as Event & { error?: string }).error);
        setIsListening(false);
        stopVolumeMonitoring();
      };

      recognitionRef.current = recognition;
    }

    return () => {
      stopVolumeMonitoring();
    };
  }, [onCommand]);

  // Monitorar volume do microfone para feedback visual
  const startVolumeMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateVolume = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolume(average / 255);
        }
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, []);

  const stopVolumeMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setVolume(0);
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      stopVolumeMonitoring();
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
      startVolumeMonitoring();
    }
  }, [isListening, startVolumeMonitoring, stopVolumeMonitoring]);

  // Text-to-Speech para respostas
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Expor função speak para uso externo
  useEffect(() => {
    if (onResult) {
      // Quando receber resultado, falar a resposta
    }
  }, [onResult]);

  if (!isSupported) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Comandos de voz não suportados neste navegador
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[280px]"
          >
            {/* Visualização de volume */}
            <div className="flex items-center justify-center gap-1 h-12 mb-3">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full"
                  animate={{
                    height: `${Math.max(4, volume * 48 * (0.5 + Math.random() * 0.5))}px`
                  }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>

            {/* Transcrição */}
            <div className="text-center">
              {transcript ? (
                <p className="text-gray-900 dark:text-white font-medium">
                  &quot;{transcript}&quot;
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  🎤 Ouvindo... fale sua pergunta
                </p>
              )}
            </div>

            {/* Dicas */}
            <div className="mt-3 text-xs text-gray-400 text-center">
              Exemplos: &quot;Como foi ontem?&quot; • &quot;Top 5 produtos&quot; • &quot;Qual o CMV?&quot;
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão principal */}
      <Button
        onClick={toggleListening}
        disabled={isProcessing}
        className={`
          relative w-14 h-14 rounded-full transition-all duration-300
          ${isListening 
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30' 
            : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/30'
          }
        `}
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : isListening ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <MicOff className="w-6 h-6 text-white" />
          </motion.div>
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}

        {/* Indicador de escuta */}
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-red-400"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </Button>
    </div>
  );
}

// Declaração de tipos para Web Speech API
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
