/**
 * Neon Drift: Procedural Web Audio Synthwave & Cyber SFX Synthesizer
 * Generates an authentic driving 16th-note synth bassline, electronic drum machine (808 kick, snare, hats),
 * lush cyberpunk pad arpeggios, and high-tech digital SFX (laser pings, sonic boost booms, rail grinds).
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted = false;

  // Master Synthwave Buses
  private masterGain: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private bassGain: GainNode | null = null;
  private drumGain: GainNode | null = null;
  private synthGain: GainNode | null = null;

  // Synthwave Sequencer Loop
  private sequencerTimer: number | null = null;
  private currentStep = 0;
  private tempoBpm = 124;

  // Rail Grind sound node
  private grindOsc: OscillatorNode | null = null;
  private grindGain: GainNode | null = null;

  constructor() {
    // AudioContext lazily starts on first user interaction
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);

      // Bass Sub-bus with modulated resonant filter
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowpass';
      this.bassFilter.frequency.value = 450;
      this.bassFilter.Q.value = 4.5; // Juicy resonance!

      this.bassGain = this.ctx.createGain();
      this.bassGain.gain.value = 0.22;
      this.bassFilter.connect(this.bassGain);
      this.bassGain.connect(this.masterGain);

      // Drum Bus
      this.drumGain = this.ctx.createGain();
      this.drumGain.gain.value = 0.28;
      this.drumGain.connect(this.masterGain);

      // Synth & Leads Bus
      this.synthGain = this.ctx.createGain();
      this.synthGain.gain.value = 0.18;
      this.synthGain.connect(this.masterGain);

      this.startSynthwaveLoop();
    } catch {
      // Audio context restricted or blocked
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // --- Real-Time Reactive Dynamics ---
  updateSpeed(speed: number, maxSpeed: number, isBoosting: boolean) {
    if (!this.ctx || !this.bassFilter || this.isMuted) return;
    const norm = Math.min(speed / maxSpeed, 1.5);

    // As speed and Overdrive build, the bass filter opens up aggressively!
    const targetFreq = 400 + norm * 1400 + (isBoosting ? 600 : 0);
    this.bassFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.12);
  }

  updateWind(speed: number, maxSpeed: number, isCarving: boolean) {
    this.updateSpeed(speed, maxSpeed, isCarving);
  }

  // --- 16-Step Synthwave Sequencer Loop ---
  private startSynthwaveLoop() {
    if (!this.ctx) return;
    const stepDuration = 60.0 / this.tempoBpm / 4; // 16th note in seconds

    // D-minor Cyberpunk bassline notes (Hz)
    // D1=36.7, F1=43.65, G1=49.0, A1=55.0, C2=65.4, D2=73.4
    const bassPattern = [
      73.4, 73.4, 73.4, 87.3, // D2, D2, D2, F2
      73.4, 73.4, 98.0, 73.4, // D2, D2, G2, D2
      65.4, 65.4, 65.4, 73.4, // C2, C2, C2, D2
      55.0, 65.4, 73.4, 87.3, // A1, C2, D2, F2
    ];

    const playStep = () => {
      if (!this.ctx || this.isMuted) {
        this.sequencerTimer = window.setTimeout(playStep, stepDuration * 1000);
        return;
      }

      const t = this.ctx.currentTime;
      const step = this.currentStep % 16;

      // 1. Kick on beats 1, 5, 9, 13 (4-on-the-floor)
      if (step % 4 === 0) {
        this.triggerKick(t);
      }

      // 2. Gated Snare / Cyber Clap on beats 5 and 13 (2 & 4 of 4/4 measure)
      if (step === 4 || step === 12) {
        this.triggerSnare(t);
      }

      // 3. Hi-Hat sizzle on offbeats
      if (step % 2 === 1) {
        this.triggerHiHat(t);
      }

      // 4. Synthwave Saw Bass note
      const freq = bassPattern[step];
      this.triggerBassNote(t, freq, stepDuration * 0.85);

      this.currentStep++;
      this.sequencerTimer = window.setTimeout(playStep, stepDuration * 1000);
    };

    this.sequencerTimer = window.setTimeout(playStep, 50);
  }

  private triggerKick(t: number) {
    if (!this.ctx || !this.drumGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.16);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.drumGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  private triggerSnare(t: number) {
    if (!this.ctx || !this.drumGain) return;

    // Noise burst
    const bufSize = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);

    noise.start(t);
    noise.stop(t + 0.14);
  }

  private triggerHiHat(t: number) {
    if (!this.ctx || !this.drumGain) return;
    const bufSize = this.ctx.sampleRate * 0.04;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);

    noise.start(t);
    noise.stop(t + 0.04);
  }

  private triggerBassNote(t: number, freq: number, dur: number) {
    if (!this.ctx || !this.bassFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(this.bassFilter);

    osc.start(t);
    osc.stop(t + dur);
  }

  // --- Cyber SFX Suite ---

  playCarveWhoosh() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.2);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  playJump() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.22); // High-tech upward laser chirp

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  playOrbChime() {
    this.playDataShardCollect();
  }

  playDataShardCollect() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Dual crystal laser chimes (E6 + B6)
    const freqs = [1318.5, 1975.5];
    freqs.forEach(freq => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.25);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  playBoostGate() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Sonic Boom Bass Drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.65);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.65);
  }

  playGoalCompleteSound() {
    this.playBoostGate();
  }

  startGrindSound() {
    this.init();
    if (!this.ctx || this.isMuted || this.grindOsc) return;

    const t = this.ctx.currentTime;
    this.grindOsc = this.ctx.createOscillator();
    this.grindGain = this.ctx.createGain();

    this.grindOsc.type = 'sawtooth';
    this.grindOsc.frequency.setValueAtTime(320, t);

    this.grindGain.gain.setValueAtTime(0.08, t);

    this.grindOsc.connect(this.grindGain);
    this.grindGain.connect(this.ctx.destination);
    this.grindOsc.start(t);
  }

  stopGrindSound() {
    if (this.grindGain && this.ctx) {
      this.grindGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      setTimeout(() => {
        if (this.grindOsc) {
          try { this.grindOsc.stop(); } catch {}
          this.grindOsc.disconnect();
          this.grindOsc = null;
        }
      }, 80);
    }
  }

  playLanding() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  playCrashSound() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Digital Glitch / System Desync Noise Burst
    const bufSize = this.ctx.sampleRate * 0.45;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (i % 8 < 4 ? 1 : -1);

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    noise.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.45);
  }

  playTrickSound(trickName: string, combo: number) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    // Escalating digital arpeggiation
    const chordPitches = [587.33, 739.99, 880.0, 1174.66, 1479.98];
    const pitch = chordPitches[Math.min(combo - 1, chordPitches.length - 1)];

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.35, t + 0.32);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.32);
  }

  playBiomeShiftSound(biome: string) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const freqs = [440, 659.25, 880];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + idx * 0.06);

      gain.gain.setValueAtTime(0.1, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.6);
    });
  }

  playUpdraftSound() {
    this.playBoostGate();
  }

  dispose() {
    if (this.sequencerTimer) clearTimeout(this.sequencerTimer);
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}
