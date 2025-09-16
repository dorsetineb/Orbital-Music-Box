import { useState, useRef, useCallback } from 'react';
import type { AudioEffects, ReverbType, DistortionType } from '../types';

// Helper function to create different distortion curves
const makeDistortionCurve = (type: DistortionType, amount: number): Float32Array => {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);

    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        switch (type) {
            case 'soft':
                // Soft clipping (tanh)
                curve[i] = Math.tanh(x * (k / 20));
                break;
            case 'hard':
            default:
                // Hard clipping (original aggressive curve)
                curve[i] = ((k + 1) * x) / (1 + k * Math.abs(x));
                break;
        }
    }
    return curve;
};

// Helper function to create a simple reverb impulse response
const createImpulseResponse = (audioCtx: AudioContext, duration: number, decay: number): AudioBuffer => {
    const sampleRate = audioCtx.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioCtx.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
};

type ActiveNode = {
    osc: OscillatorNode;
    gain: GainNode;
};

const useAudioEngine = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const prevEffectsRef = useRef<AudioEffects | null>(null);
  const previewNodeRef = useRef<ActiveNode | null>(null);

  // Effect nodes
  const effectsChainRef = useRef<{
    input: GainNode | null,
    reverb: ConvolverNode | null,
    reverbWet: GainNode | null,
    delay: DelayNode | null,
    delayWet: GainNode | null,
    delayFeedback: GainNode | null,
    distortion: WaveShaperNode | null,
    distortionWet: GainNode | null,
    phaser: BiquadFilterNode[] | null,
    phaserLFO: OscillatorNode | null,
    phaserLFOGain: GainNode | null,
    phaserWet: GainNode | null,
    flanger: DelayNode | null,
    flangerLFO: OscillatorNode | null,
    flangerLFOGain: GainNode | null,
    flangerWet: GainNode | null,
    output: GainNode | null,
    dry: GainNode | null,
  }>({
    input: null,
    reverb: null,
    reverbWet: null,
    delay: null,
    delayWet: null,
    delayFeedback: null,
    distortion: null,
    distortionWet: null,
    phaser: null,
    phaserLFO: null,
    phaserLFOGain: null,
    phaserWet: null,
    flanger: null,
    flangerLFO: null,
    flangerLFOGain: null,
    flangerWet: null,
    output: null,
    dry: null,
  });

  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Setup the entire audio graph with effects
  const setupAudioGraph = (audioCtx: AudioContext) => {
    const input = audioCtx.createGain();
    const dry = audioCtx.createGain();
    const output = audioCtx.createGain();
    
    // --- Reverb setup ---
    const reverb = audioCtx.createConvolver();
    reverb.buffer = createImpulseResponse(audioCtx, 2, 4); // Default 'medium' reverb
    const reverbWet = audioCtx.createGain();
    reverbWet.gain.value = 0;
    input.connect(reverb).connect(reverbWet).connect(output);

    // --- Delay setup ---
    const delay = audioCtx.createDelay(2.0);
    delay.delayTime.value = 0.5;
    const delayWet = audioCtx.createGain();
    delayWet.gain.value = 0;
    const delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0.4;
    input.connect(delay).connect(delayWet).connect(output);
    delay.connect(delayFeedback).connect(delay);

    // --- Distortion setup ---
    const distortion = audioCtx.createWaveShaper();
    const distortionWet = audioCtx.createGain();
    distortionWet.gain.value = 0;
    distortion.curve = makeDistortionCurve('hard', 100); // Default 'hard' distortion
    distortion.oversample = '4x';
    input.connect(distortion).connect(distortionWet).connect(output);

    // --- Phaser setup (chain of all-pass filters modulated by an LFO) ---
    const phaserStages = 6;
    const phaserFilters: BiquadFilterNode[] = [];
    const phaserWet = audioCtx.createGain();
    phaserWet.gain.value = 0;
    const phaserLFO = audioCtx.createOscillator();
    phaserLFO.type = 'sine';
    phaserLFO.frequency.value = 0.5;
    const phaserLFOGain = audioCtx.createGain();
    phaserLFOGain.gain.value = 800;
    phaserLFO.connect(phaserLFOGain);

    let current_node: AudioNode = input;
    for (let i = 0; i < phaserStages; i++) {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'allpass';
        filter.Q.value = 10;
        filter.frequency.value = 350 + i * 100; 
        phaserLFOGain.connect(filter.frequency);
        phaserFilters.push(filter);
        current_node.connect(filter);
        current_node = filter;
    }
    phaserLFO.start();
    current_node.connect(phaserWet).connect(output);

    // --- Flanger setup (modulated delay) ---
    const flanger = audioCtx.createDelay(0.05);
    flanger.delayTime.value = 0.005;
    const flangerWet = audioCtx.createGain();
    flangerWet.gain.value = 0;
    const flangerFeedback = audioCtx.createGain();
    flangerFeedback.gain.value = 0.7;
    const flangerLFO = audioCtx.createOscillator();
    flangerLFO.type = 'sine';
    flangerLFO.frequency.value = 0.25;
    const flangerLFOGain = audioCtx.createGain();
    flangerLFOGain.gain.value = 0.005;
    flangerLFO.connect(flangerLFOGain).connect(flanger.delayTime);
    flangerLFO.start();
    input.connect(flanger);
    flanger.connect(flangerFeedback).connect(flanger);
    flanger.connect(flangerWet).connect(output);

    // Dry signal path
    input.connect(dry).connect(output);
    dry.gain.value = 1.0;

    effectsChainRef.current = { input, reverb, reverbWet, delay, delayWet, delayFeedback, distortion, distortionWet, phaser: phaserFilters, phaserLFO, phaserLFOGain, phaserWet, flanger, flangerLFO, flangerLFOGain, flangerWet, output, dry };
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
  }, [getAudioContext]);
  
  // FIX: Updated updateEffects to use the new nested AudioEffects structure
  const updateEffects = useCallback((newEffects: AudioEffects) => {
      const audioCtx = audioCtxRef.current;
      const effects = effectsChainRef.current;
      if (!audioCtx || !effects.dry) return;
      
      const RAMP_TIME = 0.1; // 100ms for smooth transition
      const targetTime = audioCtx.currentTime + RAMP_TIME;

      // Update Reverb
      if (effects.reverb) {
        // NOTE: The UI 'decay' doesn't map directly to regenerating the impulse response here.
        // We'll just control the wet mix. A more advanced version could regenerate the buffer.
        effects.reverbWet?.gain.linearRampToValueAtTime(newEffects.reverb.on ? newEffects.reverb.wet : 0, targetTime);
      }
      
      // Update Delay
      if (effects.delay && effects.delayFeedback && effects.delayWet) {
        effects.delay.delayTime.linearRampToValueAtTime(newEffects.delay.time, targetTime);
        effects.delayFeedback.gain.linearRampToValueAtTime(newEffects.delay.feedback, targetTime);
        effects.delayWet.gain.linearRampToValueAtTime(newEffects.delay.on ? 0.5 : 0, targetTime); // Fixed wet level for delay
      }

      // Update Distortion
      if (effects.distortion && effects.distortionWet) {
        // NOTE: A more advanced version could map drive/tone to the curve generation.
        // For now, we control the wet mix via the 'output' parameter.
        effects.distortionWet.gain.linearRampToValueAtTime(newEffects.distortion.on ? newEffects.distortion.output : 0, targetTime);
      }
      
      // Update Phaser
      if (effects.phaserLFO && effects.phaserLFOGain && effects.phaserWet) {
         effects.phaserLFO.frequency.linearRampToValueAtTime(newEffects.phaser.rate, targetTime);
         // NOTE: The hook's depth is a gain value, not 0-1. Mapping may be needed for different sounds.
         effects.phaserLFOGain.gain.linearRampToValueAtTime(newEffects.phaser.depth * 1000, targetTime); 
         effects.phaserWet.gain.linearRampToValueAtTime(newEffects.phaser.on ? 0.7 : 0, targetTime);
      }
      
      // Update Flanger
      if (effects.flanger && effects.flangerLFO && effects.flangerLFOGain && effects.flangerWet) {
        // Flanger delay is typically very short. The UI value is in ms.
        effects.flanger.delayTime.linearRampToValueAtTime(newEffects.flanger.delay / 1000, targetTime);
        effects.flangerLFO.frequency.linearRampToValueAtTime(newEffects.flanger.rate, targetTime);
        // Flanger depth is also very small. The UI value is in ms.
        effects.flangerLFOGain.gain.linearRampToValueAtTime(newEffects.flanger.depth / 1000, targetTime);
        effects.flangerWet.gain.linearRampToValueAtTime(newEffects.flanger.on ? 0.6 : 0, targetTime);
      }

      const totalWet = [
        newEffects.reverb.on ? newEffects.reverb.wet : 0,
        newEffects.delay.on ? 0.5 : 0, // Using fixed wet values where UI doesn't provide them
        newEffects.distortion.on ? newEffects.distortion.output : 0,
        newEffects.phaser.on ? 0.7 : 0,
        newEffects.flanger.on ? 0.6 : 0,
      ].reduce((sum, val) => sum + val, 0);

      const dryTarget = Math.max(0, 1 - totalWet / 2);
      effects.dry.gain.linearRampToValueAtTime(dryTarget, targetTime);

      prevEffectsRef.current = newEffects;
  }, []);

  const playNote = useCallback((frequency: number) => {
    const audioCtx = getAudioContext();
    const effectsInput = effectsChainRef.current.input;

    if (!audioCtx || audioCtx.state !== 'running' || !effectsInput) {
        return;
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    oscillator.connect(gainNode).connect(effectsInput);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
  }, [getAudioContext]);

  const playPreviewNote = useCallback((frequency: number) => {
    const audioCtx = getAudioContext();
    const effectsInput = effectsChainRef.current.input;
    if (!audioCtx || !effectsInput) return;

    if (previewNodeRef.current) {
        const { osc, gain } = previewNodeRef.current;
        const now = audioCtx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(0, now + 0.02);
        osc.stop(now + 0.025);
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + 0.2); // Faster decay for preview

    osc.connect(gain).connect(effectsInput);
    osc.start(now);
    osc.stop(now + 0.25);
    
    previewNodeRef.current = { osc, gain };
  }, [getAudioContext]);

  const startRecording = useCallback(() => {
    const audioCtx = getAudioContext();
    if (!destinationNodeRef.current || !audioCtx || audioCtx.state !== 'running') return;
    
    const stream = destinationNodeRef.current.stream;
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    audioChunksRef.current = [];
    mediaRecorderRef.current.start();
    setIsRecording(true);
  }, [getAudioContext]);

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

  return { playNote, playPreviewNote, startRecording, stopRecording, isRecording, resumeAudio, updateEffects };
};

export default useAudioEngine;