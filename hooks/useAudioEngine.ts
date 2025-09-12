
import { useState, useRef, useCallback } from 'react';
import type { AudioEffects } from '../types';

const useAudioEngine = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Effect nodes references
  const effectsChainRef = useRef<any>({});

  const [isRecording, setIsRecording] = useState<boolean>(false);

  const setupAudioGraph = (audioCtx: AudioContext) => {
    const chain: any = {};
    
    // Master input and output
    chain.input = audioCtx.createGain();
    let lastNode: AudioNode = chain.input;

    // Helper to create a bypassable effect node
    const createEffectUnit = (node: AudioNode) => {
        const input = audioCtx.createGain();
        const output = audioCtx.createGain();
        const bypass = audioCtx.createGain();
        bypass.gain.value = 0; // Bypassed by default
        input.connect(node).connect(output);
        input.connect(bypass).connect(output);
        return { node, input, output, bypass };
    };

    // 1. Panner
    chain.panner = createEffectUnit(audioCtx.createStereoPanner());
    lastNode.connect(chain.panner.input);
    lastNode = chain.panner.output;

    // 2. Distortion
    const distortionNode = audioCtx.createWaveShaper();
    distortionNode.oversample = '4x';
    const toneFilter = audioCtx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    distortionNode.connect(toneFilter);
    chain.distortion = createEffectUnit(distortionNode);
    chain.distortion.toneFilter = toneFilter; // Attach for later access
    lastNode.connect(chain.distortion.input);
    lastNode = chain.distortion.output;

    // 3. Chorus
    // Simplified chorus using modulated delay
    const chorusDelay = audioCtx.createDelay(0.1);
    const chorusLFO = audioCtx.createOscillator();
    const chorusLFOGain = audioCtx.createGain();
    chorusLFO.type = 'sine';
    chorusLFO.connect(chorusLFOGain).connect(chorusDelay.delayTime);
    chorusLFO.start();
    chain.chorus = createEffectUnit(chorusDelay);
    chain.chorus.lfo = chorusLFO;
    chain.chorus.lfoGain = chorusLFOGain;
    lastNode.connect(chain.chorus.input);
    lastNode = chain.chorus.output;
    
    // 4. Phaser
    const phaserStages = 4;
    const phaserFilters: BiquadFilterNode[] = [];
    let currentPhaserNode: AudioNode = audioCtx.createGain(); // Dummy start node
    const phaserContainer = { input: audioCtx.createGain(), output: audioCtx.createGain(), node: currentPhaserNode };
    let phaserChain: AudioNode = phaserContainer.input;
    for (let i = 0; i < phaserStages; i++) {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'allpass';
        filter.frequency.value = 350 + i * 150;
        phaserFilters.push(filter);
        phaserChain.connect(filter);
        phaserChain = filter;
    }
    const phaserFeedback = audioCtx.createGain();
    phaserChain.connect(phaserFeedback).connect(phaserContainer.input); // Feedback loop
    phaserChain.connect(phaserContainer.output);

    const phaserLFO = audioCtx.createOscillator();
    const phaserLFOGain = audioCtx.createGain();
    phaserLFO.type = 'sine';
    phaserLFO.connect(phaserLFOGain);
    phaserFilters.forEach(f => phaserLFOGain.connect(f.frequency));
    phaserLFO.start();
    
    chain.phaser = createEffectUnit(phaserContainer.node);
    chain.phaser.lfo = phaserLFO;
    chain.phaser.lfoGain = phaserLFOGain;
    chain.phaser.feedback = phaserFeedback;
    chain.phaser.node = phaserContainer; // The whole filter chain construct
    // Connect phaser unit
    phaserContainer.input.connect(phaserFilters[0]);
    phaserFilters[phaserFilters.length - 1].connect(phaserContainer.output);
    chain.phaser.input.connect(phaserContainer.input);
    phaserContainer.output.connect(chain.phaser.output);

    lastNode.connect(chain.phaser.input);
    lastNode = chain.phaser.output;

    // 5. Flanger
    const flangerDelay = audioCtx.createDelay(0.05);
    const flangerFeedback = audioCtx.createGain();
    const flangerLFO = audioCtx.createOscillator();
    const flangerLFOGain = audioCtx.createGain();
    flangerLFO.type = 'sine';
    flangerLFO.connect(flangerLFOGain).connect(flangerDelay.delayTime);
    flangerLFO.start();
    flangerDelay.connect(flangerFeedback).connect(flangerDelay);
    chain.flanger = createEffectUnit(flangerDelay);
    chain.flanger.feedback = flangerFeedback;
    chain.flanger.lfo = flangerLFO;
    chain.flanger.lfoGain = flangerLFOGain;
    lastNode.connect(chain.flanger.input);
    lastNode = chain.flanger.output;

    // 6. Tremolo
    const tremoloGain = audioCtx.createGain();
    const tremoloLFO = audioCtx.createOscillator();
    tremoloLFO.connect(tremoloGain.gain);
    tremoloLFO.start();
    chain.tremolo = createEffectUnit(tremoloGain);
    chain.tremolo.lfo = tremoloLFO;
    lastNode.connect(chain.tremolo.input);
    lastNode = chain.tremolo.output;

    // 7. Delay
    const delayNode = audioCtx.createDelay(2.0);
    const delayFeedback = audioCtx.createGain();
    delayNode.connect(delayFeedback).connect(delayNode);
    chain.delay = createEffectUnit(delayNode);
    chain.delay.feedback = delayFeedback;
    lastNode.connect(chain.delay.input);
    lastNode = chain.delay.output;

    // 8. Reverb
    const reverbNode = audioCtx.createConvolver();
    chain.reverb = createEffectUnit(reverbNode);
    lastNode.connect(chain.reverb.input);
    lastNode = chain.reverb.output;

    // Master Output
    chain.output = audioCtx.createGain();
    lastNode.connect(chain.output);
    
    effectsChainRef.current = chain;
  };

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = context;
            destinationNodeRef.current = context.createMediaStreamDestination();
            setupAudioGraph(context);
            effectsChainRef.current.output?.connect(context.destination);
            if (destinationNodeRef.current) {
                effectsChainRef.current.output?.connect(destinationNodeRef.current);
            }
        } catch (error) {
            console.error("Web Audio API is not supported in this browser.", error);
        }
    }
    return audioCtxRef.current;
  }, []);
  
  const resumeAudio = useCallback(async () => {
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
        try {
            await audioCtx.resume();
        } catch (e) {
            console.error("Error resuming AudioContext:", e);
        }
    }
    return audioCtx;
  }, [getAudioContext]);
  
  const updateEffects = useCallback((effects: AudioEffects) => {
    const audioCtx = audioCtxRef.current;
    const chain = effectsChainRef.current;
    if (!audioCtx || !chain.input) return;

    const now = audioCtx.currentTime;
    const RAMP_TIME = 0.05;
    const targetTime = now + RAMP_TIME;

    const setBypass = (unit: any, active: boolean) => {
        unit.bypass.gain.linearRampToValueAtTime(active ? 0 : 1, targetTime);
        unit.output.gain.linearRampToValueAtTime(active ? 1 : 0, targetTime);
    };
    
    // --- Update each effect ---
    setBypass(chain.distortion, effects.distortion.on);
    if(effects.distortion.on) {
        const curve = new Float32Array(4096);
        const drive = effects.distortion.drive * 100;
        for (let i = 0; i < 4096; i++) {
            const x = (i * 2) / 4096 - 1;
            curve[i] = ((drive + 1) * x) / (1 + drive * Math.abs(x));
        }
        chain.distortion.node.curve = curve;
        chain.distortion.toneFilter.frequency.linearRampToValueAtTime(effects.distortion.tone, targetTime);
        // Output gain is handled by the main output of the unit
        chain.distortion.output.gain.linearRampToValueAtTime(effects.distortion.output, targetTime);
    }
    
    setBypass(chain.panner, effects.panner.on);
    chain.panner.node.pan.linearRampToValueAtTime(effects.panner.pan, targetTime);

    setBypass(chain.phaser, effects.phaser.on);
    chain.phaser.lfo.frequency.linearRampToValueAtTime(effects.phaser.rate, targetTime);
    chain.phaser.lfoGain.gain.linearRampToValueAtTime(effects.phaser.depth * 500, targetTime);
    chain.phaser.feedback.gain.linearRampToValueAtTime(effects.phaser.feedback, targetTime);

    setBypass(chain.flanger, effects.flanger.on);
    chain.flanger.node.delayTime.linearRampToValueAtTime(effects.flanger.delay / 1000, targetTime);
    chain.flanger.feedback.gain.linearRampToValueAtTime(effects.flanger.feedback, targetTime);
    chain.flanger.lfo.frequency.linearRampToValueAtTime(effects.flanger.rate, targetTime);
    chain.flanger.lfoGain.gain.linearRampToValueAtTime(effects.flanger.depth / 1000, targetTime);
    
    setBypass(chain.chorus, effects.chorus.on);
    chain.chorus.node.delayTime.value = 0.03;
    chain.chorus.lfo.frequency.linearRampToValueAtTime(effects.chorus.rate, targetTime);
    chain.chorus.lfoGain.gain.linearRampToValueAtTime(effects.chorus.depth * 0.01, targetTime);

    setBypass(chain.tremolo, effects.tremolo.on);
    chain.tremolo.lfo.frequency.linearRampToValueAtTime(effects.tremolo.frequency, targetTime);
    const tremoloDepth = 1 - effects.tremolo.depth;
    chain.tremolo.node.gain.linearRampToValueAtTime(tremoloDepth, targetTime); // Tremolo works on gain

    setBypass(chain.delay, effects.delay.on);
    chain.delay.node.delayTime.linearRampToValueAtTime(effects.delay.time, targetTime);
    chain.delay.feedback.gain.linearRampToValueAtTime(effects.delay.feedback, targetTime);

    setBypass(chain.reverb, effects.reverb.on);
    if (effects.reverb.on && !chain.reverb.node.buffer) {
        const decay = Math.max(0.1, effects.reverb.decay);
        const length = audioCtx.sampleRate * decay;
        const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            }
        }
        chain.reverb.node.buffer = impulse;
    }
    chain.reverb.output.gain.linearRampToValueAtTime(effects.reverb.wet, targetTime);


  }, []);

  const playNote = useCallback((frequency: number, isSustained: boolean) => {
    const audioCtx = audioCtxRef.current;
    const effectsInput = effectsChainRef.current.input;

    if (!audioCtx || audioCtx.state !== 'running' || !effectsInput) {
        return;
    }
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    const now = audioCtx.currentTime;

    if (isSustained) {
        // Long, gentle envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.stop(now + 1.5);
    } else {
        // Short, plucky envelope
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.stop(now + 0.5);
    }

    osc.connect(gainNode).connect(effectsInput);
    osc.start(now);
  }, []);

  const startRecording = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (!destinationNodeRef.current || !audioCtx || audioCtx.state !== 'running') return;
    
    const stream = destinationNodeRef.current.stream;
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    audioChunksRef.current = [];
    mediaRecorderRef.current.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setIsRecording(false);
          resolve(audioUrl);
        };
        mediaRecorderRef.current.stop();
      } else {
        setIsRecording(false);
        resolve('');
      }
    });
  }, []);

  return { playNote, startRecording, stopRecording, isRecording, resumeAudio, updateEffects };
};

export default useAudioEngine;
