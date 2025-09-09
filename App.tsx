import React, { useState, useEffect, useRef, useCallback } from 'react';
import Disc from './components/Disc';
import Controls from './components/Controls';
import EffectsControls from './components/EffectsControls';
import useAudioEngine from './hooks/useAudioEngine';
import type { Note, NoteColor, AudioEffects } from './types';
import { NOTE_COLORS, TRACK_RADII, TRACK_WIDTH, TRACK_SNAP_ANGLES } from './constants';

// --- Collision Detection Helpers ---
const isAngleInArc = (angle: number, arcStart: number, arcDuration: number): boolean => {
    const arcEnd = (arcStart + arcDuration) % 360;
    if (arcStart < arcEnd) { // No wraparound
        return angle >= arcStart && angle < arcEnd;
    } else { // Wraparound
        return angle >= arcStart || angle < arcEnd;
    }
};

const doArcsOverlap = (start1: number, duration1: number, start2: number, duration2: number): boolean => {
    // This is a simplified check. A more robust one would handle all wraparound cases.
    // For now, we check if start of one is in the other, or vice-versa.
    if (isAngleInArc(start1, start2, duration2) || isAngleInArc(start2, start1, duration1)) {
        return true;
    }
    const end1 = (start1 + duration1) % 360;
    const end2 = (start2 + duration2) % 360;
    if (isAngleInArc(end1, start2, duration2) || isAngleInArc(end2, start1, duration1)) {
        return true;
    }
    return false;
};


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
            // --- Sustained Note Audio Logic ---
            const visualStartAngle = (note.angle + newRotation) % 360;
            const visualEndAngle = (visualStartAngle + note.durationAngle) % 360;
            
            let isCurrentlyActive = false;
            // Check if playhead is within the arc's range
            if (visualStartAngle < visualEndAngle) { // Arc does not wrap around 0/360
                isCurrentlyActive = playheadPosition >= visualStartAngle && playheadPosition < visualEndAngle;
            } else { // Arc wraps around 0/360
                isCurrentlyActive = playheadPosition >= visualStartAngle || playheadPosition < visualEndAngle;
            }
            
            const wasActive = playingSustainedNotesRef.current.has(note.id);
            
            if (isCurrentlyActive && !wasActive) {
                startSustainedNote(freq, note.id);
                playingSustainedNotesRef.current.add(note.id);
            } else if (!isCurrentlyActive && wasActive) {
                stopSustainedNote(note.id);
                playingSustainedNotesRef.current.delete(note.id);
            }
        } else {
             // Single Note: Trigger on crossing
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
            // Check if click is near start or end of arc to allow removal
            const endAngle = (note.angle + note.durationAngle) % 360;
            const angleDiffStart = Math.min(Math.abs(note.angle - angle), 360 - Math.abs(note.angle - angle));
            const angleDiffEnd = Math.min(Math.abs(endAngle - angle), 360 - Math.abs(endAngle - angle));
            return angleDiffStart < noteAngularRadius || angleDiffEnd < noteAngularRadius;
        } else {
            const angleDiff = Math.min(Math.abs(note.angle - angle), 360 - Math.abs(note.angle - angle));
            return angleDiff < noteAngularRadius;
        }
    });

    if (noteToRemove) {
        setNotes(prev => prev.filter(n => n.id !== noteToRemove.id));
    } else {
        const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
        const snappedAngle = (Math.round(angle / snapAngleForTrack) * snapAngleForTrack) % 360;
        setDragInfo({ startAngle: snappedAngle, currentAngle: snappedAngle, track });
    }
  }, [isPlaying, notes, resumeAudio]);

  const handleDiscMouseMove = useCallback((track: number, angle: number) => {
    if (dragInfo && dragInfo.track === track) {
        setDragInfo(prev => prev ? { ...prev, currentAngle: angle } : null);
    }
  }, [dragInfo]);

  const handleDiscMouseUp = useCallback(() => {
    if (!dragInfo) return;

    const isSlotOccupied = (track: number, angle: number, duration: number = 0): boolean => {
        return notes.some(existingNote => {
            if (existingNote.track !== track) return false;

            if (duration > 0) { // New is an arc
                if (existingNote.durationAngle && existingNote.durationAngle > 0) { // Existing is an arc
                    return doArcsOverlap(angle, duration, existingNote.angle, existingNote.durationAngle);
                } else { // Existing is a point
                    return isAngleInArc(existingNote.angle, angle, duration);
                }
            } else { // New is a point
                if (existingNote.durationAngle && existingNote.durationAngle > 0) { // Existing is an arc
                    return isAngleInArc(angle, existingNote.angle, existingNote.durationAngle);
                } else { // Existing is a point
                    const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
                    return Math.abs(existingNote.angle - angle) < snapAngleForTrack / 2;
                }
            }
        });
    };

    const { startAngle, currentAngle, track } = dragInfo;
    const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
    const snappedCurrentAngle = (Math.round(currentAngle / snapAngleForTrack) * snapAngleForTrack);
    
    let durationAngle = (snappedCurrentAngle - startAngle + 360) % 360;
    if (durationAngle === 0 && currentAngle !== startAngle) {
        // Allow a full circle note if dragged all the way around
        durationAngle = 360;
    }

    if (durationAngle < snapAngleForTrack / 2) { // Treat as a click, add regular note
        if (!isSlotOccupied(track, startAngle)) {
            const newNote: Note = {
                id: `note-${Date.now()}-${Math.random()}`,
                track: track,
                angle: startAngle,
                color: activeColor.color,
                name: activeColor.name,
            };
            setNotes(prev => [...prev, newNote]);
        }
    } else { // Treat as a drag, add sustained note
        if (!isSlotOccupied(track, startAngle, durationAngle)) {
            const newNote: Note = {
                id: `note-${Date.now()}-${Math.random()}`,
                track: track,
                angle: startAngle,
                durationAngle: durationAngle,
                color: activeColor.color,
                name: activeColor.name,
            };
            setNotes(prev => [...prev, newNote]);
        }
    }

    setDragInfo(null);
  }, [dragInfo, activeColor.color, activeColor.name, notes]);

  const handleDiscMouseLeave = useCallback(() => {
      setDragInfo(null);
  }, []);

  const dragPreview = dragInfo ? {
      track: dragInfo.track,
      startAngle: dragInfo.startAngle, // Already snapped
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
              activeColor={activeColor}
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
