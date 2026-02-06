import type { Score, Part, NoteEvent } from '../core/types.js';
import { pitchFromMidi } from '../core/score.js';

// ─── MIDI Reading ───────────────────────────────────────────────

/**
 * Parse a Standard MIDI File (format 0 or 1) into a Score.
 * @param data - Raw MIDI file bytes.
 * @returns A fully constructed Score with parts, events, tempo, and time signatures.
 * @throws {Error} If the file is malformed, truncated, or uses an unsupported format.
 */
export function midiToScore(data: Uint8Array): Score {
  if (data.length < 14) {
    throw new Error('Invalid MIDI: file too short (< 14 bytes)');
  }
  const r = new MidiReader(data);
  return r.parse();
}

interface MidiHeader {
  format: number;
  nTracks: number;
  ticksPerQuarter: number;
}

interface MidiEvent {
  tick: number;
  kind: 'noteOn' | 'noteOff' | 'meta' | 'programChange';
  channel: number;
  note?: number;
  velocity?: number;
  metaType?: number;
  metaData?: Uint8Array;
  program?: number;
}

/** Maximum number of bytes to read for a variable-length quantity (prevents infinite loops). */
const MAX_VARLEN_BYTES = 4;

class MidiReader {
  private pos = 0;

  constructor(private data: Uint8Array) {}

  parse(): Score {
    const header = this.readHeader();
    if (header.format > 1) {
      throw new Error(`Unsupported MIDI format ${header.format} (only 0 and 1 are supported)`);
    }
    const tracks: MidiEvent[][] = [];
    for (let i = 0; i < header.nTracks; i++) {
      tracks.push(this.readTrack());
    }
    return this.buildScore(header, tracks);
  }

  private assertBounds(need: number): void {
    if (this.pos + need > this.data.length) {
      throw new Error(
        `Unexpected end of MIDI data at offset ${this.pos} (need ${need} bytes, have ${this.data.length - this.pos})`,
      );
    }
  }

  private readHeader(): MidiHeader {
    this.assertBounds(14);
    const magic = this.readAscii(4);
    if (magic !== 'MThd') throw new Error(`Invalid MIDI: expected MThd, got ${magic}`);

    const len = this.readU32();
    if (len !== 6) throw new Error(`Unexpected MIDI header length: ${len}`);

    return {
      format: this.readU16(),
      nTracks: this.readU16(),
      ticksPerQuarter: this.readU16(),
    };
  }

  private readTrack(): MidiEvent[] {
    this.assertBounds(8);
    const magic = this.readAscii(4);
    if (magic !== 'MTrk') throw new Error(`Invalid track: expected MTrk at offset ${this.pos - 4}, got ${magic}`);

    const chunkLen = this.readU32();
    if (this.pos + chunkLen > this.data.length) {
      throw new Error(
        `Truncated MIDI track: declared ${chunkLen} bytes but only ${this.data.length - this.pos} remain`,
      );
    }
    const endPos = this.pos + chunkLen;
    const events: MidiEvent[] = [];
    let tick = 0;
    let runningStatus = 0;

    while (this.pos < endPos) {
      tick += this.readVarLen();
      this.assertBounds(1);
      let status = this.data[this.pos]!;

      if (status < 0x80) {
        // Running status
        status = runningStatus;
      } else {
        this.pos++;
        if (status < 0xF0) runningStatus = status;
      }

      const type = status & 0xF0;
      const ch = status & 0x0F;

      if (status === 0xFF) {
        // Meta event
        this.assertBounds(1);
        const metaType = this.data[this.pos++]!;
        const len = this.readVarLen();
        this.assertBounds(len);
        const metaData = this.data.slice(this.pos, this.pos + len);
        this.pos += len;
        events.push({ tick, kind: 'meta', channel: 0, metaType, metaData });
      } else if (status === 0xF0 || status === 0xF7) {
        // SysEx — skip
        const len = this.readVarLen();
        this.assertBounds(len);
        this.pos += len;
      } else if (type === 0x90) {
        this.assertBounds(2);
        const note = this.data[this.pos++]!;
        const vel = this.data[this.pos++]!;
        events.push({
          tick, channel: ch,
          kind: vel > 0 ? 'noteOn' : 'noteOff',
          note, velocity: vel,
        });
      } else if (type === 0x80) {
        this.assertBounds(2);
        const note = this.data[this.pos++]!;
        const vel = this.data[this.pos++]!;
        events.push({ tick, kind: 'noteOff', channel: ch, note, velocity: vel });
      } else if (type === 0xC0) {
        this.assertBounds(1);
        const prog = this.data[this.pos++]!;
        events.push({ tick, kind: 'programChange', channel: ch, program: prog });
      } else if (type === 0xD0) {
        this.assertBounds(1);
        this.pos += 1;
      } else if (type === 0xE0 || type === 0xA0 || type === 0xB0) {
        this.assertBounds(2);
        this.pos += 2;
      }
    }

    this.pos = endPos;
    return events;
  }

  private buildScore(header: MidiHeader, tracks: MidiEvent[][]): Score {
    const score: Score = {
      metadata: { title: '', composer: '' },
      settings: { ticksPerQuarter: header.ticksPerQuarter, tuningHz: 440 },
      parts: [],
      timeSignatures: [],
      tempoChanges: [],
      keyCenters: [],
    };

    let nextId = 1;

    // For format 0, all events are in a single track. For format 1, track 0 is
    // typically the control track with meta events, subsequent tracks have notes.
    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t]!;
      let name = `Track ${t + 1}`;
      let program = 0;
      let channel = 0;
      let trackEndTick = 0;

      // Extract meta info
      for (const evt of track) {
        if (evt.kind === 'meta' && evt.metaType === 0x03 && evt.metaData) {
          name = new TextDecoder().decode(evt.metaData);
        } else if (evt.kind === 'meta' && evt.metaType === 0x51 && evt.metaData) {
          // Tempo
          const d = evt.metaData;
          if (d.length >= 3) {
            const uspb = (d[0]! << 16) | (d[1]! << 8) | d[2]!;
            score.tempoChanges.push({ bpm: Math.round(60000000 / uspb), atTick: evt.tick });
          }
        } else if (evt.kind === 'meta' && evt.metaType === 0x58 && evt.metaData) {
          // Time signature
          if (evt.metaData.length >= 2) {
            score.timeSignatures.push({
              numerator: evt.metaData[0]!,
              denominator: Math.pow(2, evt.metaData[1]!),
              atTick: evt.tick,
            });
          }
        } else if (evt.kind === 'meta' && evt.metaType === 0x59 && evt.metaData) {
          // Key signature: sf (signed) = sharps/flats, mi = major(0)/minor(1)
          if (evt.metaData.length >= 2) {
            const sf = evt.metaData[0]! > 127 ? evt.metaData[0]! - 256 : evt.metaData[0]!;
            const mi = evt.metaData[1]!;
            // Map key signature to tonic pitch class
            // Sharps: C=0, G=1, D=2, A=3, E=4, B=5, F#=6, C#=7
            // Flats:  C=0, F=-1, Bb=-2, Eb=-3, Ab=-4, Db=-5, Gb=-6, Cb=-7
            const majorTonic = ((sf * 7) % 12 + 12) % 12;
            const tonic = mi === 1 ? (majorTonic + 9) % 12 : majorTonic;
            score.keyCenters.push({
              tonic,
              mode: mi === 1 ? 'minor' : 'major',
              atTick: evt.tick,
            });
          }
        } else if (evt.kind === 'meta' && evt.metaType === 0x2F) {
          // End of track — record tick for orphan handling
          trackEndTick = evt.tick;
        } else if (evt.kind === 'programChange') {
          program = evt.program!;
          channel = evt.channel;
        }
      }

      // Pair note-on / note-off (FIFO per pitch per channel)
      const pending = new Map<string, Array<{ tick: number; velocity: number }>>();
      const notes: NoteEvent[] = [];

      for (const evt of track) {
        if (evt.kind === 'noteOn') {
          const key = `${evt.channel}:${evt.note!}`;
          if (!pending.has(key)) pending.set(key, []);
          pending.get(key)!.push({ tick: evt.tick, velocity: evt.velocity! });
        } else if (evt.kind === 'noteOff') {
          const key = `${evt.channel}:${evt.note!}`;
          const queue = pending.get(key);
          if (queue && queue.length > 0) {
            const on = queue.shift()!;
            notes.push({
              id: `e_${nextId++}`,
              pitch: pitchFromMidi(evt.note!),
              onset: on.tick,
              duration: Math.max(1, evt.tick - on.tick),
              velocity: on.velocity,
              voice: 0,
            });
          }
        }
      }

      // Close orphaned note-on events at end of track
      for (const [key, queue] of pending) {
        const noteNum = parseInt(key.split(':')[1]!, 10);
        for (const on of queue) {
          const endTick = trackEndTick > on.tick ? trackEndTick : on.tick + 1;
          notes.push({
            id: `e_${nextId++}`,
            pitch: pitchFromMidi(noteNum),
            onset: on.tick,
            duration: Math.max(1, endTick - on.tick),
            velocity: on.velocity,
            voice: 0,
          });
        }
      }

      if (notes.length > 0) {
        notes.sort((a, b) => a.onset - b.onset);
        const firstNoteOn = track.find(e => e.kind === 'noteOn');
        score.parts.push({
          id: `part_${score.parts.length + 1}`,
          name,
          midiProgram: program,
          midiChannel: firstNoteOn?.channel ?? channel,
          events: notes,
        });
      }
    }

    if (score.timeSignatures.length === 0) {
      score.timeSignatures.push({ numerator: 4, denominator: 4, atTick: 0 });
    }
    if (score.tempoChanges.length === 0) {
      score.tempoChanges.push({ bpm: 120, atTick: 0 });
    }

    return score;
  }

  private readAscii(len: number): string {
    this.assertBounds(len);
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(this.data[this.pos++]!);
    return s;
  }

  private readU32(): number {
    this.assertBounds(4);
    const v =
      (this.data[this.pos]! << 24) |
      (this.data[this.pos + 1]! << 16) |
      (this.data[this.pos + 2]! << 8) |
      this.data[this.pos + 3]!;
    this.pos += 4;
    return v >>> 0;
  }

  private readU16(): number {
    this.assertBounds(2);
    const v = (this.data[this.pos]! << 8) | this.data[this.pos + 1]!;
    this.pos += 2;
    return v;
  }

  private readVarLen(): number {
    let val = 0;
    let count = 0;
    let b: number;
    do {
      if (count >= MAX_VARLEN_BYTES) {
        throw new Error(`Variable-length quantity exceeds ${MAX_VARLEN_BYTES} bytes at offset ${this.pos}`);
      }
      this.assertBounds(1);
      b = this.data[this.pos++]!;
      val = (val << 7) | (b & 0x7F);
      count++;
    } while (b & 0x80);
    return val;
  }
}

// ─── MIDI Writing ───────────────────────────────────────────────

/**
 * Export a Score to Standard MIDI File (format 1) bytes.
 * @param score - The score to export.
 * @returns MIDI file as a Uint8Array, ready to write to disk.
 */
export function scoreToMidi(score: Score): Uint8Array {
  const w = new MidiWriter(score);
  return w.write();
}

class MidiWriter {
  constructor(private score: Score) {}

  write(): Uint8Array {
    const tracks: Uint8Array[] = [];
    tracks.push(this.controlTrack());
    for (const part of this.score.parts) {
      tracks.push(this.partTrack(part));
    }

    const header = this.header(tracks.length);
    const totalLen = header.length + tracks.reduce((s, t) => s + t.length, 0);
    const out = new Uint8Array(totalLen);
    let pos = 0;
    out.set(header, pos); pos += header.length;
    for (const t of tracks) { out.set(t, pos); pos += t.length; }
    return out;
  }

  private header(nTracks: number): Uint8Array {
    const buf = new Uint8Array(14);
    // MThd
    buf[0] = 0x4D; buf[1] = 0x54; buf[2] = 0x68; buf[3] = 0x64;
    // Length = 6
    buf[7] = 6;
    // Format 1
    buf[9] = 1;
    // nTracks
    buf[10] = (nTracks >> 8) & 0xFF; buf[11] = nTracks & 0xFF;
    // Division
    const div = this.score.settings.ticksPerQuarter;
    buf[12] = (div >> 8) & 0xFF; buf[13] = div & 0xFF;
    return buf;
  }

  private controlTrack(): Uint8Array {
    const events: Array<{ tick: number; bytes: number[] }> = [];

    // Time signatures
    for (const ts of this.score.timeSignatures) {
      events.push({
        tick: ts.atTick,
        bytes: [0xFF, 0x58, 0x04, ts.numerator, Math.log2(ts.denominator), 0x18, 0x08],
      });
    }

    // Tempo changes
    for (const tc of this.score.tempoChanges) {
      const uspb = Math.round(60000000 / tc.bpm);
      events.push({
        tick: tc.atTick,
        bytes: [0xFF, 0x51, 0x03, (uspb >> 16) & 0xFF, (uspb >> 8) & 0xFF, uspb & 0xFF],
      });
    }

    // Key centers
    for (const kc of this.score.keyCenters) {
      const mi = kc.mode === 'minor' ? 1 : 0;
      // Convert tonic pitch class back to sharps/flats count
      const tonic = mi === 1 ? (kc.tonic + 3) % 12 : kc.tonic;
      // Map pitch class to sf: inverse of (sf*7) mod 12
      // Lookup table for pitch class → sf
      const pcToSf: Record<number, number> = {
        0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6,
        5: -1, 10: -2, 3: -3, 8: -4, 1: -5,
      };
      const sf = pcToSf[tonic] ?? 0;
      events.push({
        tick: kc.atTick,
        bytes: [0xFF, 0x59, 0x02, sf < 0 ? sf + 256 : sf, mi],
      });
    }

    // Sort by tick
    events.sort((a, b) => a.tick - b.tick);

    const bytes: number[] = [];
    let prevTick = 0;
    for (const evt of events) {
      pushVarLen(bytes, evt.tick - prevTick);
      for (const b of evt.bytes) bytes.push(b);
      prevTick = evt.tick;
    }

    // End of track
    pushVarLen(bytes, 0);
    bytes.push(0xFF, 0x2F, 0x00);

    return this.wrapTrack(new Uint8Array(bytes));
  }

  private partTrack(part: Part): Uint8Array {
    const bytes: number[] = [];
    const ch = part.midiChannel & 0x0F;

    // Program change
    pushVarLen(bytes, 0);
    bytes.push(0xC0 | ch, part.midiProgram & 0x7F);

    // Track name
    const nameBytes = new TextEncoder().encode(part.name);
    pushVarLen(bytes, 0);
    bytes.push(0xFF, 0x03);
    pushVarLen(bytes, nameBytes.length);
    for (const b of nameBytes) bytes.push(b);

    // Sort note-on and note-off events by tick
    const midiEvts: Array<{ tick: number; bytes: number[] }> = [];
    for (const note of part.events) {
      midiEvts.push({
        tick: note.onset,
        bytes: [0x90 | ch, note.pitch.midi & 0x7F, note.velocity & 0x7F],
      });
      midiEvts.push({
        tick: note.onset + note.duration,
        bytes: [0x80 | ch, note.pitch.midi & 0x7F, 0],
      });
    }
    midiEvts.sort((a, b) => a.tick - b.tick);

    let prevTick = 0;
    for (const evt of midiEvts) {
      pushVarLen(bytes, evt.tick - prevTick);
      for (const b of evt.bytes) bytes.push(b);
      prevTick = evt.tick;
    }

    // End of track
    pushVarLen(bytes, 0);
    bytes.push(0xFF, 0x2F, 0x00);

    return this.wrapTrack(new Uint8Array(bytes));
  }

  private wrapTrack(data: Uint8Array): Uint8Array {
    const buf = new Uint8Array(8 + data.length);
    // MTrk
    buf[0] = 0x4D; buf[1] = 0x54; buf[2] = 0x72; buf[3] = 0x6B;
    const len = data.length;
    buf[4] = (len >> 24) & 0xFF;
    buf[5] = (len >> 16) & 0xFF;
    buf[6] = (len >> 8) & 0xFF;
    buf[7] = len & 0xFF;
    buf.set(data, 8);
    return buf;
  }
}

function pushVarLen(arr: number[], val: number): void {
  const v = Math.max(0, val);
  const buf: number[] = [v & 0x7F];
  let remaining = v >> 7;
  while (remaining > 0) {
    buf.push((remaining & 0x7F) | 0x80);
    remaining >>= 7;
  }
  buf.reverse();
  for (const b of buf) arr.push(b);
}
