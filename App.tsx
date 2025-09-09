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


const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rotationSpeed, setRotationSpeed] = useState<number>(10); // seconds per rotation
  const [activeColor, setActiveColor] = useState<NoteColor>(NOTE_COLORS[0]);
  const [rotation, setRotation] = useState<number>(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [activeTracks, setActiveTracks] = useState<boolean[]>([true, true, true, true]);
  const [isEffectsPanelOpen, setIsEffectsPanelOpen] = useState<boolean>(false);
  
  const [isSustainedMode, setIsSustainedMode] = useState<boolean>(false);
  const [sustainedNoteStartPoint, setSustainedNoteStartPoint] = useState<{ track: number; angle: number } | null>(null);

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
    setSustainedNoteStartPoint(null);
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

  const handleSustainedModeToggle = () => {
    setIsSustainedMode(prev => !prev);
    setSustainedNoteStartPoint(null); // Reset on mode change
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
            
            // Calculate how far the disc rotated in this frame
            const rotationIncrement = (newRotation - prevRotation + 360) % 360;
            
            // Calculate the note's angle relative to the playhead at the start of the frame
            const angleToPlayhead = (playheadPosition - prevNoteVisualAngle + 360) % 360;

            // If the note was before the playhead and the rotation increment crossed it, trigger play
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

  const handleDiscClick = useCallback(async (track: number, angle: number) => {
    if (isPlaying) return;
    await resumeAudio();

    // First, check if we're clicking on an existing note to remove it.
    const noteToRemove = findNoteAt(notes, track, angle);
    if (noteToRemove) {
        setNotes(prev => prev.filter(n => n.id !== noteToRemove.id));
        setSustainedNoteStartPoint(null); // Cancel sustained note creation
        return;
    }

    const isSlotOccupied = (checkTrack: number, checkAngle: number, duration: number = 0): boolean => {
        return notes.some(existingNote => {
            if (existingNote.track !== checkTrack) return false;

            if (duration > 0) { // New is an arc
                if (existingNote.durationAngle && existingNote.durationAngle > 0) { // Existing is an arc
                    return doArcsOverlap(checkAngle, duration, existingNote.angle, existingNote.durationAngle);
                } else { // Existing is a point
                    return isAngleInArc(existingNote.angle, checkAngle, duration);
                }
            } else { // New is a point
                if (existingNote.durationAngle && existingNote.durationAngle > 0) { // Existing is an arc
                    return isAngleInArc(checkAngle, existingNote.angle, existingNote.durationAngle);
                } else { // Existing is a point
                    const snapAngleForTrack = TRACK_SNAP_ANGLES[checkTrack];
                    return Math.abs(existingNote.angle - checkAngle) < snapAngleForTrack / 2;
                }
            }
        });
    };

    // If not removing, proceed to add a note.
    const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
    const snappedAngle = (Math.round(angle / snapAngleForTrack) * snapAngleForTrack) % 360;

    if (isSustainedMode) {
        if (!sustainedNoteStartPoint) {
            // First click: Set start point if the spot is free
            if (!isSlotOccupied(track, snappedAngle)) {
                setSustainedNoteStartPoint({ track, angle: snappedAngle });
            }
        } else {
            // Second click: Create sustained note
            if (sustainedNoteStartPoint.track !== track) {
                // Mismatched track, start over on the new track
                 if (!isSlotOccupied(track, snappedAngle)) {
                    setSustainedNoteStartPoint({ track, angle: snappedAngle });
                } else {
                    setSustainedNoteStartPoint(null);
                }
                return;
            }

            const angle1 = sustainedNoteStartPoint.angle;
            const angle2 = snappedAngle;

            if (angle1 === angle2) { // Clicked same spot twice, cancel
                setSustainedNoteStartPoint(null);
                return;
            }

            // Calculate shortest path for the arc
            let startAngle, durationAngle;
            const clockwiseDist = (angle2 - angle1 + 360) % 360;
            
            if (clockwiseDist <= 180) {
                startAngle = angle1;
                durationAngle = clockwiseDist;
            } else {
                startAngle = angle2;
                durationAngle = 360 - clockwiseDist;
            }

            if (durationAngle < snapAngleForTrack / 2) {
                setSustainedNoteStartPoint(null);
                return; // Duration too small, cancel.
            }

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
            setSustainedNoteStartPoint(null); // Reset after creation attempt
        }
    } else {
        // Single note mode
        if (!isSlotOccupied(track, snappedAngle)) {
            const newNote: Note = {
                id: `note-${Date.now()}-${Math.random()}`,
                track: track,
                angle: snappedAngle,
                color: activeColor.color,
                name: activeColor.name,
            };
            setNotes(prev => [...prev, newNote]);
        }
    }
  }, [isPlaying, notes, isSustainedMode, sustainedNoteStartPoint, activeColor, resumeAudio]);
  

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
              onDiscClick={handleDiscClick}
              activeColor={activeColor}
              sustainedNoteStartPoint={sustainedNoteStartPoint}
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
            isSustainedMode={isSustainedMode}
            onSustainedModeToggle={handleSustainedModeToggle}
        />
        <div className={`w-full transition-all duration-500 ease-in-out ${isEffectsPanelOpen ? 'opacity-100 max-h-[500px] visible' : 'opacity-0 max-h-0 invisible'}`}>
          {isEffectsPanelOpen && <EffectsControls effects={effects} onChange={handleEffectChange} />}
        </div>
      </div>
    </div>
  );
};

export default App;
