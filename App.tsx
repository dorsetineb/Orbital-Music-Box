
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Disc from './components/Disc';
import Controls from './components/Controls';
import EffectsControls from './components/EffectsControls';
import useAudioEngine from './hooks/useAudioEngine';
import type { Note, NoteColor, AudioEffects } from './types';
import { NOTE_COLORS, TRACK_RADII, TRACK_WIDTH, TRACK_SNAP_ANGLES } from './constants';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rotationSpeed, setRotationSpeed] = useState<number>(10); // seconds per rotation
  const [activeColor, setActiveColor] = useState<NoteColor>(NOTE_COLORS[0]);
  const [rotation, setRotation] = useState<number>(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [activeTracks, setActiveTracks] = useState<boolean[]>([true, true, true, true]);
  const [isEffectsPanelOpen, setIsEffectsPanelOpen] = useState<boolean>(true); // Open by default
  const [isSustainMode, setIsSustainMode] = useState<boolean>(false);

  const [effects, setEffects] = useState<AudioEffects>({
    distortion: { on: false, drive: 0.5, tone: 2500, output: 0.5 },
    panner: { on: false, pan: 0.0 },
    phaser: { on: false, rate: 1.2, depth: 0.5, feedback: 0.5 },
    flanger: { on: false, delay: 3.0, depth: 1.0, feedback: 0.5, rate: 1.5 },
    chorus: { on: false, rate: 1.5, depth: 0.5 },
    tremolo: { on: false, frequency: 5.0, depth: 0.6 },
    delay: { on: false, time: 0.25, feedback: 0.3 },
    reverb: { on: false, decay: 1.5, wet: 0.5 },
  });

  const { 
    playNote, 
    startRecording, 
    stopRecording, 
    isRecording, 
    resumeAudio,
    updateEffects,
  } = useAudioEngine();

  const lastPlayedRef = useRef<Map<string, number>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    updateEffects(effects);
  }, [effects, updateEffects]);

  const handleDiscClick = async (track: number, angle: number) => {
    await resumeAudio();
    
    const trackRadius = TRACK_RADII[track];
    const noteAngularRadius = Math.atan2(TRACK_WIDTH / 2, trackRadius) * (180 / Math.PI);

    const existingNoteIndex = notes.findIndex(note => {
        if (note.track !== track) return false;
        const angleDiff = Math.min(Math.abs(note.angle - angle), 360 - Math.abs(note.angle - angle));
        return angleDiff < noteAngularRadius;
    });

    if (existingNoteIndex !== -1) {
        setNotes(prev => prev.filter((_, index) => index !== existingNoteIndex));
    } else {
        const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
        const snappedAngle = (Math.round(angle / snapAngleForTrack) * snapAngleForTrack) % 360;
        const isSlotOccupied = notes.some(note => note.track === track && note.angle === snappedAngle);
        
        if (!isSlotOccupied) {
            // FIX: Initialize durationAngle for the new note.
            // For now, all created notes are single notes, so their duration
            // is the same as the snap angle for that track.
            const newNote: Note = {
                id: `note-${Date.now()}-${Math.random()}`,
                track,
                angle: snappedAngle,
                color: activeColor.color,
                name: activeColor.name,
                durationAngle: snapAngleForTrack,
            };
            setNotes(prev => [...prev, newNote]);
        }
    }
  };

  const handlePlayPause = async () => {
    await resumeAudio();
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
      setIsPlaying(true);
    }
  };

  const handleEffectChange = (effectName: keyof AudioEffects, param: string, value: any) => {
    setEffects(prev => ({
      ...prev,
      [effectName]: {
        ...prev[effectName],
        [param]: value,
      }
    }));
  };

  const animate = useCallback(() => {
    setRotation(prevRotation => {
      const degreesPerSecond = 360 / rotationSpeed;
      const degreesPerFrame = degreesPerSecond / 60; // Assuming 60fps
      const newRotation = (prevRotation + degreesPerFrame) % 360;
      const playheadPosition = 0; // Playhead is at the top (12 o'clock)

      notes.forEach(note => {
        const prevNoteVisualAngle = (note.angle + prevRotation) % 360;
        const currentNoteVisualAngle = (note.angle + newRotation) % 360;
        
        let crossed = false;
        if (prevNoteVisualAngle > 270 && currentNoteVisualAngle < 90) {
            crossed = true; // Wrapped around 360/0
        } else if (prevNoteVisualAngle < playheadPosition && currentNoteVisualAngle >= playheadPosition) {
            crossed = true;
        }

        if (crossed) {
          const now = Date.now();
          const lastPlayed = lastPlayedRef.current.get(note.id) || 0;
          
          if (now - lastPlayed > 250) { // Debounce
            if (activeTracks[note.track]) {
                const noteDetails = NOTE_COLORS.find(nc => nc.color === note.color);
                if (noteDetails) {
                    const octaveMultiplier = Math.pow(2, TRACK_RADII.length - 1 - note.track);
                    playNote(noteDetails.freq * octaveMultiplier, isSustainMode);
                }
            }
            lastPlayedRef.current.set(note.id, now);
          }
        }
      });

      return newRotation;
    });
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [notes, playNote, rotationSpeed, activeTracks, isSustainMode]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, animate]);

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
        <div className="w-full max-w-2xl flex-shrink-0">
             <Controls
                isPlaying={isPlaying}
                isRecording={isRecording}
                rotationSpeed={rotationSpeed}
                activeColor={activeColor}
                onPlayPause={handlePlayPause}
                onRecord={handleRecord}
                onSpeedChange={setRotationSpeed}
                onColorSelect={setActiveColor}
                onClear={() => setNotes([])}
                recordedUrl={recordedUrl}
                isEffectsPanelOpen={isEffectsPanelOpen}
                onToggleEffectsPanel={() => setIsEffectsPanelOpen(p => !p)}
                isSustainMode={isSustainMode}
                onToggleSustainMode={() => setIsSustainMode(p => !p)}
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
                  onToggleTrack={(trackIndex) => setActiveTracks(prev => {
                      const newActive = [...prev];
                      newActive[trackIndex] = !newActive[trackIndex];
                      return newActive;
                  })}
                />
            </div>
        </div>
      
        <div className="w-full flex-shrink-0">
            <div className={`w-full transition-all duration-300 ease-in-out ${isEffectsPanelOpen ? 'opacity-100 max-h-[1000px] visible' : 'opacity-0 max-h-0 invisible'}`}>
              <EffectsControls effects={effects} onChange={handleEffectChange} />
            </div>
        </div>
    </div>
  );
};

export default App;
