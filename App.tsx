import React, { useState, useEffect, useRef, useCallback } from 'react';
import Disc from './components/Disc';
import Controls from './components/Controls';
import EffectsControls from './components/EffectsControls';
import useAudioEngine from './hooks/useAudioEngine';
import type { Note, NoteColor, AudioEffects } from './types';
import { NOTE_COLORS, TRACK_SNAP_ANGLES } from './constants';

// --- Collision Detection Helpers ---
const isAngleInArc = (angle: number, arcStart: number, arcDuration: number): boolean => {
    const arcEnd = (arcStart + arcDuration) % 360;
    // A small epsilon is used to handle floating point inaccuracies at the boundary.
    const epsilon = 0.001; 
    if (arcStart < arcEnd) { // No wraparound
        return angle >= arcStart && angle < arcEnd - epsilon;
    } else { // Wraparound
        return angle >= arcStart || angle < arcEnd - epsilon;
    }
};

const findNoteAt = (notes: Note[], track: number, angle: number): Note | null => {
    for (const note of notes) {
        if (note.track !== track) continue;
        if (isAngleInArc(angle, note.angle, note.durationAngle)) {
            return note;
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
  const [isSustainMode, setIsSustainMode] = useState<boolean>(false);
  
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
    subOctaveMix: 0,
  });

  const { 
    startSustainedNote,
    stopSustainedNote, 
    startRecording, 
    stopRecording, 
    isRecording, 
    resumeAudio,
    updateEffects,
  } = useAudioEngine();

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

  const handleToggleSustainMode = () => {
      setIsSustainMode(prev => !prev);
  }

  const animate = useCallback(() => {
    setRotation(prevRotation => {
      const degreesPerSecond = 360 / rotationSpeed;
      const degreesPerFrame = degreesPerSecond / 60; // Assuming 60fps
      const newRotation = (prevRotation + degreesPerFrame) % 360;
      const playheadPosition = 0; // Playhead is now at the top of the disc (0 degrees)

      notes.forEach(note => {
        if (!activeTracks[note.track]) return;
        
        const noteDetails = NOTE_COLORS.find(nc => nc.color === note.color);
        if (!noteDetails) return;
        
        const octaveMultiplier = Math.pow(2, note.track);
        const freq = noteDetails.freq * octaveMultiplier;

        const visualStartAngle = (note.angle + newRotation) % 360;
        const visualEndAngle = (visualStartAngle + note.durationAngle) % 360;
        
        let isCurrentlyActive = false;
        // Handle the two cases for an angle being inside an arc
        if (visualStartAngle < visualEndAngle) {
            // Normal case: the arc doesn't cross the 0-degree line
            isCurrentlyActive = playheadPosition >= visualStartAngle && playheadPosition < visualEndAngle;
        } else if (visualStartAngle > visualEndAngle) {
            // Wrap-around case: the arc crosses the 0-degree line
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
      });
      return newRotation;
    });
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [notes, rotationSpeed, activeTracks, startSustainedNote, stopSustainedNote]);

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

        const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
        // Use Math.floor to snap to the beginning of the slot the user clicked in.
        const snappedAngle = (Math.floor(angle / snapAngleForTrack) * snapAngleForTrack) % 360;
        
        const noteAtSnappedSlot = findNoteAt(notes, track, snappedAngle);

        if (isSustainMode) {
            // --- SUSTAIN MODE LOGIC ---
            if (noteAtSnappedSlot) {
                // If the user clicks a slot that is already part of a note, delete that note.
                setNotes(prev => prev.filter(n => n.id !== noteAtSnappedSlot.id));
                return;
            }

            // If the clicked slot is empty, try to extend or merge.
            // Find a note to the LEFT (counter-clockwise) of the click that can be extended.
            const noteOnLeft = notes.find(n =>
                n.track === track &&
                n.color === activeColor.color &&
                Math.abs(((n.angle + n.durationAngle) % 360) - snappedAngle) < 1
            );

            // Find a note to the RIGHT (clockwise) of the click that can be extended.
            const noteOnRight = notes.find(n =>
                n.track === track &&
                n.color === activeColor.color &&
                Math.abs(n.angle - ((snappedAngle + snapAngleForTrack) % 360)) < 1
            );

            if (noteOnLeft && noteOnRight) {
                // --- Merge Case ---
                const newDuration = noteOnLeft.durationAngle + snapAngleForTrack + noteOnRight.durationAngle;
                const remainingNotes = notes.filter(n => n.id !== noteOnLeft.id && n.id !== noteOnRight.id);
                const mergedNote = { ...noteOnLeft, durationAngle: newDuration };
                setNotes([...remainingNotes, mergedNote]);

            } else if (noteOnLeft) {
                // --- Extend End Case ---
                setNotes(notes.map(n =>
                    n.id === noteOnLeft.id
                        ? { ...n, durationAngle: n.durationAngle + snapAngleForTrack }
                        : n
                ));

            } else if (noteOnRight) {
                // --- Extend Start Case ---
                setNotes(notes.map(n =>
                    n.id === noteOnRight.id
                        ? { ...n, angle: snappedAngle, durationAngle: n.durationAngle + snapAngleForTrack }
                        : n
                ));
            }
            // If no adjacent note is found, do nothing.

        } else {
            // --- NORMAL MODE: ADD/REMOVE SINGLE NOTES ---
            if (noteAtSnappedSlot) {
                setNotes(prev => prev.filter(n => n.id !== noteAtSnappedSlot.id));
            } else {
                const newNote: Note = {
                    id: `note-${Date.now()}-${Math.random()}`,
                    track: track,
                    angle: snappedAngle,
                    color: activeColor.color,
                    name: activeColor.name,
                    durationAngle: snapAngleForTrack,
                };
                setNotes(prev => [...prev, newNote]);
            }
        }
    }, [isPlaying, isSustainMode, notes, activeColor, resumeAudio]);


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
            isSustainMode={isSustainMode}
            onToggleSustainMode={handleToggleSustainMode}
        />
        <div className={`w-full transition-all duration-500 ease-in-out ${isEffectsPanelOpen ? 'opacity-100 max-h-[500px] visible' : 'opacity-0 max-h-0 invisible'}`}>
          {isEffectsPanelOpen && <EffectsControls effects={effects} onChange={handleEffectChange} />}
        </div>
      </div>
    </div>
  );
};

export default App;