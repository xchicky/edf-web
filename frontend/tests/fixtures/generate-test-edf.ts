#!/usr/bin/env node

/**
 * Generate Test EDF Files for E2E Testing
 *
 * This script creates minimal valid EDF files for testing.
 * Usage: node tests/fixtures/generate-test-edf.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EDFChannel {
  label: string;
  samplesPerRecord: number;
  physicalMin: number;
  physicalMax: number;
  digitalMin: number;
  digitalMax: number;
  prefiltering: string;
  transducerType: string;
  physicalDimension: string;
}

interface EDFHeaderOptions {
  version?: string;
  patientID?: string;
  recordingID?: string;
  startDate?: string;
  startTime?: string;
  numRecords?: number;
  duration?: number;
  channels: EDFChannel[];
}

/**
 * Create a minimal EDF file buffer
 */
function createEDFFile(options: EDFHeaderOptions): Buffer {
  const {
    version = '0',
    patientID = 'Test Patient',
    recordingID = 'Test Recording',
    startDate = '01.02.26',
    startTime = '00.00.00',
    numRecords = 10,
    duration = 1,
    channels
  } = options;

  // Header is 256 bytes + ns * 256 bytes for channel info
  const numChannels = channels.length;
  const headerSize = 256 + (numChannels * 256);
  const header = Buffer.alloc(headerSize);

  // Version (8 bytes)
  header.write(version.padEnd(8, ' '), 0);

  // Patient ID (80 bytes)
  header.write(patientID.padEnd(80, ' '), 8);

  // Recording ID (80 bytes)
  header.write(recordingID.padEnd(80, ' '), 88);

  // Start date (8 bytes)
  header.write(startDate, 168);

  // Start time (8 bytes)
  header.write(startTime, 176);

  // Header bytes (8 bytes)
  header.write(String(headerSize).padStart(8, ' ').padEnd(8, ' '), 184);

  // Reserved (44 bytes) - EDF+ compatible
  header.write(' '.repeat(44), 192);

  // Number of signals (8 bytes)
  header.write(String(numChannels).padStart(8, ' ').padEnd(8, ' '), 236);

  // Signal-specific parameters (each channel gets 256 bytes)
  let offset = 256;
  for (const channel of channels) {
    // Label (16 bytes)
    header.write(channel.label.padEnd(16, ' '), offset);
    offset += 16;

    // Transducer type (80 bytes)
    header.write(channel.transducerType.padEnd(80, ' '), offset);
    offset += 80;

    // Physical dimension (8 bytes)
    header.write(channel.physicalDimension.padEnd(8, ' '), offset);
    offset += 8;

    // Physical minimum (8 bytes)
    header.write(String(channel.physicalMin).padStart(8, ' ').padEnd(8, ' '), offset);
    offset += 8;

    // Physical maximum (8 bytes)
    header.write(String(channel.physicalMax).padStart(8, ' ').padEnd(8, ' '), offset);
    offset += 8;

    // Digital minimum (8 bytes)
    header.write(String(channel.digitalMin).padStart(8, ' ').padEnd(8, ' '), offset);
    offset += 8;

    // Digital maximum (8 bytes)
    header.write(String(channel.digitalMax).padStart(8, ' ').padEnd(8, ' '), offset);
    offset += 8;

    // Prefiltering (80 bytes)
    header.write(channel.prefiltering.padEnd(80, ' '), offset);
    offset += 80;

    // Number of samples per record (8 bytes)
    header.write(String(channel.samplesPerRecord).padStart(8, ' ').padEnd(8, ' '), offset);
    offset += 8;

    // Reserved (32 bytes)
    header.write(' '.repeat(32), offset);
    offset += 32;
  }

  // Create data records
  const totalSamplesPerRecord = channels.reduce((sum, ch) => sum + ch.samplesPerRecord, 0);
  const dataRecordSize = totalSamplesPerRecord * 2; // 2 bytes per sample (int16)
  const dataBuffer = Buffer.alloc(numRecords * dataRecordSize);

  let dataOffset = 0;
  for (let record = 0; record < numRecords; record++) {
    const time = record * duration;

    for (const channel of channels) {
      for (let sample = 0; sample < channel.samplesPerRecord; sample++) {
        // Generate synthetic EEG-like signal
        const t = time + (sample / channel.samplesPerRecord) * duration;

        // Create mix of frequencies (alpha, beta waves)
        const alpha = Math.sin(2 * Math.PI * 10 * t); // 10 Hz alpha
        const beta = Math.sin(2 * Math.PI * 20 * t) * 0.5; // 20 Hz beta
        const noise = (Math.random() - 0.5) * 0.2; // Small noise

        const value = alpha + beta + noise;

        // Scale to digital range
        const digitalValue = Math.floor(
          ((value - (-1.5)) / 3) * (channel.digitalMax - channel.digitalMin) + channel.digitalMin
        );

        // Write as little-endian int16
        dataBuffer.writeInt16LE(
          Math.max(channel.digitalMin, Math.min(channel.digitalMax, digitalValue)),
          dataOffset
        );

        dataOffset += 2;
      }
    }
  }

  return Buffer.concat([header, dataBuffer]);
}

/**
 * Standard EEG channel configuration
 */
const STANDARD_EEG_CHANNELS: EDFChannel[] = [
  { label: 'Fp1', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'Fp2', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'F3', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'F4', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'C3', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'C4', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'P3', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'P4', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'O1', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'O2', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'F7', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'F8', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'T3', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'T4', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'T5', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'T6', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'Fz', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'Cz', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
  { label: 'Pz', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: 'HP:0.16Hz LP:70Hz', transducerType: 'AgAgCl electrode', physicalDimension: 'uV' },
];

/**
 * Simplified 3-channel config for quick testing
 */
const SIMPLE_CHANNELS: EDFChannel[] = [
  { label: 'Fp1', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: '', transducerType: '', physicalDimension: 'uV' },
  { label: 'F3', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: '', transducerType: '', physicalDimension: 'uV' },
  { label: 'Fz', samplesPerRecord: 256, physicalMin: -500, physicalMax: 500, digitalMin: -32768, digitalMax: 32767, prefiltering: '', transducerType: '', physicalDimension: 'uV' },
];

// Output directory
const outputDir = path.resolve(__dirname, '../fixtures');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Generating test EDF files...');

// Generate 19-channel standard EEG file
const standardEEG = createEDFFile({
  patientID: 'Test Patient 001',
  recordingID: 'Standard EEG Test',
  numRecords: 60, // 60 seconds
  duration: 1,
  channels: STANDARD_EEG_CHANNELS
});
fs.writeFileSync(path.join(outputDir, 'standard-19ch.eeg'), standardEEG);
console.log('  Created: standard-19ch.eeg (~560KB)');

// Generate simple 3-channel file
const simpleEEG = createEDFFile({
  patientID: 'Test Patient 002',
  recordingID: 'Simple EEG Test',
  numRecords: 30, // 30 seconds
  duration: 1,
  channels: SIMPLE_CHANNELS
});
fs.writeFileSync(path.join(outputDir, 'simple-3ch.eeg'), simpleEEG);
console.log('  Created: simple-3ch.eeg (~100KB)');

// Generate minimal 1-channel file
const minimalEEG = createEDFFile({
  patientID: 'Test Patient 003',
  recordingID: 'Minimal EEG Test',
  numRecords: 10, // 10 seconds
  duration: 1,
  channels: [SIMPLE_CHANNELS[0]]
});
fs.writeFileSync(path.join(outputDir, 'minimal-1ch.eeg'), minimalEEG);
console.log('  Created: minimal-1ch.eeg (~8KB)');

console.log('\nAll test EDF files generated successfully!');
console.log(`Output directory: ${outputDir}`);
