type SoundName =
  | 'launch'
  | 'thud'
  | 'wood'
  | 'glass'
  | 'stone'
  | 'pop'
  | 'explode'
  | 'split'
  | 'dash'
  | 'win'
  | 'lose'
  | 'star'
  | 'click';

export class AudioManager {
  muted = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<SoundName, number>();

  unlock(): void {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.02);
    }
  }

  play(name: SoundName): void {
    if (this.muted || !this.ensure() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    const minGap = name === 'thud' || name === 'wood' ? 0.045 : 0.03;
    if (now - last < minGap) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'launch':
        this.tone(430, 150, 0.2, 0.24, 0.16, 'triangle');
        this.noise(0.1, 'highpass', 900, 0.15, 0.12);
        break;
      case 'thud':
        this.tone(130, 58, 0.2, 0.2, 0.16, 'sine');
        this.noise(0.11, 'lowpass', 500, 0.13, 0.1);
        break;
      case 'wood':
        this.tone(160, 70, 0.18, 0.15, 0.13, 'triangle');
        this.noise(0.13, 'bandpass', 720, 0.18, 0.15);
        break;
      case 'glass':
        this.noise(0.26, 'highpass', 2200, 0.22, 0.3);
        this.tone(1850, 2400, 0.16, 0.09, 0.05, 'sine');
        this.tone(2650, 3200, 0.12, 0.06, 0.02, 'sine');
        break;
      case 'stone':
        this.tone(95, 48, 0.28, 0.24, 0.22, 'sine');
        this.noise(0.2, 'lowpass', 420, 0.2, 0.18);
        break;
      case 'pop':
        this.tone(520, 1060, 0.15, 0.22, 0.05, 'sine');
        this.noise(0.09, 'highpass', 1600, 0.08, 0.05);
        break;
      case 'explode':
        this.tone(110, 38, 0.5, 0.32, 0.4, 'sine');
        this.noise(0.42, 'lowpass', 1100, 0.3, 0.36);
        break;
      case 'split':
        [0, 0.055, 0.11].forEach((offset) => {
          this.tone(640 + offset * 2200, 980 + offset * 2200, 0.1, 0.15, 0.05, 'sine', offset);
        });
        break;
      case 'dash':
        this.noise(0.22, 'bandpass', 1800, 0.18, 0.2, 400);
        this.tone(330, 760, 0.18, 0.14, 0.12, 'triangle');
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          this.tone(freq, freq, 0.3, 0.16, 0, 'triangle', i * 0.11);
        });
        break;
      case 'lose':
        [392, 329.63, 261.63].forEach((freq, i) => {
          this.tone(freq, freq * 0.94, 0.34, 0.16, 0, 'triangle', i * 0.14);
        });
        break;
      case 'star':
        this.tone(1046.5, 1046.5, 0.22, 0.12, 0, 'sine');
        this.tone(1568, 1568, 0.24, 0.08, 0, 'sine', 0.08);
        break;
      case 'click':
        this.tone(640, 840, 0.08, 0.12, 0.04, 'sine');
        break;
    }
  }

  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    gain: number,
    attack = 0.01,
    type: OscillatorType = 'sine',
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  private noise(
    duration: number,
    filterType: BiquadFilterType,
    frequency: number,
    gain: number,
    attack = 0.01,
    sweepTo?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, start);
    if (sweepTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), start + duration);
    }
    filter.Q.value = filterType === 'bandpass' ? 0.9 : 0.6;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.03);
  }

  private getNoise(): AudioBuffer {
    if (!this.ctx) throw new Error('audio not ready');
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(this.ctx.sampleRate * 0.7);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
