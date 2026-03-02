
class SoundService {
  private ctx: AudioContext | null = null;
  private bgmPlaying = false;
  private nextBeatTime = 0;
  private tempo = 145; 

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number, decay: boolean = true) {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    if (decay) {
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playDistortedKick() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  private playSnare(vol: number = 0.08) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  startBGM() {
    if (this.bgmPlaying) return;
    this.init();
    this.bgmPlaying = true;
    this.nextBeatTime = this.ctx!.currentTime;
    
    let step = 0;
    const loop = () => {
      if (!this.bgmPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const beatDuration = 60 / this.tempo / 4; 

      while (this.nextBeatTime < now + 0.1) {
        // Badass Industrial Kick
        if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) this.playDistortedKick();
        
        // Snare
        if (step % 16 === 8) this.playSnare(0.12);
        
        // Sawtooth Bassline
        if (step % 4 === 0) {
          const notes = [41.20, 48.99, 55.00, 36.71]; // E1, G1, A1, D1
          const freq = notes[Math.floor(step / 16) % notes.length];
          this.playTone(freq, 'sawtooth', 0.2, 0.05, true);
        }

        // Gritty Metal Hits
        if (step % 32 === 28) this.playTone(880, 'square', 0.15, 0.015);

        this.nextBeatTime += beatDuration;
        step = (step + 1) % 64;
      }
      setTimeout(loop, 25);
    };
    loop();
  }

  jump() { this.playTone(320, 'square', 0.12, 0.04); }
  coin() { this.playTone(950, 'sine', 0.15, 0.05); }
  heart() { 
    this.playTone(523.25, 'sine', 0.1, 0.06);
    setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.06), 70);
  }
  stomp() { this.playTone(120, 'triangle', 0.25, 0.15); }
  jetpack() { this.playTone(60 + Math.random() * 30, 'sawtooth', 0.06, 0.01); }
  land() { this.playTone(80, 'sine', 0.08, 0.04); }
  hurt() { this.playTone(55, 'sawtooth', 0.6, 0.2); }
  wallBounce() { this.playTone(50, 'triangle', 0.4, 0.18); }
}

export const sounds = new SoundService();
