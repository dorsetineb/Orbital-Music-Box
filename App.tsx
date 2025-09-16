import React, { useState, useEffect, useRef, useCallback } from 'react';
import Disc from './components/Disc';
import Controls from './components/Controls';
import EffectsPanel from './components/EffectsPanel';
import useAudioEngine from './hooks/useAudioEngine';
import type { Note, NoteColor, AudioEffects } from './types';
import { NOTE_COLORS, NOTE_DURATION_ANGLES } from './constants';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rotationSpeed, setRotationSpeed] = useState<number>(10); // seconds per rotation
  const [activeColor, setActiveColor] = useState<NoteColor>(NOTE_COLORS[0]);
  const [activeWaveform, setActiveWaveform] = useState<OscillatorType>('triangle');
  const [rotation, setRotation] = useState<number>(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [activeTracks, setActiveTracks] = useState<boolean[]>([true, true, true, true]);
  const [isEffectsPanelOpen, setIsEffectsPanelOpen] = useState<boolean>(false);

  // FIX: Updated effects state to align with the `AudioEffects` type in `types.ts`.
  // This removes 'ghost' and 'glitch' effects and uses the correct properties for the remaining effects.
  const [effects, setEffects] = useState<AudioEffects>({
    distortion: { on: false, drive: 0.5, tone: 4000, output: 0.5 },
    panner: { on: false, pan: 0 },
    phaser: { on: false, rate: 1, depth: 0.5, feedback: 0.5 },
    flanger: { on: false, delay: 3, depth: 2, feedback: 0.5, rate: 0.5 },
    chorus: { on: false, rate: 1.5, depth: 0.7 },
    tremolo: { on: false, frequency: 5, depth: 0.5 },
    delay: { on: false, time: 0.5, feedback: 0.5 },
    reverb: { on: false, decay: 2, wet: 0.5 },
    bitcrusher: { on: false, bitDepth: 8, mix: 0.5 },
    vibrato: { on: false, rate: 5, depth: 10 },
  });

  const { 
    startRecording, 
    stopRecording, 
    isRecording, 
    resumeAudio,
    playPreviewNote,
    playShortNote,
    updateEffects,
  } = useAudioEngine();

  useEffect(() => {
    updateEffects(effects);
  }, [effects, updateEffects]);

  const animationFrameRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number | null>(null);


  const handleDiscClick = async (track: number, angle: number) => {
    await resumeAudio();

    // 1. Check for a direct click on a note to delete it
    const noteClickedIndex = notes.findIndex(note => {
        if (note.track !== track) return false;
        const noteStart = note.angle;
        let noteEnd = (note.angle + note.durationAngle);
        const clickAngle = angle;
        // Handle wrap-around for end angle
        if (noteEnd >= 360) {
            noteEnd = noteEnd % 360;
            return clickAngle >= noteStart || clickAngle <= noteEnd;
        } else {
            return clickAngle >= noteStart && clickAngle <= noteEnd;
        }
    });

    if (noteClickedIndex !== -1) {
        setNotes(prev => prev.filter((_, index) => index !== noteClickedIndex));
        return;
    }

    // 2. Click on an empty space, add a new note if it doesn't overlap
    const baseDuration = NOTE_DURATION_ANGLES[track];
    const newNoteStartAngle = (angle - baseDuration / 2 + 360) % 360;
    
    const isOverlapping = notes.some(note => {
        if (note.track !== track) return false;
        const c1 = (newNoteStartAngle + baseDuration / 2);
        const c2 = (note.angle + note.durationAngle / 2);
        const dist = Math.min(Math.abs(c1 - c2), 360 - Math.abs(c1 - c2));
        const collisionThreshold = (baseDuration / 2) + (note.durationAngle / 2);
        return dist < collisionThreshold;
    });

    if (!isOverlapping) {
        const newNote: Note = {
            id: `note-${Date.now()}-${Math.random()}`,
            track,
            angle: newNoteStartAngle,
            color: activeColor.color,
            name: activeColor.name,
            durationAngle: baseDuration,
        };
        setNotes(prev => [...prev, newNote]);
        const octaveMultiplier = Math.pow(2, track);
        const frequency = activeColor.freq * octaveMultiplier;
        playShortNote(frequency, activeWaveform);
    }
  };

  const handleColorSelect = async (color: NoteColor) => {
    await resumeAudio();
    setActiveColor(color);
    if (playPreviewNote) {
      playPreviewNote(color.freq, activeWaveform);
    }
  };

  const handleWaveformSelect = async (waveform: OscillatorType) => {
    await resumeAudio();
    setActiveWaveform(waveform);
    playPreviewNote(activeColor.freq, waveform);
  };
  
  const handleClear = () => {
    setNotes([]);
  };
  
  const handleToggleTrack = (trackIndex: number) => {
    setActiveTracks(prev => {
        const newActive = [...prev];
        newActive[trackIndex] = !newActive[trackIndex];
        return newActive;
    });
  };

  const handlePlayPause = async () => {
    await resumeAudio();
    if (!isPlaying) {
        rotationRef.current = rotation;
        lastFrameTimeRef.current = performance.now();
    } else {
        lastFrameTimeRef.current = null;
    }
    setIsPlaying(prev => !prev);
  };
  
  const handleRecord = async () => {
    await resumeAudio();
    if (isRecording) {
      const url = await stopRecording();
      setRecordedUrl(url);
      setIsPlaying(false);
    } else {
      setRecordedUrl(null);
      startRecording();
       if (!isPlaying) {
          rotationRef.current = rotation;
          lastFrameTimeRef.current = performance.now();
      }
      setIsPlaying(true);
    }
  };

  const handleEffectChange = <K extends keyof AudioEffects>(
    effectName: K,
    param: keyof AudioEffects[K],
    value: AudioEffects[K][keyof AudioEffects[K]]
  ) => {
    setEffects(prev => ({
      ...prev,
      [effectName]: {
        ...prev[effectName],
        [param]: value,
      },
    }));
  };

  const animate = useCallback((timestamp: number) => {
    if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
    }

    const deltaTime = timestamp - lastFrameTimeRef.current;
    lastFrameTimeRef.current = timestamp;

    const prevRotation = rotationRef.current;
    const degreesPerSecond = 360 / rotationSpeed;
    const degreesPerFrame = degreesPerSecond * (deltaTime / 1000);
    const newRotation = prevRotation + degreesPerFrame;

    const didCrossPlayhead = (angle: number, prevRot: number, newRot: number): boolean => {
        const prevVisualAngle = angle + prevRot;
        const newVisualAngle = angle + newRot;
        return Math.floor(newVisualAngle / 360) > Math.floor(prevVisualAngle / 360);
    };

    notes.forEach(note => {
        if (!activeTracks[note.track]) return;
        
        const noteDetails = NOTE_COLORS.find(nc => nc.color === note.color);
        if (!noteDetails) return;
        
        const octaveMultiplier = Math.pow(2, note.track);
        const frequency = noteDetails.freq * octaveMultiplier;

        const startHasCrossed = didCrossPlayhead(note.angle, prevRotation, newRotation);
        if (startHasCrossed) {
            playShortNote(frequency, activeWaveform);
        }
    });

    rotationRef.current = newRotation;
    setRotation(newRotation % 360);

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [notes, rotationSpeed, activeTracks, playShortNote, activeWaveform]);

  useEffect(() => {
    if (isPlaying) {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = performance.now();
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      lastFrameTimeRef.current = null;
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, animate]);

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
        <div className="w-full max-w-2xl flex-shrink-0 z-10">
             <Controls
                isPlaying={isPlaying}
                isRecording={isRecording}
                rotationSpeed={rotationSpeed}
                activeColor={activeColor}
                onPlayPause={handlePlayPause}
                onRecord={handleRecord}
                onSpeedChange={(speed) => {
                    if (!isPlaying) rotationRef.current = rotation;
                    setRotationSpeed(speed);
                }}
                onColorSelect={handleColorSelect}
                onClear={handleClear}
                recordedUrl={recordedUrl}
                onToggleEffects={() => setIsEffectsPanelOpen(p => !p)}
                activeWaveform={activeWaveform}
                onWaveformSelect={handleWaveformSelect}
            />
        </div>

        <div className="w-full flex-1 flex items-center justify-center relative my-4">
            <div className="w-full max-w-[600px] aspect-square">
                <Disc 
                  notes={notes}
                  rotation={rotation} 
                  isPlaying={isPlaying} 
                  onDiscClick={handleDiscClick}
                  activeTracks={activeTracks}
                  onToggleTrack={handleToggleTrack}
                />
            </div>
        </div>
      
        <EffectsPanel
            isOpen={isEffectsPanelOpen}
            onClose={() => setIsEffectsPanelOpen(false)}
            effects={effects}
            onChange={handleEffectChange}
        />
    </div>
  );
};

export default App;