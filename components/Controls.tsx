import React from 'react';
import type { NoteColor } from '../types';
import { NOTE_COLORS } from '../constants';
import { PlayIcon, PauseIcon, RecordIcon, ClearIcon, DownloadIcon, EffectsIcon, SustainedNoteIcon } from './icons';

interface ControlsProps {
  isPlaying: boolean;
  isRecording: boolean;
  rotationSpeed: number;
  activeColor: NoteColor;
  recordedUrl: string | null;
  isEffectsPanelOpen: boolean;
  isSustainedMode: boolean;
  onPlayPause: () => void;
  onRecord: () => void;
  onSpeedChange: (speed: number) => void;
  onColorSelect: (color: NoteColor) => void;
  onClear: () => void;
  onToggleEffectsPanel: () => void;
  onSustainedModeToggle: () => void;
}

const Controls: React.FC<ControlsProps> = (props) => {
  const {
    isPlaying,
    isRecording,
    rotationSpeed,
    activeColor,
    recordedUrl,
    isEffectsPanelOpen,
    isSustainedMode,
    onPlayPause,
    onRecord,
    onSpeedChange,
    onColorSelect,
    onClear,
    onToggleEffectsPanel,
    onSustainedModeToggle
  } = props;

  return (
    <div className="w-full max-w-2xl bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-700 mt-6">
      <div className="flex flex-col items-center gap-4">

        {/* Row 1: Note Palette */}
        <div className="flex flex-wrap justify-center items-center gap-3">
            {NOTE_COLORS.map(note => (
            <button
                key={note.name}
                onClick={() => onColorSelect(note)}
                className={`w-10 h-10 rounded-full transition-transform duration-200 flex justify-center items-center font-bold text-white ${activeColor.name === note.name ? 'ring-2 ring-offset-2 ring-offset-gray-800' : ''}`}
                style={{ 
                    backgroundColor: note.color, 
                    '--tw-ring-color': note.color,
                    textShadow: '0px 1px 3px rgba(0,0,0,0.6)' 
                } as React.CSSProperties}
                aria-label={`Select note ${note.name}`}
            >
                {note.name.charAt(0)}
            </button>
            ))}
        </div>

        {/* Row 2: Main Controls */}
        <div className="flex items-center gap-4">
            <button onClick={onPlayPause} className="p-3 bg-gray-700 rounded-full hover:bg-cyan-500 transition-colors" disabled={isRecording} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button 
                onClick={onRecord} 
                className={`p-3 rounded-full transition-colors ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-700 hover:bg-red-500'}`}
                 aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
                <RecordIcon isRecording={isRecording} />
            </button>
             <button onClick={onClear} className="p-3 bg-gray-700 rounded-full hover:bg-yellow-500 transition-colors" disabled={isRecording || isSustainedMode} aria-label="Clear all notes">
                <ClearIcon />
            </button>
            <button onClick={onSustainedModeToggle} className={`p-3 rounded-full transition-colors ${isSustainedMode ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-cyan-600'}`} aria-label="Toggle sustained note mode" disabled={isPlaying || isRecording}>
                <SustainedNoteIcon />
            </button>
            <button onClick={onToggleEffectsPanel} className={`p-3 rounded-full transition-colors ${isEffectsPanelOpen ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-cyan-600'}`} aria-label="Toggle effects panel">
                <EffectsIcon />
            </button>
            {recordedUrl && (
                <a href={recordedUrl} download={`disqif-ai-${Date.now()}.webm`} className="p-3 bg-green-600 rounded-full hover:bg-green-500 transition-colors" aria-label="Download recording">
                    <DownloadIcon />
                </a>
            )}
        </div>
        
        {/* Row 3: Speed Control */}
        <div className="flex items-center gap-3 w-full max-w-xs">
            <span className="text-gray-400 text-sm">Speed</span>
            <input
                id="speed-control"
                type="range"
                min="2"
                max="20"
                step="0.5"
                value={rotationSpeed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white"
                aria-label="Rotation speed"
            />
        </div>

      </div>
    </div>
  );
};

export default Controls;
