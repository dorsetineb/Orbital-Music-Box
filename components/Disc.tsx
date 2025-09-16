import React from 'react';
import type { Note } from '../types';
import { DISC_SIZE, TRACK_COUNT, TRACK_WIDTH, INNER_RADIUS, TRACK_GAP, TRACK_RADII } from '../constants';

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

    // Adjust for disc rotation to get the logical angle on the disc itself
    const adjustedAngle = (angle - rotation + 360) % 360;
    
    let closestTrackIndex = -1;
    let minRadialDistance = Infinity;

    TRACK_RADII.forEach((radius, index) => {
        const radialDistance = Math.abs(distance - radius);
        if (radialDistance < minRadialDistance) {
            minRadialDistance = radialDistance;
            closestTrackIndex = index;
        }
    });

    // If the click is within half a track's width of the center of the closest track, we have a match.
    if (closestTrackIndex !== -1 && minRadialDistance <= TRACK_WIDTH / 2) {
        return { track: closestTrackIndex, angle: adjustedAngle };
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
  
  const firstRadius = TRACK_RADII[0];
  const lastRadius = TRACK_RADII[TRACK_COUNT - 1];
  const padding = 20;
  const rectY = (DISC_SIZE / 2) - firstRadius - TRACK_WIDTH / 2 - padding;
  const rectHeight = firstRadius - lastRadius + TRACK_WIDTH + (padding * 2);
  const rectWidthWithPadding = TRACK_WIDTH + (padding * 2);
  const rectXWithPadding = DISC_SIZE / 2 - rectWidthWithPadding / 2;


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
          
          {/* Notes */}
          {notes.map(note => {
            const trackRadius = TRACK_RADII[note.track];
            const angle = note.angle + note.durationAngle / 2;
            const pos = polarToCartesian(DISC_SIZE / 2, DISC_SIZE / 2, trackRadius, angle);
            return (
              <g key={note.id} className="pointer-events-none">
                {/* Fill */}
                <circle cx={pos.x} cy={pos.y} r={TRACK_WIDTH / 2} fill={note.color} />
              </g>
            );
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
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinecap="round"
                className="pointer-events-none"
                filter="url(#glow)"
            />
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Track Toggles Background */}
            <rect
                x={rectXWithPadding}
                y={rectY}
                width={rectWidthWithPadding}
                height={rectHeight}
                rx={rectWidthWithPadding / 2}
                ry={rectWidthWithPadding / 2}
                fill="rgba(255, 255, 255, 0.15)"
            />
            
            {/* Track Toggles */}
            {TRACK_RADII.map((radius, i) => {
                const logicalTrackIndex = i;
                const isActive = activeTracks[logicalTrackIndex];
                const buttonCenterX = DISC_SIZE / 2;
                const buttonCenterY = (DISC_SIZE / 2) - radius;
                const buttonRadius = TRACK_WIDTH / 2;

                return (
                    <g
                        key={`track-btn-svg-${logicalTrackIndex}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onToggleTrack(logicalTrackIndex); }}
                        className="pointer-events-auto"
                        style={{ cursor: 'pointer' }}
                    >
                        <title>Toggle Track {logicalTrackIndex + 1}</title>
                        {/* Hitbox */}
                        <circle
                            cx={buttonCenterX}
                            cy={buttonCenterY}
                            r={buttonRadius}
                            fill="transparent"
                        />
                        {/* Outline */}
                        <circle
                            cx={buttonCenterX}
                            cy={buttonCenterY}
                            r={TRACK_WIDTH / 2}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.2)"
                            strokeWidth="1.5"
                            className="pointer-events-none"
                        />
                        {/* Inner indicator circle */}
                        <circle
                            cx={buttonCenterX}
                            cy={buttonCenterY}
                            r={isActive ? 8 : 6} // Grow slightly when active
                            fill={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'}
                            stroke={isActive ? 'rgba(0,0,0,0.2)' : 'none'}
                            strokeWidth="1"
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