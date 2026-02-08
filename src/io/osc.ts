// ---------------------------------------------------------------------------
// Stratum — OSC 1.0 Binary Serialization
// Implements Open Sound Control 1.0 message and bundle encoding
// ---------------------------------------------------------------------------

// ─── Types ─────────────────────────────────────────────────────────────────

/** Supported OSC type tags. */
export type OscType = 'i' | 'f' | 's' | 'b' | 'h' | 't';

/** A single OSC argument with explicit type tag. */
export interface OscArgument {
  readonly type: OscType;
  readonly value: number | bigint | string | Uint8Array;
}

/** An OSC message: address pattern + arguments. */
export interface OscMessage {
  readonly address: string;
  readonly args: readonly OscArgument[];
}

/**
 * An OSC bundle: timetag + ordered elements (messages or nested bundles).
 * Timetag is NTP format: [seconds since 1900-01-01, fractional seconds].
 * Immediate execution uses the special timetag `[0, 1]`.
 */
export interface OscBundle {
  readonly timetag: readonly [seconds: number, fractional: number];
  readonly elements: readonly (OscMessage | OscBundle)[];
}

/** Options for converting analysis results to OSC messages. */
export interface OscExportOptions {
  readonly addressPrefix?: string;
  readonly includeKeys?: boolean;
  readonly includeChords?: boolean;
  readonly includeTension?: boolean;
  readonly includeBeats?: boolean;
}

/** Analysis data that can be exported as OSC messages. */
export interface OscAnalysisInput {
  readonly tension?: readonly { readonly tick: number; readonly value: number }[];
  readonly keys?: readonly { readonly tick: number; readonly label: string }[];
  readonly chords?: readonly { readonly tick: number; readonly label: string }[];
  readonly beats?: readonly { readonly tick: number; readonly value: number }[];
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/** Calculate padding needed to reach next 4-byte boundary. */
function padToFour(len: number): number {
  const rem = len % 4;
  return rem === 0 ? 0 : 4 - rem;
}

/** Concatenate multiple Uint8Arrays into one. */
function concatBuffers(bufs: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const b of bufs) total += b.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/** Encode an OSC string: UTF-8 + null terminator + padding to 4-byte boundary. */
function writeOscString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  // +1 for null terminator
  const totalLen = encoded.length + 1;
  const padded = totalLen + padToFour(totalLen);
  const buf = new Uint8Array(padded);
  buf.set(encoded, 0);
  // Remaining bytes are already 0 (null terminator + padding)
  return buf;
}

/** Encode a 32-bit big-endian signed integer. */
function writeOscInt32(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  const dv = new DataView(buf.buffer);
  dv.setInt32(0, n, false);
  return buf;
}

/** Encode a 32-bit big-endian IEEE 754 float. */
function writeOscFloat32(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  const dv = new DataView(buf.buffer);
  dv.setFloat32(0, n, false);
  return buf;
}

/** Encode a blob: 4-byte size prefix + data + padding to 4-byte boundary. */
function writeOscBlob(data: Uint8Array): Uint8Array {
  const sizeBytes = writeOscInt32(data.length);
  const padded = data.length + padToFour(data.length);
  const blobBuf = new Uint8Array(padded);
  blobBuf.set(data, 0);
  return concatBuffers([sizeBytes, blobBuf]);
}

/** Encode a 64-bit big-endian signed integer from BigInt. */
function writeOscInt64(n: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const dv = new DataView(buf.buffer);
  dv.setBigInt64(0, n, false);
  return buf;
}

/** Encode an NTP timetag as two 32-bit big-endian unsigned integers. */
function writeOscTimetag(seconds: number, fractional: number): Uint8Array {
  const buf = new Uint8Array(8);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, seconds, false);
  dv.setUint32(4, fractional, false);
  return buf;
}

/** Encode a single OSC argument to its binary representation. */
function writeArg(arg: OscArgument): Uint8Array {
  switch (arg.type) {
    case 'i': return writeOscInt32(arg.value as number);
    case 'f': return writeOscFloat32(arg.value as number);
    case 's': return writeOscString(arg.value as string);
    case 'b': return writeOscBlob(arg.value as Uint8Array);
    case 'h': return writeOscInt64(arg.value as bigint);
    case 't': {
      // Timetag stored as bigint: upper 32 = seconds, lower 32 = fractional
      const v = arg.value as bigint;
      const sec = Number((v >> 32n) & 0xFFFFFFFFn);
      const frac = Number(v & 0xFFFFFFFFn);
      return writeOscTimetag(sec, frac);
    }
  }
}

/** Check if an element is an OscBundle (vs OscMessage). */
function isBundle(el: OscMessage | OscBundle): el is OscBundle {
  return 'timetag' in el && 'elements' in el;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Serialize an OSC message to its binary representation.
 *
 * The binary format follows OSC 1.0:
 * - Address string (null-terminated, 4-byte aligned)
 * - Type tag string: comma + type chars (null-terminated, 4-byte aligned)
 * - Arguments in order, each 4-byte aligned
 *
 * @param message - The OSC message to serialize.
 * @returns Binary representation as Uint8Array.
 * @throws {RangeError} If the address does not start with `/`.
 */
export function oscToBuffer(message: OscMessage): Uint8Array {
  if (!message.address.startsWith('/')) {
    throw new RangeError(`OSC address must start with "/", got "${message.address}"`);
  }

  const parts: Uint8Array[] = [];

  // Address
  parts.push(writeOscString(message.address));

  // Type tag string: comma + type chars
  const typeTags = ',' + message.args.map(a => a.type).join('');
  parts.push(writeOscString(typeTags));

  // Arguments
  for (const arg of message.args) {
    parts.push(writeArg(arg));
  }

  return concatBuffers(parts);
}

/**
 * Serialize an OSC bundle to its binary representation (recursive).
 *
 * Bundle format:
 * - `#bundle\0` (8 bytes)
 * - NTP timetag (8 bytes)
 * - For each element: 4-byte size prefix + element bytes
 *
 * @param bundle - The OSC bundle to serialize.
 * @returns Binary representation as Uint8Array.
 */
export function oscBundleToBuffer(bundle: OscBundle): Uint8Array {
  const parts: Uint8Array[] = [];

  // Bundle header: "#bundle\0" (exactly 8 bytes, already 4-byte aligned)
  const header = new Uint8Array(8);
  const headerStr = '#bundle';
  for (let i = 0; i < headerStr.length; i++) {
    header[i] = headerStr.charCodeAt(i);
  }
  // header[7] is already 0 (null terminator)
  parts.push(header);

  // Timetag
  parts.push(writeOscTimetag(bundle.timetag[0], bundle.timetag[1]));

  // Elements
  for (const el of bundle.elements) {
    const elBytes = isBundle(el) ? oscBundleToBuffer(el) : oscToBuffer(el);
    // Size prefix (4 bytes, big-endian)
    parts.push(writeOscInt32(elBytes.length));
    parts.push(elBytes);
  }

  return concatBuffers(parts);
}

/**
 * Create an OSC bundle from messages with an optional timetag.
 *
 * @param messages - Array of OSC messages and/or nested bundles.
 * @param timetag - NTP timetag as [seconds, fractional]. Defaults to immediate `[0, 1]`.
 * @returns A frozen OscBundle.
 */
export function oscBundle(
  messages: readonly (OscMessage | OscBundle)[],
  timetag: readonly [number, number] = [0, 1],
): OscBundle {
  return Object.freeze({
    timetag: Object.freeze([timetag[0], timetag[1]] as const),
    elements: Object.freeze(messages.map(m => Object.freeze({ ...m }))),
  });
}

/**
 * Convert analysis results to OSC messages.
 *
 * Generates messages using stratum address patterns:
 * - `/stratum/tension` — float32 tension value at tick
 * - `/stratum/key` — string key label at tick
 * - `/stratum/chord` — string chord label at tick
 * - `/stratum/beat` — float32 beat strength at tick
 *
 * @param input - Analysis data arrays (tension, keys, chords, beats).
 * @param options - Export options (address prefix, which data to include).
 * @returns Array of frozen OSC messages.
 */
export function analysisToOsc(
  input: OscAnalysisInput,
  options?: OscExportOptions,
): readonly OscMessage[] {
  const prefix = options?.addressPrefix ?? '/stratum';
  const includeKeys = options?.includeKeys ?? true;
  const includeChords = options?.includeChords ?? true;
  const includeTension = options?.includeTension ?? true;
  const includeBeats = options?.includeBeats ?? true;

  const messages: OscMessage[] = [];

  if (includeTension && input.tension) {
    for (const t of input.tension) {
      messages.push(Object.freeze({
        address: `${prefix}/tension`,
        args: Object.freeze([
          Object.freeze({ type: 'i' as const, value: t.tick }),
          Object.freeze({ type: 'f' as const, value: t.value }),
        ]),
      }));
    }
  }

  if (includeKeys && input.keys) {
    for (const k of input.keys) {
      messages.push(Object.freeze({
        address: `${prefix}/key`,
        args: Object.freeze([
          Object.freeze({ type: 'i' as const, value: k.tick }),
          Object.freeze({ type: 's' as const, value: k.label }),
        ]),
      }));
    }
  }

  if (includeChords && input.chords) {
    for (const c of input.chords) {
      messages.push(Object.freeze({
        address: `${prefix}/chord`,
        args: Object.freeze([
          Object.freeze({ type: 'i' as const, value: c.tick }),
          Object.freeze({ type: 's' as const, value: c.label }),
        ]),
      }));
    }
  }

  if (includeBeats && input.beats) {
    for (const b of input.beats) {
      messages.push(Object.freeze({
        address: `${prefix}/beat`,
        args: Object.freeze([
          Object.freeze({ type: 'i' as const, value: b.tick }),
          Object.freeze({ type: 'f' as const, value: b.value }),
        ]),
      }));
    }
  }

  return Object.freeze(messages);
}

/**
 * Convenience constructor for an OSC message that infers type tags from JS values.
 *
 * Type inference:
 * - `number` → `'f'` (float32) if fractional, `'i'` (int32) if integer
 * - `bigint` → `'h'` (int64)
 * - `string` → `'s'`
 * - `Uint8Array` → `'b'` (blob)
 *
 * @param address - OSC address pattern (must start with `/`).
 * @param args - Argument values; types are inferred automatically.
 * @returns A frozen OscMessage.
 * @throws {RangeError} If the address does not start with `/` or an argument has unsupported type.
 */
export function createOscMessage(
  address: string,
  ...args: readonly (number | bigint | string | Uint8Array)[]
): OscMessage {
  if (!address.startsWith('/')) {
    throw new RangeError(`OSC address must start with "/", got "${address}"`);
  }

  const oscArgs: OscArgument[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      oscArgs.push(Object.freeze({ type: 's' as const, value: arg }));
    } else if (typeof arg === 'bigint') {
      oscArgs.push(Object.freeze({ type: 'h' as const, value: arg }));
    } else if (arg instanceof Uint8Array) {
      oscArgs.push(Object.freeze({ type: 'b' as const, value: arg }));
    } else if (typeof arg === 'number') {
      if (Number.isInteger(arg)) {
        oscArgs.push(Object.freeze({ type: 'i' as const, value: arg }));
      } else {
        oscArgs.push(Object.freeze({ type: 'f' as const, value: arg }));
      }
    } else {
      throw new RangeError(`Unsupported OSC argument type: ${typeof arg}`);
    }
  }

  return Object.freeze({
    address,
    args: Object.freeze(oscArgs),
  });
}
