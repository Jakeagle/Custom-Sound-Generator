// src/ui-controller.js

import { CustomSoundGenerator } from "../audio/custom-sound-generator.js";
import { playTHXDeepNote } from "../thx-deep-note.js";

// Dummy THX deep note player for testing (replace with your actual implementation)
// export function playTHXDeepNote() {
//   const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//   const osc = audioCtx.createOscillator();
//   osc.type = "sine";
//   osc.frequency.setValueAtTime(440, audioCtx.currentTime);
//   osc.connect(audioCtx.destination);
//   osc.start();
//   osc.stop(audioCtx.currentTime + 2);
// }

// Add download functionality
export const createDownload = async (audioCtx) => {
  // Create offline context for rendering
  const offlineCtx = new OfflineAudioContext({
    numberOfChannels: 2,
    length: 44100 * audioCtx.length,
    sampleRate: 44100,
  });

  // Create WAV file
  const audioBuffer = await offlineCtx.startRendering();
  const wavData = audioBufferToWav(audioBuffer);
  const blob = new Blob([wavData], { type: "audio/wav" });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "custom-sound.wav";
  link.click();

  // Cleanup
  URL.revokeObjectURL(url);
};

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2;
  const wav = new DataView(new ArrayBuffer(44 + length));

  // WAV Header
  writeString(wav, 0, "RIFF");
  wav.setUint32(4, 36 + length, true);
  writeString(wav, 8, "WAVE");
  writeString(wav, 12, "fmt ");
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, numChannels, true);
  wav.setUint32(24, buffer.sampleRate, true);
  wav.setUint32(28, buffer.sampleRate * numChannels * 2, true);
  wav.setUint16(32, numChannels * 2, true);
  wav.setUint16(34, 16, true);
  writeString(wav, 36, "data");
  wav.setUint32(40, length, true);

  // Write audio data
  const offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      wav.setInt16(
        offset + (i * numChannels + channel) * 2,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
    }
  }

  return wav.buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export class UIController {
  constructor() {
    this.generator = new CustomSoundGenerator();
    this.audioCtx = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // THX Button
    document.getElementById("playBtn")?.addEventListener("click", async () => {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      await this.audioCtx.resume();
      playTHXDeepNote();
    });

    // Custom Sound Button
    document
      .getElementById("playCustomBtn")
      ?.addEventListener("click", async () => {
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext ||
            window.webkitAudioContext)();
        }
        await this.audioCtx.resume();

        // Get all sections with class .sound-section; if none, log warning and return
        const sectionElements = document.querySelectorAll(".sound-section");
        if (!sectionElements.length) {
          console.warn("No custom sound sections found.");
          return;
        }

        this.generator = new CustomSoundGenerator();
        sectionElements.forEach((section) => {
          // Auto-assign an ID if missing
          let id = section.getAttribute("data-section-id");
          if (!id) {
            id = Date.now().toString();
            section.setAttribute("data-section-id", id);
          }
          const config = this.getSectionConfig(id);
          if (config) {
            this.generator.addSection(config);
          }
        });

        this.generator.play();
      });

    // Add Section Button (assumed to add valid .sound-section markup)
    document.getElementById("addSectionBtn")?.addEventListener("click", () => {
      this.handleAddSection();
    });
  }

  // Modified getSectionConfig with null checks
  getSectionConfig(id) {
    const startTypeEl = document.getElementById(`startType_${id}`);
    if (!startTypeEl) {
      console.warn(`Missing startType element for section: ${id}`);
      return null;
    }
    const startType = startTypeEl.value;
    const config = {
      startType,
      startChord:
        startType === "chord"
          ? document.getElementById(`startChordSelect_${id}`)?.value
          : null,
      startRange:
        startType === "range"
          ? [
              parseFloat(
                document.getElementById(`startMinFreq_${id}`)?.value || 0
              ),
              parseFloat(
                document.getElementById(`startMaxFreq_${id}`)?.value || 0
              ),
            ]
          : null,
      endType: document.getElementById(`endType_${id}`)?.value,
      endChord:
        document.getElementById(`endType_${id}`)?.value === "chord"
          ? document.getElementById(`endChordSelect_${id}`)?.value
          : null,
      endRange:
        document.getElementById(`endType_${id}`)?.value === "range"
          ? [
              parseFloat(
                document.getElementById(`endMinFreq_${id}`)?.value || 0
              ),
              parseFloat(
                document.getElementById(`endMaxFreq_${id}`)?.value || 0
              ),
            ]
          : null,
      numVoices: parseInt(
        document.getElementById(`numVoices_${id}`)?.value || "0"
      ),
      oscillatorType: document.getElementById(`oscType_${id}`)?.value,
      movementType: document.getElementById(`movementType_${id}`)?.value,
      startSpread: document.getElementById(`startSpread_${id}`)?.value,
      duration: parseFloat(
        document.getElementById(`sectionLength_${id}`)?.value || "0"
      ),
      eq: {
        highpass: parseFloat(
          document.getElementById(`highpassFreq_${id}`)?.value || "0"
        ),
        lowpass: parseFloat(
          document.getElementById(`lowpassFreq_${id}`)?.value || "0"
        ),
        reverb: parseFloat(
          document.getElementById(`reverbAmount_${id}`)?.value || "0"
        ),
      },
    };

    // Basic validation
    if (!config.duration || !config.numVoices) {
      console.warn(`Incomplete configuration for section: ${id}`);
      return null;
    }
    return config;
  }

  // Dummy add section implementation
  handleAddSection() {
    const sectionsContainer = document.getElementById("sections");
    const sectionId = Date.now().toString(); // unique id
    const sectionHTML = `
      <div class="sound-section" data-section-id="${sectionId}">
        <select id="startType_${sectionId}">
          <option value="range">Range</option>
          <option value="chord">Chord</option>
        </select>
        <input id="startChordSelect_${sectionId}" placeholder="Start Chord">
        <input id="startMinFreq_${sectionId}" type="number" placeholder="Start Min Freq" value="220">
        <input id="startMaxFreq_${sectionId}" type="number" placeholder="Start Max Freq" value="440">
        <select id="endType_${sectionId}">
          <option value="range">Range</option>
          <option value="chord">Chord</option>
        </select>
        <input id="endChordSelect_${sectionId}" placeholder="End Chord">
        <input id="endMinFreq_${sectionId}" type="number" placeholder="End Min Freq" value="440">
        <input id="endMaxFreq_${sectionId}" type="number" placeholder="End Max Freq" value="880">
        <input id="numVoices_${sectionId}" type="number" placeholder="Voices" value="5">
        <select id="oscType_${sectionId}">
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="sawtooth">Sawtooth</option>
          <option value="triangle">Triangle</option>
        </select>
        <select id="movementType_${sectionId}">
          <option value="direct">Direct</option>
          <option value="random">Random</option>
        </select>
        <select id="startSpread_${sectionId}">
          <option value="even">Even</option>
          <option value="random">Random</option>
        </select>
        <input id="sectionLength_${sectionId}" type="number" placeholder="Section Length (sec)" value="5">
        <input id="highpassFreq_${sectionId}" type="number" placeholder="Highpass" value="60">
        <input id="lowpassFreq_${sectionId}" type="number" placeholder="Lowpass" value="7000">
        <input id="reverbAmount_${sectionId}" type="number" placeholder="Reverb" value="0.3">
      </div>
    `;
    sectionsContainer.insertAdjacentHTML("beforeend", sectionHTML);
  }
}

// Initialize controller when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.soundController = new UIController();
});

// export { UIController };
