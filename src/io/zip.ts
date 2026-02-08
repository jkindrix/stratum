// ---------------------------------------------------------------------------
// Stratum — Inline ZIP / DEFLATE (RFC 1951) Decompressor
// Zero-dependency implementation for .mxl (compressed MusicXML) support
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bit reader — LSB-first
// ---------------------------------------------------------------------------

class BitReader {
  private pos = 0;   // byte position
  private bit = 0;   // bit offset within current byte (0-7)

  constructor(private readonly data: Uint8Array) {}

  /** Read `n` bits (up to 25), LSB first. */
  readBits(n: number): number {
    let result = 0;
    let shift = 0;
    while (n > 0) {
      if (this.pos >= this.data.length) {
        throw new RangeError('Unexpected end of DEFLATE stream');
      }
      const byte = this.data[this.pos]!;
      const avail = 8 - this.bit;
      const take = Math.min(avail, n);
      const mask = (1 << take) - 1;
      result |= ((byte >>> this.bit) & mask) << shift;
      this.bit += take;
      shift += take;
      n -= take;
      if (this.bit >= 8) {
        this.bit = 0;
        this.pos++;
      }
    }
    return result;
  }

  /** Align to next byte boundary. */
  alignToByte(): void {
    if (this.bit > 0) {
      this.bit = 0;
      this.pos++;
    }
  }

  /** Read `n` raw bytes (after byte-alignment). */
  readBytes(n: number): Uint8Array {
    this.alignToByte();
    if (this.pos + n > this.data.length) {
      throw new RangeError('Unexpected end of DEFLATE stream');
    }
    const slice = this.data.slice(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  get byteOffset(): number { return this.pos; }
}

// ---------------------------------------------------------------------------
// Huffman tree
// ---------------------------------------------------------------------------

interface HuffmanNode {
  symbol?: number;
  children?: [HuffmanNode | undefined, HuffmanNode | undefined];
}

function buildHuffmanTree(codeLengths: readonly number[]): HuffmanNode {
  // Step 1: Count codes per length
  const maxBits = codeLengths.reduce((a, b) => Math.max(a, b), 0);
  if (maxBits === 0) return {};
  const blCount = new Array<number>(maxBits + 1).fill(0);
  for (const cl of codeLengths) {
    if (cl > 0) blCount[cl]!++;
  }

  // Step 2: Compute starting codes
  const nextCode = new Array<number>(maxBits + 1).fill(0);
  let code = 0;
  for (let bits = 1; bits <= maxBits; bits++) {
    code = (code + (blCount[bits - 1] ?? 0)) << 1;
    nextCode[bits] = code;
  }

  // Step 3: Build tree
  const root: HuffmanNode = { children: [undefined, undefined] };
  for (let i = 0; i < codeLengths.length; i++) {
    const len = codeLengths[i]!;
    if (len === 0) continue;
    let c = nextCode[len]!;
    nextCode[len]!++;

    let node = root;
    for (let bit = len - 1; bit >= 0; bit--) {
      const b = (c >>> bit) & 1;
      if (!node.children) node.children = [undefined, undefined];
      if (!node.children[b]) {
        node.children[b] = bit === 0
          ? { symbol: i }
          : { children: [undefined, undefined] };
      }
      node = node.children[b]!;
    }
    node.symbol = i;
  }
  return root;
}

function decodeSymbol(reader: BitReader, root: HuffmanNode): number {
  let node = root;
  for (let i = 0; i < 50; i++) { // safety limit
    if (node.symbol !== undefined && !node.children) return node.symbol;
    if (!node.children) throw new RangeError('Invalid Huffman code');
    const bit = reader.readBits(1);
    const next = node.children[bit as 0 | 1];
    if (!next) throw new RangeError('Invalid Huffman code');
    node = next;
    if (node.symbol !== undefined && !node.children) return node.symbol;
  }
  throw new RangeError('Huffman decode exceeded depth limit');
}

// ---------------------------------------------------------------------------
// Fixed Huffman tables (RFC 1951 §3.2.6)
// ---------------------------------------------------------------------------

function buildFixedLiteralTree(): HuffmanNode {
  const lengths = new Array<number>(288);
  for (let i = 0; i <= 143; i++) lengths[i] = 8;
  for (let i = 144; i <= 255; i++) lengths[i] = 9;
  for (let i = 256; i <= 279; i++) lengths[i] = 7;
  for (let i = 280; i <= 287; i++) lengths[i] = 8;
  return buildHuffmanTree(lengths);
}

function buildFixedDistanceTree(): HuffmanNode {
  const lengths = new Array<number>(32).fill(5);
  return buildHuffmanTree(lengths);
}

let _fixedLitTree: HuffmanNode | undefined;
let _fixedDistTree: HuffmanNode | undefined;

function getFixedLiteralTree(): HuffmanNode {
  if (!_fixedLitTree) _fixedLitTree = buildFixedLiteralTree();
  return _fixedLitTree;
}

function getFixedDistanceTree(): HuffmanNode {
  if (!_fixedDistTree) _fixedDistTree = buildFixedDistanceTree();
  return _fixedDistTree;
}

// ---------------------------------------------------------------------------
// Length / distance tables (RFC 1951 §3.2.5)
// ---------------------------------------------------------------------------

const LENGTH_BASE: readonly number[] = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13,
  15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
  67, 83, 99, 115, 131, 163, 195, 227, 258,
];

const LENGTH_EXTRA: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
  1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
  4, 4, 4, 4, 5, 5, 5, 5, 0,
];

const DISTANCE_BASE: readonly number[] = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25,
  33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
  1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];

const DISTANCE_EXTRA: readonly number[] = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3,
  4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
  9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

// Code-length alphabet order for dynamic Huffman (RFC 1951 §3.2.7)
const CL_ORDER: readonly number[] = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

// ---------------------------------------------------------------------------
// Dynamic Huffman table builder
// ---------------------------------------------------------------------------

function decodeDynamicTrees(reader: BitReader): { litTree: HuffmanNode; distTree: HuffmanNode } {
  const hlit = reader.readBits(5) + 257;
  const hdist = reader.readBits(5) + 1;
  const hclen = reader.readBits(4) + 4;

  // Code-length code lengths
  const clCodeLengths = new Array<number>(19).fill(0);
  for (let i = 0; i < hclen; i++) {
    clCodeLengths[CL_ORDER[i]!] = reader.readBits(3);
  }
  const clTree = buildHuffmanTree(clCodeLengths);

  // Decode literal/length + distance code lengths
  const totalCodes = hlit + hdist;
  const codeLengths: number[] = [];
  while (codeLengths.length < totalCodes) {
    const sym = decodeSymbol(reader, clTree);
    if (sym < 16) {
      codeLengths.push(sym);
    } else if (sym === 16) {
      // Repeat previous 3-6 times
      const repeat = reader.readBits(2) + 3;
      const prev = codeLengths[codeLengths.length - 1] ?? 0;
      for (let i = 0; i < repeat; i++) codeLengths.push(prev);
    } else if (sym === 17) {
      // Repeat 0 for 3-10 times
      const repeat = reader.readBits(3) + 3;
      for (let i = 0; i < repeat; i++) codeLengths.push(0);
    } else if (sym === 18) {
      // Repeat 0 for 11-138 times
      const repeat = reader.readBits(7) + 11;
      for (let i = 0; i < repeat; i++) codeLengths.push(0);
    }
  }

  const litLengths = codeLengths.slice(0, hlit);
  const distLengths = codeLengths.slice(hlit, hlit + hdist);

  return {
    litTree: buildHuffmanTree(litLengths),
    distTree: buildHuffmanTree(distLengths),
  };
}

// ---------------------------------------------------------------------------
// DEFLATE block decoder
// ---------------------------------------------------------------------------

function inflateBlock(
  reader: BitReader,
  litTree: HuffmanNode,
  distTree: HuffmanNode,
  output: number[],
): void {
  for (;;) {
    const sym = decodeSymbol(reader, litTree);
    if (sym < 256) {
      output.push(sym);
    } else if (sym === 256) {
      return; // End of block
    } else {
      // Length-distance pair
      const lengthIdx = sym - 257;
      const length = (LENGTH_BASE[lengthIdx] ?? 3) + reader.readBits(LENGTH_EXTRA[lengthIdx] ?? 0);
      const distSym = decodeSymbol(reader, distTree);
      const distance = (DISTANCE_BASE[distSym] ?? 1) + reader.readBits(DISTANCE_EXTRA[distSym] ?? 0);

      // Copy from back-reference
      const start = output.length - distance;
      for (let i = 0; i < length; i++) {
        output.push(output[start + i] ?? 0);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// inflate — public API
// ---------------------------------------------------------------------------

/**
 * Decompress RFC 1951 DEFLATE data.
 *
 * @param compressed - Raw DEFLATE byte stream (not wrapped in zlib or gzip).
 * @returns Decompressed bytes.
 * @throws {RangeError} On malformed or truncated input.
 */
export function inflate(compressed: Uint8Array): Uint8Array {
  const reader = new BitReader(compressed);
  const output: number[] = [];

  let bfinal = 0;
  do {
    bfinal = reader.readBits(1);
    const btype = reader.readBits(2);

    if (btype === 0) {
      // Stored (uncompressed) block
      const raw = reader.readBytes(4);
      const len = raw[0]! | (raw[1]! << 8);
      const nlen = raw[2]! | (raw[3]! << 8);
      if ((len ^ 0xFFFF) !== nlen) {
        throw new RangeError('Invalid stored block length');
      }
      const data = reader.readBytes(len);
      for (let i = 0; i < len; i++) output.push(data[i]!);
    } else if (btype === 1) {
      // Fixed Huffman codes
      inflateBlock(reader, getFixedLiteralTree(), getFixedDistanceTree(), output);
    } else if (btype === 2) {
      // Dynamic Huffman codes
      const { litTree, distTree } = decodeDynamicTrees(reader);
      inflateBlock(reader, litTree, distTree, output);
    } else {
      throw new RangeError(`Invalid DEFLATE block type ${btype}`);
    }
  } while (bfinal === 0);

  return new Uint8Array(output);
}

// ---------------------------------------------------------------------------
// ZIP archive parser
// ---------------------------------------------------------------------------

/**
 * Check if a byte array starts with the ZIP local file header signature.
 *
 * @param data - Data to check.
 * @returns True if data starts with ZIP magic bytes (PK\x03\x04).
 */
export function isMxl(data: Uint8Array): boolean {
  return data.length >= 4 &&
    data[0] === 0x50 && data[1] === 0x4B &&
    data[2] === 0x03 && data[3] === 0x04;
}

/** Read a 16-bit little-endian unsigned integer. */
function readU16(data: Uint8Array, offset: number): number {
  return (data[offset]! | (data[offset + 1]! << 8));
}

/** Read a 32-bit little-endian unsigned integer. */
function readU32(data: Uint8Array, offset: number): number {
  return (
    (data[offset]!) |
    (data[offset + 1]! << 8) |
    (data[offset + 2]! << 16) |
    ((data[offset + 3]! << 24) >>> 0)
  ) >>> 0;
}

/** Decode bytes as UTF-8. */
function decodeUtf8(data: Uint8Array): string {
  // Use TextDecoder if available (node/browser), otherwise manual
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(data);
  }
  // Fallback: ASCII only
  let s = '';
  for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]!);
  return s;
}

/** Strip UTF-8 BOM if present. */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

/**
 * Central Directory entry sizes from the End of Central Directory record.
 */
interface CentralDirInfo {
  cdOffset: number;
  cdSize: number;
  totalEntries: number;
}

/**
 * Find the End of Central Directory record and extract CD offset.
 */
function findEndOfCentralDir(data: Uint8Array): CentralDirInfo | undefined {
  // EOCD signature: 0x06054b50
  // Search backwards (EOCD is 22+ bytes from end)
  const minPos = Math.max(0, data.length - 65557); // max comment size = 65535
  for (let i = data.length - 22; i >= minPos; i--) {
    if (data[i] === 0x50 && data[i + 1] === 0x4B &&
        data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      return {
        totalEntries: readU16(data, i + 10),
        cdSize: readU32(data, i + 12),
        cdOffset: readU32(data, i + 16),
      };
    }
  }
  return undefined;
}

interface CentralDirEntry {
  filename: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/**
 * Parse Central Directory entries.
 */
function parseCentralDir(data: Uint8Array, info: CentralDirInfo): CentralDirEntry[] {
  const entries: CentralDirEntry[] = [];
  let offset = info.cdOffset;
  for (let i = 0; i < info.totalEntries; i++) {
    if (offset + 46 > data.length) break;
    // Central dir signature: 0x02014b50
    if (readU32(data, offset) !== 0x02014B50) break;

    const method = readU16(data, offset + 10);
    const compressedSize = readU32(data, offset + 20);
    const uncompressedSize = readU32(data, offset + 24);
    const filenameLen = readU16(data, offset + 28);
    const extraLen = readU16(data, offset + 30);
    const commentLen = readU16(data, offset + 32);
    const localHeaderOffset = readU32(data, offset + 42);
    const filename = decodeUtf8(data.slice(offset + 46, offset + 46 + filenameLen));

    entries.push({ filename, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + filenameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Extract all files from a ZIP archive.
 *
 * Supports stored (method 0) and DEFLATE (method 8) entries.
 *
 * @param data - ZIP archive bytes.
 * @returns Map of filename to file content.
 * @throws {RangeError} On malformed archives or unsupported compression methods.
 */
export function unzip(data: Uint8Array): Map<string, Uint8Array> {
  if (data.length < 22) {
    throw new RangeError('Data too short to be a ZIP archive');
  }
  if (!isMxl(data)) {
    throw new RangeError('Not a ZIP archive (missing PK signature)');
  }

  const files = new Map<string, Uint8Array>();

  // Try Central Directory first for reliable sizes
  const eocd = findEndOfCentralDir(data);
  if (eocd) {
    const cdEntries = parseCentralDir(data, eocd);
    for (const entry of cdEntries) {
      const content = extractFromLocalHeader(data, entry.localHeaderOffset, entry.method, entry.compressedSize);
      files.set(entry.filename, content);
    }
    return files;
  }

  // Fallback: walk local file headers
  let offset = 0;
  while (offset + 30 <= data.length) {
    const sig = readU32(data, offset);
    if (sig !== 0x04034B50) break; // Not a local file header

    const flags = readU16(data, offset + 6);
    const method = readU16(data, offset + 8);
    let compressedSize = readU32(data, offset + 18);
    const filenameLen = readU16(data, offset + 26);
    const extraLen = readU16(data, offset + 28);
    const filename = decodeUtf8(data.slice(offset + 30, offset + 30 + filenameLen));
    const dataStart = offset + 30 + filenameLen + extraLen;

    // Data descriptor flag (bit 3)
    if ((flags & 0x08) !== 0 && compressedSize === 0) {
      throw new RangeError(
        `ZIP entry "${filename}" uses data descriptor without Central Directory — cannot determine size`,
      );
    }

    if (method !== 0 && method !== 8) {
      throw new RangeError(`Unsupported ZIP compression method ${method} for entry "${filename}"`);
    }

    if (dataStart + compressedSize > data.length) {
      throw new RangeError(`ZIP entry "${filename}" extends beyond archive boundary`);
    }

    const compressed = data.slice(dataStart, dataStart + compressedSize);
    const content = method === 0 ? compressed : inflate(compressed);
    files.set(filename, content);

    offset = dataStart + compressedSize;
  }

  return files;
}

/**
 * Extract file content from a local file header at a known offset.
 */
function extractFromLocalHeader(
  data: Uint8Array,
  offset: number,
  method: number,
  compressedSize: number,
): Uint8Array {
  if (offset + 30 > data.length) {
    throw new RangeError('ZIP local file header extends beyond archive');
  }
  const filenameLen = readU16(data, offset + 26);
  const extraLen = readU16(data, offset + 28);
  const dataStart = offset + 30 + filenameLen + extraLen;

  if (method !== 0 && method !== 8) {
    throw new RangeError(`Unsupported ZIP compression method ${method}`);
  }

  if (dataStart + compressedSize > data.length) {
    throw new RangeError('ZIP entry data extends beyond archive boundary');
  }

  const compressed = data.slice(dataStart, dataStart + compressedSize);
  return method === 0 ? compressed : inflate(compressed);
}
