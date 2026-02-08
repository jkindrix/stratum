// ---------------------------------------------------------------------------
// Stratum — MPE (MIDI Polyphonic Expression) Parser
// Parses per-note pitch bend, pressure, and slide from MIDI channel-per-note
// streams following the MPE specification.
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';
import { pitchFromMidi } from '../core/score.js';

// ─── Types ─────────────────────────────────────────────────────────────────

/** MPE zone configuration (lower or upper). */
export interface MpeZone {
  readonly masterChannel: number;
  readonly memberChannels: number;
  readonly memberChannelStart: number;
  readonly memberChannelEnd: number;
}

/** Full MPE configuration with optional lower and upper zones. */
export interface MpeConfig {
  readonly lowerZone: MpeZone | null;
  readonly upperZone: MpeZone | null;
}

/** Per-note expression state for an MPE note. */
export interface MpeNoteExpression {
  readonly channel: number;
  readonly note: number;
  /** Per-note pitch bend, normalized to -1.0 .. +1.0. */
  readonly pitchBend: number;
  /** Per-note pressure (channel aftertouch), normalized to 0.0 .. 1.0. */
  readonly pressure: number;
  /** Per-note slide (CC74), normalized to 0.0 .. 1.0. */
  readonly slide: number;
}

/** An MPE note event combining note-on data with per-note expression. */
export interface MpeNoteEvent {
  readonly channel: number;
  readonly note: number;
  readonly velocity: number;
  readonly expression: MpeNoteExpression;
}

/** A raw MIDI message for MPE input parsing. */
export interface MidiMessage {
  /** Status byte (0x80-0xFF). */
  readonly status: number;
  /** First data byte (0-127). */
  readonly data1: number;
  /** Second data byte (0-127). */
  readonly data2: number;
  /** Channel (0-15). */
  readonly channel: number;
}

/** Result of parsing an MPE stream. */
export interface MpeParseResult {
  readonly config: MpeConfig;
  readonly notes: readonly MpeNoteEvent[];
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/** MIDI status byte masks. */
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CONTROL_CHANGE = 0xB0;
const CHANNEL_PRESSURE = 0xD0;
const PITCH_BEND = 0xE0;

/** MCM detection: RPN 0x0006 = CC101(0) + CC100(6) + CC6(memberCount). */
interface McmState {
  rpn101: boolean;
  rpn100: boolean;
}

/** Per-channel expression tracking. */
interface ChannelExpression {
  pitchBend: number;
  pressure: number;
  slide: number;
}

/** Check if a channel is a member channel in any zone. */
function isMemberChannel(ch: number, config: MpeConfig): boolean {
  if (config.lowerZone) {
    if (ch >= config.lowerZone.memberChannelStart && ch <= config.lowerZone.memberChannelEnd) {
      return true;
    }
  }
  if (config.upperZone) {
    if (ch >= config.upperZone.memberChannelStart && ch <= config.upperZone.memberChannelEnd) {
      return true;
    }
  }
  return false;
}

/** Check if a channel is a master channel in any zone. */
function isMasterChannel(ch: number, config: MpeConfig): boolean {
  if (config.lowerZone && ch === config.lowerZone.masterChannel) return true;
  if (config.upperZone && ch === config.upperZone.masterChannel) return true;
  return false;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Detect MPE zone configuration from MIDI messages.
 *
 * Scans for MCM (MIDI Channel Mode) messages:
 * - RPN 0x0006 on channel 0 → lower zone with N member channels (1..N)
 * - RPN 0x0006 on channel 15 → upper zone with N member channels (15-N..14)
 *
 * @param messages - Array of raw MIDI messages.
 * @returns Detected MPE configuration with lower and upper zones.
 */
export function detectMpeConfig(messages: readonly MidiMessage[]): MpeConfig {
  let lowerZone: MpeZone | null = null;
  let upperZone: MpeZone | null = null;

  // Track RPN state per channel
  const mcmState = new Map<number, McmState>();

  for (const msg of messages) {
    const statusType = msg.status & 0xF0;
    if (statusType !== CONTROL_CHANGE) continue;

    const ch = msg.channel;
    if (!mcmState.has(ch)) {
      mcmState.set(ch, { rpn101: false, rpn100: false });
    }
    const state = mcmState.get(ch)!;

    if (msg.data1 === 101 && msg.data2 === 0) {
      state.rpn101 = true;
    } else if (msg.data1 === 100 && msg.data2 === 6) {
      state.rpn100 = true;
    } else if (msg.data1 === 6 && state.rpn101 && state.rpn100) {
      // CC6 = member channel count, and RPN 0x0006 was set
      const memberCount = msg.data2;
      if (ch === 0 && memberCount > 0) {
        lowerZone = Object.freeze({
          masterChannel: 0,
          memberChannels: memberCount,
          memberChannelStart: 1,
          memberChannelEnd: Math.min(memberCount, 14),
        });
      } else if (ch === 15 && memberCount > 0) {
        upperZone = Object.freeze({
          masterChannel: 15,
          memberChannels: memberCount,
          memberChannelStart: Math.max(15 - memberCount, 1),
          memberChannelEnd: 14,
        });
      }
      // Reset RPN state
      state.rpn101 = false;
      state.rpn100 = false;
    }
  }

  return Object.freeze({ lowerZone, upperZone });
}

/**
 * Parse a MIDI message stream with MPE semantics.
 *
 * Per-note expression is tracked per member channel:
 * - Pitch bend → per-note pitch bend (-1.0 to +1.0)
 * - Channel aftertouch (0xD0) → per-note pressure (0.0 to 1.0)
 * - CC74 → per-note slide (0.0 to 1.0)
 *
 * @param messages - Array of raw MIDI messages.
 * @param config - Optional MPE config. Auto-detected if not provided.
 * @returns Parse result with config and MPE note events.
 */
export function parseMpeStream(
  messages: readonly MidiMessage[],
  config?: MpeConfig,
): MpeParseResult {
  const cfg = config ?? detectMpeConfig(messages);

  // Track per-channel expression
  const channelExpr = new Map<number, ChannelExpression>();
  const notes: MpeNoteEvent[] = [];

  for (const msg of messages) {
    const statusType = msg.status & 0xF0;
    const ch = msg.channel;

    // Initialize channel expression if needed
    if (!channelExpr.has(ch)) {
      channelExpr.set(ch, { pitchBend: 0, pressure: 0, slide: 0 });
    }
    const expr = channelExpr.get(ch)!;

    // Skip master channel events for note creation
    if (isMasterChannel(ch, cfg)) continue;

    switch (statusType) {
      case NOTE_ON: {
        if (msg.data2 === 0) break; // velocity 0 = note-off
        if (!isMemberChannel(ch, cfg) && (cfg.lowerZone !== null || cfg.upperZone !== null)) break;

        notes.push(Object.freeze({
          channel: ch,
          note: msg.data1,
          velocity: msg.data2,
          expression: Object.freeze({
            channel: ch,
            note: msg.data1,
            pitchBend: expr.pitchBend,
            pressure: expr.pressure,
            slide: expr.slide,
          }),
        }));
        break;
      }

      case PITCH_BEND: {
        // 14-bit pitch bend: data1=LSB, data2=MSB
        const raw14 = msg.data1 | (msg.data2 << 7);
        expr.pitchBend = normalizePitchBend14(msg.data2, msg.data1);
        // Update expression on any active notes for this channel
        void raw14; // used implicitly through normalizePitchBend14
        break;
      }

      case CHANNEL_PRESSURE: {
        expr.pressure = msg.data1 / 127;
        break;
      }

      case CONTROL_CHANGE: {
        if (msg.data1 === 74) {
          expr.slide = msg.data2 / 127;
        }
        break;
      }

      default:
        break;
    }
  }

  return Object.freeze({ config: cfg, notes: Object.freeze(notes) });
}

/**
 * Map an MPE member channel to a voice index.
 *
 * @param channel - MIDI channel (0-15).
 * @param config - MPE configuration.
 * @returns Voice index (0-based) for member channels, or -1 for master channels.
 */
export function mpeChannelToVoice(channel: number, config: MpeConfig): number {
  if (config.lowerZone) {
    if (channel === config.lowerZone.masterChannel) return -1;
    if (channel >= config.lowerZone.memberChannelStart && channel <= config.lowerZone.memberChannelEnd) {
      return channel - config.lowerZone.memberChannelStart;
    }
  }
  if (config.upperZone) {
    if (channel === config.upperZone.masterChannel) return -1;
    if (channel >= config.upperZone.memberChannelStart && channel <= config.upperZone.memberChannelEnd) {
      return channel - config.upperZone.memberChannelStart;
    }
  }
  return -1;
}

/**
 * Normalize 14-bit MIDI pitch bend to -1.0 .. +1.0.
 *
 * Center value 0x2000 = 0.0, min 0x0000 = -1.0, max 0x3FFF ≈ +1.0.
 *
 * @param msb - Pitch bend MSB (data2, 0-127).
 * @param lsb - Pitch bend LSB (data1, 0-127).
 * @returns Normalized pitch bend value.
 */
export function normalizePitchBend14(msb: number, lsb: number): number {
  const raw14 = (msb << 7) | lsb;
  return (raw14 - 0x2000) / 0x2000;
}

/**
 * Convert an MPE note event to a standard stratum NoteEvent.
 *
 * The per-note pitch bend is applied as centsDeviation:
 * - Default MPE range is ±48 semitones
 * - Cents = pitchBend * 48 * 100
 *
 * @param mpeNote - The MPE note event.
 * @param onset - Onset time in ticks.
 * @param duration - Duration in ticks.
 * @returns A standard NoteEvent with centsDeviation applied.
 */
export function mpeNoteToNoteEvent(
  mpeNote: MpeNoteEvent,
  onset: number,
  duration: number,
): NoteEvent {
  const basePitch = pitchFromMidi(mpeNote.note);
  const centsDeviation = mpeNote.expression.pitchBend * 48 * 100;

  return Object.freeze({
    id: `mpe-${mpeNote.channel}-${mpeNote.note}-${onset}`,
    pitch: Object.freeze({
      ...basePitch,
      centsDeviation: (basePitch.centsDeviation ?? 0) + centsDeviation,
    }),
    onset,
    duration,
    velocity: mpeNote.velocity,
    voice: 0,
  });
}
