import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioEffects } from '../types';

type ActivePreviewNodes = {
    oscs: OscillatorNode[];
    masterGain: GainNode;
};

// Helper to create a simple reverb impulse response
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

const makeBitcrusherCurve = (bitDepth: number) => {
    const curve = new Float32Array(65536);
    const steps = Math.pow(2, bitDepth);
    for (let i = 0; i < 65536; i++) {
        const x = (i / 32768) - 1; // map to -1 to 1
        curve[i] = Math.round(x * (steps / 2)) / (steps / 2);
    }
    return curve;
};

const makeDistortionCurve = (amount: number) => {
    const k = amount * 100;
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        // A standard soft-clipping formula
        curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
    }
    return curve;
};


const useAudioEngine = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const previewNodeRef = useRef<ActivePreviewNodes | null>(null);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const isSetup = useRef(false);
  const effectsRef = useRef<AudioEffects | null>(null);

  const effectsChainRef = useRef<{
    input: GainNode;
    output: GainNode;
    // --- Effect Nodes ---
    reverb: { node: ConvolverNode; wet: GainNode };
    delay: { node: DelayNode; feedback: GainNode; wet: GainNode };
    flanger: { delay: DelayNode; feedback: GainNode; lfo: OscillatorNode; lfoGain: GainNode; wet: GainNode };
    bitcrusher: { node: WaveShaperNode; wet: GainNode };
    distortion: { node: WaveShaperNode; tone: BiquadFilterNode; output: GainNode; wet: GainNode };
  } | null>(null);

  const setupAudioGraph = useCallback((audioCtx: AudioContext) => {
    if (isSetup.current) return;
    
    const input = audioCtx.createGain();
    const output = audioCtx.createGain();
    
    // --- Reverb ---
    const reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createImpulseResponse(audioCtx, 2.5, 2.5);
    const reverbWet = audioCtx.createGain();
    input.connect(reverbNode).connect(reverbWet).connect(output);
    const reverb = { node: reverbNode, wet: reverbWet };

    // --- Delay ---
    const delayNode = audioCtx.createDelay(2.0);
    const delayFeedback = audioCtx.createGain();
    const delayWet = audioCtx.createGain();
    input.connect(delayNode).connect(delayWet).connect(output);
    delayNode.connect(delayFeedback).connect(delayNode);
    const delay = { node: delayNode, feedback: delayFeedback, wet: delayWet };

    // --- Flanger ---
    const flangerDelay = audioCtx.createDelay(0.1);
    const flangerFeedback = audioCtx.createGain();
    const flangerLFO = audioCtx.createOscillator();
    const flangerLFOGain = audioCtx.createGain();
    const flangerWet = audioCtx.createGain();
    flangerLFO.type = 'sine';
    flangerLFO.start();
    input.connect(flangerDelay).connect(flangerWet).connect(output);
    flangerDelay.connect(flangerFeedback).connect(flangerDelay);
    flangerLFO.connect(flangerLFOGain).connect(flangerDelay.delayTime);
    const flanger = { delay: flangerDelay, feedback: flangerFeedback, lfo: flangerLFO, lfoGain: flangerLFOGain, wet: flangerWet };
    
    // --- Bitcrusher ---
    const bitcrusherNode = audioCtx.createWaveShaper();
    const bitcrusherWet = audioCtx.createGain();
    input.connect(bitcrusherNode).connect(bitcrusherWet).connect(output);
    const bitcrusher = { node: bitcrusherNode, wet: bitcrusherWet };

    // --- Distortion ---
    const distortionNode = audioCtx.createWaveShaper();
    const distortionTone = audioCtx.createBiquadFilter();
    distortionTone.type = 'lowpass';
    const distortionOutput = audioCtx.createGain();
    const distortionWet = audioCtx.createGain();
    input.connect(distortionNode).connect(distortionTone).connect(distortionOutput).connect(distortionWet).connect(output);
    const distortion = { node: distortionNode, tone: distortionTone, output: distortionOutput, wet: distortionWet };

    // Connect dry signal
    const dry = audioCtx.createGain();
    input.connect(dry).connect(output);
    dry.gain.value = 1.0;

    effectsChainRef.current = {
      input, output, reverb, delay, flanger, bitcrusher, distortion
    };
    isSetup.current = true;
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = context;
        destinationNodeRef.current = context.createMediaStreamDestination();
        setupAudioGraph(context);
        effectsChainRef.current?.output.connect(context.destination);
        if (destinationNodeRef.current) {
          effectsChainRef.current?.output.connect(destinationNodeRef.current);
        }
      } catch (e) {
        console.error("AudioContext not supported");
      }
    }
    return audioCtxRef.current;
  }, [setupAudioGraph]);

  const resumeAudio = useCallback(async () => {
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
  }, [getAudioContext]);
  
  const updateEffects = useCallback((effects: AudioEffects) => {
    effectsRef.current = effects;
    const audioCtx = getAudioContext();
    const chain = effectsChainRef.current;
    if (!audioCtx || !chain) return;

    const RAMP_TIME = 0.1;
    const now = audioCtx.currentTime;
    
    // Reverb
    chain.reverb.wet.gain.linearRampToValueAtTime(effects.reverb.on ? effects.reverb.wet : 0, now + RAMP_TIME);
    
    // Delay
    chain.delay.wet.gain.linearRampToValueAtTime(effects.delay.on ? 0.5 : 0, now + RAMP_TIME); // Using a fixed wet level for delay
    chain.delay.node.delayTime.linearRampToValueAtTime(effects.delay.time, now + RAMP_TIME);
    chain.delay.feedback.gain.linearRampToValueAtTime(effects.delay.feedback, now + RAMP_TIME);
    
    // Flanger
    chain.flanger.wet.gain.linearRampToValueAtTime(effects.flanger.on ? 0.7 : 0, now + RAMP_TIME);
    chain.flanger.delay.delayTime.linearRampToValueAtTime(effects.flanger.delay / 1000, now + RAMP_TIME); // ms to s
    chain.flanger.lfo.frequency.linearRampToValueAtTime(effects.flanger.rate, now + RAMP_TIME);
    chain.flanger.lfoGain.gain.linearRampToValueAtTime(effects.flanger.depth / 1000, now + RAMP_TIME); // ms to s for depth
    chain.flanger.feedback.gain.linearRampToValueAtTime(effects.flanger.feedback, now + RAMP_TIME);

    // Bitcrusher
    if (effects.bitcrusher.on) {
        chain.bitcrusher.node.curve = makeBitcrusherCurve(effects.bitcrusher.bitDepth);
    }
    chain.bitcrusher.wet.gain.linearRampToValueAtTime(effects.bitcrusher.on ? effects.bitcrusher.mix : 0, now + RAMP_TIME);

    // Distortion
    chain.distortion.wet.gain.linearRampToValueAtTime(effects.distortion.on ? 1.0 : 0, now + RAMP_TIME);
    chain.distortion.node.curve = makeDistortionCurve(effects.distortion.drive);
    chain.distortion.tone.frequency.linearRampToValueAtTime(effects.distortion.tone, now + RAMP_TIME);
    chain.distortion.output.gain.linearRampToValueAtTime(effects.distortion.output, now + RAMP_TIME);

  }, [getAudioContext]);
  
  const playShortNote = useCallback((frequency: number, waveform: OscillatorType = 'triangle') => {
    const audioCtx = getAudioContext();
    const effectsInput = effectsChainRef.current?.input;
    if (!audioCtx || !effectsInput) return;

    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.connect(effectsInput);

    // --- 1. The percussive "hammer" attack ---
    const hammerAttackTime = 0.002;
    const hammerDecayTime = 0.05;

    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    noiseFilter.Q.value = 5;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.5, now + hammerAttackTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + hammerDecayTime);

    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noise.start(now);
    noise.stop(now + hammerDecayTime);

    // --- 2. The main tonal part of the note ---
    const tonalGain = audioCtx.createGain();
    
    const attackTime = 0.005;
    const decayTime = 0.3;
    const sustainLevel = 0.15;
    const releaseTime = 1.5;
    const totalDuration = attackTime + decayTime + releaseTime;
    
    tonalGain.gain.setValueAtTime(0, now);
    tonalGain.gain.linearRampToValueAtTime(0.3, now + attackTime);
    tonalGain.gain.exponentialRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    tonalGain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);
    
    tonalGain.connect(masterGain);
    
    const stopTime = now + totalDuration;

    // Sub-oscillator (triangle) for body, slightly detuned for warmth
    const subOsc = audioCtx.createOscillator();
    subOsc.type = waveform;
    subOsc.frequency.setValueAtTime(frequency * 0.502, now);
    subOsc.connect(tonalGain);
    subOsc.start(now);
    subOsc.stop(stopTime);

    // Main oscillator (triangle) for fundamental
    const mainOsc = audioCtx.createOscillator();
    mainOsc.type = waveform;
    mainOsc.frequency.setValueAtTime(frequency, now);
    mainOsc.connect(tonalGain);
    mainOsc.start(now);
    mainOsc.stop(stopTime);

    // Sine wave harmonics for brightness
    const harmonics = [ { m: 2, g: 0.6 }, { m: 3, g: 0.2 }, { m: 4, g: 0.4 }, { m: 6, g: 0.15 } ];

    let vibratoLFO: OscillatorNode | null = null;
    let vibratoLfoGain: GainNode | null = null;
    const currentEffects = effectsRef.current;

    if (currentEffects && currentEffects.vibrato.on) {
        vibratoLFO = audioCtx.createOscillator();
        vibratoLfoGain = audioCtx.createGain();
        vibratoLFO.frequency.setValueAtTime(currentEffects.vibrato.rate, now);
        vibratoLfoGain.gain.setValueAtTime(currentEffects.vibrato.depth, now);
        vibratoLFO.connect(vibratoLfoGain);
        vibratoLFO.start(now);
        vibratoLFO.stop(stopTime);
    }
    
    const allOscs = [subOsc, mainOsc];

    harmonics.forEach(harmonic => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency * harmonic.m, now);
      gainNode.gain.setValueAtTime(harmonic.g, now);
      osc.connect(gainNode).connect(tonalGain);
      osc.start(now);
      osc.stop(stopTime);
      allOscs.push(osc);
    });
    
    if (vibratoLfoGain) {
        allOscs.forEach(osc => vibratoLfoGain!.connect(osc.detune));
    }
  }, [getAudioContext]);

  const playPreviewNote = useCallback((frequency: number, waveform: OscillatorType = 'triangle') => {
    const audioCtx = getAudioContext();
    const effectsInput = effectsChainRef.current?.input;
    if (!audioCtx || !effectsInput) return;

    const now = audioCtx.currentTime;

    if (previewNodeRef.current) {
        const { oscs, masterGain } = previewNodeRef.current;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.linearRampToValueAtTime(0, now + 0.05);
        oscs.forEach(osc => osc.stop(now + 0.05));
    }

    const masterGain = audioCtx.createGain();
    masterGain.connect(effectsInput);

    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    const stopTime = now + 0.3;
    const oscs: OscillatorNode[] = [];
    const previewFreq = frequency * 2; // one octave up for preview

    const mainOsc = audioCtx.createOscillator();
    mainOsc.type = waveform;
    mainOsc.frequency.setValueAtTime(previewFreq, now);
    mainOsc.connect(masterGain);
    mainOsc.start(now);
    mainOsc.stop(stopTime);
    oscs.push(mainOsc);
    
    const harmonicOsc = audioCtx.createOscillator();
    const harmonicGain = audioCtx.createGain();
    harmonicOsc.type = 'sine';
    harmonicOsc.frequency.setValueAtTime(previewFreq * 2, now);
    harmonicGain.gain.value = 0.6;
    harmonicOsc.connect(harmonicGain).connect(masterGain);
    harmonicOsc.start(now);
    harmonicOsc.stop(stopTime);
    oscs.push(harmonicOsc);
    
    previewNodeRef.current = { oscs, masterGain };
  }, [getAudioContext]);
  
  const startRecording = useCallback(() => {
    const audioCtx = getAudioContext();
    if (!destinationNodeRef.current || !audioCtx) return;
    
    const stream = destinationNodeRef.current.stream;
    // @ts-ignore
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
      if (mediaRecorderRef.current?.state === 'recording') {
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
  
  return { 
      startRecording, 
      stopRecording, 
      isRecording, 
      resumeAudio, 
      playPreviewNote,
      playShortNote, 
      updateEffects 
  };
};

export default useAudioEngine;