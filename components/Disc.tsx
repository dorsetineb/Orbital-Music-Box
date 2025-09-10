import React from 'react';
import type { Note } from '../types';
import { DISC_SIZE, TRACK_COUNT, TRACK_WIDTH, INNER_RADIUS, TRACK_GAP, TRACK_RADII, TRACK_SNAP_ANGLES } from '../constants';

interface DiscProps {
  notes: Note[];
  rotation: number;
  isPlaying: boolean;
  activeTracks: boolean[];
  onToggleTrack: (trackIndex: number) => void;
  onDiscClick: (track: number, angle: number) => void;
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

// --- SVG Arc Helpers ---
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    // 0 degrees is at the top (12 o'clock)
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number): string => {
    // Prevent rendering artifacts for very small arcs by ensuring a minimum length.
    if (Math.abs(endAngle - startAngle) < 0.01) {
        endAngle = startAngle + 0.01;
    }
    // Handle full circles
    const fullCircle = Math.abs(endAngle - startAngle) >= 360;
    if (fullCircle) {
        endAngle = startAngle + 359.99;
    }

    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    
    const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
    
    const d = [
        'M', start.x, start.y,
        'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y,
    ].join(' ');

    return d;
};


const Disc: React.FC<DiscProps> = (props) => {
    const { 
        notes, 
        rotation, 
        isPlaying, 
        activeTracks, 
        onToggleTrack, 
        onDiscClick
    } = props;
    
  const getCoordsFromEvent = (e: React.MouseEvent<SVGSVGElement>): { track: number; angle: number } | null => {
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

    // Calculate angle where 0 is at the top, increasing clockwise.
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) {
      angle += 360;
    }

    // Adjust for disc rotation to get the logical angle of the note
    const adjustedAngle = (angle - rotation + 360) % 360;
    
    for (let i = 0; i < TRACK_COUNT; i++) {
        // We check from the inside out to find the track
        const trackStartRadius = INNER_RADIUS + i * (TRACK_WIDTH + TRACK_GAP);
        const trackEndRadius = trackStartRadius + TRACK_WIDTH;
        if (distance >= trackStartRadius && distance <= trackEndRadius) {
            // Return the logical track index (0 is outermost)
            return { track: TRACK_COUNT - 1 - i, angle: adjustedAngle };
        }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPlaying) return;
      const coords = getCoordsFromEvent(e);
      if (coords) {
          onDiscClick(coords.track, coords.angle);
      }
  };

  return (
    <div className="w-full h-full">
      <svg
        viewBox={`-10 -10 ${DISC_SIZE + 20} ${DISC_SIZE + 20}`}
        onMouseDown={handleMouseDown}
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
                  // Render the dot in the middle of the slot for correct visual alignment.
                  const angle = pointIndex * snapAngle + snapAngle / 2;
                  const pos = polarToCartesian(DISC_SIZE/2, DISC_SIZE/2, radius, angle);
                  return (
                      <circle
                          key={`snap-${trackIndex}-${pointIndex}`}
                          cx={pos.x}
                          cy={pos.y}
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
            // Use an epsilon to handle floating point inaccuracies.
            const isSingleNote = note.durationAngle <= TRACK_SNAP_ANGLES[note.track] + 0.01;

            if (isSingleNote) {
                // --- RENDER CIRCLE for single notes ---
                // Calculate the center of the slot for correct visual positioning.
                const centerAngle = note.angle + note.durationAngle / 2;
                const pos = polarToCartesian(DISC_SIZE / 2, DISC_SIZE / 2, trackRadius, centerAngle);
                const noteRadius = TRACK_WIDTH / 2;
                return (
                    <g key={note.id} className="pointer-events-none">
                        {/* Border */}
                        <circle cx={pos.x} cy={pos.y} r={noteRadius + 3} fill={lightenHexColor(note.color, 40)} />
                        {/* Fill */}
                        <circle cx={pos.x} cy={pos.y} r={noteRadius} fill={note.color} />
                    </g>
                );
            } else {
                // --- RENDER ARC for sustained notes ---
                let startAngle = note.angle;
                let endAngle = note.angle + note.durationAngle;

                // Compensate for the round line cap, which extends half the stroke width visually.
                const capOffsetAngle = (Math.atan((TRACK_WIDTH / 2) / trackRadius) * 180 / Math.PI);
                const compensatedStart = startAngle + capOffsetAngle;
                const compensatedEnd = endAngle - capOffsetAngle;

                // Only apply the compensation if the note is long enough, to prevent visual glitches.
                if (compensatedEnd > compensatedStart) {
                    startAngle = compensatedStart;
                    endAngle = compensatedEnd;
                }

                const pathData = describeArc(DISC_SIZE / 2, DISC_SIZE / 2, trackRadius, startAngle, endAngle);
                return (
                    <g key={note.id} className="pointer-events-none">
                        {/* Border */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke={lightenHexColor(note.color, 40)}
                            strokeWidth={TRACK_WIDTH + 6}
                            strokeLinecap="round"
                        />
                        {/* Fill */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke={note.color}
                            strokeWidth={TRACK_WIDTH}
                            strokeLinecap="round"
                        />
                    </g>
                );
            }
          })}
        </g>

        {/* Static Playhead and Controls at the top */}
        <g>
            {/* Playhead */}
            <line
                x1={DISC_SIZE / 2}
                y1={0}
                x2={DISC_SIZE / 2}
                y2={(DISC_SIZE / 2) - INNER_RADIUS + TRACK_GAP}
                stroke="rgba(107, 114, 128, 0.8)" // Gray-500
                strokeWidth="8"
                strokeLinecap="round"
                className="pointer-events-none"
            />

            {/* Track Toggles */}
            {TRACK_RADII.map((radius, i) => {
                const trackIndex = i;
                const isActive = activeTracks[trackIndex];
                const buttonCenterX = DISC_SIZE / 2;
                const buttonCenterY = (DISC_SIZE / 2) - radius;
                const buttonRadius = TRACK_WIDTH / 2; // Same size as a single note

                return (
                    <g
                        key={`track-btn-svg-${trackIndex}`}
                        onClick={(e) => { e.stopPropagation(); onToggleTrack(trackIndex); }}
                        className="pointer-events-auto group"
                        style={{ cursor: 'pointer' }}
                    >
                        <title>Toggle Track {trackIndex + 1}</title>
                        {/* Outer button circle */}
                        <circle
                            cx={buttonCenterX}
                            cy={buttonCenterY}
                            r={buttonRadius}
                            fill="rgba(255, 255, 255, 0.15)"
                            className="transition-colors group-hover:fill-white/25"
                        />
                        {/* Inner indicator circle */}
                        <circle
                            cx={buttonCenterX}
                            cy={buttonCenterY}
                            r={isActive ? 8 : 6} // Grow slightly when active
                            fill={isActive ? 'white' : 'rgba(255, 255, 255, 0.3)'}
                            className="transition-all pointer-events-none"
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