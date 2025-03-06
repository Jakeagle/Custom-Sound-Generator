class Section {
  constructor(config) {
    this.config = config;
  }

  calculateStartFrequencies() {
    if (this.config.startType === "chord") {
      return this.getChordFrequencies(this.config.startChord);
    }
    return this.getRangeFrequencies(
      this.config.startRange[0],
      this.config.startRange[1],
      this.config.startSpread
    );
  }

  calculateEndFrequencies() {
    if (this.config.endType === "chord") {
      return this.getChordFrequencies(this.config.endChord);
    }
    return this.getRangeFrequencies(
      this.config.endRange[0],
      this.config.endRange[1],
      "random"
    );
  }

  getRangeFrequencies(min, max, spread) {
    const frequencies = [];
    if (spread === "even") {
      const step = (max - min) / (this.config.numVoices - 1);
      for (let i = 0; i < this.config.numVoices; i++) {
        frequencies.push(min + step * i);
      }
    } else {
      for (let i = 0; i < this.config.numVoices; i++) {
        frequencies.push(min + Math.random() * (max - min));
      }
    }
    return frequencies;
  }

  getChordFrequencies(chordName) {
    const chords = {
      THX: this.generateTHXChord(),
      // Add more chords as needed
    };
    return chords[chordName] || [];
  }

  generateTHXChord() {
    const baseFreqs = [293.66, 369.99, 440];
    return Array(this.config.numVoices)
      .fill()
      .map(() => {
        return baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
      });
  }
}

class CustomSoundGenerator {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.sections = [];
    this.isPlaying = false;
  }

  addSection(config) {
    this.sections.push(new Section(config));
  }

  async play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const masterGain = this.audioCtx.createGain();
    const lowpass = this.audioCtx.createBiquadFilter();
    const highpass = this.audioCtx.createBiquadFilter();

    masterGain.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(this.audioCtx.destination);

    let currentTime = this.audioCtx.currentTime;

    for (const section of this.sections) {
      const startFreqs = section.calculateStartFrequencies();
      const endFreqs = section.calculateEndFrequencies();

      // Configure filters
      lowpass.frequency.setValueAtTime(section.config.eq.lowpass, currentTime);
      highpass.frequency.setValueAtTime(
        section.config.eq.highpass,
        currentTime
      );

      const oscillators = startFreqs.map((startFreq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = section.config.oscillatorType;
        osc.frequency.setValueAtTime(startFreq, currentTime);

        if (section.config.movementType === "direct") {
          osc.frequency.linearRampToValueAtTime(
            endFreqs[i % endFreqs.length],
            currentTime + section.config.duration
          );
        } else {
          // Random movement
          const steps = 20;
          const stepTime = section.config.duration / steps;
          for (let step = 0; step < steps; step++) {
            const time = currentTime + step * stepTime;
            const randomFreq =
              endFreqs[Math.floor(Math.random() * endFreqs.length)];
            osc.frequency.linearRampToValueAtTime(randomFreq, time + stepTime);
          }
        }

        // Amplitude envelope
        gain.gain.setValueAtTime(0, currentTime);
        gain.gain.linearRampToValueAtTime(
          1 / section.config.numVoices,
          currentTime + 0.1
        );
        gain.gain.linearRampToValueAtTime(
          0,
          currentTime + section.config.duration
        );

        osc.connect(gain);
        gain.connect(masterGain);

        return osc;
      });

      oscillators.forEach((osc) => osc.start(currentTime));
      oscillators.forEach((osc) =>
        osc.stop(currentTime + section.config.duration)
      );

      currentTime += section.config.duration;
    }

    setTimeout(() => {
      this.isPlaying = false;
      this.sections = [];
    }, currentTime * 1000);
  }
}

// Add to window for global access
window.CustomSoundGenerator = CustomSoundGenerator;
