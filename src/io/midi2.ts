// ---------------------------------------------------------------------------
// Stratum — MIDI 2.0 Universal MIDI Packet (UMP) Parser
// Parses MIDI 2.0 channel voice messages with 16-bit velocity, 7.9 pitch,
// and provides MIDI 1.0 fallback conversion.
// ---------------------------------------------------------------------------

// ─── Types ─────────────────────────────────────────────────────────────────

/** Valid 4-bit UMP message type nibbles. */
export type UmpMessageType =
  | 0x0 | 0x1 | 0x2 | 0x3 | 0x4 | 0x5;

/** Parsed UMP header from the first 32-bit word. */
export interface UmpHeader {
  readonly messageType: number;
  readonly group: number;
  readonly status: number;
  readonly channel: number;
  readonly wordCount: number;
}

/** MIDI 2.0 note-on event. */
export interface Midi2NoteOn {
  readonly type: 'noteOn';
  readonly group: number;
  readonly channel: number;
  readonly note: number;
  readonly velocity: number;
  readonly attributeType: number;
  readonly attributeValue: number;
}

/** MIDI 2.0 note-off event. */
export interface Midi2NoteOff {
  readonly type: 'noteOff';
  readonly group: number;
  readonly channel: number;
  readonly note: number;
  readonly velocity: number;
  readonly attributeType: number;
  readonly attributeValue: number;
}

/** MIDI 2.0 per-note pitch bend. */
export interface Midi2PitchBend {
  readonly type: 'perNotePitchBend';
  readonly group: number;
  readonly channel: number;
  readonly note: number;
  readonly pitch79: number;
}

/** MIDI 2.0 control change with 32-bit value. */
export interface Midi2ControlChange {
  readonly type: 'controlChange';
  readonly group: number;
  readonly channel: number;
  readonly controller: number;
  readonly value: number;
}

/** MIDI 2.0 channel pressure with 32-bit value. */
export interface Midi2ChannelPressure {
  readonly type: 'channelPressure';
  readonly group: number;
  readonly channel: number;
  readonly value: number;
}

/** Union of all supported MIDI 2.0 event types. */
export type Midi2Event =
  | Midi2NoteOn
  | Midi2NoteOff
  | Midi2PitchBend
  | Midi2ControlChange
  | Midi2ChannelPressure;

/** MIDI 2.0 capability detection result. */
export interface Midi2Capabilities {
  readonly hasPropertyExchange: boolean;
  readonly umpVersion: number;
  readonly groups: number;
}

/** MIDI 1.0 fallback event. */
export interface Midi1Event {
  readonly type: string;
  readonly channel: number;
  readonly data1: number;
  readonly data2: number;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/** MIDI 2.0 channel voice status bytes. */
const STATUS_NOTE_OFF = 0x80;
const STATUS_NOTE_ON = 0x90;
const STATUS_CONTROL_CHANGE = 0xB0;
const STATUS_CHANNEL_PRESSURE = 0xD0;
const STATUS_PER_NOTE_PITCH_BEND = 0x60;

/** Lookup table for word count per UMP message type. */
function umpWordCount(messageType: number): number {
  switch (messageType) {
    case 0x0: // Utility
    case 0x1: // System real-time / common
      return 1;
    case 0x2: // MIDI 1.0 channel voice
    case 0x3: // Data / SysEx 7-bit
      return 2;
    case 0x4: // MIDI 2.0 channel voice
    case 0x5: // Data / SysEx 8-bit
      return 2;
    default:
      return 1;
  }
}

/** Scale 16-bit velocity to 7-bit. Clamp to 1-127 (0 only if input is 0). */
function scaleVelocity16to7(v16: number): number {
  if (v16 === 0) return 0;
  const v7 = Math.round(v16 / 512);
  return Math.max(1, Math.min(127, v7));
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Parse the header fields from a 32-bit UMP word.
 *
 * @param word - The first 32-bit word of a UMP packet.
 * @returns Parsed header with message type, group, status, channel, and word count.
 */
export function parseUmpHeader(word: number): UmpHeader {
  const messageType = (word >>> 28) & 0xF;
  const group = (word >>> 24) & 0xF;
  const status = (word >>> 16) & 0xFF;
  const channel = (word >>> 16) & 0xF;
  const wordCount = umpWordCount(messageType);
  return Object.freeze({ messageType, group, status, channel, wordCount });
}

/**
 * Parse a UMP packet (1-4 words) into a MIDI 2.0 event.
 *
 * Supports MIDI 2.0 channel voice messages (message type 0x4):
 * - Note on/off with 16-bit velocity and attributes
 * - Per-note pitch bend (7.9 fixed-point)
 * - Control change with 32-bit value
 * - Channel pressure with 32-bit value
 *
 * @param words - Array of 32-bit words forming the UMP packet.
 * @returns Parsed event, or null for unsupported message types.
 */
export function parseUmpPacket(words: readonly number[]): Midi2Event | null {
  if (words.length === 0) return null;
  const word0 = words[0] ?? 0;
  const messageType = (word0 >>> 28) & 0xF;

  // Only handle MIDI 2.0 channel voice (type 0x4)
  if (messageType !== 0x4) return null;
  if (words.length < 2) return null;

  const group = (word0 >>> 24) & 0xF;
  const statusByte = (word0 >>> 16) & 0xF0; // Upper nibble of status
  const channel = (word0 >>> 16) & 0xF;
  const note = (word0 >>> 8) & 0x7F;
  const word1 = words[1] ?? 0;

  switch (statusByte) {
    case STATUS_NOTE_ON: {
      const velocity = (word1 >>> 16) & 0xFFFF;
      const attributeType = (word1 >>> 8) & 0xFF;
      const attributeValue = word1 & 0xFF;
      return Object.freeze({
        type: 'noteOn' as const,
        group, channel, note, velocity, attributeType, attributeValue,
      });
    }

    case STATUS_NOTE_OFF: {
      const velocity = (word1 >>> 16) & 0xFFFF;
      const attributeType = (word1 >>> 8) & 0xFF;
      const attributeValue = word1 & 0xFF;
      return Object.freeze({
        type: 'noteOff' as const,
        group, channel, note, velocity, attributeType, attributeValue,
      });
    }

    case STATUS_PER_NOTE_PITCH_BEND: {
      // word1 is the 32-bit pitch bend data
      const pitch79 = pitch79ToSemitones(word1);
      return Object.freeze({
        type: 'perNotePitchBend' as const,
        group, channel, note, pitch79,
      });
    }

    case STATUS_CONTROL_CHANGE: {
      // note field is controller index for CC
      return Object.freeze({
        type: 'controlChange' as const,
        group, channel,
        controller: note,
        value: word1,
      });
    }

    case STATUS_CHANNEL_PRESSURE: {
      return Object.freeze({
        type: 'channelPressure' as const,
        group, channel,
        value: word1,
      });
    }

    default:
      return null;
  }
}

/**
 * Parse a byte buffer as a sequence of UMP packets.
 *
 * Reads 32-bit big-endian words from the buffer and groups them into
 * packets based on message type word count.
 *
 * @param data - Raw byte buffer containing UMP data.
 * @returns Array of parsed MIDI 2.0 events (unsupported types are skipped).
 * @throws {RangeError} If the buffer length is not a multiple of 4 or is truncated.
 */
export function parseUmpStream(data: Uint8Array): readonly Midi2Event[] {
  if (data.length % 4 !== 0) {
    throw new RangeError(`UMP stream length must be a multiple of 4 bytes, got ${data.length}`);
  }

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const totalWords = data.length / 4;
  const events: Midi2Event[] = [];
  let i = 0;

  while (i < totalWords) {
    const word0 = dv.getUint32(i * 4, false);
    const messageType = (word0 >>> 28) & 0xF;
    const wc = umpWordCount(messageType);

    if (i + wc > totalWords) {
      throw new RangeError(`Truncated UMP packet at word ${i}: need ${wc} words, have ${totalWords - i}`);
    }

    const words: number[] = [];
    for (let j = 0; j < wc; j++) {
      words.push(dv.getUint32((i + j) * 4, false));
    }

    const event = parseUmpPacket(words);
    if (event !== null) {
      events.push(event);
    }

    i += wc;
  }

  return Object.freeze(events);
}

/**
 * Convert a MIDI 2.0 event to MIDI 1.0 semantics.
 *
 * - 16-bit velocity → 7-bit (scaled, clamped 1-127 for note-on)
 * - 32-bit CC value → 7-bit MSB
 * - 32-bit pressure → 7-bit MSB
 * - Per-note pitch bend → 14-bit pitch bend data
 *
 * @param event - A MIDI 2.0 event.
 * @returns A MIDI 1.0 event with 7-bit values.
 */
export function midi2ToMidi1(event: Midi2Event): Midi1Event {
  switch (event.type) {
    case 'noteOn': {
      const v7 = scaleVelocity16to7(event.velocity);
      return Object.freeze({
        type: 'noteOn',
        channel: event.channel,
        data1: event.note,
        data2: v7 === 0 ? 1 : v7, // MIDI 1.0: velocity 0 on note-on = note-off, so clamp to 1
      });
    }

    case 'noteOff':
      return Object.freeze({
        type: 'noteOff',
        channel: event.channel,
        data1: event.note,
        data2: scaleVelocity16to7(event.velocity),
      });

    case 'controlChange':
      return Object.freeze({
        type: 'controlChange',
        channel: event.channel,
        data1: event.controller,
        data2: (event.value >>> 25) & 0x7F, // MSB of 32-bit → 7-bit
      });

    case 'channelPressure':
      return Object.freeze({
        type: 'channelPressure',
        channel: event.channel,
        data1: (event.value >>> 25) & 0x7F,
        data2: 0,
      });

    case 'perNotePitchBend': {
      // Convert float semitones back to 14-bit pitch bend centered at 0x2000
      // Assume ±2 semitone range (standard MIDI 1.0 default)
      const normalized = Math.max(-1, Math.min(1, event.pitch79 / 2));
      const pb14 = Math.round((normalized + 1) * 0x2000);
      const clamped = Math.max(0, Math.min(0x3FFF, pb14));
      return Object.freeze({
        type: 'pitchBend',
        channel: event.channel,
        data1: clamped & 0x7F,           // LSB
        data2: (clamped >>> 7) & 0x7F,   // MSB
      });
    }
  }
}

/**
 * Scan a UMP byte buffer for MIDI 2.0 discovery/capability messages.
 *
 * Detects:
 * - UMP version from utility messages
 * - Property Exchange capability from type 0x5 SysEx messages
 * - Number of active groups
 *
 * @param data - Raw UMP byte buffer.
 * @returns Detected capabilities.
 */
export function detectMidi2Capabilities(data: Uint8Array): Midi2Capabilities {
  let hasPropertyExchange = false;
  let umpVersion = 1;
  const groupsSeen = new Set<number>();

  if (data.length % 4 !== 0) {
    return Object.freeze({ hasPropertyExchange, umpVersion, groups: 0 });
  }

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const totalWords = data.length / 4;
  let i = 0;

  while (i < totalWords) {
    const word0 = dv.getUint32(i * 4, false);
    const messageType = (word0 >>> 28) & 0xF;
    const group = (word0 >>> 24) & 0xF;
    const wc = umpWordCount(messageType);

    if (i + wc > totalWords) break;

    groupsSeen.add(group);

    // Type 0x5 = Data/SysEx 8-bit → indicates property exchange capability
    if (messageType === 0x5) {
      hasPropertyExchange = true;
    }

    // Type 0x0 = Utility; check for UMP version notification
    if (messageType === 0x0) {
      const status = (word0 >>> 16) & 0x3FF;
      // Status 0x000 with non-zero version field
      if (status === 0) {
        const ver = word0 & 0xFF;
        if (ver > 0) umpVersion = ver;
      }
    }

    i += wc;
  }

  return Object.freeze({
    hasPropertyExchange,
    umpVersion,
    groups: groupsSeen.size,
  });
}

/**
 * Convert a 7.9 fixed-point pitch value to floating-point semitones.
 *
 * MIDI 2.0 uses 7.9 fixed-point for per-note pitch:
 * - Upper 7 bits: signed semitone offset
 * - Lower 9 bits: fractional part (1/512 semitone resolution)
 *
 * @param value - The 32-bit word containing the 7.9 pitch value (in bits 31..16).
 * @returns Pitch offset in semitones as a float.
 */
export function pitch79ToSemitones(value: number): number {
  // The 7.9 value occupies the upper 16 bits of word1 in some contexts,
  // but for per-note pitch bend it's the full 32-bit word.
  // Extract the 16-bit value from the upper half
  const raw16 = (value >>> 16) & 0xFFFF;
  // 7 bits signed + 9 bits fractional
  const semitones = (raw16 >> 9) & 0x7F;
  const signed = semitones >= 64 ? semitones - 128 : semitones;
  const fractional = (raw16 & 0x1FF) / 512;
  return signed + fractional;
}

/**
 * Convert floating-point semitones to 7.9 fixed-point value.
 *
 * @param semitones - Pitch offset in semitones.
 * @returns 32-bit value with 7.9 pitch in upper 16 bits.
 */
export function semitonesToPitch79(semitones: number): number {
  const clamped = Math.max(-64, Math.min(63.998046875, semitones));
  const intPart = Math.floor(clamped);
  const fracPart = clamped - intPart;
  // Convert to 7-bit signed (two's complement in 7 bits)
  const signed7 = intPart < 0 ? (intPart + 128) & 0x7F : intPart & 0x7F;
  const frac9 = Math.round(fracPart * 512) & 0x1FF;
  const raw16 = ((signed7 << 9) | frac9) & 0xFFFF;
  return (raw16 << 16) >>> 0;
}
