/** Small procedural SFX bus: no third-party audio and iOS-safe unlock. */
export class SoundBus {
  constructor() {
    this.context = null;
    this.master = null;
    this.unlocked = false;
    this.unlock = this.unlock.bind(this);
    window.addEventListener('friend-fighters-unlock-audio', this.unlock);
    window.addEventListener('pointerdown', this.unlock, { passive: true });
    window.addEventListener('keydown', this.unlock);
  }

  unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.context.destination);
    }
    this.context.resume?.();
    this.unlocked = true;
  }

  tone({ frequency = 220, endFrequency = frequency, duration = 0.08, type = 'square', gain = 0.12 } = {}) {
    if (!this.unlocked || !this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  noise(duration = 0.07, gain = 0.1, highpass = 650) {
    if (!this.unlocked || !this.context || !this.master) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const amp = this.context.createGain();
    const now = this.context.currentTime;
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    source.start(now);
  }

  play(name) {
    switch (name) {
      case 'jump': this.tone({ frequency: 210, endFrequency: 440, duration: 0.11, type: 'sine', gain: 0.1 }); break;
      case 'doubleJump': this.tone({ frequency: 310, endFrequency: 720, duration: 0.14, type: 'triangle', gain: 0.1 }); break;
      case 'swing': this.noise(0.08, 0.06, 1200); break;
      case 'hit': this.noise(0.09, 0.16, 240); this.tone({ frequency: 110, endFrequency: 58, duration: 0.09, gain: 0.16 }); break;
      case 'heavyHit': this.noise(0.16, 0.2, 120); this.tone({ frequency: 90, endFrequency: 38, duration: 0.17, type: 'sawtooth', gain: 0.18 }); break;
      case 'hurt': this.tone({ frequency: 260, endFrequency: 92, duration: 0.18, type: 'sawtooth', gain: 0.1 }); break;
      case 'enemyHurt': this.tone({ frequency: 190, endFrequency: 72, duration: 0.11, type: 'square', gain: 0.075 }); break;
      case 'block': this.tone({ frequency: 820, endFrequency: 430, duration: 0.1, type: 'triangle', gain: 0.085 }); break;
      case 'dodge': this.noise(0.13, 0.065, 1800); break;
      case 'skill': this.tone({ frequency: 170, endFrequency: 680, duration: 0.25, type: 'sawtooth', gain: 0.08 }); break;
      case 'shot': this.tone({ frequency: 510, endFrequency: 150, duration: 0.08, type: 'square', gain: 0.06 }); break;
      case 'laser': this.tone({ frequency: 95, endFrequency: 42, duration: 0.62, type: 'sawtooth', gain: 0.11 }); break;
      case 'wave': this.tone({ frequency: 260, endFrequency: 520, duration: 0.2, type: 'triangle', gain: 0.08 }); break;
      case 'pickup': this.tone({ frequency: 500, endFrequency: 980, duration: 0.18, type: 'sine', gain: 0.08 }); break;
      default: break;
    }
  }
}
