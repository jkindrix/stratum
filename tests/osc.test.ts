import { describe, it, expect } from 'vitest';
import {
  oscToBuffer,
  oscBundleToBuffer,
  oscBundle,
  analysisToOsc,
  createOscMessage,
} from '../src/io/osc.js';
import type { OscMessage, OscBundle as OscBundleType } from '../src/io/osc.js';

/** Read a big-endian int32 from a Uint8Array at offset. */
function readInt32BE(buf: Uint8Array, offset: number): number {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return dv.getInt32(offset, false);
}

/** Read a big-endian float32 from a Uint8Array at offset. */
function readFloat32BE(buf: Uint8Array, offset: number): number {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return dv.getFloat32(offset, false);
}

/** Read a big-endian uint32 from a Uint8Array at offset. */
function readUint32BE(buf: Uint8Array, offset: number): number {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return dv.getUint32(offset, false);
}

/** Read a null-terminated string from buffer starting at offset. */
function readOscString(buf: Uint8Array, offset: number): { str: string; nextOffset: number } {
  let end = offset;
  while (end < buf.length && (buf[end] ?? 0) !== 0) end++;
  const decoder = new TextDecoder();
  const str = decoder.decode(buf.slice(offset, end));
  // Advance past null + padding to 4-byte boundary
  const totalLen = end - offset + 1;
  const padded = totalLen + ((4 - (totalLen % 4)) % 4);
  return { str, nextOffset: offset + padded };
}

describe('OSC serialization', () => {
  describe('writeOscString', () => {
    it('serializes strings with null terminator and 4-byte padding', () => {
      // "hi" = 2 chars + 1 null = 3 bytes → pad to 4
      const msg = createOscMessage('/test', 'hi');
      const buf = oscToBuffer(msg);
      // Address "/test" = 5+1=6 → pad to 8
      // Type tag ",s" = 2+1=3 → pad to 4
      // String "hi" = 2+1=3 → pad to 4
      expect(buf.length).toBe(8 + 4 + 4);
    });

    it('pads 4-char strings correctly', () => {
      // "test" = 4 chars + 1 null = 5 → pad to 8
      const msg = createOscMessage('/x', 'test');
      const buf = oscToBuffer(msg);
      // "/x" = 2+1=3 → 4, ",s" = 2+1=3 → 4, "test" = 4+1=5 → 8
      expect(buf.length).toBe(4 + 4 + 8);
    });
  });

  describe('writeOscInt32', () => {
    it('encodes int32 in big-endian', () => {
      const msg: OscMessage = {
        address: '/i',
        args: [{ type: 'i', value: 256 }],
      };
      const buf = oscToBuffer(msg);
      // "/i" → 4 bytes, ",i" → 4 bytes, int32 → 4 bytes
      expect(buf.length).toBe(12);
      // The int32 starts at offset 8
      expect(readInt32BE(buf, 8)).toBe(256);
    });
  });

  describe('writeOscFloat32', () => {
    it('encodes float32 in big-endian IEEE 754', () => {
      const msg: OscMessage = {
        address: '/f',
        args: [{ type: 'f', value: 440.0 }],
      };
      const buf = oscToBuffer(msg);
      const val = readFloat32BE(buf, 8);
      expect(val).toBeCloseTo(440.0, 1);
    });
  });

  describe('writeOscBlob', () => {
    it('encodes blob with size prefix and padding', () => {
      const blobData = new Uint8Array([1, 2, 3, 4, 5]); // 5 bytes
      const msg: OscMessage = {
        address: '/b',
        args: [{ type: 'b', value: blobData }],
      };
      const buf = oscToBuffer(msg);
      // "/b" → 4, ",b" → 4, size(4) + 5 bytes padded to 8 = 12
      expect(buf.length).toBe(4 + 4 + 4 + 8);
      // Size prefix at offset 8
      expect(readInt32BE(buf, 8)).toBe(5);
      // Blob data starts at offset 12
      expect(buf[12]).toBe(1);
      expect(buf[16]).toBe(5);
    });
  });

  describe('writeOscInt64', () => {
    it('encodes bigint as 64-bit big-endian', () => {
      const msg: OscMessage = {
        address: '/h',
        args: [{ type: 'h', value: BigInt('0x0000000100000002') }],
      };
      const buf = oscToBuffer(msg);
      // "/h" → 4, ",h" → 4, int64 → 8
      expect(buf.length).toBe(16);
      // Upper 32 bits = 1, lower 32 bits = 2
      expect(readUint32BE(buf, 8)).toBe(1);
      expect(readUint32BE(buf, 12)).toBe(2);
    });
  });

  describe('writeOscTimetag', () => {
    it('encodes immediate timetag [0, 1]', () => {
      const bundle = oscBundle([], [0, 1]);
      const buf = oscBundleToBuffer(bundle);
      // "#bundle\0" = 8, timetag = 8
      expect(readUint32BE(buf, 8)).toBe(0);
      expect(readUint32BE(buf, 12)).toBe(1);
    });
  });

  describe('oscToBuffer', () => {
    it('serializes a simple message with single arg', () => {
      const msg: OscMessage = {
        address: '/test',
        args: [{ type: 'i', value: 42 }],
      };
      const buf = oscToBuffer(msg);
      const { str: addr, nextOffset: o1 } = readOscString(buf, 0);
      expect(addr).toBe('/test');
      const { str: tags } = readOscString(buf, o1);
      expect(tags).toBe(',i');
    });

    it('serializes multi-arg message with mixed types', () => {
      const msg: OscMessage = {
        address: '/mix',
        args: [
          { type: 'i', value: 1 },
          { type: 'f', value: 2.5 },
          { type: 's', value: 'hello' },
        ],
      };
      const buf = oscToBuffer(msg);
      const { str: addr, nextOffset: o1 } = readOscString(buf, 0);
      expect(addr).toBe('/mix');
      const { str: tags, nextOffset: o2 } = readOscString(buf, o1);
      expect(tags).toBe(',ifs');
      // Int at o2
      expect(readInt32BE(buf, o2)).toBe(1);
      // Float at o2+4
      expect(readFloat32BE(buf, o2 + 4)).toBeCloseTo(2.5, 5);
    });

    it('serializes empty-args message with comma-only type tag', () => {
      const msg: OscMessage = { address: '/ping', args: [] };
      const buf = oscToBuffer(msg);
      const { nextOffset: o1 } = readOscString(buf, 0);
      const { str: tags } = readOscString(buf, o1);
      expect(tags).toBe(',');
    });
  });

  describe('oscBundleToBuffer', () => {
    it('starts with #bundle header', () => {
      const bundle = oscBundle([]);
      const buf = oscBundleToBuffer(bundle);
      const decoder = new TextDecoder();
      expect(decoder.decode(buf.slice(0, 7))).toBe('#bundle');
      expect(buf[7]).toBe(0);
    });

    it('encodes timetag bytes correctly', () => {
      const bundle = oscBundle([], [100, 200]);
      const buf = oscBundleToBuffer(bundle);
      expect(readUint32BE(buf, 8)).toBe(100);
      expect(readUint32BE(buf, 12)).toBe(200);
    });

    it('includes size prefixes for multiple messages', () => {
      const m1: OscMessage = { address: '/a', args: [{ type: 'i', value: 1 }] };
      const m2: OscMessage = { address: '/b', args: [{ type: 'i', value: 2 }] };
      const bundle = oscBundle([m1, m2]);
      const buf = oscBundleToBuffer(bundle);

      // After header (8) + timetag (8) = offset 16
      // Element 1: size prefix (4) + message bytes
      const m1Bytes = oscToBuffer(m1);
      const size1 = readInt32BE(buf, 16);
      expect(size1).toBe(m1Bytes.length);

      // Element 2 starts at 16 + 4 + size1
      const m2Bytes = oscToBuffer(m2);
      const size2 = readInt32BE(buf, 20 + size1);
      expect(size2).toBe(m2Bytes.length);
    });

    it('handles nested bundles', () => {
      const inner: OscBundleType = oscBundle(
        [{ address: '/inner', args: [] }],
        [10, 20],
      );
      const outer = oscBundle([inner], [1, 2]);
      const buf = oscBundleToBuffer(outer);

      // Outer starts with #bundle
      const decoder = new TextDecoder();
      expect(decoder.decode(buf.slice(0, 7))).toBe('#bundle');

      // After outer header+timetag (16) + size prefix (4), inner starts
      const innerStart = 20;
      expect(decoder.decode(buf.slice(innerStart, innerStart + 7))).toBe('#bundle');
    });
  });

  describe('analysisToOsc', () => {
    it('converts tension data to /stratum/tension messages', () => {
      const msgs = analysisToOsc({
        tension: [
          { tick: 0, value: 0.5 },
          { tick: 480, value: 0.8 },
        ],
      });
      expect(msgs.length).toBe(2);
      expect(msgs[0]!.address).toBe('/stratum/tension');
      expect(msgs[0]!.args[0]!.type).toBe('i');
      expect(msgs[0]!.args[0]!.value).toBe(0);
      expect(msgs[0]!.args[1]!.type).toBe('f');
      expect(msgs[0]!.args[1]!.value).toBe(0.5);
    });

    it('converts key, chord, and beat data', () => {
      const msgs = analysisToOsc({
        keys: [{ tick: 0, label: 'C major' }],
        chords: [{ tick: 0, label: 'Cmaj' }],
        beats: [{ tick: 0, value: 1.0 }],
      });
      expect(msgs.some(m => m.address === '/stratum/key')).toBe(true);
      expect(msgs.some(m => m.address === '/stratum/chord')).toBe(true);
      expect(msgs.some(m => m.address === '/stratum/beat')).toBe(true);
    });

    it('uses custom address prefix', () => {
      const msgs = analysisToOsc(
        { tension: [{ tick: 0, value: 0.5 }] },
        { addressPrefix: '/myapp' },
      );
      expect(msgs[0]!.address).toBe('/myapp/tension');
    });
  });

  describe('createOscMessage', () => {
    it('infers type tags from JS values', () => {
      const msg = createOscMessage('/auto', 42, 3.14, 'hello', BigInt(99));
      expect(msg.args[0]!.type).toBe('i');
      expect(msg.args[1]!.type).toBe('f');
      expect(msg.args[2]!.type).toBe('s');
      expect(msg.args[3]!.type).toBe('h');
    });

    it('infers blob type from Uint8Array', () => {
      const msg = createOscMessage('/blob', new Uint8Array([1, 2, 3]));
      expect(msg.args[0]!.type).toBe('b');
    });
  });

  describe('address validation', () => {
    it('rejects addresses not starting with /', () => {
      expect(() => oscToBuffer({ address: 'bad', args: [] })).toThrow(RangeError);
      expect(() => createOscMessage('bad')).toThrow(RangeError);
    });
  });

  describe('immutability', () => {
    it('returns frozen objects', () => {
      const msg = createOscMessage('/frozen', 1);
      expect(Object.isFrozen(msg)).toBe(true);
      expect(Object.isFrozen(msg.args)).toBe(true);

      const bundle = oscBundle([msg]);
      expect(Object.isFrozen(bundle)).toBe(true);
      expect(Object.isFrozen(bundle.timetag)).toBe(true);
      expect(Object.isFrozen(bundle.elements)).toBe(true);

      const oscMsgs = analysisToOsc({ tension: [{ tick: 0, value: 0.5 }] });
      expect(Object.isFrozen(oscMsgs)).toBe(true);
      expect(Object.isFrozen(oscMsgs[0])).toBe(true);
    });
  });
});
