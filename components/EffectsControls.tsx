import React from 'react';
import type { AudioEffects, ReverbType, DistortionType } from '../types';

interface EffectsControlsProps {
    effects: AudioEffects;
    onChange: <K extends keyof AudioEffects>(effect: K, value: AudioEffects[K]) => void;
}

const ControlButton: React.FC<{onClick: () => void, isActive: boolean, children: React.ReactNode}> = ({ onClick, isActive, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 text-sm rounded-md transition-colors ${isActive ? 'bg-cyan-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
    >
        {children}
    </button>
);


const EffectsControls: React.FC<EffectsControlsProps> = ({ effects, onChange }) => {
    
    return (
        <div className="w-full bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-700">
            <h3 className="text-lg font-bold text-gray-300 mb-3 text-center">Effects</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                
                {/* Reverb Controls */}
                <div className="flex items-center gap-3">
                    <label className="text-gray-400 text-sm w-24">Reverb Type</label>
                    <div className="flex items-center gap-2">
                        {(['short', 'medium', 'long'] as ReverbType[]).map(type => (
                           <ControlButton key={type} onClick={() => onChange('reverbType', type)} isActive={effects.reverbType === type}>
                             {type.charAt(0).toUpperCase() + type.slice(1)}
                           </ControlButton>
                        ))}
                    </div>
                </div>
                 <div className="flex items-center gap-3">
                    <label htmlFor="reverbMix" className="text-gray-400 text-sm w-24">Reverb Mix</label>
                    <input
                        id="reverbMix"
                        type="range" min="0" max="1" step="0.01" value={effects.reverbMix}
                        onChange={(e) => onChange('reverbMix', Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white"
                    />
                </div>

                {/* Distortion Controls */}
                 <div className="flex items-center gap-3">
                    <label className="text-gray-400 text-sm w-24">Distortion</label>
                     <div className="flex items-center gap-2">
                        {(['soft', 'hard'] as DistortionType[]).map(type => (
                           <ControlButton key={type} onClick={() => onChange('distortionType', type)} isActive={effects.distortionType === type}>
                             {type.charAt(0).toUpperCase() + type.slice(1)}
                           </ControlButton>
                        ))}
                    </div>
                </div>
                 <div className="flex items-center gap-3">
                    <label htmlFor="distortionMix" className="text-gray-400 text-sm w-24">Distortion Mix</label>
                    <input
                        id="distortionMix"
                        type="range" min="0" max="1" step="0.01" value={effects.distortionMix}
                        onChange={(e) => onChange('distortionMix', Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white"
                    />
                </div>

                {/* Delay Slider */}
                <div className="flex items-center gap-3 md:col-span-2">
                    <label htmlFor="delayMix" className="text-gray-400 text-sm w-24">Delay Mix</label>
                    <input
                        id="delayMix"
                        type="range" min="0" max="1" step="0.01" value={effects.delayMix}
                        onChange={(e) => onChange('delayMix', Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white"
                    />
                </div>
                
                {/* Sub-Octave Slider */}
                <div className="flex items-center gap-3 md:col-span-2">
                    <label htmlFor="subOctaveMix" className="text-gray-400 text-sm w-24">Sub Octave</label>
                    <input
                        id="subOctaveMix"
                        type="range" min="0" max="1" step="0.01" value={effects.subOctaveMix}
                        onChange={(e) => onChange('subOctaveMix', Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white"
                    />
                </div>

                {/* --- Spacer & Title for Modulation Effects --- */}
                <hr className="md:col-span-2 border-gray-700 my-2" />


                {/* Phaser Controls */}
                <div className="flex items-center gap-3">
                    <label htmlFor="phaserMix" className="text-gray-400 text-sm w-24">Phaser Mix</label>
                    <input id="phaserMix" type="range" min="0" max="1" step="0.01" value={effects.phaserMix} onChange={(e) => onChange('phaserMix', Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white" />
                </div>
                <div /> {/* Spacer */}
                <div className="flex items-center gap-3">
                    <label htmlFor="phaserRate" className="text-gray-400 text-sm w-24">Phaser Rate</label>
                    <input id="phaserRate" type="range" min="0.1" max="8" step="0.1" value={effects.phaserRate} onChange={(e) => onChange('phaserRate', Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white" />
                </div>
                <div className="flex items-center gap-3">
                    <label htmlFor="phaserDepth" className="text-gray-400 text-sm w-24">Phaser Depth</label>
                    <input id="phaserDepth" type="range" min="100" max="1500" step="10" value={effects.phaserDepth} onChange={(e) => onChange('phaserDepth', Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white" />
                </div>

                 {/* Flanger Controls */}
                 <div className="flex items-center gap-3">
                    <label htmlFor="flangerMix" className="text-gray-400 text-sm w-24">Flanger Mix</label>
                    <input id="flangerMix" type="range" min="0" max="1" step="0.01" value={effects.flangerMix} onChange={(e) => onChange('flangerMix', Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white" />
                </div>
                <div /> {/* Spacer */}
                <div className="flex items-center gap-3">
                    <label htmlFor="flangerRate" className="text-gray-400 text-sm w-24">Flanger Rate</label>
                    <input id="flangerRate" type="range" min="0.05" max="5" step="0.05" value={effects.flangerRate} onChange={(e) => onChange('flangerRate', Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white" />
                </div>
                <div className="flex items-center gap-3">
                    <label htmlFor="flangerDepth" className="text-gray-400 text-sm w-24">Flanger Depth</label>
                    <input id="flangerDepth" type="range" min="0.001" max="0.02" step="0.001" value={effects.flangerDepth} onChange={(e) => onChange('flangerDepth', Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white" />
                </div>
            </div>
        </div>
    );
};

export default EffectsControls;