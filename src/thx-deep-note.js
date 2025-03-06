import { createDownload } from "./ui/ui-controller.js";

// Generate a D major chord with proper voice distribution and increased detuning
function generateDMajorChord(numVoices) {
  const D = 293.66;
  const Fsharp = 369.99;
  const A = 440.0;

  const notes = [
    D / 2,
    D,
    D * 2,
    D * 4, // D in different octaves
    Fsharp / 2,
    Fsharp,
    Fsharp * 2, // F# in different octaves
    A / 2,
    A,
    A * 2, // A in different octaves
  ];

  let chord = [];

  for (let i = 0; i < numVoices; i++) {
    const note = notes[i % notes.length];
    const variation = 1 + (Math.random() * 0.016 - 0.008);
    chord.push(note * variation);
  }

  return chord;
}

// THX Deep Note Recreation with improved harmonic ending
function playTHXDeepNote(downloadWav = false) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const finalChord = generateDMajorChord(30);

  // Adjust initial frequencies to reduce low rumble
  const initialFreqs = [];
  const centerFreq = 293.66 / 1.5; // Raised from /2 to reduce rumble

  // Create tighter cluster with less extreme frequencies
  for (let i = 0; i < 30; i++) {
    initialFreqs.push(centerFreq * (0.98 + i * 0.004)); // Tighter spread
  }

  const duration = 31;
  const fadeoutDuration = duration * 0.3; // 15% fadeout duration
  const sectionDurations = [10, 8, 13];
  const sectionModes = ["random", "direct", "direct"];
  const sectionRanges = [
    // Narrower range to reduce high static
    [centerFreq * 0.7, centerFreq * 1.8],
    [280, 450], // Narrower middle range
  ];

  const masterGain = audioCtx.createGain();

  // Add lowpass filter to reduce high frequency static
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(7000, audioCtx.currentTime);
  lowpass.Q.value = 1.7;

  // Add highpass filter to reduce rumble
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(60, audioCtx.currentTime);
  highpass.Q.value = 1.9;

  // Connect filter chain
  masterGain.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(audioCtx.destination);
  masterGain.gain.value = 0.8;

  const oscillators = initialFreqs.map((startFreq, i) => {
    const osc = audioCtx.createOscillator();
    const voiceGain = audioCtx.createGain();
    osc.type = "sawtooth";

    // Reduce initial frequency variation
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);

    // Smoother initial fade in
    voiceGain.gain.setValueAtTime(0, audioCtx.currentTime);
    voiceGain.gain.linearRampToValueAtTime(
      1.0 / 30,
      audioCtx.currentTime + 0.2
    );

    // Add fadeout
    const fadeoutStart = audioCtx.currentTime + duration - fadeoutDuration;
    voiceGain.gain.setValueAtTime(1.0 / 30, fadeoutStart);
    voiceGain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration
    );

    osc.connect(voiceGain);
    voiceGain.connect(masterGain);

    return { osc, voiceGain };
  });

  // Add frequency monitoring for the first voice
  const monitoredOsc = oscillators[0].osc;
  const monitorInterval = setInterval(() => {
    console.log(`Current frequency: ${monitoredOsc.frequency.value} Hz`);
  }, 100); // Log every 100ms

  // Clear the monitoring when sound ends
  setTimeout(() => {
    clearInterval(monitorInterval);
  }, duration * 1000);

  let currentTime = audioCtx.currentTime;
  sectionDurations.forEach((sectionDuration, sectionIndex) => {
    const sectionEndTime = currentTime + sectionDuration;
    const mode = sectionModes[sectionIndex];
    const range = sectionRanges[sectionIndex] || [];

    oscillators.forEach(({ osc }, i) => {
      const endFreq = finalChord[i % finalChord.length];
      if (mode === "direct") {
        osc.frequency.linearRampToValueAtTime(endFreq, sectionEndTime);
      } else if (mode === "random") {
        const steps = 2;
        const stepTime = sectionDuration / steps;
        for (let step = 0; step < steps; step++) {
          const time = currentTime + step * stepTime;
          const progress = step / steps;
          const [minFreq, maxFreq] = range;
          const randomFreq = minFreq + Math.random() * (maxFreq - minFreq);
          osc.frequency.linearRampToValueAtTime(randomFreq, time + stepTime);
        }
      }
    });

    currentTime = sectionEndTime;
  });

  oscillators.forEach(({ osc }) => osc.start(audioCtx.currentTime));
  setTimeout(() => {
    oscillators.forEach(({ osc }) => osc.stop(currentTime));
    if (downloadWav) {
      createDownload(audioCtx);
    }
  }, duration * 1000);
}

// Export functions
export { playTHXDeepNote };
