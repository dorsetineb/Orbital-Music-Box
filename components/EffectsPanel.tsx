import React from 'react';
import type { AudioEffects } from '../types';
import { CloseIcon } from './icons';

interface EffectsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    effects: AudioEffects;
    onChange: <K extends keyof AudioEffects>(effectName: K, param: keyof AudioEffects[K], value: AudioEffects[K][keyof AudioEffects[K]]) => void;
}

const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}> = ({ checked, onChange, label }) => (
    <div className="flex items-center justify-between">
        <span className="font-bold text-slate-100">{label}</span>
        <div
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ${checked ? 'bg-sky-500' : 'bg-slate-600'}`}
            role="switch"
            aria-checked={checked}
            aria-label={label}
        >
            <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${checked ? 'transform translate-x-6' : ''}`}
            ></div>
        </div>
    </div>
);


const Slider: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
    <div className="flex flex-col gap-1">
        <label className="text-sm text-slate-400 w-full">{label}</label>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="custom-slider w-full"
            aria-label={label}
        />
    </div>
);


const EffectSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-slate-900/70 rounded-lg p-4 flex flex-col gap-4">{children}</div>
);

const EffectsPanel: React.FC<EffectsPanelProps> = ({ isOpen, onClose, effects, onChange }) => {
    return (
        <>
            {/* Overlay */}
            <div 
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Panel */}
            <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-slate-100">Audio Effects</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700" aria-label="Close effects panel">
                        <CloseIcon />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100%-65px)]">
                    <div className="grid grid-cols-1 gap-4">
                        <EffectSection>
                            <ToggleSwitch checked={effects.distortion.on} onChange={(v) => onChange('distortion', 'on', v)} label="Distortion" />
                            <Slider label={`Drive: ${effects.distortion.drive.toFixed(2)}`} value={effects.distortion.drive} min={0} max={1} step={0.01} onChange={(v) => onChange('distortion', 'drive', v)} />
                            <Slider label={`Tone: ${effects.distortion.tone.toFixed(0)} Hz`} value={effects.distortion.tone} min={200} max={10000} step={100} onChange={(v) => onChange('distortion', 'tone', v)} />
                            <Slider label={`Output: ${effects.distortion.output.toFixed(2)}`} value={effects.distortion.output} min={0} max={1} step={0.01} onChange={(v) => onChange('distortion', 'output', v)} />
                        </EffectSection>
                        
                        <EffectSection>
                            <ToggleSwitch checked={effects.reverb.on} onChange={(v) => onChange('reverb', 'on', v)} label="Reverb" />
                            <Slider label={`Decay: ${effects.reverb.decay.toFixed(2)}s`} value={effects.reverb.decay} min={0.1} max={5} step={0.1} onChange={(v) => onChange('reverb', 'decay', v)} />
                            <Slider label={`Wet Mix: ${effects.reverb.wet.toFixed(2)}`} value={effects.reverb.wet} min={0} max={1} step={0.01} onChange={(v) => onChange('reverb', 'wet', v)} />
                        </EffectSection>

                        <EffectSection>
                            <ToggleSwitch checked={effects.delay.on} onChange={(v) => onChange('delay', 'on', v)} label="Delay" />
                            <Slider label={`Time: ${effects.delay.time.toFixed(2)}s`} value={effects.delay.time} min={0.01} max={2} step={0.01} onChange={(v) => onChange('delay', 'time', v)} />
                            <Slider label={`Feedback: ${effects.delay.feedback.toFixed(2)}`} value={effects.delay.feedback} min={0} max={0.95} step={0.01} onChange={(v) => onChange('delay', 'feedback', v)} />
                        </EffectSection>
                        
                        <EffectSection>
                            <ToggleSwitch checked={effects.flanger.on} onChange={(v) => onChange('flanger', 'on', v)} label="Flanger" />
                            <Slider label={`Delay: ${effects.flanger.delay.toFixed(1)}ms`} value={effects.flanger.delay} min={0.1} max={10} step={0.1} onChange={(v) => onChange('flanger', 'delay', v)} />
                            <Slider label={`Depth: ${effects.flanger.depth.toFixed(1)}ms`} value={effects.flanger.depth} min={0.1} max={5} step={0.1} onChange={(v) => onChange('flanger', 'depth', v)} />
                            <Slider label={`Feedback: ${effects.flanger.feedback.toFixed(2)}`} value={effects.flanger.feedback} min={0} max={0.9} step={0.01} onChange={(v) => onChange('flanger', 'feedback', v)} />
                            <Slider label={`Rate: ${effects.flanger.rate.toFixed(2)} Hz`} value={effects.flanger.rate} min={0.05} max={5} step={0.05} onChange={(v) => onChange('flanger', 'rate', v)} />
                        </EffectSection>

                        <EffectSection>
                            <ToggleSwitch checked={effects.bitcrusher.on} onChange={(v) => onChange('bitcrusher', 'on', v)} label="Bitcrusher" />
                            <Slider label={`Bit Depth: ${effects.bitcrusher.bitDepth}`} value={effects.bitcrusher.bitDepth} min={4} max={16} step={1} onChange={(v) => onChange('bitcrusher', 'bitDepth', v)} />
                            <Slider label={`Mix: ${effects.bitcrusher.mix.toFixed(2)}`} value={effects.bitcrusher.mix} min={0} max={1} step={0.01} onChange={(v) => onChange('bitcrusher', 'mix', v)} />
                        </EffectSection>

                         <EffectSection>
                            <ToggleSwitch checked={effects.vibrato.on} onChange={(v) => onChange('vibrato', 'on', v)} label="Vibrato" />
                            <Slider label={`Rate: ${effects.vibrato.rate.toFixed(2)} Hz`} value={effects.vibrato.rate} min={0.5} max={20} step={0.1} onChange={(v) => onChange('vibrato', 'rate', v)} />
                            <Slider label={`Depth: ${effects.vibrato.depth.toFixed(1)} cents`} value={effects.vibrato.depth} min={1} max={100} step={1} onChange={(v) => onChange('vibrato', 'depth', v)} />
                        </EffectSection>
                    </div>
                </div>
            </div>
        </>
    );
};

export default EffectsPanel;