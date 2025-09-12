
export interface Note {
  id: string;
  track: number; // 0-indexed from the outermost track
  angle: number; // in degrees (0-360).
  color: string;
  name: string;
  // FIX: Add durationAngle to support sustained notes.
  durationAngle: number; // The angular length of the note in degrees.
}

export interface NoteColor {
  name: string;
  color: string;
  freq: number;
}


// --- New Audio Effect Types ---

export interface Distortion {
  on: boolean;
  drive: number; // 0 to 1
  tone: number; // frequency in Hz
  output: number; // 0 to 1
}

export interface Panner {
  on: boolean;
  pan: number; // -1 (left) to 1 (right)
}

export interface Phaser {
  on: boolean;
  rate: number; // Hz
  depth: number; // 0 to 1
  feedback: number; // 0 to 1
}

export interface Flanger {
  on: boolean;
  delay: number; // ms
  depth: number; // ms
  feedback: number; // 0 to 1
  rate: number; // Hz
}

export interface Chorus {
  on: boolean;
  rate: number; // Hz
  depth: number; // 0 to 1
}

export interface Tremolo {
  on: boolean;
  frequency: number; // Hz
  depth: number; // 0 to 1
}

export interface Delay {
  on: boolean;
  time: number; // seconds
  feedback: number; // 0 to 1
}

export interface Reverb {
  on: boolean;
  decay: number; // seconds
  wet: number; // 0 to 1 (wet mix)
}

export interface AudioEffects {
  distortion: Distortion;
  panner: Panner;
  phaser: Phaser;
  flanger: Flanger;
  chorus: Chorus;
  tremolo: Tremolo;
  delay: Delay;
  reverb: Reverb;
}
