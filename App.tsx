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
  const [isEffectsPanelOpen, setIsEffectsPanelOpen] = useState<boolean>(false);
  const [dragInfo, setDragInfo] = useState<{ track: number; startAngle: number; currentAngle: number; } | null>(null);
  const [effects, setEffects] = useState<AudioEffects>({
    reverbMix: 0,
    reverbType: 'medium',
    delayMix: 0,
    distortionMix: 0,
    distortionType: 'hard',
    phaserMix: 0,
    phaserRate: 0.5,
    phaserDepth: 800,
    flangerMix: 0,
    flangerRate: 0.2,
    flangerDepth: 0.005,
  });

  const { 
    playNote,
    startSustainedNote,
    stopSustainedNote, 
    startRecording, 
    stopRecording, 
    isRecording, 
    resumeAudio,
    updateEffects,
  } = useAudioEngine();

  const lastPlayedRef = useRef<Map<string, number>>(new Map());
  const playingSustainedNotesRef = useRef(new Set<string>());
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    updateEffects(effects);
  }, [effects, updateEffects]);

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

  const handleSpeedChange = (newSpeed: number) => {
    setRotationSpeed(newSpeed);
  };

  const handleColorSelect = (color: NoteColor) => {
    setActiveColor(color);
  };

  const handleClear = () => {
    setNotes([]);
  }

  const handleToggleTrack = (trackIndex: number) => {
    setActiveTracks(prev => {
        const newActiveTracks = [...prev];
        newActiveTracks[trackIndex] = !newActiveTracks[trackIndex];
        return newActiveTracks;
    });
  };
  
  const handleEffectChange = <K extends keyof AudioEffects>(effect: K, value: AudioEffects[K]) => {
    setEffects(prev => ({ ...prev, [effect]: value }));
  };
  
  const handleToggleEffectsPanel = () => {
      setIsEffectsPanelOpen(prev => !prev);
  };

  const animate = useCallback(() => {
    setRotation(prevRotation => {
      const degreesPerSecond = 360 / rotationSpeed;
      const degreesPerFrame = degreesPerSecond / 60; // Assuming 60fps
      const newRotation = (prevRotation + degreesPerFrame) % 360;
      const playheadPosition = 90;

      notes.forEach(note => {
        if (!activeTracks[note.track]) return;
        
        const noteDetails = NOTE_COLORS.find(nc => nc.color === note.color);
        if (!noteDetails) return;
        
        const octaveMultiplier = Math.pow(2, note.track);
        const freq = noteDetails.freq * octaveMultiplier;

        if (note.durationAngle && note.durationAngle > 0) {
            const startAngle = (note.angle + newRotation) % 360;
            const endAngle = (startAngle + note.durationAngle);
            
            let isPlayheadInside = false;
            if (endAngle > 360) {
                isPlayheadInside = playheadPosition >= startAngle || playheadPosition < (endAngle % 360);
            } else {
                isPlayheadInside = playheadPosition >= startAngle && playheadPosition < endAngle;
            }

            if (isPlayheadInside) {
                if (!playingSustainedNotesRef.current.has(note.id)) {
                    startSustainedNote(freq, note.id);
                    playingSustainedNotesRef.current.add(note.id);
                }
            } else {
                if (playingSustainedNotesRef.current.has(note.id)) {
                    stopSustainedNote(note.id);
                    playingSustainedNotesRef.current.delete(note.id);
                }
            }
        } else {
            const prevNoteVisualAngle = (note.angle + prevRotation) % 360;
            const currentNoteVisualAngle = (note.angle + newRotation) % 360;
            
            let crossed = false;
            if (prevNoteVisualAngle < currentNoteVisualAngle) {
                if (prevNoteVisualAngle < playheadPosition && currentNoteVisualAngle >= playheadPosition) crossed = true;
            } else if (prevNoteVisualAngle > currentNoteVisualAngle) { 
                if (prevNoteVisualAngle < playheadPosition || currentNoteVisualAngle >= playheadPosition) crossed = true;
            }

            if (crossed) {
                const now = Date.now();
                const lastPlayed = lastPlayedRef.current.get(note.id) || 0;
                if (now - lastPlayed > 250) {
                    playNote(freq);
                    lastPlayedRef.current.set(note.id, now);
                }
            }
        }
      });
      return newRotation;
    });
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [notes, playNote, rotationSpeed, activeTracks, startSustainedNote, stopSustainedNote]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      playingSustainedNotesRef.current.forEach(noteId => stopSustainedNote(noteId));
      playingSustainedNotesRef.current.clear();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, animate, stopSustainedNote]);

  const handleDiscMouseDown = useCallback(async (track: number, angle: number) => {
    if (isPlaying) return;
    await resumeAudio();
    
    const trackRadius = TRACK_RADII[track];
    const noteAngularRadius = Math.atan2(TRACK_WIDTH / 2, trackRadius) * (180 / Math.PI);

    const noteToRemove = notes.find(note => {
        if (note.track !== track) return false;
        
        if (note.durationAngle && note.durationAngle > 0) {
            const endAngle = (note.angle + note.durationAngle);
            if (endAngle > 360) {
                return angle >= note.angle || angle <= (endAngle % 360);
            } else {
                return angle >= note.angle && angle <= endAngle;
            }
        } else {
            const angleDiff = Math.min(Math.abs(note.angle - angle), 360 - Math.abs(note.angle - angle));
            return angleDiff < noteAngularRadius;
        }
    });

    if (noteToRemove) {
        setNotes(prev => prev.filter(n => n.id !== noteToRemove.id));
    } else {
        setDragInfo({ startAngle: angle, currentAngle: angle, track });
    }
  }, [isPlaying, notes, resumeAudio]);

  const handleDiscMouseMove = useCallback((track: number, angle: number) => {
    if (dragInfo && dragInfo.track === track) {
        setDragInfo(prev => prev ? { ...prev, currentAngle: angle } : null);
    }
  }, [dragInfo]);

  const handleDiscMouseUp = useCallback(() => {
    if (!dragInfo) return;

    const durationAngle = (dragInfo.currentAngle - dragInfo.startAngle + 360) % 360;
    
    if (durationAngle < 5) { // Treat as a click, add regular note
        const snapAngleForTrack = TRACK_SNAP_ANGLES[dragInfo.track];
        const snappedAngle = (Math.round(dragInfo.startAngle / snapAngleForTrack) * snapAngleForTrack) % 360;
        
        const isSlotOccupied = notes.some(note => note.track === dragInfo.track && note.angle === snappedAngle && !note.durationAngle);
        if (!isSlotOccupied) {
            const newNote: Note = {
                id: `note-${Date.now()}-${Math.random()}`,
                track: dragInfo.track,
                angle: snappedAngle,
                color: activeColor.color,
                name: activeColor.name,
            };
            setNotes(prev => [...prev, newNote]);
        }
    } else { // Treat as a drag, add sustained note
        const newNote: Note = {
            id: `note-${Date.now()}-${Math.random()}`,
            track: dragInfo.track,
            angle: dragInfo.startAngle,
            durationAngle: durationAngle,
            color: activeColor.color,
            name: activeColor.name,
        };
        setNotes(prev => [...prev, newNote]);
    }

    setDragInfo(null);
  }, [dragInfo, activeColor.color, activeColor.name, notes]);

  const handleDiscMouseLeave = useCallback(() => {
      setDragInfo(null);
  }, []);

  const dragPreview = dragInfo ? {
      track: dragInfo.track,
      startAngle: dragInfo.startAngle,
      durationAngle: (dragInfo.currentAngle - dragInfo.startAngle + 360) % 360
  } : null;

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
        <header className="absolute top-0 left-0 p-6">
            <h1 className="text-3xl font-bold text-gray-200">Disqif-AI</h1>
        </header>

      <div className="w-full flex-1 flex items-center justify-center relative">
        <div className="w-full max-w-[600px] aspect-square">
            <Disc 
              notes={notes}
              rotation={rotation} 
              isPlaying={isPlaying}
              activeTracks={activeTracks}
              onToggleTrack={handleToggleTrack}
              onDiscMouseDown={handleDiscMouseDown}
              onDiscMouseMove={handleDiscMouseMove}
              onDiscMouseUp={handleDiscMouseUp}
              onDiscMouseLeave={handleDiscMouseLeave}
              dragPreview={dragPreview}
            />
        </div>
      </div>
      
      <div className="w-full max-w-2xl flex flex-col items-center gap-4 mt-auto">
        <Controls
            isPlaying={isPlaying}
            isRecording={isRecording}
            rotationSpeed={rotationSpeed}
            activeColor={activeColor}
            onPlayPause={handlePlayPause}
            onRecord={handleRecord}
            onSpeedChange={handleSpeedChange}
            onColorSelect={handleColorSelect}
            onClear={handleClear}
            recordedUrl={recordedUrl}
            isEffectsPanelOpen={isEffectsPanelOpen}
            onToggleEffectsPanel={handleToggleEffectsPanel}
        />
        <div className={`w-full transition-all duration-500 ease-in-out ${isEffectsPanelOpen ? 'opacity-100 max-h-[500px] visible' : 'opacity-0 max-h-0 invisible'}`}>
          {isEffectsPanelOpen && <EffectsControls effects={effects} onChange={handleEffectChange} />}
        </div>
      </div>
    </div>
  );
};

export default App;