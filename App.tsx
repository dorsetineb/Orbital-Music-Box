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
    startRecording, 
    stopRecording, 
    isRecording, 
    resumeAudio,
    updateEffects,
  } = useAudioEngine();

  const lastPlayedRef = useRef<Map<string, number>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  // Update audio engine when effects change
  useEffect(() => {
    updateEffects(effects);
  }, [effects, updateEffects]);

  const handleAddOrRemoveNote = async (track: number, angle: number) => {
    await resumeAudio(); // Crucial: ensure audio is ready before state changes.
    
    const trackRadius = TRACK_RADII[track];
    // This is the angular distance from a note's center to its edge
    const noteAngularRadius = Math.atan2(TRACK_WIDTH / 2, trackRadius) * (180 / Math.PI);

    const existingNoteIndex = notes.findIndex(note => {
        if (note.track !== track) return false;
        
        const angleDiff = Math.min(
            Math.abs(note.angle - angle),
            360 - Math.abs(note.angle - angle)
        );
        // A click is "on" a note if it's within its radius (from the center)
        return angleDiff < noteAngularRadius;
    });

    if (existingNoteIndex !== -1) {
        setNotes(prev => prev.filter((_, index) => index !== existingNoteIndex));
    } else {
        // Get the snap angle for the specific track
        const snapAngleForTrack = TRACK_SNAP_ANGLES[track];
        // Snap the angle to the nearest predefined position for that track
        const snappedAngle = (Math.round(angle / snapAngleForTrack) * snapAngleForTrack) % 360;

        // Check if a note already exists at this snapped position on the same track
        const isSlotOccupied = notes.some(note => note.track === track && note.angle === snappedAngle);
        
        // Only add a new note if the snapped slot is not already occupied
        if (!isSlotOccupied) {
            const newNote: Note = {
                id: `note-${Date.now()}-${Math.random()}`,
                track,
                angle: snappedAngle,
                color: activeColor.color,
                name: activeColor.name,
            };
            setNotes(prev => [...prev, newNote]);
        }
    }
  };

  const handlePlayPause = async () => {
    await resumeAudio(); // Crucial: ensure audio is ready before starting playback.
    setIsPlaying(prev => !prev);
  };
  
  const handleRecord = async () => {
    await resumeAudio(); // Crucial: ensure audio is ready before recording.
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
      const playheadPosition = 90; // Playhead is at the bottom (pointing down)

      notes.forEach(note => {
        const prevNoteVisualAngle = (note.angle + prevRotation) % 360;
        const currentNoteVisualAngle = (note.angle + newRotation) % 360;
        
        let crossed = false;
        // Standard case: note crosses playhead without wrapping around 360 degrees
        if (prevNoteVisualAngle < currentNoteVisualAngle) {
            if (prevNoteVisualAngle < playheadPosition && currentNoteVisualAngle >= playheadPosition) {
                crossed = true;
            }
        // Wrap-around case: e.g., prev angle is 359, current is 1.
        } else if (prevNoteVisualAngle > currentNoteVisualAngle) { 
            if (prevNoteVisualAngle < playheadPosition || currentNoteVisualAngle >= playheadPosition) {
                crossed = true;
            }
        }

        if (crossed) {
          const now = Date.now();
          const lastPlayed = lastPlayedRef.current.get(note.id) || 0;
          
          // Debounce to prevent multiple triggers for the same pass
          if (now - lastPlayed > 250) {
            if (activeTracks[note.track]) { // Check if the note's track is active
                const noteDetails = NOTE_COLORS.find(nc => nc.color === note.color);
                if (noteDetails) {
                    // Outermost track (track 0) is base octave. Each inner track is one octave higher.
                    const octaveMultiplier = Math.pow(2, note.track);
                    playNote(noteDetails.freq * octaveMultiplier);
                }
            }
            lastPlayedRef.current.set(note.id, now);
          }
        }
      });

      return newRotation;
    });
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [notes, playNote, rotationSpeed, activeTracks]);

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
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
        <header className="absolute top-0 left-0 p-6">
            <h1 className="text-3xl font-bold text-gray-200">Orbital Music Box</h1>
        </header>

      <div className="w-full flex-1 flex items-center justify-center relative">
        <div className="w-full max-w-[600px] aspect-square">
            <Disc 
              notes={notes}
              rotation={rotation} 
              isPlaying={isPlaying} 
              onAddOrRemoveNote={handleAddOrRemoveNote}
              activeTracks={activeTracks}
              onToggleTrack={handleToggleTrack}
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