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


const useAudioEngine = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const prevEffectsRef = useRef<AudioEffects | null>(null);
  const activeSourcesRef = useRef(new Map<string, { oscillator: OscillatorNode, gainNode: GainNode }>());


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
    const delay = audioCtx.createDelay(1.0);
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
  
  const updateEffects = useCallback((newEffects: AudioEffects) => {
      const audioCtx = audioCtxRef.current;
      const effects = effectsChainRef.current;
      if (!audioCtx || !effects.dry) return;

      const prevEffects = prevEffectsRef.current;
      
      // Handle changes that require re-creating parts of the audio graph
      if (prevEffects?.reverbType !== newEffects.reverbType) {
        const reverbParams = {
            short: { duration: 1, decay: 2 },
            medium: { duration: 2, decay: 4 },
            long: { duration: 4, decay: 6 }
        }[newEffects.reverbType];
        if (effects.reverb) {
            effects.reverb.buffer = createImpulseResponse(audioCtx, reverbParams.duration, reverbParams.decay);
        }
      }
      
      if (prevEffects?.distortionType !== newEffects.distortionType) {
        if (effects.distortion) {
            effects.distortion.curve = makeDistortionCurve(newEffects.distortionType, 100);
        }
      }

      // Handle smooth gain transitions for mix levels
      const RAMP_TIME = 0.1; // 100ms for smooth transition
      const targetTime = audioCtx.currentTime + RAMP_TIME;

      effects.reverbWet?.gain.linearRampToValueAtTime(newEffects.reverbMix, targetTime);
      effects.delayWet?.gain.linearRampToValueAtTime(newEffects.delayMix, targetTime);
      effects.distortionWet?.gain.linearRampToValueAtTime(newEffects.distortionMix, targetTime);
      effects.phaserWet?.gain.linearRampToValueAtTime(newEffects.phaserMix, targetTime);
      effects.flangerWet?.gain.linearRampToValueAtTime(newEffects.flangerMix, targetTime);

      // Update LFOs for phaser and flanger
      effects.phaserLFO?.frequency.linearRampToValueAtTime(newEffects.phaserRate, targetTime);
      effects.phaserLFOGain?.gain.linearRampToValueAtTime(newEffects.phaserDepth, targetTime);
      effects.flangerLFO?.frequency.linearRampToValueAtTime(newEffects.flangerRate, targetTime);
      effects.flangerLFOGain?.gain.linearRampToValueAtTime(newEffects.flangerDepth, targetTime);


      const totalWetTarget = newEffects.reverbMix + newEffects.delayMix + newEffects.distortionMix + newEffects.phaserMix + newEffects.flangerMix;
      const dryTarget = Math.max(0, 1 - totalWetTarget / 2);
      effects.dry.gain.linearRampToValueAtTime(dryTarget, targetTime);

      prevEffectsRef.current = newEffects;
  }, []);

  const startSustainedNote = useCallback((frequency: number, noteId: string) => {
    const audioCtx = audioCtxRef.current;
    const effectsInput = effectsChainRef.current.input;

    if (!audioCtx || audioCtx.state !== 'running' || !effectsInput || activeSourcesRef.current.has(noteId)) {
        return;
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // Quick fade-in to prevent clicks, targeting a slightly lower volume for sustained notes.
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 0.02); // 20ms fade-in

    oscillator.connect(gainNode).connect(effectsInput);
    oscillator.start(audioCtx.currentTime);

    activeSourcesRef.current.set(noteId, { oscillator, gainNode });
  }, []);

  const stopSustainedNote = useCallback((noteId: string) => {
      const audioCtx = audioCtxRef.current;
      const source = activeSourcesRef.current.get(noteId);

      if (audioCtx && source) {
          const { oscillator, gainNode } = source;
          const stopTime = audioCtx.currentTime + 0.05; // 50ms fade-out for precision
          
          // Hold current gain value, then ramp down smoothly to prevent clicks.
          gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime); 
          gainNode.gain.linearRampToValueAtTime(0.0001, stopTime); 
          
          oscillator.stop(stopTime);
          activeSourcesRef.current.delete(noteId);
      }
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

  return { startSustainedNote, stopSustainedNote, startRecording, stopRecording, isRecording, resumeAudio, updateEffects };
};

export default useAudioEngine;
