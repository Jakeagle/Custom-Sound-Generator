// custom-sound-generator.js

function generateDMajorChord(numVoices) {
  const D = 293.66; // D4
  const Fsharp = 369.99; // F#4
  const A = 440.0; // A4

  // Base frequencies for D major chord
  const baseNotes = [
    D / 2, // D3
    D, // D4
    D * 2, // D5
    Fsharp / 2, // F#3
    Fsharp, // F#4
    A / 2, // A3
    A, // A4
  ];

  // Generate frequencies for all voices with slight detuning
  return Array(numVoices)
    .fill()
    .map(() => {
      const note = baseNotes[Math.floor(Math.random() * baseNotes.length)];
      // Add slight detuning (-0.5% to +0.5%)
      return note * (1 + (Math.random() * 0.01 - 0.005));
    });
}

class SoundSection {
  constructor({
    startType, // "chord" or "range"
    startChord, // array of frequencies or chord name
    startRange, // [minFreq, maxFreq]
    endType,
    endChord,
    endRange,
    numVoices,
    oscillatorType, // "sawtooth", "sine", "square", "triangle"
    movementType, // "direct" or "random"
    startSpread, // "even" or "random"
    duration, // seconds
    eq = {
      highpass: 60,
      lowpass: 7000,
      reverb: 0.3,
    },
  }) {
    this.config = {
      startType,
      startChord,
      startRange,
      endType,
      endChord,
      endRange,
      numVoices,
      oscillatorType,
      movementType,
      startSpread,
      duration,
      eq,
    };
  }

  getStartFrequencies() {
    if (this.config.startType === "chord") {
      return this.getChordFrequencies(this.config.startChord);
    } else {
      return this.getRangeFrequencies(
        this.config.startRange[0],
        this.config.startRange[1],
        this.config.startSpread
      );
    }
  }

  getEndFrequencies() {
    if (this.config.endType === "chord") {
      return this.getChordFrequencies(this.config.endChord);
    } else {
      return this.getRangeFrequencies(
        this.config.endRange[0],
        this.config.endRange[1],
        "random"
      );
    }
  }

  getRangeFrequencies(min, max, spreadType) {
    const frequencies = [];
    if (spreadType === "even") {
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
    // Include the THX chord and other common chords
    const chords = {
      THX: generateDMajorChord(this.config.numVoices),
      // Add other chord definitions here
    };
    return chords[chordName] || [];
  }
}

export class CustomSoundGenerator {
  constructor() {
    this.sections = [];
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  addSection(sectionConfig) {
    this.sections.push(new SoundSection(sectionConfig));
  }

  async play(downloadMode = false) {
    const totalDuration = this.sections.reduce(
      (sum, section) => sum + section.config.duration,
      0
    );

    // Create master chain
    const masterGain = this.audioCtx.createGain();
    const reverbNode = await this.createReverb();
    const lowpass = this.audioCtx.createBiquadFilter();
    const highpass = this.audioCtx.createBiquadFilter();

    // Connect chain
    masterGain.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(reverbNode.input); // Connect to reverb input
    reverbNode.connect(this.audioCtx.destination);

    let currentTime = this.audioCtx.currentTime;

    this.sections.forEach((section, sectionIndex) => {
      const startFreqs = section.getStartFrequencies();
      const endFreqs = section.getEndFrequencies();
      const { duration, eq } = section.config;

      // Update EQ settings
      lowpass.frequency.setValueAtTime(eq.lowpass, currentTime);
      highpass.frequency.setValueAtTime(eq.highpass, currentTime);
      reverbNode.wet.setValueAtTime(eq.reverb, currentTime);

      // Create oscillators for this section
      const oscillators = startFreqs.map((startFreq, i) => {
        const osc = this.audioCtx.createOscillator();
        const voiceGain = this.audioCtx.createGain();

        osc.type = section.config.oscillatorType;
        osc.frequency.setValueAtTime(startFreq, currentTime);

        if (section.config.movementType === "direct") {
          osc.frequency.linearRampToValueAtTime(
            endFreqs[i % endFreqs.length],
            currentTime + duration
          );
        } else {
          // Random movement implementation
          const steps = 20;
          const stepTime = duration / steps;
          for (let step = 0; step < steps; step++) {
            const time = currentTime + step * stepTime;
            const randomFreq =
              endFreqs[Math.floor(Math.random() * endFreqs.length)];
            osc.frequency.linearRampToValueAtTime(randomFreq, time + stepTime);
          }
        }

        // Connect oscillator chain
        osc.connect(voiceGain);
        voiceGain.connect(masterGain);

        return { osc, voiceGain };
      });

      // Start oscillators
      oscillators.forEach(({ osc }) => osc.start(currentTime));

      currentTime += duration;
    });

    if (downloadMode) {
      // Implement download logic here
    }
  }

  async createReverb() {
    const convolver = this.audioCtx.createConvolver();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();

    // Create impulse response
    const length = 2 * this.audioCtx.sampleRate;
    const impulseBuffer = this.audioCtx.createBuffer(
      2,
      length,
      this.audioCtx.sampleRate
    );

    for (let channel = 0; channel < impulseBuffer.numberOfChannels; channel++) {
      const channelData = impulseBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / channelData.length, 2);
      }
    }

    convolver.buffer = impulseBuffer;

    // Create reverb routing
    const reverbNode = {
      input: this.audioCtx.createGain(),
      output: this.audioCtx.createGain(),
      wet: wetGain.gain,
      convolver: convolver,

      connect(target) {
        this.output.connect(target);
      },
    };

    // Set up internal routing
    reverbNode.input.connect(dryGain);
    reverbNode.input.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(reverbNode.output);
    wetGain.connect(reverbNode.output);

    // Set initial gains
    dryGain.gain.value = 1;
    wetGain.gain.value = 0.3;

    return reverbNode;
  }
}
