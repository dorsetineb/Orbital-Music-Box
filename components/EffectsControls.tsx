
import React from 'react';
import type { AudioEffects } from '../types';

interface EffectsControlsProps {
    effects: AudioEffects;
    onChange: (effectName: keyof AudioEffects, param: string, value: any) => void;
}

const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}> = ({ checked, onChange, label }) => (
    <div className="flex items-center gap-3">
        <div
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-300 ${checked ? 'bg-blue-500' : 'bg-slate-600'}`}
            role="switch"
            aria-checked={checked}
            aria-label={label}
        >
            <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${checked ? 'transform translate-x-6' : ''}`}
            ></div>
        </div>
        <span className="font-bold text-slate-200">{label}</span>
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
    <div className="flex items-center gap-4">
        <label className="text-sm text-slate-400 w-28 whitespace-nowrap overflow-hidden text-ellipsis">{label}</label>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="custom-slider flex-grow"
            aria-label={label}
        />
    </div>
);


const EffectSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col gap-3">{children}</div>
);

const EffectsControls: React.FC<EffectsControlsProps> = ({ effects, onChange }) => {
    return (
        <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <EffectSection title="Distortion">
                    <ToggleSwitch
                        checked={effects.distortion.on}
                        onChange={(val) => onChange('distortion', 'on', val)}
                        label="Distortion"
                    />
                    <Slider label={`Drive: ${effects.distortion.drive.toFixed(2)}`} value={effects.distortion.drive} min={0} max={1} step={0.01} onChange={(v) => onChange('distortion', 'drive', v)} />
                    <Slider label={`Tone: ${effects.distortion.tone.toFixed(0)} Hz`} value={effects.distortion.tone} min={200} max={10000} step={100} onChange={(v) => onChange('distortion', 'tone', v)} />
                    <Slider label={`Output: ${effects.distortion.output.toFixed(2)}`} value={effects.distortion.output} min={0} max={1} step={0.01} onChange={(v) => onChange('distortion', 'output', v)} />
                </EffectSection>

                <EffectSection title="Panner">
                    <ToggleSwitch
                        checked={effects.panner.on}
                        onChange={(val) => onChange('panner', 'on', val)}
                        label="Panner"
                    />
                    <Slider label={`Pan: ${effects.panner.pan.toFixed(2)}`} value={effects.panner.pan} min={-1} max={1} step={0.01} onChange={(v) => onChange('panner', 'pan', v)} />
                </EffectSection>

                <EffectSection title="Phaser">
                    <ToggleSwitch
                        checked={effects.phaser.on}
                        onChange={(val) => onChange('phaser', 'on', val)}
                        label="Phaser"
                    />
                    <Slider label={`Rate: ${effects.phaser.rate.toFixed(2)} Hz`} value={effects.phaser.rate} min={0.1} max={10} step={0.1} onChange={(v) => onChange('phaser', 'rate', v)} />
                    <Slider label={`Depth: ${effects.phaser.depth.toFixed(2)}`} value={effects.phaser.depth} min={0} max={1} step={0.01} onChange={(v) => onChange('phaser', 'depth', v)} />
                    <Slider label={`Feedback: ${effects.phaser.feedback.toFixed(2)}`} value={effects.phaser.feedback} min={0} max={0.9} step={0.01} onChange={(v) => onChange('phaser', 'feedback', v)} />
                </EffectSection>
                
                <EffectSection title="Flanger">
                    <ToggleSwitch
                        checked={effects.flanger.on}
                        onChange={(val) => onChange('flanger', 'on', val)}
                        label="Flanger"
                    />
                    <Slider label={`Delay: ${effects.flanger.delay.toFixed(1)}ms`} value={effects.flanger.delay} min={0.1} max={10} step={0.1} onChange={(v) => onChange('flanger', 'delay', v)} />
                    <Slider label={`Depth: ${effects.flanger.depth.toFixed(1)}ms`} value={effects.flanger.depth} min={0.1} max={5} step={0.1} onChange={(v) => onChange('flanger', 'depth', v)} />
                    <Slider label={`Feedback: ${effects.flanger.feedback.toFixed(2)}`} value={effects.flanger.feedback} min={0} max={0.9} step={0.01} onChange={(v) => onChange('flanger', 'feedback', v)} />
                    <Slider label={`Rate: ${effects.flanger.rate.toFixed(2)} Hz`} value={effects.flanger.rate} min={0.05} max={5} step={0.05} onChange={(v) => onChange('flanger', 'rate', v)} />
                </EffectSection>

                <EffectSection title="Chorus">
                    <ToggleSwitch
                        checked={effects.chorus.on}
                        onChange={(val) => onChange('chorus', 'on', val)}
                        label="Chorus"
                    />
                    <Slider label={`Rate: ${effects.chorus.rate.toFixed(2)}`} value={effects.chorus.rate} min={0.1} max={10} step={0.1} onChange={(v) => onChange('chorus', 'rate', v)} />
                    <Slider label={`Depth: ${effects.chorus.depth.toFixed(2)}`} value={effects.chorus.depth} min={0} max={1} step={0.01} onChange={(v) => onChange('chorus', 'depth', v)} />
                </EffectSection>
                
                <EffectSection title="Tremolo">
                    <ToggleSwitch
                        checked={effects.tremolo.on}
                        onChange={(val) => onChange('tremolo', 'on', val)}
                        label="Tremolo"
                    />
                    <Slider label={`Frequency: ${effects.tremolo.frequency.toFixed(2)}`} value={effects.tremolo.frequency} min={0.5} max={20} step={0.1} onChange={(v) => onChange('tremolo', 'frequency', v)} />
                    <Slider label={`Depth: ${effects.tremolo.depth.toFixed(2)}`} value={effects.tremolo.depth} min={0} max={1} step={0.01} onChange={(v) => onChange('tremolo', 'depth', v)} />
                </EffectSection>

                <EffectSection title="Delay">
                     <ToggleSwitch
                        checked={effects.delay.on}
                        onChange={(val) => onChange('delay', 'on', val)}
                        label="Delay"
                    />
                    <Slider label={`Time: ${effects.delay.time.toFixed(2)}s`} value={effects.delay.time} min={0.01} max={2} step={0.01} onChange={(v) => onChange('delay', 'time', v)} />
                    <Slider label={`Feedback: ${effects.delay.feedback.toFixed(2)}`} value={effects.delay.feedback} min={0} max={0.95} step={0.01} onChange={(v) => onChange('delay', 'feedback', v)} />
                </EffectSection>

                <EffectSection title="Reverb">
                    <ToggleSwitch
                        checked={effects.reverb.on}
                        onChange={(val) => onChange('reverb', 'on', val)}
                        label="Reverb"
                    />
                    <Slider label={`Decay: ${effects.reverb.decay.toFixed(2)}s`} value={effects.reverb.decay} min={0.1} max={5} step={0.1} onChange={(v) => onChange('reverb', 'decay', v)} />
                    <Slider label={`Wet Mix: ${effects.reverb.wet.toFixed(2)}`} value={effects.reverb.wet} min={0} max={1} step={0.01} onChange={(v) => onChange('reverb', 'wet', v)} />
                </EffectSection>

            </div>
        </div>
    );
};

export default EffectsControls;
