// ---------------------------------------------------------------------------
// Stratum — Web MIDI API Integration
// Browser MIDI input/output with graceful Node.js degradation.
// ---------------------------------------------------------------------------

import type { NoteEvent } from '../core/types.js';
import { pitchFromMidi } from '../core/score.js';

// ─── Local Web MIDI Type Declarations ──────────────────────────────────────
// These mirror the Web MIDI API without requiring the DOM lib in tsconfig.

interface MidiPortLike {
  id: string;
  name: string | null;
  manufacturer: string | null;
  type: 'input' | 'output';
}

interface MidiInputLike extends MidiPortLike {
  onmidimessage: ((ev: { data: Uint8Array }) => void) | null;
}

interface MidiOutputLike extends MidiPortLike {
  send(data: readonly number[], timestamp?: number): void;
}

interface MidiAccessLike {
  inputs: Map<string, MidiInputLike>;
  outputs: Map<string, MidiOutputLike>;
}

// ─── Public Types ──────────────────────────────────────────────────────────

/** A MIDI device descriptor. */
export interface MidiDevice {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
}

/** Options for requesting Web MIDI access. */
export interface WebMidiAccessOptions {
  readonly sysex?: boolean;
}

/** Callback for incoming MIDI messages. */
export type MidiMessageCallback = (message: IncomingMidiMessage) => void;

/** A parsed incoming MIDI message. */
export interface IncomingMidiMessage {
  readonly status: number;
  readonly channel: number;
  readonly data1: number;
  readonly data2: number;
  readonly raw: Uint8Array;
  readonly timestamp: number;
}

/** A subscription handle for unsubscribing from MIDI messages. */
export interface MidiSubscription {
  readonly unsubscribe: () => void;
}

/** A Web MIDI connection providing input/output access. */
export interface WebMidiConnection {
  readonly available: boolean;
  readonly inputs: ReadonlyMap<string, MidiInputLike>;
  readonly outputs: ReadonlyMap<string, MidiOutputLike>;
  readonly send: (outputId: string, data: readonly number[], timestamp?: number) => void;
  readonly subscribe: (inputId: string, callback: MidiMessageCallback) => MidiSubscription;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/** Safely access navigator from globalThis without requiring DOM types. */
function getNavigator(): { requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MidiAccessLike> } | undefined {
  return (globalThis as unknown as { navigator?: { requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MidiAccessLike> } }).navigator;
}

/** Parse 1-3 raw MIDI bytes into an IncomingMidiMessage. */
function parseMidiBytes(data: Uint8Array, timestamp: number): IncomingMidiMessage {
  if (data.length === 0) {
    throw new RangeError('MIDI message cannot be empty');
  }

  const status = data[0] ?? 0;
  const channel = status & 0x0F;
  const data1 = data.length > 1 ? (data[1] ?? 0) : 0;
  const data2 = data.length > 2 ? (data[2] ?? 0) : 0;

  return Object.freeze({
    status: status & 0xF0,
    channel,
    data1,
    data2,
    raw: data,
    timestamp,
  });
}

/** Map a Web MIDI port to a MidiDevice descriptor. */
function portToDevice(port: MidiPortLike): MidiDevice {
  return Object.freeze({
    id: port.id,
    name: port.name ?? 'Unknown',
    manufacturer: port.manufacturer ?? 'Unknown',
  });
}

/** Create a no-op connection for non-browser environments. */
function createNoOpConnection(): WebMidiConnection {
  return Object.freeze({
    available: false,
    inputs: new Map<string, MidiInputLike>(),
    outputs: new Map<string, MidiOutputLike>(),
    send: () => { /* no-op */ },
    subscribe: (): MidiSubscription => Object.freeze({ unsubscribe: () => { /* no-op */ } }),
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Check if the Web MIDI API is available in the current environment.
 *
 * @returns `true` if `navigator.requestMIDIAccess` exists, `false` otherwise.
 */
export function isWebMidiSupported(): boolean {
  const nav = getNavigator();
  return nav !== undefined && typeof nav.requestMIDIAccess === 'function';
}

/**
 * Request Web MIDI access.
 *
 * In browser environments, calls `navigator.requestMIDIAccess()`.
 * In Node.js or environments without Web MIDI, returns a no-op connection
 * with `available: false` that does not throw.
 *
 * @param options - Optional access options (e.g., sysex permission).
 * @returns A WebMidiConnection providing device enumeration and messaging.
 */
export async function webMidiAccess(options?: WebMidiAccessOptions): Promise<WebMidiConnection> {
  const nav = getNavigator();
  if (!nav || typeof nav.requestMIDIAccess !== 'function') {
    return createNoOpConnection();
  }

  const access = await nav.requestMIDIAccess({ sysex: options?.sysex ?? false });

  const send = (outputId: string, data: readonly number[], timestamp?: number): void => {
    const output = access.outputs.get(outputId);
    if (!output) {
      throw new RangeError(`MIDI output device not found: "${outputId}"`);
    }
    output.send(data, timestamp);
  };

  const subscribe = (inputId: string, callback: MidiMessageCallback): MidiSubscription => {
    const input = access.inputs.get(inputId);
    if (!input) {
      throw new RangeError(`MIDI input device not found: "${inputId}"`);
    }

    const handler = (ev: { data: Uint8Array }): void => {
      callback(parseMidiBytes(ev.data, Date.now()));
    };
    input.onmidimessage = handler;

    return Object.freeze({
      unsubscribe: () => {
        input.onmidimessage = null;
      },
    });
  };

  return Object.freeze({
    available: true,
    inputs: access.inputs,
    outputs: access.outputs,
    send,
    subscribe,
  });
}

/**
 * List available MIDI input devices.
 *
 * @param connection - A WebMidiConnection obtained from `webMidiAccess()`.
 * @returns Array of MIDI input device descriptors.
 */
export function listMidiInputs(connection: WebMidiConnection): readonly MidiDevice[] {
  const devices: MidiDevice[] = [];
  for (const port of connection.inputs.values()) {
    devices.push(portToDevice(port));
  }
  return Object.freeze(devices);
}

/**
 * List available MIDI output devices.
 *
 * @param connection - A WebMidiConnection obtained from `webMidiAccess()`.
 * @returns Array of MIDI output device descriptors.
 */
export function listMidiOutputs(connection: WebMidiConnection): readonly MidiDevice[] {
  const devices: MidiDevice[] = [];
  for (const port of connection.outputs.values()) {
    devices.push(portToDevice(port));
  }
  return Object.freeze(devices);
}

/**
 * Subscribe to MIDI messages from an input device.
 *
 * @param connection - A WebMidiConnection obtained from `webMidiAccess()`.
 * @param inputId - The device ID of the MIDI input to subscribe to.
 * @param callback - Function called for each incoming MIDI message.
 * @returns A subscription handle with an `unsubscribe` method.
 * @throws {RangeError} If the input device ID is not found (browser only).
 */
export function onMidiMessage(
  connection: WebMidiConnection,
  inputId: string,
  callback: MidiMessageCallback,
): MidiSubscription {
  return connection.subscribe(inputId, callback);
}

/**
 * Send MIDI data to an output device.
 *
 * @param connection - A WebMidiConnection obtained from `webMidiAccess()`.
 * @param outputId - The device ID of the MIDI output to send to.
 * @param data - Array of MIDI bytes to send.
 * @param timestamp - Optional scheduling timestamp (DOMHighResTimeStamp).
 * @throws {RangeError} If the output device ID is not found (browser only).
 */
export function sendMidiMessage(
  connection: WebMidiConnection,
  outputId: string,
  data: readonly number[],
  timestamp?: number,
): void {
  connection.send(outputId, data, timestamp);
}

/**
 * Convert a MIDI note-on message to a stratum NoteEvent.
 *
 * Returns `null` for non-note messages or velocity-0 note-on (which is
 * semantically a note-off in MIDI).
 *
 * @param message - An incoming MIDI message.
 * @returns A NoteEvent, or null if the message is not a note-on with positive velocity.
 */
export function midiMessageToNoteEvent(message: IncomingMidiMessage): NoteEvent | null {
  // Note-on = 0x90, check for positive velocity
  if (message.status !== 0x90 || message.data2 === 0) {
    return null;
  }

  const pitch = pitchFromMidi(message.data1);
  return Object.freeze({
    id: `webmidi-${message.channel}-${message.data1}-${message.timestamp}`,
    pitch: Object.freeze(pitch),
    onset: 0,
    duration: 1,
    velocity: message.data2,
    voice: 0,
  });
}
