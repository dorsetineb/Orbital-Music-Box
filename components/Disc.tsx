import React from 'react';
import type { Note } from '../types';
import { DISC_SIZE, TRACK_COUNT, TRACK_WIDTH, INNER_RADIUS, TRACK_GAP, TRACK_RADII, TRACK_SNAP_ANGLES } from '../constants';

interface DiscProps {
  notes: Note[];
  rotation: number;
  isPlaying: boolean;
  onAddOrRemoveNote: (track: number, angle: number) => void;
  activeTracks: boolean[];
  onToggleTrack: (trackIndex: number) => void;
}

const lightenHexColor = (hex: string, percent: number): string => {
    if (!hex.startsWith('#') || (hex.length !== 4 && hex.length !== 7)) return hex;
    
    let r, g, b;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }

    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

    const toHex = (c: number) => ('00' + c.toString(16)).slice(-2);

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};


const Disc: React.FC<DiscProps> = ({ notes, rotation, isPlaying, onAddOrRemoveNote, activeTracks, onToggleTrack }) => {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPlaying) return; // Prevent adding/removing notes while playing

    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const centerX = DISC_SIZE / 2;
    const centerY = DISC_SIZE / 2;

    const dx = svgP.x - centerX;
    const dy = svgP.y - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) {
      angle += 360;
    }

    const currentDiscRotation = rotation;
    const adjustedAngle = (angle - currentDiscRotation + 360) % 360;
    
    // Tracks are ordered from inner to outer for radius calculation
    for (let i = 0; i < TRACK_COUNT; i++) {
        // Here, `i` corresponds to the visual track from the center (0=inner)
        const trackStartRadius = INNER_RADIUS + i * (TRACK_WIDTH + TRACK_GAP);
        const trackEndRadius = trackStartRadius + TRACK_WIDTH;
        if (distance >= trackStartRadius && distance <= trackEndRadius) {
            // Convert visual track index `i` to logical track index (0 = outermost)
            onAddOrRemoveNote(TRACK_COUNT - 1 - i, adjustedAngle);
            break;
        }
    }
  };
  
  // These variables define the playhead as if it were drawn horizontally to the right
  const playheadVerticalMargin = 20; 
  const playheadThickness = TRACK_WIDTH + 30; // The thickness of the rod
  const playheadLength = (TRACK_COUNT * TRACK_WIDTH) + ((TRACK_COUNT - 1) * TRACK_GAP) + (playheadVerticalMargin * 2); // The length of the rod
  const playheadX = (DISC_SIZE / 2) + INNER_RADIUS - playheadVerticalMargin;
  const playheadY = (DISC_SIZE / 2) - (playheadThickness / 2);


  return (
    <div className="w-full h-full">
      <svg
        viewBox={`-10 -10 ${DISC_SIZE + 20} ${DISC_SIZE + 20}`}
        onClick={handleClick}
        className={isPlaying ? 'cursor-default' : 'cursor-pointer'}
        style={{ width: '100%', height: '100%' }}
      >
        <g transform={`rotate(${rotation} ${DISC_SIZE / 2} ${DISC_SIZE / 2})`}>
          {/* Tracks */}
          {Array.from({ length: TRACK_COUNT }, (_, i) => (
            <circle
              key={`track-${i}`}
              cx={DISC_SIZE / 2}
              cy={DISC_SIZE / 2}
              r={INNER_RADIUS + i * (TRACK_WIDTH + TRACK_GAP) + TRACK_WIDTH / 2}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={TRACK_WIDTH}
            />
          ))}

          {/* Snap Point Indicators */}
          {!isPlaying && TRACK_SNAP_ANGLES.map((snapAngle, trackIndex) => {
              const numPoints = 360 / snapAngle;
              const radius = TRACK_RADII[trackIndex];
              return Array.from({ length: numPoints }).map((_, pointIndex) => {
                  const angle = pointIndex * snapAngle;
                  const x = DISC_SIZE / 2 + radius * Math.cos(angle * Math.PI / 180);
                  const y = DISC_SIZE / 2 + radius * Math.sin(angle * Math.PI / 180);
                  return (
                      <circle
                          key={`snap-${trackIndex}-${pointIndex}`}
                          cx={x}
                          cy={y}
                          r="2"
                          fill="rgba(255, 255, 255, 0.1)"
                          className="pointer-events-none"
                      />
                  );
              });
          })}
          
          {/* Notes */}
          {notes.map(note => {
            const trackRadius = TRACK_RADII[note.track];
            const x = DISC_SIZE / 2 + trackRadius * Math.cos(note.angle * Math.PI / 180);
            const y = DISC_SIZE / 2 + trackRadius * Math.sin(note.angle * Math.PI / 180);
            return (
              <circle
                key={note.id}
                cx={x}
                cy={y}
                r={TRACK_WIDTH / 2}
                fill={note.color}
                stroke={lightenHexColor(note.color, 40)}
                strokeWidth={3}
                className="pointer-events-none"
              />
            );
          })}
        </g>

        {/* --- SVG Playhead --- */}
        {/* The group is rotated 90 degrees to position the playhead at the bottom */}
        <g transform={`rotate(90, ${DISC_SIZE / 2}, ${DISC_SIZE / 2})`}>
          {/* Playhead Rod - Drawn horizontally, then rotated */}
           <rect
                x={playheadX}
                y={playheadY}
                width={playheadLength}
                height={playheadThickness}
                fill="#4a5568" // gray-700
                rx={playheadThickness / 2} // Fully rounded ends
            />
           {/* Buttons - Drawn horizontally, then rotated */}
            {TRACK_RADII.map((radius, i) => {
              const trackIndex = i; 
              const isActive = activeTracks[trackIndex];
              // Calculate position as if on the right side of the disc
              const buttonCenterX = (DISC_SIZE / 2) + radius;
              const buttonCenterY = DISC_SIZE / 2;

              return (
                  <g 
                    key={`track-btn-svg-${trackIndex}`}
                    onClick={(e) => { e.stopPropagation(); onToggleTrack(trackIndex); }}
                    className="pointer-events-auto"
                    style={{ cursor: 'pointer' }}
                  >
                        <title>Toggle Track {trackIndex + 1}</title>
                        {/* Hitbox / Background */}
                        <circle
                            cx={buttonCenterX}
                            cy={buttonCenterY}
                            r={TRACK_WIDTH / 2}
                            fill={isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(55, 65, 81, 0.5)'}
                            stroke={isActive ? 'rgba(255, 255, 255, 0.5)' : 'rgba(107, 114, 128, 0.5)'}
                            strokeWidth="2"
                        />
                        {/* Inner Dot */}
                         <circle
                            cx={buttonCenterX}
                            cy={buttonCenterY}
                            r="6"
                            fill={isActive ? '#ffffff' : 'rgba(107, 114, 128, 0.5)'}
                            className="transition-colors"
                        />
                  </g>
              );
          })}
        </g>
      </svg>
    </div>
  );
};

export default Disc;