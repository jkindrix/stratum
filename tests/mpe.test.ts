import { describe, it, expect } from 'vitest';
import {
  detectMpeConfig,
  parseMpeStream,
  mpeChannelToVoice,
  normalizePitchBend14,
  mpeNoteToNoteEvent,
} from '../src/io/mpe.js';
import type { MidiMessage, MpeConfig } from '../src/io/mpe.js';

/** Helper: create a CC message. */
function cc(channel: number, controller: number, value: number): MidiMessage {
  return { status: 0xB0 | channel, data1: controller, data2: value, channel };
}

/** Helper: create a note-on message. */
function noteOn(channel: number, note: number, velocity: number): MidiMessage {
  return { status: 0x90 | channel, data1: note, data2: velocity, channel };
}

/** Helper: create a pitch bend message. */
function pitchBend(channel: number, msb: number, lsb: number): MidiMessage {
  return { status: 0xE0 | channel, data1: lsb, data2: msb, channel };
}

/** Helper: create a channel aftertouch message. */
function aftertouch(channel: number, value: number): MidiMessage {
  return { status: 0xD0 | channel, data1: value, data2: 0, channel };
}

/** MCM sequence: RPN 0x0006 → CC101=0, CC100=6, CC6=memberCount. */
function mcm(channel: number, memberCount: number): MidiMessage[] {
  return [
    cc(channel, 101, 0),
    cc(channel, 100, 6),
    cc(channel, 6, memberCount),
  ];
}

describe('MPE parsing', () => {
  describe('detectMpeConfig', () => {
    it('detects lower zone MCM on channel 0', () => {
      const messages = mcm(0, 5);
      const config = detectMpeConfig(messages);
      expect(config.lowerZone).not.toBeNull();
      expect(config.lowerZone!.masterChannel).toBe(0);
      expect(config.lowerZone!.memberChannels).toBe(5);
      expect(config.lowerZone!.memberChannelStart).toBe(1);
      expect(config.lowerZone!.memberChannelEnd).toBe(5);
      expect(config.upperZone).toBeNull();
    });

    it('detects upper zone MCM on channel 15', () => {
      const messages = mcm(15, 4);
      const config = detectMpeConfig(messages);
      expect(config.upperZone).not.toBeNull();
      expect(config.upperZone!.masterChannel).toBe(15);
      expect(config.upperZone!.memberChannels).toBe(4);
      expect(config.upperZone!.memberChannelStart).toBe(11);
      expect(config.upperZone!.memberChannelEnd).toBe(14);
      expect(config.lowerZone).toBeNull();
    });

    it('detects both zones', () => {
      const messages = [...mcm(0, 3), ...mcm(15, 3)];
      const config = detectMpeConfig(messages);
      expect(config.lowerZone).not.toBeNull();
      expect(config.upperZone).not.toBeNull();
    });

    it('returns null zones when no MCM detected', () => {
      const config = detectMpeConfig([]);
      expect(config.lowerZone).toBeNull();
      expect(config.upperZone).toBeNull();
    });
  });

  describe('parseMpeStream', () => {
    it('parses per-note pitch bend on member channel', () => {
      const config: MpeConfig = Object.freeze({
        lowerZone: Object.freeze({
          masterChannel: 0,
          memberChannels: 3,
          memberChannelStart: 1,
          memberChannelEnd: 3,
        }),
        upperZone: null,
      });

      const messages: MidiMessage[] = [
        // Pitch bend on channel 1 (member), MSB=96, LSB=0 → above center
        pitchBend(1, 96, 0),
        // Note-on on channel 1
        noteOn(1, 60, 100),
      ];

      const result = parseMpeStream(messages, config);
      expect(result.notes.length).toBe(1);
      expect(result.notes[0]!.expression.pitchBend).toBeGreaterThan(0);
    });

    it('parses per-note pressure (channel aftertouch)', () => {
      const config: MpeConfig = Object.freeze({
        lowerZone: Object.freeze({
          masterChannel: 0,
          memberChannels: 3,
          memberChannelStart: 1,
          memberChannelEnd: 3,
        }),
        upperZone: null,
      });

      const messages: MidiMessage[] = [
        aftertouch(1, 100),
        noteOn(1, 60, 80),
      ];

      const result = parseMpeStream(messages, config);
      expect(result.notes[0]!.expression.pressure).toBeCloseTo(100 / 127, 2);
    });

    it('parses per-note slide (CC74)', () => {
      const config: MpeConfig = Object.freeze({
        lowerZone: Object.freeze({
          masterChannel: 0,
          memberChannels: 3,
          memberChannelStart: 1,
          memberChannelEnd: 3,
        }),
        upperZone: null,
      });

      const messages: MidiMessage[] = [
        cc(1, 74, 64),
        noteOn(1, 60, 80),
      ];

      const result = parseMpeStream(messages, config);
      expect(result.notes[0]!.expression.slide).toBeCloseTo(64 / 127, 2);
    });

    it('handles multiple simultaneous notes on different channels', () => {
      const config: MpeConfig = Object.freeze({
        lowerZone: Object.freeze({
          masterChannel: 0,
          memberChannels: 5,
          memberChannelStart: 1,
          memberChannelEnd: 5,
        }),
        upperZone: null,
      });

      const messages: MidiMessage[] = [
        noteOn(1, 60, 80),
        noteOn(2, 64, 90),
        noteOn(3, 67, 100),
      ];

      const result = parseMpeStream(messages, config);
      expect(result.notes.length).toBe(3);
      expect(result.notes[0]!.channel).toBe(1);
      expect(result.notes[1]!.channel).toBe(2);
      expect(result.notes[2]!.channel).toBe(3);
    });

    it('master channel events do not create per-note data', () => {
      const config: MpeConfig = Object.freeze({
        lowerZone: Object.freeze({
          masterChannel: 0,
          memberChannels: 3,
          memberChannelStart: 1,
          memberChannelEnd: 3,
        }),
        upperZone: null,
      });

      const messages: MidiMessage[] = [
        // Note on master channel (channel 0) — should be ignored
        noteOn(0, 60, 80),
      ];

      const result = parseMpeStream(messages, config);
      expect(result.notes.length).toBe(0);
    });
  });

  describe('normalizePitchBend14', () => {
    it('center (0x2000) → 0.0', () => {
      // 0x2000 = MSB 64, LSB 0
      expect(normalizePitchBend14(64, 0)).toBeCloseTo(0.0, 5);
    });

    it('max → ~+1.0, min → -1.0', () => {
      // Max: 0x3FFF = MSB 127, LSB 127
      expect(normalizePitchBend14(127, 127)).toBeCloseTo(1.0, 2);
      // Min: 0x0000 = MSB 0, LSB 0
      expect(normalizePitchBend14(0, 0)).toBeCloseTo(-1.0, 5);
    });
  });

  describe('mpeChannelToVoice', () => {
    const config: MpeConfig = Object.freeze({
      lowerZone: Object.freeze({
        masterChannel: 0,
        memberChannels: 3,
        memberChannelStart: 1,
        memberChannelEnd: 3,
      }),
      upperZone: null,
    });

    it('master channel → -1', () => {
      expect(mpeChannelToVoice(0, config)).toBe(-1);
    });

    it('member channels → sequential indices', () => {
      expect(mpeChannelToVoice(1, config)).toBe(0);
      expect(mpeChannelToVoice(2, config)).toBe(1);
      expect(mpeChannelToVoice(3, config)).toBe(2);
    });
  });

  describe('mpeNoteToNoteEvent', () => {
    it('produces valid NoteEvent', () => {
      const mpeNote = Object.freeze({
        channel: 1,
        note: 60,
        velocity: 100,
        expression: Object.freeze({
          channel: 1, note: 60,
          pitchBend: 0, pressure: 0.5, slide: 0.3,
        }),
      });

      const event = mpeNoteToNoteEvent(mpeNote, 0, 480);
      expect(event.pitch.midi).toBe(60);
      expect(event.onset).toBe(0);
      expect(event.duration).toBe(480);
      expect(event.velocity).toBe(100);
    });

    it('applies pitch bend as centsDeviation', () => {
      const mpeNote = Object.freeze({
        channel: 1,
        note: 60,
        velocity: 100,
        expression: Object.freeze({
          channel: 1, note: 60,
          pitchBend: 0.5, // Half of ±48 = 24 semitones = 2400 cents
          pressure: 0, slide: 0,
        }),
      });

      const event = mpeNoteToNoteEvent(mpeNote, 0, 480);
      expect(event.pitch.centsDeviation).toBeCloseTo(2400, 0);
    });
  });

  describe('immutability', () => {
    it('returns frozen objects', () => {
      const config = detectMpeConfig([]);
      expect(Object.isFrozen(config)).toBe(true);

      const result = parseMpeStream([]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.notes)).toBe(true);

      const mpeNote = Object.freeze({
        channel: 1, note: 60, velocity: 100,
        expression: Object.freeze({
          channel: 1, note: 60, pitchBend: 0, pressure: 0, slide: 0,
        }),
      });
      const event = mpeNoteToNoteEvent(mpeNote, 0, 480);
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.pitch)).toBe(true);
    });
  });
});
