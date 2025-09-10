
import React from 'react';

const iconProps = {
  className: "w-6 h-6 text-white",
  viewBox: "0 0 24 24",
  fill: "currentColor",
  xmlns: "http://www.w3.org/2000/svg",
};

export const PlayIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon: React.FC = () => (
  <svg {...iconProps}>
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

export const RecordIcon: React.FC<{ isRecording: boolean }> = ({ isRecording }) => (
  <svg {...iconProps}>
    {isRecording ? (
       <rect x="6" y="6" width="12" height="12" rx="2"></rect>
    ) : (
       <circle cx="12" cy="12" r="8"></circle>
    )}
  </svg>
);

export const ClearIcon: React.FC = () => (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
        <line x1="18" y1="9" x2="12" y2="15"></line>
        <line x1="12" y1="9" x2="18" y2="15"></line>
    </svg>
);

export const DownloadIcon: React.FC = () => (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

export const EffectsIcon: React.FC = () => (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14"></line>
        <line x1="4" y1="10" x2="4" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12" y2="3"></line>
        <line x1="20" y1="21" x2="20" y2="16"></line>
        <line x1="20" y1="12" x2="20" y2="3"></line>
        <line x1="1" y1="14" x2="7" y2="14"></line>
        <line x1="9" y1="8" x2="15" y2="8"></line>
        {/* FIX: Corrected malformed SVG line */}
        <line x1="17" y1="16" x2="23" y2="16"></line>
    </svg>
);

{/* FIX: Added missing icons */}
export const SustainIcon: React.FC = () => (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18h16"></path>
        <path d="M8 18V8a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v10"></path>
    </svg>
);

export const AIIcon: React.FC = () => (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v6M4.2 8.2l4.2 4.2M3 12h6M4.2 15.8l4.2-4.2M12 21v-6M19.8 15.8l-4.2-4.2M21 12h-6M19.8 8.2l-4.2 4.2"></path>
    </svg>
);

export const SpinnerIcon: React.FC = () => (
  <svg
    {...iconProps}
    className="w-6 h-6 text-white animate-spin"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
