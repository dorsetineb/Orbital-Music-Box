import React from 'react';
import type { NoteColor } from '../types';
import { NOTE_COLORS } from '../constants';
import { PlayIcon, PauseIcon, RecordIcon, ClearIcon, DownloadIcon, EffectsIcon, SineWaveIcon, SquareWaveIcon, SawtoothWaveIcon, TriangleWaveIcon } from './icons';

interface ControlsProps {
  isPlaying: boolean;
  isRecording: boolean;
  rotationSpeed: number;
  activeColor: NoteColor;
  recordedUrl: string | null;
  onPlayPause: () => void;
  onRecord: () => void;
  onSpeedChange: (speed: number) => void;
  onColorSelect: (color: NoteColor) => void;
  onClear: () => void;
  onToggleEffects: () => void;
  activeWaveform: OscillatorType;
  onWaveformSelect: (waveform: OscillatorType) => void;
}

const WAVEFORMS: { type: OscillatorType; icon: React.FC }[] = [
    { type: 'sine', icon: SineWaveIcon },
    { type: 'square', icon: SquareWaveIcon },
    { type: 'triangle', icon: TriangleWaveIcon },
    { type: 'sawtooth', icon: SawtoothWaveIcon },
];


const Controls: React.FC<ControlsProps> = (props) => {
  const {
    isPlaying,
    isRecording,
    rotationSpeed,
    activeColor,
    recordedUrl,
    onPlayPause,
    onRecord,
    onSpeedChange,
    onColorSelect,
    onClear,
    onToggleEffects,
    activeWaveform,
    onWaveformSelect,
  } = props;

  return (
    <div className="w-full max-w-2xl rounded-xl p-4 mt-6">
      <div className="flex flex-col items-center gap-4">

        {/* Row 1: Main Controls */}
        <div className="flex items-center gap-4">
            <button onClick={onPlayPause} className="p-4 bg-slate-700 rounded-full hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isRecording} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button 
                onClick={onRecord} 
                className={`p-4 rounded-full transition-colors ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-700 hover:bg-red-500'}`}
                 aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
                <RecordIcon isRecording={isRecording} />
            </button>
             <button onClick={onClear} className="p-4 bg-slate-700 rounded-full hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={isRecording} aria-label="Clear all notes">
                <ClearIcon />
            </button>
             <button onClick={onToggleEffects} className="p-4 bg-slate-700 rounded-full hover:bg-purple-500 transition-colors" aria-label="Toggle effects panel">
                <EffectsIcon />
            </button>
            {recordedUrl && (
                <a href={recordedUrl} download={`disqif-ai-${Date.now()}.webm`} className="p-4 bg-green-600 rounded-full hover:bg-green-500 transition-colors" aria-label="Download recording">
                    <DownloadIcon />
                </a>
            )}
        </div>

        {/* Container for Note Palette and Speed/Sustain to align their widths */}
        <div className="w-full max-w-lg flex flex-col items-center gap-3">
             {/* Row 2: Note & Waveform Palettes */}
            <div className="flex justify-center items-center gap-4 sm:gap-6">
                {/* Note Palette */}
                <div className="flex justify-center items-center gap-2">
                    {NOTE_COLORS.map(note => (
                    <button
                        key={note.name}
                        onClick={() => onColorSelect(note)}
                        className={`w-9 h-9 rounded-full transition-all duration-200 flex justify-center items-center font-bold text-white ${activeColor.name === note.name ? 'ring-2 ring-offset-2 ring-offset-slate-800 scale-110' : 'opacity-60 saturate-50 hover:opacity-100 hover:saturate-100'}`}
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

                {/* Waveform Palette */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-full">
                    {WAVEFORMS.map(({ type, icon: Icon }) => (
                        <button
                            key={type}
                            onClick={() => onWaveformSelect(type)}
                            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-200 ${activeWaveform === type ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                            aria-label={`Select ${type} waveform`}
                        >
                            <Icon />
                        </button>
                    ))}
                </div>
            </div>

            {/* Row 3: Speed Control */}
            <div className="w-full pt-2">
                 <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">Velocidade</span>
                    <input
                        id="speed-control"
                        type="range"
                        min="2"
                        max="20"
                        step="0.5"
                        value={rotationSpeed}
                        onChange={(e) => onSpeedChange(Number(e.target.value))}
                        className="custom-slider w-full"
                        aria-label="Velocidade de rotação"
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Controls;