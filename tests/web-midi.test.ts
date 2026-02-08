import { describe, it, expect } from 'vitest';
import {
  isWebMidiSupported,
  webMidiAccess,
  listMidiInputs,
  listMidiOutputs,
  onMidiMessage,
  sendMidiMessage,
  midiMessageToNoteEvent,
} from '../src/io/web-midi.js';
import type { IncomingMidiMessage } from '../src/io/web-midi.js';

describe('Web MIDI API', () => {
  describe('isWebMidiSupported', () => {
    it('returns false in Node.js', () => {
      expect(isWebMidiSupported()).toBe(false);
    });
  });

  describe('webMidiAccess', () => {
    it('returns connection with available=false in Node.js', async () => {
      const conn = await webMidiAccess();
      expect(conn.available).toBe(false);
    });
  });

  describe('no-op connection', () => {
    it('send does not throw', async () => {
      const conn = await webMidiAccess();
      expect(() => conn.send('nonexistent', [0x90, 60, 100])).not.toThrow();
    });

    it('subscribe returns subscription with unsubscribe', async () => {
      const conn = await webMidiAccess();
      const sub = conn.subscribe('nonexistent', () => { /* no-op */ });
      expect(sub).toBeDefined();
      expect(() => sub.unsubscribe()).not.toThrow();
    });

    it('listMidiInputs returns empty array', async () => {
      const conn = await webMidiAccess();
      expect(listMidiInputs(conn)).toEqual([]);
    });

    it('listMidiOutputs returns empty array', async () => {
      const conn = await webMidiAccess();
      expect(listMidiOutputs(conn)).toEqual([]);
    });
  });

  describe('parseMidiBytes (via midiMessageToNoteEvent)', () => {
    it('note-on (0x90) parsed as note event', () => {
      const msg: IncomingMidiMessage = Object.freeze({
        status: 0x90,
        channel: 0,
        data1: 60,
        data2: 100,
        raw: new Uint8Array([0x90, 60, 100]),
        timestamp: 1000,
      });
      const ev = midiMessageToNoteEvent(msg);
      expect(ev).not.toBeNull();
      expect(ev!.pitch.midi).toBe(60);
      expect(ev!.velocity).toBe(100);
    });

    it('note-off (0x80) returns null', () => {
      const msg: IncomingMidiMessage = Object.freeze({
        status: 0x80,
        channel: 0,
        data1: 60,
        data2: 64,
        raw: new Uint8Array([0x80, 60, 64]),
        timestamp: 1000,
      });
      expect(midiMessageToNoteEvent(msg)).toBeNull();
    });

    it('control change returns null', () => {
      const msg: IncomingMidiMessage = Object.freeze({
        status: 0xB0,
        channel: 0,
        data1: 7,
        data2: 100,
        raw: new Uint8Array([0xB0, 7, 100]),
        timestamp: 1000,
      });
      expect(midiMessageToNoteEvent(msg)).toBeNull();
    });
  });

  describe('midiMessageToNoteEvent', () => {
    it('note-on → NoteEvent with correct pitch', () => {
      const msg: IncomingMidiMessage = Object.freeze({
        status: 0x90,
        channel: 0,
        data1: 72, // C5
        data2: 80,
        raw: new Uint8Array([0x90, 72, 80]),
        timestamp: 500,
      });
      const ev = midiMessageToNoteEvent(msg);
      expect(ev).not.toBeNull();
      expect(ev!.pitch.midi).toBe(72);
      expect(ev!.pitch.pitchClass).toBe(0); // C
      expect(ev!.pitch.octave).toBe(5);
    });

    it('velocity-0 note-on → null (note-off semantics)', () => {
      const msg: IncomingMidiMessage = Object.freeze({
        status: 0x90,
        channel: 0,
        data1: 60,
        data2: 0,
        raw: new Uint8Array([0x90, 60, 0]),
        timestamp: 1000,
      });
      expect(midiMessageToNoteEvent(msg)).toBeNull();
    });

    it('non-note message → null', () => {
      const msg: IncomingMidiMessage = Object.freeze({
        status: 0xE0, // Pitch bend
        channel: 0,
        data1: 0,
        data2: 64,
        raw: new Uint8Array([0xE0, 0, 64]),
        timestamp: 1000,
      });
      expect(midiMessageToNoteEvent(msg)).toBeNull();
    });
  });

  describe('onMidiMessage and sendMidiMessage wrappers', () => {
    it('delegates to connection methods', async () => {
      const conn = await webMidiAccess();
      // These just call connection.subscribe/send which are no-ops
      const sub = onMidiMessage(conn, 'any', () => { /* no-op */ });
      expect(() => sub.unsubscribe()).not.toThrow();
      expect(() => sendMidiMessage(conn, 'any', [0x90, 60, 100])).not.toThrow();
    });
  });

  describe('immutability', () => {
    it('returns frozen objects', () => {
      const msg: IncomingMidiMessage = Object.freeze({
        status: 0x90, channel: 0, data1: 60, data2: 100,
        raw: new Uint8Array([0x90, 60, 100]), timestamp: 1000,
      });
      const ev = midiMessageToNoteEvent(msg);
      expect(Object.isFrozen(ev)).toBe(true);
      expect(Object.isFrozen(ev!.pitch)).toBe(true);
    });
  });
});
