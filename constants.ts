import type { NoteColor } from './types';

export const DISC_SIZE = 600;
export const TRACK_COUNT = 4;
export const TRACK_WIDTH = 45;
export const TRACK_GAP = 15;
export const INNER_RADIUS = (DISC_SIZE / 2) - ((TRACK_WIDTH + TRACK_GAP) * TRACK_COUNT);

// Defines the snap angle for each track, from outermost (index 0) to innermost (index 3).
// This results in 36, 24, 16, and 12 positions, respectively.
export const TRACK_SNAP_ANGLES = [10, 15, 22.5, 30];

export const TRACK_RADII = Array.from({ length: TRACK_COUNT }, (_, i) => {
    // This calculates radius from the center outwards for rendering circles.
    const logicalIndex = TRACK_COUNT - 1 - i;
    return INNER_RADIUS + logicalIndex * (TRACK_WIDTH + TRACK_GAP) + TRACK_WIDTH / 2;
});


// Diatonic Scale (C Major)
export const NOTE_COLORS: NoteColor[] = [
  { name: 'C4', color: '#ef4444', freq: 261.63 }, // Red
  { name: 'D4', color: '#f97316', freq: 293.66 }, // Orange
  { name: 'E4', color: '#eab308', freq: 329.63 }, // Yellow
  { name: 'F4', color: '#22c55e', freq: 349.23 }, // Green
  { name: 'G4', color: '#0ea5e9', freq: 392.00 }, // Light Blue
  { name: 'A4', color: '#3b82f6', freq: 440.00 }, // Dark Blue
  { name: 'B4', color: '#ec4899', freq: 493.88 }, // Pink
];