/**
 * Procedural Web Audio Synthesizer for Skyflow
 * Creates dynamic wind rush, nostalgic Ghibli chimes, carve whooshes, and ambient chords.
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted = false;

  // Wind rush noise node
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  // Ambient chord drone
  private ambientGain: GainNode | null = null;
  private ambientTimer: number | null = null;

  constructor() {
    // Lazy initialize on first user interaction
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master wind rush generator
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 320;
      this.windFilter.Q.value = 1.4;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.08;

      whiteNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      whiteNoise.start(0);

      // Ambient chord pad
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.05;
      this.ambientGain.connect(this.ctx.destination);
      this.startAmbientLoop();
    } catch {
      // Audio context might be blocked or restricted
    }
  }

  updateWind(speed: number, maxSpeed: number, isCarving: boolean) {
    if (!this.ctx || !this.windFilter || !this.windGain || this.isMuted) return;

    const norm = Math.min(speed / maxSpeed, 1.0);
    const targetFreq = 260 + norm * 550 + (isCarving ? 140 : 0);
    const targetGain = 0.04 + norm * 0.14 + (isCarving ? 0.05 : 0);

    const t = this.ctx.currentTime;
    this.windFilter.frequency.setTargetAtTime(targetFreq, t, 0.1);
    this.windGain.gain.setTargetAtTime(targetGain, t, 0.1);
  }

  playCarveWhoosh() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.25);

    filter.type = 'lowpass';
    filter.frequency.value = 400;

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playOrbChime() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    // Ghibli pentatonic bell frequencies: D5, F#5, A5, B5, D6
    const freqs = [587.33, 739.99, 880.0, 987.77, 1174.66];
    const freq = freqs[Math.floor(Math.random() * freqs.length)];

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, this.ctx.currentTime);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.01, this.ctx.currentTime); // shimmering overtone

    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 1.2);
    osc2.stop(t + 1.2);
  }

  playJump() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(460, t + 0.3);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  playLanding() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  playTrickSound(trickName: string, combo: number) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    // Harmonic progression rising with combo count
    const baseFreqs = [440.0, 554.37, 659.25, 880.0, 1108.73, 1318.5]; // A maj pentatonic
    const noteIdx = Math.min(combo - 1, baseFreqs.length - 1);
    const freq = baseFreqs[Math.max(0, noteIdx)];

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscHarmonic = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.35);

    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(freq * 2.0, t);
    oscHarmonic.frequency.exponentialRampToValueAtTime(freq * 2.5, t + 0.35);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    oscHarmonic.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    oscHarmonic.start(t);
    osc.stop(t + 0.45);
    oscHarmonic.stop(t + 0.45);
  }

  playUpdraftSound() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.5);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.8);
  }

  playGoalCompleteSound() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const triad = [587.33, 739.99, 880.0, 1174.66]; // D maj triad celebration
    triad.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.08, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 1.2);
    });
  }

  playBiomeShiftSound(biome: string) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = biome === 'dunes' ? 329.63 : biome === 'sky-islands' ? 440.0 : biome === 'forest' ? 261.63 : 293.66;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 1.5, t + 1.0);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 2.0);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 2.0);
  }

  private startAmbientLoop() {
    if (!this.ctx || !this.ambientGain) return;

    // Nostalgic Ghibli chord progressions (maj7 & sus2 chords in D major)
    const chords = [
      [293.66, 369.99, 440.0, 554.37], // Dmaj7
      [246.94, 329.63, 440.0, 493.88], // Bm7 / E sus
      [220.0,  329.63, 440.0, 554.37], // A sus / A maj
      [196.0,  293.66, 369.99, 440.0], // G maj9
    ];

    let chordIdx = 0;
    const playNextChord = () => {
      if (!this.ctx || !this.ambientGain || this.isMuted) return;
      const chord = chords[chordIdx];
      chordIdx = (chordIdx + 1) % chords.length;

      const t = this.ctx.currentTime;
      chord.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);

        const noteGain = 0.025 / chord.length;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(noteGain, t + 1.5 + i * 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);

        osc.connect(g);
        g.connect(this.ambientGain!);

        osc.start(t);
        osc.stop(t + 6.0);
      });
    };

    playNextChord();
    this.ambientTimer = window.setInterval(playNextChord, 6200);
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx) {
      if (this.isMuted) {
        this.ctx.suspend();
      } else {
        this.ctx.resume();
      }
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  dispose() {
    if (this.ambientTimer) clearInterval(this.ambientTimer);
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
