'use client';

import { useState, useEffect, useRef } from 'react';
import { History, Zap, Play, Pause, Square, Coffee } from 'lucide-react';
import { motion } from 'motion/react';

// Instância global para evitar limite de contextos de áudio no navegador
let audioCtx: AudioContext | null = null;

// Função utilitária para gerar sons usando a Web Audio API (sem precisar de arquivos externos)
const playSound = (type: 'start' | 'pause' | 'rest' | 'finish') => {
  try {
    if (typeof window === 'undefined') return;

    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const ctx = audioCtx;

    const playTone = (freq: number, waveType: OscillatorType, duration: number, startTimeOffset: number = 0) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + startTimeOffset;

      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, startTime);
      
      // Envelope de volume para um som mais suave (fade in rápido, fade out lento)
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    if (type === 'start') {
      // Bipe agudo e energético para o Treino
      playTone(880, 'triangle', 0.4); 
    } else if (type === 'pause' || type === 'rest') {
      // Bipe grave e suave para Pausa/Descanso
      playTone(440, 'sine', 0.4); 
    } else if (type === 'finish') {
      // Sequência de notas (arpejo) para Finalização
      playTone(440, 'sine', 0.3, 0);
      playTone(554, 'sine', 0.3, 0.15);
      playTone(659, 'sine', 0.3, 0.3);
      playTone(880, 'triangle', 0.6, 0.45);
    }
  } catch (e) {
    console.error("Erro ao reproduzir áudio", e);
  }
};

export default function HIITTimer() {
  // Configurações
  const [trainDuration, setTrainDuration] = useState(60);
  const restOptions = [15, 30, 45, 60];
  const [restIndex, setRestIndex] = useState(0); // Padrão 15s
  const restDuration = restOptions[restIndex];

  // Estado do Timer
  const [timeLeft, setTimeLeft] = useState(trainDuration);
  const [phaseTotal, setPhaseTotal] = useState(trainDuration);
  const [isTraining, setIsTraining] = useState(true);
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused' | 'finished'>('idle');
  
  // Resumo Final
  const [summary, setSummary] = useState({ min: 0, sec: 0 });

  // Refs para controle de tempo total
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);
  const pauseStartRef = useRef(0);
  const isTrainingRef = useRef(isTraining);

  // Sincroniza a ref com o estado para usar no setInterval sem recriá-lo
  useEffect(() => {
    isTrainingRef.current = isTraining;
  }, [isTraining]);

  // Lógica principal do Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerState === 'running') {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Alterna a fase quando chega a zero
            const nextIsTraining = !isTrainingRef.current;
            setIsTraining(nextIsTraining);
            const nextDuration = nextIsTraining ? trainDuration : restDuration;
            setPhaseTotal(nextDuration);
            
            // Toca o som correspondente à nova fase
            playSound(nextIsTraining ? 'start' : 'rest');
            
            return nextDuration;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState, trainDuration, restDuration]);

  // Ações dos Botões
  const handleDurationChange = (newDuration: number) => {
    setTrainDuration(newDuration);
    if (timerState === 'idle') {
      setTimeLeft(newDuration);
      setPhaseTotal(newDuration);
      setIsTraining(true);
    }
  };

  const handleStart = () => {
    playSound('start');
    setIsTraining(true);
    setTimeLeft(trainDuration);
    setPhaseTotal(trainDuration);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    setTimerState('running');
  };

  const togglePause = () => {
    if (timerState === 'running') {
      playSound('pause');
      setTimerState('paused');
      pauseStartRef.current = Date.now();
    } else if (timerState === 'paused') {
      playSound('start');
      pausedTimeRef.current += Date.now() - pauseStartRef.current;
      setTimerState('running');
    } else if (timerState === 'idle') {
      handleStart();
    }
  };

  const handleFinish = () => {
    if (timerState === 'idle') return;
    
    playSound('finish');
    
    let currentPause = 0;
    if (timerState === 'paused') {
      currentPause = Date.now() - pauseStartRef.current;
    }
    
    const totalTimeMs = Date.now() - startTimeRef.current - pausedTimeRef.current - currentPause;
    const totalSeconds = Math.max(0, Math.floor(totalTimeMs / 1000));
    
    setSummary({
      min: Math.floor(totalSeconds / 60),
      sec: totalSeconds % 60
    });
    setTimerState('finished');
  };

  const handleReset = () => {
    setTimerState('idle');
    setIsTraining(true);
    setTimeLeft(trainDuration);
    setPhaseTotal(trainDuration);
  };

  // Formatação e Cálculos Visuais
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = timeLeft / phaseTotal;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - progress);
  const sliderPercentage = (restIndex / (restOptions.length - 1)) * 100;

  // Cores Dinâmicas (Treino vs Descanso)
  const activeColor = isTraining ? "#fc536d" : "#67dc9f";
  const activeShadow = isTraining ? "rgba(252,83,109,0.4)" : "rgba(103,220,159,0.4)";

  return (
    <main className="flex-1 flex flex-col items-center relative pt-20 pb-32 px-6 bg-radial-glow w-full max-w-md mx-auto shadow-2xl shadow-black/50 min-h-screen">
      
      {/* Modal de Resumo (Substitui o alert) */}
      {timerState === 'finished' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0c0c1f]/80 backdrop-blur-md p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1e1e32] border border-[#333348] rounded-3xl p-8 w-full max-w-sm flex flex-col items-center shadow-2xl"
          >
            <h2 className="font-headline font-bold text-2xl text-[#e2e0fc] mb-2">Treino Finalizado!</h2>
            <p className="font-body text-slate-400 mb-6 text-center">Ótimo trabalho. Aqui está o seu tempo total de foco.</p>
            
            <div className="text-5xl font-label font-bold text-[#fc536d] mb-8 drop-shadow-[0_0_15px_rgba(252,83,109,0.4)]">
              {summary.min}m {summary.sec}s
            </div>
            
            <button 
              onClick={handleReset}
              className="w-full py-4 rounded-xl font-label text-sm font-bold bg-[#fc536d] text-[#5b0017] hover:bg-[#ffb2b7] transition-colors shadow-[0_0_20px_rgba(252,83,109,0.3)]"
            >
              FECHAR
            </button>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <header className="absolute top-0 w-full z-50 bg-[#0c0c1f]/80 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <button className="text-[#fc536d]/80 hover:text-[#fc536d] transition-colors">
          <History size={24} strokeWidth={2} />
        </button>
        <h1 className="font-headline font-black tracking-tighter text-lg text-[#fc536d]">
          <span className="font-medium tracking-normal">MEU</span> HIIT
        </h1>
        <div className="w-6"></div> {/* Placeholder para manter o título centralizado */}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center w-full mt-8">
        {/* Timer Section */}
        <div className="relative flex flex-col items-center justify-center mb-16 w-full">
          <span 
            className="font-label text-[10px] uppercase tracking-[0.4em] mb-6 opacity-80 transition-colors duration-500"
            style={{ color: activeColor }}
          >
            {isTraining ? 'TREINO' : 'DESCANSO'}
          </span>

          <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center">
            {/* Background Ring */}
            <div className="absolute inset-0 rounded-full border-[10px] border-[#1e1e32] opacity-50"></div>

            {/* Animated Progress Ring */}
            <svg 
              className="absolute inset-0 w-full h-full -rotate-90 transition-all duration-500" 
              style={{ filter: `drop-shadow(0 0 15px ${activeShadow})` }} 
              viewBox="0 0 100 100"
            >
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                stroke={activeColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </svg>

            {/* Time Display */}
            <div className="flex flex-col items-center z-10">
              <span className="font-label text-6xl md:text-7xl font-bold text-[#e2e0fc] tracking-tighter">
                {formatTime(timeLeft)}
              </span>
              <div className="flex items-center gap-1 mt-2 transition-colors duration-500" style={{ color: activeColor }}>
                {isTraining ? <Zap size={14} fill="currentColor" /> : <Coffee size={14} fill="currentColor" />}
                <span className="font-label text-[12px] uppercase tracking-widest opacity-80">
                  {isTraining ? 'Ativo' : 'Recuperação'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="w-full max-w-sm flex flex-col gap-10 z-10">
          {/* Duration */}
          <div className="flex flex-col gap-4">
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-slate-400 px-2">Duração da Série</span>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleDurationChange(60)}
                className={`py-4 rounded-xl font-label text-sm font-bold transition-all ${trainDuration === 60 ? 'bg-[#542f98] text-[#c3a6ff] shadow-[0_0_20px_rgba(84,47,152,0.3)] border border-[#d2bbff]/20' : 'bg-[#1e1e32] text-[#e2bebf] hover:bg-[#28283d]'}`}
              >
                60s
              </button>
              <button
                onClick={() => handleDurationChange(120)}
                className={`py-4 rounded-xl font-label text-sm font-bold transition-all ${trainDuration === 120 ? 'bg-[#542f98] text-[#c3a6ff] shadow-[0_0_20px_rgba(84,47,152,0.3)] border border-[#d2bbff]/20' : 'bg-[#1e1e32] text-[#e2bebf] hover:bg-[#28283d]'}`}
              >
                120s
              </button>
            </div>
          </div>

          {/* Rest Slider */}
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end px-2">
              <span className="font-label text-[10px] uppercase tracking-[0.2em] text-slate-400">Descanso</span>
              <span className="font-label text-lg font-bold text-[#d2bbff]">{restDuration}s</span>
            </div>

            <div className="relative h-2 w-full bg-[#333348] rounded-full">
              {/* Visual Track */}
              <div
                className="absolute top-0 left-0 h-full bg-[#d2bbff] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${sliderPercentage}%` }}
              ></div>
              {/* Visual Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-[#eaddff] rounded-full shadow-[0_0_10px_rgba(210,187,255,0.5)] border-4 border-[#333348] pointer-events-none transition-all duration-300 ease-out"
                style={{ left: `calc(${sliderPercentage}% - 12px)` }}
              ></div>

              {/* Actual Input */}
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={restIndex}
                onChange={(e) => setRestIndex(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {/* Labels */}
              <div className="absolute -bottom-6 w-full flex justify-between px-1">
                <span className="font-label text-[10px] text-slate-500">15s</span>
                <span className="font-label text-[10px] text-slate-500">30s</span>
                <span className="font-label text-[10px] text-slate-500">45s</span>
                <span className="font-label text-[10px] text-slate-500">60s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 w-full z-40 flex justify-around items-center px-4 pt-4 pb-8 bg-[#0c0c1f]/90 backdrop-blur-2xl rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(233,69,96,0.2)]">
        <button
          onClick={handleStart}
          className="flex flex-col items-center justify-center text-slate-500 hover:text-[#ffb2b7] transition-all active:scale-90 duration-300 ease-out w-20"
        >
          <div className="w-12 h-12 flex items-center justify-center mb-1">
            <Play size={28} fill={timerState === 'running' ? "currentColor" : "none"} />
          </div>
          <span className="font-label uppercase tracking-[0.15em] text-[10px]">
            {timerState === 'idle' ? 'Iniciar' : 'Reiniciar'}
          </span>
        </button>

        <button
          onClick={togglePause}
          className={`flex flex-col items-center justify-center rounded-full w-20 h-20 transition-all active:scale-90 duration-300 ease-out -mt-8 ${timerState === 'running' ? 'bg-[#fc536d]/20 text-[#fc536d] shadow-[0_0_20px_rgba(252,83,109,0.4)] border border-[#fc536d]/30' : 'bg-[#1e1e32] text-slate-400'}`}
        >
          {timerState === 'running' ? (
            <Pause size={32} fill="currentColor" />
          ) : (
            <Play size={32} fill="currentColor" className="ml-1" />
          )}
          <span className="font-label uppercase tracking-[0.15em] text-[10px] mt-1">
            {timerState === 'running' ? 'Pausar' : 'Continuar'}
          </span>
        </button>

        <button
          onClick={handleFinish}
          className="flex flex-col items-center justify-center text-slate-500 hover:text-[#ffb2b7] transition-all active:scale-90 duration-300 ease-out w-20"
        >
          <div className="w-12 h-12 flex items-center justify-center mb-1">
            <Square size={24} fill="currentColor" />
          </div>
          <span className="font-label uppercase tracking-[0.15em] text-[10px]">Finalizar</span>
        </button>
      </nav>
    </main>
  );
}
