
export interface Note {
  id: string;
  track: number; // 0-indexed from the outermost track
  angle: number; // in degrees (0-360). This is the start angle.
  durationAngle: number; // The length of the note in degrees.
  color: string;
  name: string;
}

export interface NoteColor {
  name: string;
  color: string;
  freq: number;
}

export type ReverbType = 'short' | 'medium' | 'long';
export type DistortionType = 'soft' | 'hard';

export interface AudioEffects {
  reverbMix: number; // 0 to 1
  reverbType: ReverbType;
  delayMix: number; // 0 to 1
  distortionMix: number; // 0 to 1
  distortionType: DistortionType;
  phaserMix: number; // 0 to 1
  phaserRate: number; // LFO frequency in Hz
  phaserDepth: number; // LFO gain
  flangerMix: number; // 0 to 1
  flangerRate: number; // LFO frequency in Hz
  flangerDepth: number; // LFO gain (delay time modulation)
  subOctaveMix: number; // 0 to 1
}