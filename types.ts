
export interface Note {
  id: string;
  track: number; // 0-indexed from the outermost track
  angle: number; // in degrees (0-360).
  color: string;
  name: string;
  durationAngle: number; // The angular length of the note in degrees.
}

export interface NoteColor {
  name: string;
  color: string;
  freq: number;
}

// FIX: Added DistortionType and ReverbType for the new audio engine, which were imported but not defined.
export type DistortionType = 'soft' | 'hard';
export type ReverbType = 'hall' | 'plate' | 'spring' | 'custom';

// FIX: Updated effect types to match the new audio engine and EffectsControls component.
export interface DistortionEffect {
  on: boolean;
  drive: number;
  tone: number;
  output: number;
}

export interface PannerEffect {
  on: boolean;
  pan: number;
}

export interface PhaserEffect {
  on: boolean;
  rate: number;
  depth: number;
  feedback: number;
}

export interface FlangerEffect {
  on: boolean;
  delay: number;
  depth: number;
  feedback: number;
  rate: number;
}

export interface ChorusEffect {
  on: boolean;
  rate: number;
  depth: number;
}

export interface TremoloEffect {
  on: boolean;
  frequency: number;
  depth: number;
}

export interface DelayEffect {
  on: boolean;
  time: number;
  feedback: number;
}

export interface ReverbEffect {
  on: boolean;
  decay: number;
  wet: number;
}

// NOTE: GhostEffect and GlitchEffect are part of an older app version and are not used by the `src` files.
// They are removed to align with the more recent `EffectsControls` component.
export interface GhostEffect {
    on: boolean;
    intensity: number; // Controls the mix of the shimmer/ghostly trail
}

export interface GlitchEffect {
    on: boolean;
    intensity: number; // Controls the amount of bitcrushing/sample rate reduction
}

export interface BitcrusherEffect {
    on: boolean;
    bitDepth: number; // 4-16
    mix: number; // 0-1
}

export interface VibratoEffect {
    on: boolean;
    rate: number; // in Hz
    depth: number; // in cents
}


// FIX: Updated AudioEffects to include all new effects used in src/App.tsx and fix errors in EffectsControls.tsx.
export interface AudioEffects {
  distortion: DistortionEffect;
  panner: PannerEffect;
  phaser: PhaserEffect;
  flanger: FlangerEffect;
  chorus: ChorusEffect;
  tremolo: TremoloEffect;
  delay: DelayEffect;
  reverb: ReverbEffect;
  bitcrusher: BitcrusherEffect;
  vibrato: VibratoEffect;
}