import { describe, it, expect } from 'vitest';
import {
  parseUmpHeader,
  parseUmpPacket,
  parseUmpStream,
  midi2ToMidi1,
  detectMidi2Capabilities,
  pitch79ToSemitones,
  semitonesToPitch79,
} from '../src/io/midi2.js';

/** Build a UMP word from message type, group, status+channel, and index byte. */
function makeWord0(msgType: number, group: number, status: number, channel: number, index: number): number {
  return (
    ((msgType & 0xF) << 28) |
    ((group & 0xF) << 24) |
    (((status & 0xF0) | (channel & 0xF)) << 16) |
    ((index & 0x7F) << 8)
  ) >>> 0;
}

/** Convert an array of 32-bit words to a Uint8Array (big-endian). */
function wordsToBytes(words: number[]): Uint8Array {
  const buf = new Uint8Array(words.length * 4);
  const dv = new DataView(buf.buffer);
  words.forEach((w, i) => dv.setUint32(i * 4, w, false));
  return buf;
}

describe('MIDI 2.0 UMP parsing', () => {
  describe('parseUmpHeader', () => {
    it('extracts type, group, and channel', () => {
      // Type 0x4, group 2, status 0x90 (note-on), channel 3
      const word = makeWord0(0x4, 2, 0x90, 3, 60);
      const h = parseUmpHeader(word);
      expect(h.messageType).toBe(0x4);
      expect(h.group).toBe(2);
      expect(h.channel).toBe(3);
    });
  });

  describe('word count', () => {
    it('returns correct word count per message type', () => {
      expect(parseUmpHeader(0x00000000).wordCount).toBe(1); // type 0
      expect(parseUmpHeader(0x10000000).wordCount).toBe(1); // type 1
      expect(parseUmpHeader(0x20000000).wordCount).toBe(2); // type 2
      expect(parseUmpHeader(0x40000000).wordCount).toBe(2); // type 4
    });
  });

  describe('parseUmpPacket', () => {
    it('parses MIDI 2.0 note-on with 16-bit velocity', () => {
      const word0 = makeWord0(0x4, 0, 0x90, 0, 60); // note 60
      // word1: velocity=32768 (0x8000) in upper 16 bits, attrType=0, attrValue=0
      const word1 = (32768 << 16) >>> 0;
      const ev = parseUmpPacket([word0, word1]);
      expect(ev).not.toBeNull();
      expect(ev!.type).toBe('noteOn');
      if (ev!.type === 'noteOn') {
        expect(ev!.note).toBe(60);
        expect(ev!.velocity).toBe(32768);
        expect(ev!.channel).toBe(0);
      }
    });

    it('parses MIDI 2.0 note-off', () => {
      const word0 = makeWord0(0x4, 0, 0x80, 0, 64);
      const word1 = (16384 << 16) >>> 0;
      const ev = parseUmpPacket([word0, word1]);
      expect(ev).not.toBeNull();
      expect(ev!.type).toBe('noteOff');
      if (ev!.type === 'noteOff') {
        expect(ev!.note).toBe(64);
        expect(ev!.velocity).toBe(16384);
      }
    });

    it('parses per-note pitch bend (7.9 format)', () => {
      const word0 = makeWord0(0x4, 0, 0x60, 0, 60);
      // 7.9: semitone 2, fraction 0 → raw16 = (2 << 9) = 1024 → word1 = (1024 << 16)
      const word1 = (1024 << 16) >>> 0;
      const ev = parseUmpPacket([word0, word1]);
      expect(ev).not.toBeNull();
      expect(ev!.type).toBe('perNotePitchBend');
      if (ev!.type === 'perNotePitchBend') {
        expect(ev!.pitch79).toBeCloseTo(2.0, 1);
      }
    });

    it('parses control change with 32-bit value', () => {
      const word0 = makeWord0(0x4, 0, 0xB0, 0, 7); // CC7 (volume)
      const word1 = 0x80000000 >>> 0; // midpoint 32-bit
      const ev = parseUmpPacket([word0, word1]);
      expect(ev).not.toBeNull();
      expect(ev!.type).toBe('controlChange');
      if (ev!.type === 'controlChange') {
        expect(ev!.controller).toBe(7);
        expect(ev!.value).toBe(0x80000000 >>> 0);
      }
    });

    it('parses channel pressure with 32-bit value', () => {
      const word0 = makeWord0(0x4, 0, 0xD0, 0, 0);
      const word1 = 0xFFFFFFFF >>> 0;
      const ev = parseUmpPacket([word0, word1]);
      expect(ev).not.toBeNull();
      expect(ev!.type).toBe('channelPressure');
      if (ev!.type === 'channelPressure') {
        expect(ev!.value).toBe(0xFFFFFFFF >>> 0);
      }
    });

    it('returns null for unsupported message types', () => {
      // Type 0x1 = system real-time (not MIDI 2.0 channel voice)
      const word0 = 0x10000000;
      expect(parseUmpPacket([word0])).toBeNull();
    });
  });

  describe('parseUmpStream', () => {
    it('parses multiple packets from byte buffer', () => {
      const w0a = makeWord0(0x4, 0, 0x90, 0, 60);
      const w1a = (65535 << 16) >>> 0;
      const w0b = makeWord0(0x4, 0, 0x80, 0, 60);
      const w1b = (0 << 16) >>> 0;
      const data = wordsToBytes([w0a, w1a, w0b, w1b]);
      const events = parseUmpStream(data);
      expect(events.length).toBe(2);
      expect(events[0]!.type).toBe('noteOn');
      expect(events[1]!.type).toBe('noteOff');
    });

    it('throws RangeError for truncated stream', () => {
      // 3 bytes, not a multiple of 4
      expect(() => parseUmpStream(new Uint8Array([1, 2, 3]))).toThrow(RangeError);
    });
  });

  describe('midi2ToMidi1', () => {
    it('scales 16-bit velocity to 7-bit', () => {
      const midi1 = midi2ToMidi1({
        type: 'noteOn', group: 0, channel: 0, note: 60,
        velocity: 65535, attributeType: 0, attributeValue: 0,
      });
      expect(midi1.data2).toBeLessThanOrEqual(127);
      expect(midi1.data2).toBeGreaterThanOrEqual(1);
    });

    it('clamps velocity 0 on note-on to 1', () => {
      const midi1 = midi2ToMidi1({
        type: 'noteOn', group: 0, channel: 0, note: 60,
        velocity: 0, attributeType: 0, attributeValue: 0,
      });
      expect(midi1.data2).toBe(1);
    });

    it('preserves note number on note-off', () => {
      const midi1 = midi2ToMidi1({
        type: 'noteOff', group: 0, channel: 0, note: 72,
        velocity: 8192, attributeType: 0, attributeValue: 0,
      });
      expect(midi1.type).toBe('noteOff');
      expect(midi1.data1).toBe(72);
    });

    it('converts pitch bend to 14-bit', () => {
      const midi1 = midi2ToMidi1({
        type: 'perNotePitchBend', group: 0, channel: 0, note: 60, pitch79: 0,
      });
      // 0 semitones = center → 0x2000
      const pb14 = midi1.data1 | (midi1.data2 << 7);
      expect(pb14).toBe(0x2000);
    });
  });

  describe('pitch79ToSemitones', () => {
    it('converts known 7.9 values', () => {
      // 0 semitones, 0 fraction → raw16=0 → word=0
      expect(pitch79ToSemitones(0)).toBe(0);
      // 1 semitone, 0 fraction → raw16=(1<<9)=512 → word=(512<<16)
      expect(pitch79ToSemitones((512 << 16) >>> 0)).toBeCloseTo(1.0, 5);
      // 0.5 semitone → raw16=(0<<9)|256=256 → word=(256<<16)
      expect(pitch79ToSemitones((256 << 16) >>> 0)).toBeCloseTo(0.5, 1);
    });
  });

  describe('semitonesToPitch79', () => {
    it('handles boundary values and round-trips', () => {
      // 0 semitones
      expect(semitonesToPitch79(0)).toBe(0);

      // Round-trip: 2.0 semitones
      const encoded = semitonesToPitch79(2.0);
      const decoded = pitch79ToSemitones(encoded);
      expect(decoded).toBeCloseTo(2.0, 2);

      // Round-trip: -1.5 semitones
      const enc2 = semitonesToPitch79(-1.5);
      const dec2 = pitch79ToSemitones(enc2);
      expect(dec2).toBeCloseTo(-1.5, 1);
    });
  });

  describe('detectMidi2Capabilities', () => {
    it('detects property exchange from type 0x5 messages', () => {
      // Type 0x5 message (SysEx 8-bit → property exchange indicator)
      const word0 = (0x5 << 28) >>> 0;
      const word1 = 0;
      const data = wordsToBytes([word0, word1]);
      const caps = detectMidi2Capabilities(data);
      expect(caps.hasPropertyExchange).toBe(true);
      expect(caps.groups).toBeGreaterThanOrEqual(1);
    });

    it('returns frozen capabilities', () => {
      const caps = detectMidi2Capabilities(new Uint8Array(0));
      expect(Object.isFrozen(caps)).toBe(true);
    });
  });

  describe('immutability', () => {
    it('returns frozen objects from all functions', () => {
      const header = parseUmpHeader(0x40900000);
      expect(Object.isFrozen(header)).toBe(true);

      const word0 = makeWord0(0x4, 0, 0x90, 0, 60);
      const word1 = (32768 << 16) >>> 0;
      const ev = parseUmpPacket([word0, word1]);
      expect(Object.isFrozen(ev)).toBe(true);

      const data = wordsToBytes([word0, word1]);
      const events = parseUmpStream(data);
      expect(Object.isFrozen(events)).toBe(true);

      const midi1 = midi2ToMidi1(ev!);
      expect(Object.isFrozen(midi1)).toBe(true);
    });
  });
});
