import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Music, Disc, Activity, ListMusic, Volume2, Zap, GraduationCap } from 'lucide-react';

// --- 音樂理論常數 ---
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const BASS_STRINGS = [
  { name: 'G', baseIndex: 7 },
  { name: 'D', baseIndex: 2 },
  { name: 'A', baseIndex: 9 },
  { name: 'E', baseIndex: 4 },
];

// --- 音程名稱對照表 (中文化) ---
const INTERVAL_NAMES = {
  0: { label: '根音', theory: 'R' },
  1: { label: '小二度', theory: 'm2' },
  2: { label: '大二度', theory: 'M2' },
  3: { label: '小三度', theory: 'm3' },
  4: { label: '大三度', theory: 'M3' },
  5: { label: '完全四度', theory: 'P4' },
  6: { label: '減五度', theory: 'd5' }, // 或是增四度 (Tritone)
  7: { label: '完全五度', theory: 'P5' },
  8: { label: '小六度', theory: 'm6' },
  9: { label: '大六度', theory: 'M6' },
  10: { label: '小七度', theory: 'm7' },
  11: { label: '大七度', theory: 'M7' },
};

const SCALES = {
  'minor_pentatonic': { name: '小調五聲 (Funk/Rock)', intervals: [0, 3, 5, 7, 10] },
  'major_pentatonic': { name: '大調五聲 (Country/Pop)', intervals: [0, 2, 4, 7, 9] },
  'blues': { name: '藍調音階 (Blues)', intervals: [0, 3, 5, 6, 7, 10] },
  'dorian': { name: 'Dorian 調式 (Funk/Jazz)', intervals: [0, 2, 3, 5, 7, 9, 10] },
  'mixolydian': { name: 'Mixolydian 調式 (Jam)', intervals: [0, 2, 4, 5, 7, 9, 10] },
  'major': { name: '自然大調 (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11] },
  'minor': { name: '自然小調 (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10] },
  'chromatic': { name: '半音階 (練習運指)', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

// --- 擴充版鼓機節奏模式 ---
const DRUM_PATTERNS = {
  // --- FUNK ZONE ---
  'funk_jb': { name: '★ JB\'s Funk (The One)', bpm: 105, steps: [4, 3, 3, 3, 5, 3, 3, 3, 1, 3, 3, 3, 5, 3, 3, 3] },
  'funk_oakland': { name: '★ Oakland Sync (16th)', bpm: 98, steps: [4, 0, 1, 0, 5, 0, 1, 1, 0, 1, 3, 0, 5, 0, 3, 1] },
  'funk_slap': { name: '★ Slap Machine (Open)', bpm: 110, steps: [4, 0, 0, 0, 5, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0, 0] },
  'funk_nola': { name: '★ NOLA Strut (N.O.)', bpm: 90, steps: [4, 0, 1, 0, 2, 0, 4, 0, 0, 0, 1, 0, 5, 0, 2, 0] },
  'funk_sync': { name: 'Standard Funk', bpm: 95, steps: [4, 0, 3, 1, 5, 0, 3, 0, 0, 1, 3, 0, 5, 0, 3, 0] },
  // --- HIP HOP ZONE ---
  'hiphop_90s': { name: 'Boom Bap (90s)', bpm: 90, steps: [4, 0, 3, 1, 5, 0, 1, 0, 4, 1, 3, 0, 5, 0, 3, 0] },
  'hiphop_trap': { name: 'Trap (Modern)', bpm: 140, steps: [4, 0, 3, 0, 3, 0, 3, 0, 5, 0, 3, 0, 3, 0, 4, 0] },
  'lofi_chill': { name: 'Lo-Fi Chill', bpm: 75, steps: [4, 0, 0, 0, 5, 0, 0, 1, 0, 0, 1, 0, 5, 0, 0, 0] },
  // --- OTHERS ---
  'jazz_swing': { name: 'Jazz Swing', bpm: 120, steps: [3, 0, 3, 0, 2, 0, 3, 0, 3, 0, 3, 0, 2, 0, 3, 0] },
  'rock_straight': { name: 'Rock (8-Beat)', bpm: 100, steps: [4, 0, 3, 0, 5, 0, 3, 0, 4, 0, 3, 0, 5, 0, 3, 0] },
  'metronome': { name: 'Metronome', bpm: 90, steps: [3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0] },
};

// --- Web Audio API 鼓聲合成引擎 ---
const createDrumEngine = (ctx) => {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const playSound = (type, time) => {
    const t = time || ctx.currentTime;
    // KICK
    if (type === 1 || type === 4 || type === 6) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, t);
      compressor.ratio.setValueAtTime(12, t);
      osc.connect(gain);
      gain.connect(compressor);
      compressor.connect(ctx.destination);
      osc.frequency.setValueAtTime(100, t); // Start deeper (was 150)
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.5); // End lower (was 40)
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5); // Slightly longer decay (was 0.4)
      osc.start(t);
      osc.stop(t + 0.5); // Extend stop time (was 0.4)
    }
    // SNARE
    if (type === 2 || type === 5 || type === 6) {
      const noise = ctx.createBufferSource();
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1000;
      const noiseGain = ctx.createGain();
      noise.buffer = buffer;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      noise.start(t);
      noise.stop(t + 0.2);
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.frequency.setValueAtTime(250, t);
      oscGain.gain.setValueAtTime(0.4, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    }
    // HI-HAT
    if (type === 3 || type === 4 || type === 5) {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      source.start(t);
      source.stop(t + 0.05);
    }
  };
  return { playSound };
};

const RAINBOW_COLORS = [
  { bg: "bg-rose-500", text: "text-white", hex: "#f43f5e" },    // Root - Red
  { bg: "bg-orange-500", text: "text-slate-900", hex: "#f97316" }, // 2nd - Orange
  { bg: "bg-amber-400", text: "text-slate-900", hex: "#fbbf24" },  // 3rd - Yellow
  { bg: "bg-emerald-500", text: "text-white", hex: "#10b981" },    // 4th - Green
  { bg: "bg-cyan-500", text: "text-slate-900", hex: "#06b6d4" },   // 5th - Blue
  { bg: "bg-indigo-500", text: "text-white", hex: "#6366f1" },    // 6th - Indigo
  { bg: "bg-fuchsia-500", text: "text-white", hex: "#d946ef" },   // 7th - Purple
];

export default function BassGrooveChineseIntervals() {
  const [rootNote, setRootNote] = useState('E');
  const [selectedScaleKey, setSelectedScaleKey] = useState('minor_pentatonic');
  // 已移除 showNoteNames 狀態
  const [bpm, setBpm] = useState(90);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rhythmPattern, setRhythmPattern] = useState('funk_jb');
  const [currentStep, setCurrentStep] = useState(0);

  // Refs for Audio & Animation
  const audioContextRef = useRef(null);
  const drumEngineRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef(null);
  const currentStepRef = useRef(0);

  // Refs for Visual Sync
  const isPlayingRef = useRef(false);
  const visualQueueRef = useRef([]);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    setBpm(DRUM_PATTERNS[rhythmPattern].bpm);
  }, [rhythmPattern]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const scheduleNote = useCallback((stepNumber, time) => {
    visualQueueRef.current.push({ step: stepNumber, time: time });
    const pattern = DRUM_PATTERNS[rhythmPattern].steps;
    const beatType = pattern[stepNumber];
    if (beatType > 0 && drumEngineRef.current) {
      drumEngineRef.current.playSound(beatType, time);
    }
  }, [rhythmPattern]);

  const scheduler = useCallback(function scheduler() {
    const lookahead = 25.0;
    const scheduleAheadTime = 0.1;

    if (!audioContextRef.current || !isPlayingRef.current) return;

    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
      scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
      const secondsPerBeat = 60.0 / bpm;
      const secondsPer16th = secondsPerBeat / 4;
      nextNoteTimeRef.current += secondsPer16th;
      currentStepRef.current = (currentStepRef.current + 1) % 16;
    }

    timerIDRef.current = window.setTimeout(scheduler, lookahead);
  }, [bpm, scheduleNote]);

  const animate = useCallback(function animate() {
    if (isPlayingRef.current && audioContextRef.current) {
      const currentTime = audioContextRef.current.currentTime;
      while (visualQueueRef.current.length > 0) {
        const nextEvent = visualQueueRef.current[0];
        if (nextEvent.time <= currentTime + 0.02) {
          setCurrentStep(nextEvent.step);
          visualQueueRef.current.shift();
        } else {
          break;
        }
      }
    }
    if (isPlayingRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, []);

  const togglePlay = async () => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      drumEngineRef.current = createDrumEngine(audioContextRef.current);
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (!isPlaying) {
      setIsPlaying(true);
      isPlayingRef.current = true;
      currentStepRef.current = 0;
      visualQueueRef.current = [];
      if (audioContextRef.current) {
        nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
      }
      scheduler();
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (timerIDRef.current) window.clearTimeout(timerIDRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setCurrentStep(0);
    }
  };

  useEffect(() => {
    return () => {
      if (timerIDRef.current) window.clearTimeout(timerIDRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // UI Helpers
  const getScaleNotesIndices = () => {
    const rootIndex = NOTES.indexOf(rootNote);
    const intervals = SCALES[selectedScaleKey].intervals;
    return intervals.map(interval => (rootIndex + interval) % 12);
  };
  const scaleNotesIndices = getScaleNotesIndices();
  const rootIndex = NOTES.indexOf(rootNote);

  // --- 計算當前音階的詳細資訊 ---
  const currentScaleDetails = SCALES[selectedScaleKey].intervals.map((interval, index) => {
    const noteName = NOTES[(rootIndex + interval) % 12];
    const intervalData = INTERVAL_NAMES[interval];
    const color = RAINBOW_COLORS[index % RAINBOW_COLORS.length];
    return { note: noteName, intervalLabel: intervalData.label, isRoot: interval === 0, color };
  });


  const renderNutString = (str, idx) => {
    const noteIndex = str.baseIndex % 12;
    const scaleIndex = scaleNotesIndices.indexOf(noteIndex);
    const isScaleNote = scaleIndex !== -1;
    const color = isScaleNote ? RAINBOW_COLORS[scaleIndex % RAINBOW_COLORS.length] : null;

    let styleClass = "text-slate-500 font-bold";

    if (isScaleNote) {
      const baseClass = "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold shadow-md";
      if (scaleIndex === 0) { // Root
        styleClass = `${baseClass} ${color.bg} ${color.text} ring-2 ring-rose-900`;
      } else {
        styleClass = `${baseClass} ${color.bg} ${color.text}`;
      }
    }

    return (
      <div key={idx} className="h-16 md:h-20 flex items-center justify-center">
        <div className={styleClass}>
          {str.name}
        </div>
      </div>
    );
  };

  const renderFret = (stringData, fretNum) => {
    const noteIndex = (stringData.baseIndex + fretNum) % 12;
    const noteName = NOTES[noteIndex];
    const scaleIndex = scaleNotesIndices.indexOf(noteIndex);
    const isScaleNote = scaleIndex !== -1;
    const color = isScaleNote ? RAINBOW_COLORS[scaleIndex % RAINBOW_COLORS.length] : null;

    let markerClass = "hidden";
    let markerContent = "";

    if (isScaleNote) {
      const isRoot = scaleIndex === 0;
      markerClass = `
        absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
        w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs md:text-sm font-bold shadow-lg transition-all duration-300
        ${color.bg} ${color.text}
        ${isRoot ? "ring-2 ring-rose-300 z-10 scale-110" : "scale-100 opacity-90"}
      `;
      markerContent = noteName;
    }
    const isDotFret = [3, 5, 7, 9, 15].includes(fretNum);
    const isDoubleDotFret = fretNum === 12;

    return (
      <div key={fretNum} className="relative flex-1 border-r border-slate-600 h-16 md:h-20 flex items-center justify-center group hover:bg-slate-800/30 transition-colors">
        <div className="absolute w-full h-[2px] md:h-[4px] bg-slate-400 group-hover:bg-slate-300 shadow-sm" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}></div>
        <div className={markerClass}>{markerContent}</div>
        {stringData.name === 'A' && (
          <>
            {isDotFret && <div className="absolute -bottom-[34px] md:-bottom-[42px] left-1/2 transform -translate-x-1/2 w-3 h-3 md:w-4 md:h-4 bg-slate-500/40 rounded-full z-0 pointer-events-none"></div>}
            {isDoubleDotFret && (
              <div className="absolute -bottom-[34px] md:-bottom-[42px] left-1/2 transform -translate-x-1/2 flex gap-2 md:gap-4 z-0 pointer-events-none">
                <div className="w-3 h-3 md:w-4 md:h-4 bg-slate-500/40 rounded-full"></div>
                <div className="w-3 h-3 md:w-4 md:h-4 bg-slate-500/40 rounded-full"></div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-rose-500 selection:text-white flex flex-col">
      {/* Header */}
      <header className="p-4 md:p-6 bg-slate-950 border-b border-slate-800 shadow-xl z-20">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

          {/* Logo Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 bg-rose-600 rounded-lg shadow-lg shadow-rose-900/50">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Bass Groove: 中文版</h1>
              <p className="text-slate-400 text-sm">樂理分析 / 指板導航 / 節奏訓練</p>
            </div>
          </div>

          {/* Controls Container */}
          <div className="flex flex-col gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800 w-full lg:w-auto">

            {/* 上排：選單 */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] uppercase text-slate-500 font-semibold mb-1 ml-1">Key (調性)</label>
                <select value={rootNote} onChange={(e) => setRootNote(e.target.value)} className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-rose-500 p-2.5 min-w-[70px]">
                  {NOTES.map(note => <option key={note} value={note}>{note}</option>)}
                </select>
              </div>
              <div className="flex flex-col flex-1">
                <label className="text-[10px] uppercase text-slate-500 font-semibold mb-1 ml-1">Scale (音階)</label>
                <select value={selectedScaleKey} onChange={(e) => setSelectedScaleKey(e.target.value)} className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-rose-500 p-2.5 min-w-[200px]">
                  {Object.entries(SCALES).map(([key, data]) => <option key={key} value={key}>{data.name}</option>)}
                </select>
              </div>
            </div>

            {/* 下排：音程分析顯示區 (繁體中文版) */}
            <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-800/50">
              <div className="flex items-center gap-2 mr-2 text-slate-500 text-xs">
                <GraduationCap className="w-4 h-4" />
                <span>組成音:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentScaleDetails.map((item, idx) => (
                  <div
                    key={idx}
                    className={`
                                flex flex-col items-center justify-center px-2 py-1.5 rounded-lg shadow-sm border border-opacity-20 min-w-[3.5rem]
                                ${item.color.bg} ${item.color.text}
                            `}
                  >
                    <span className="text-sm font-bold leading-none mb-1">{item.note}</span>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${item.isRoot ? 'text-rose-100' : 'text-slate-900 opacity-70'}`}>
                      {item.intervalLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Main Fretboard */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 md:p-8 overflow-x-auto w-full">
        <div className="relative bg-[#2e2a24] border-y-8 border-[#1a1814] rounded-xl shadow-2xl w-full max-w-[1200px] overflow-x-auto custom-scrollbar">
          {/* 上弦枕 (Nut) */}
          <div className="absolute left-0 top-0 bottom-0 w-10 md:w-14 bg-[#1a1612] border-r-4 border-slate-500 z-10 flex flex-col justify-between py-0 shadow-xl">
            {BASS_STRINGS.map((str, idx) => renderNutString(str, idx))}
          </div>

          <div className="flex flex-col min-w-[800px] pl-10 md:pl-14">
            {BASS_STRINGS.map((string) => (
              <div key={string.name} className="flex">
                {Array.from({ length: 15 }, (_, i) => i + 1).map((fretNum) => renderFret(string, fretNum))}
              </div>
            ))}
          </div>
          <div className="flex min-w-[800px] pl-10 md:pl-14 bg-[#1a1814] text-slate-500 text-xs py-1 border-t border-slate-700">
            {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => (
              <div key={num} className="flex-1 text-center">{num}</div>
            ))}
          </div>
        </div>
        <div className="mt-8 text-center max-w-2xl px-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-yellow-400">當前節奏：{DRUM_PATTERNS[rhythmPattern].name}</h3>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            BPM: <span className="text-white font-bold">{bpm}</span> |
            請參照上方 <span className="text-cyan-400 font-bold">中文音程</span>，練習時試著思考現在彈的是「大三度」還是「小七度」。
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 px-4 py-4 sticky bottom-0 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6 w-full lg:w-auto justify-center bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <Disc className={`w-5 h-5 ${isPlaying ? 'text-rose-500 animate-spin' : 'text-slate-600'}`} />
              <input
                type="number"
                value={bpm}
                onChange={(e) => {
                  let value = parseInt(e.target.value);
                  if (isNaN(value)) value = 40;
                  // We allow typing, but the slider range is 40-240.
                  // We can clamp on blur or just let it stay. 
                  // Let's use a change handler that updates state immediately.
                  setBpm(value);
                }}
                onBlur={(e) => {
                  // Clamp value on blur to ensure it stays in reasonable bounds for the engine/slider
                  let value = parseInt(e.target.value);
                  if (isNaN(value) || value < 40) value = 40;
                  if (value > 240) value = 240;
                  setBpm(value);
                }}
                className="text-3xl font-mono font-bold text-white w-20 text-center bg-transparent border-b border-rose-500/30 focus:border-rose-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500 font-bold mt-2">BPM</span>
            </div>
            <input
              type="range" min="40" max="240" value={bpm} onChange={(e) => setBpm(Number(e.target.value))}
              className="w-32 md:w-48 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 w-full">
            <div className="relative">
              <ListMusic className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={rhythmPattern}
                onChange={(e) => setRhythmPattern(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium w-full md:w-auto"
              >
                <optgroup label="Funk & Soul"><option value="funk_jb">JB's Funk (The One)</option><option value="funk_oakland">Oakland Sync (16th)</option><option value="funk_slap">Slap Machine (Open)</option><option value="funk_nola">NOLA Strut</option><option value="funk_sync">Standard Funk</option></optgroup>
                <optgroup label="Hip Hop"><option value="hiphop_90s">Boom Bap</option><option value="hiphop_trap">Trap</option><option value="lofi_chill">Lo-Fi Chill</option></optgroup>
                <optgroup label="Others"><option value="jazz_swing">Jazz Swing</option><option value="rock_straight">Rock Straight</option><option value="metronome">Metronome</option></optgroup>
              </select>
            </div>

            {/* 16-step visualizer */}
            <div className="flex gap-1">
              {Array.from({ length: 16 }).map((_, idx) => {
                const isCurrent = currentStep === idx;
                const isDownbeat = idx % 4 === 0;

                let bgClass = 'bg-slate-800';
                if (isCurrent) {
                  if (isDownbeat) {
                    bgClass = 'bg-yellow-400 shadow-[0_0_15px_#facc15] scale-y-125';
                  } else {
                    bgClass = 'bg-emerald-400 shadow-[0_0_10px_#34d399] scale-y-110';
                  }
                } else {
                  if (isDownbeat) {
                    bgClass = 'bg-slate-600';
                  }
                }

                return (
                  <div
                    key={idx}
                    className={`
                                    w-2 h-4 md:w-3 md:h-6 rounded-sm transition-all duration-75
                                    ${bgClass}
                                `}
                  />
                )
              })}
            </div>
          </div>
          <button
            onClick={togglePlay}
            className={`
                    w-full lg:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-full font-bold text-lg shadow-lg transition-all transform active:scale-95
                    ${isPlaying ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-900/30' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/30'}
                `}
          >
            {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
            {isPlaying ? "STOP" : "PLAY"}
          </button>
        </div>
      </footer>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1a1814; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
      `}</style>
    </div>
  );
}