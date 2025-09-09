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
        return angle >= arcStart && angle <= arcEnd;
    } else { // Wraparound
        return angle >= arcStart || angle <= arcEnd;
    }
};

const doArcsOverlap = (start1: number, duration1: number, start2: number, duration2: number): boolean => {
    const end1 = (start1 + duration1) % 360;
    const end2 = (start2 + duration2) % 360;

    const start1In2 = isAngleInArc(start1, start2, duration2);
    const end1In2 = isAngleInArc(end1, start2, duration2);
    const start2In1 = isAngleInArc(start2, start1, duration1);
    const end2In1 = isAngleInArc(end2, start1, duration1);

    return start1In2 || end1In2 || start2In1 || end2In1;
};

const findNoteAt = (notes: Note[], track: number, angle: number): Note | null => {
    const trackRadius = TRACK_RADII[track];
    const noteAngularRadius = Math.atan2(TRACK_WIDTH / 2, trackRadius) * (180 / Math.PI);

    for (const note of notes) {
        if (note.track !== track) continue;

        if (note.durationAngle && note.durationAngle > 0) {
            if (isAngleInArc(angle, note.angle, note.durationAngle)) {
                return note;
            }
        } else {
            const angleDiff = Math.min(Math.abs(note.angle - angle), 360 - Math.abs(note.angle - angle));
            if (angleDiff < noteAngularRadius) {
                return note;
            }
        }
    }
    return null;
};

export interface DragState {
  startTrack: number;
  startAngle: number;
  lastAngle: number;
  totalAngleDelta: number;
}

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rotationSpeed, setRotationSpeed] = useState<number>(10); // seconds per rotation
  const [activeColor, setActiveColor] = useState<NoteColor>(NOTE_COLORS[0]);
  const [rotation, setRotation] = useState<number>(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [activeTracks, setActiveTracks] = useState<boolean[]>([true, true, true, true]);
  const [isEffectsPanelOpen, setIsEffectsPanelOpen] = useState<boolean>(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  
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
            // --- Single Note Audio Logic (Rewritten for accuracy) ---
            const prevNoteVisualAngle = (note.angle + prevRotation) % 360;
            const rotationIncrement = (newRotation - prevRotation + 360) % 360;
            const angleToPlayhead = (playheadPosition - prevNoteVisualAngle + 360) % 360;
            const crossed = angleToPlayhead > 0 && angleToPlayhead <= rotationIncrement;

            if (crossed) {
                const now = Date.now();
                const lastPlayed = lastPlayedRef.current.get(note.id) || 0;
                if (now - lastPlayed > 250) { // Debounce
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

    const handleMouseDown = useCallback(async (track: number, angle: number) => {
        if (isPlaying) return;
        await resumeAudio();

        const noteToRemove = findNoteAt(notes, track, angle);
        if (noteToRemove) {
            setNotes(prev => prev.filter(n => n.id !== noteToRemove.id));
            return; 
        }

        const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
        const snappedAngle = (Math.round(angle / snapAngleForTrack) * snapAngleForTrack) % 360;

        if (findNoteAt(notes, track, snappedAngle)) {
            return; 
        }
        
        setDragState({
            startTrack: track,
            startAngle: snappedAngle,
            lastAngle: snappedAngle,
            totalAngleDelta: 0,
        });
    }, [isPlaying, notes, resumeAudio]);

    const handleMouseMove = useCallback((track: number, angle: number) => {
        if (!dragState || track !== dragState.startTrack) return;
       
        let delta = angle - dragState.lastAngle;
        // Handle angle wrapping around 360/0
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        setDragState(prev => prev ? { 
            ...prev,
            lastAngle: angle,
            totalAngleDelta: prev.totalAngleDelta + delta,
        } : null);
    }, [dragState]);

    const handleMouseUp = useCallback(() => {
        if (!dragState) return;

        const { startTrack, startAngle, totalAngleDelta } = dragState;
        const snapAngleForTrack = TRACK_SNAP_ANGLES[startTrack];

        const isSlotOccupied = (checkTrack: number, checkAngle: number, duration: number = 0): boolean => {
             return notes.some(existingNote => {
                if (existingNote.track !== checkTrack) return false;
                if (duration > 0) {
                    if (existingNote.durationAngle && existingNote.durationAngle > 0) {
                        return doArcsOverlap(checkAngle, duration, existingNote.angle, existingNote.durationAngle);
                    }
                    return isAngleInArc(existingNote.angle, checkAngle, duration);
                } else {
                    if (existingNote.durationAngle && existingNote.durationAngle > 0) {
                        return isAngleInArc(checkAngle, existingNote.angle, existingNote.durationAngle);
                    }
                    return Math.abs(existingNote.angle - checkAngle) < snapAngleForTrack / 2;
                }
            });
        };

        // If drag was negligible, treat as a click to create a single note.
        if (Math.abs(totalAngleDelta) < snapAngleForTrack / 2) {
             if (!isSlotOccupied(startTrack, startAngle)) {
                const newNote: Note = {
                    id: `note-${Date.now()}-${Math.random()}`,
                    track: startTrack,
                    angle: startAngle,
                    color: activeColor.color,
                    name: activeColor.name,
                };
                setNotes(prev => [...prev, newNote]);
            }
        } else {
            // Sustained note logic
            let finalAngle: number;
            let finalDuration: number;
            
            const snappedTotalAngle = Math.round(totalAngleDelta / snapAngleForTrack) * snapAngleForTrack;

            if (snappedTotalAngle >= 0) { // Clockwise drag
                finalAngle = startAngle;
                finalDuration = snappedTotalAngle;
            } else { // Counter-clockwise drag
                const endAngle = (startAngle + snappedTotalAngle + 360) % 360;
                finalAngle = endAngle;
                finalDuration = -snappedTotalAngle;
            }

            // After snapping, duration might be too small
            if (finalDuration < snapAngleForTrack / 2) {
                 if (!isSlotOccupied(startTrack, startAngle)) {
                    const newNote: Note = {
                        id: `note-${Date.now()}-${Math.random()}`,
                        track: startTrack,
                        angle: startAngle,
                        color: activeColor.color,
                        name: activeColor.name,
                    };
                    setNotes(prev => [...prev, newNote]);
                }
            } else if (!isSlotOccupied(startTrack, finalAngle, finalDuration)) {
                 if (finalDuration >= 360) finalDuration = 359.9;
                const newNote: Note = {
                    id: `note-${Date.now()}-${Math.random()}`,
                    track: startTrack,
                    angle: finalAngle,
                    durationAngle: finalDuration,
                    color: activeColor.color,
                    name: activeColor.name,
                };
                setNotes(prev => [...prev, newNote]);
            }
        }
        setDragState(null);
    }, [dragState, activeColor, notes]);

    const handleMouseLeave = useCallback(() => {
       // We call handleMouseUp to finalize any note being dragged if the mouse leaves the area
       if(dragState) {
           handleMouseUp();
       }
    }, [dragState, handleMouseUp]);

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
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              dragState={dragState}
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