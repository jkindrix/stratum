// ---------------------------------------------------------------------------
// Stratum — Minimal XML Parser & Serializer (zero-dependency)
// ---------------------------------------------------------------------------

/**
 * Represents an XML element with tag, attributes, and children.
 * Children can be other elements or text strings.
 */
export interface XmlElement {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly (XmlElement | string)[];
}

// ---------------------------------------------------------------------------
// Entity decoding / encoding
// ---------------------------------------------------------------------------

const DECODE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

const ENCODE_MAP: readonly [string, string][] = [
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&apos;'],
];

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, m => DECODE_MAP[m] ?? m);
}

function encodeEntities(s: string): string {
  let r = s;
  for (const [ch, ent] of ENCODE_MAP) {
    r = r.split(ch).join(ent);
  }
  return r;
}

function encodeAttrValue(s: string): string {
  return encodeEntities(s);
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse an XML string into an XmlElement tree.
 *
 * Supports:
 * - Regular and self-closing elements
 * - Attributes (double or single quoted)
 * - Text content with entity decoding
 * - Skips `<?xml?>` declarations, `<!DOCTYPE>`, and `<!-- comments -->`
 *
 * @param text - XML source string.
 * @returns The root XmlElement.
 * @throws {RangeError} If the XML is malformed.
 */
export function parseXml(text: string): XmlElement {
  let pos = 0;
  const len = text.length;

  function skipWhitespace(): void {
    while (pos < len && (text[pos] === ' ' || text[pos] === '\t' || text[pos] === '\n' || text[pos] === '\r')) {
      pos++;
    }
  }

  function skipDeclarationsAndComments(): void {
    while (pos < len) {
      skipWhitespace();
      if (pos >= len || text[pos] !== '<') break;

      // XML declaration <?...?>
      if (text[pos + 1] === '?') {
        const end = text.indexOf('?>', pos + 2);
        if (end < 0) throw new RangeError('Unterminated XML declaration');
        pos = end + 2;
        continue;
      }

      // Comment <!--...-->
      if (text[pos + 1] === '!' && text[pos + 2] === '-' && text[pos + 3] === '-') {
        const end = text.indexOf('-->', pos + 4);
        if (end < 0) throw new RangeError('Unterminated comment');
        pos = end + 3;
        continue;
      }

      // DOCTYPE <!DOCTYPE...>
      if (text[pos + 1] === '!' && text.substring(pos + 2, pos + 9) === 'DOCTYPE') {
        // Handle nested brackets in DOCTYPE
        let depth = 1;
        pos = pos + 9;
        while (pos < len && depth > 0) {
          if (text[pos] === '<') depth++;
          else if (text[pos] === '>') depth--;
          pos++;
        }
        continue;
      }

      break;
    }
  }

  function readTagName(): string {
    const start = pos;
    while (pos < len && text[pos] !== ' ' && text[pos] !== '\t' && text[pos] !== '\n' &&
           text[pos] !== '\r' && text[pos] !== '>' && text[pos] !== '/' && text[pos] !== '?') {
      pos++;
    }
    if (pos === start) throw new RangeError(`Expected tag name at position ${pos}`);
    return text.substring(start, pos);
  }

  function readAttrName(): string {
    const start = pos;
    while (pos < len && text[pos] !== '=' && text[pos] !== ' ' && text[pos] !== '\t' &&
           text[pos] !== '\n' && text[pos] !== '\r' && text[pos] !== '>' && text[pos] !== '/') {
      pos++;
    }
    return text.substring(start, pos);
  }

  function readAttrValue(): string {
    skipWhitespace();
    if (pos >= len || text[pos] !== '=') return '';
    pos++; // skip =
    skipWhitespace();
    const quote = text[pos];
    if (quote !== '"' && quote !== "'") throw new RangeError(`Expected quoted attribute value at position ${pos}`);
    pos++; // skip opening quote
    const start = pos;
    while (pos < len && text[pos] !== quote) pos++;
    const val = text.substring(start, pos);
    pos++; // skip closing quote
    return decodeEntities(val);
  }

  function readAttributes(): Record<string, string> {
    const attrs: Record<string, string> = {};
    while (pos < len) {
      skipWhitespace();
      if (pos >= len || text[pos] === '>' || text[pos] === '/' || text[pos] === '?') break;
      const name = readAttrName();
      if (!name) break;
      const value = readAttrValue();
      attrs[name] = value;
    }
    return attrs;
  }

  function parseElement(): XmlElement {
    // Must be at '<'
    if (text[pos] !== '<') throw new RangeError(`Expected '<' at position ${pos}`);
    pos++; // skip <

    const tag = readTagName();
    const attrs = readAttributes();
    skipWhitespace();

    // Self-closing: <tag ... />
    if (text[pos] === '/') {
      pos++; // skip /
      if (text[pos] !== '>') throw new RangeError(`Expected '>' after '/' at position ${pos}`);
      pos++; // skip >
      return Object.freeze({ tag, attrs: Object.freeze(attrs), children: Object.freeze([]) });
    }

    if (text[pos] !== '>') throw new RangeError(`Expected '>' at position ${pos}`);
    pos++; // skip >

    // Parse children
    const children: (XmlElement | string)[] = [];
    while (pos < len) {
      // Check for closing tag
      if (text[pos] === '<' && text[pos + 1] === '/') {
        pos += 2; // skip </
        const closeTag = readTagName();
        if (closeTag !== tag) {
          throw new RangeError(`Mismatched closing tag: expected </${tag}>, got </${closeTag}>`);
        }
        skipWhitespace();
        if (text[pos] !== '>') throw new RangeError(`Expected '>' at position ${pos}`);
        pos++; // skip >
        return Object.freeze({ tag, attrs: Object.freeze(attrs), children: Object.freeze(children) });
      }

      // Skip comments inside elements
      if (text[pos] === '<' && text[pos + 1] === '!' && text[pos + 2] === '-' && text[pos + 3] === '-') {
        const end = text.indexOf('-->', pos + 4);
        if (end < 0) throw new RangeError('Unterminated comment');
        pos = end + 3;
        continue;
      }

      // Child element
      if (text[pos] === '<') {
        children.push(parseElement());
        continue;
      }

      // Text content
      const start = pos;
      while (pos < len && text[pos] !== '<') pos++;
      const textContent = text.substring(start, pos);
      const decoded = decodeEntities(textContent);
      if (decoded.trim()) {
        children.push(decoded);
      }
    }

    throw new RangeError(`Unterminated element <${tag}>`);
  }

  skipDeclarationsAndComments();
  skipWhitespace();

  if (pos >= len) throw new RangeError('Empty XML document');

  const root = parseElement();
  return root;
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

export interface XmlSerializeOptions {
  /** Include `<?xml ... ?>` declaration (default true). */
  readonly declaration?: boolean;
  /** Pretty-print with indentation (default false). */
  readonly indent?: boolean;
}

/**
 * Serialize an XmlElement tree to an XML string.
 *
 * @param root - Root element to serialize.
 * @param options - Serialization options.
 * @returns The serialized XML string.
 */
export function serializeXml(root: XmlElement, options?: XmlSerializeOptions): string {
  const decl = options?.declaration !== false;
  const indent = options?.indent === true;

  const parts: string[] = [];
  if (decl) parts.push('<?xml version="1.0" encoding="UTF-8"?>');

  function emit(el: XmlElement, depth: number): void {
    const pad = indent ? '  '.repeat(depth) : '';
    const nl = indent ? '\n' : '';

    // Build opening tag
    let open = `${pad}<${el.tag}`;
    for (const [k, v] of Object.entries(el.attrs)) {
      open += ` ${k}="${encodeAttrValue(v)}"`;
    }

    if (el.children.length === 0) {
      parts.push(`${open}/>${nl}`);
      return;
    }

    // Single text child — inline
    if (el.children.length === 1 && typeof el.children[0] === 'string') {
      parts.push(`${open}>${encodeEntities(el.children[0])}</${el.tag}>${nl}`);
      return;
    }

    parts.push(`${open}>${nl}`);
    for (const ch of el.children) {
      if (typeof ch === 'string') {
        parts.push(`${indent ? '  '.repeat(depth + 1) : ''}${encodeEntities(ch)}${nl}`);
      } else {
        emit(ch, depth + 1);
      }
    }
    parts.push(`${pad}</${el.tag}>${nl}`);
  }

  emit(root, 0);
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Builder & Query Helpers
// ---------------------------------------------------------------------------

/**
 * Create an XmlElement with optional attributes and children.
 */
export function createElement(
  tag: string,
  attrs?: Record<string, string>,
  children?: (XmlElement | string)[],
): XmlElement {
  return Object.freeze({
    tag,
    attrs: Object.freeze(attrs ?? {}),
    children: Object.freeze(children ?? []),
  });
}

/**
 * Find the first child element with the given tag name.
 */
export function findChild(el: XmlElement, tag: string): XmlElement | undefined {
  for (const ch of el.children) {
    if (typeof ch !== 'string' && ch.tag === tag) return ch;
  }
  return undefined;
}

/**
 * Find all child elements with the given tag name.
 */
export function findChildren(el: XmlElement, tag: string): XmlElement[] {
  const result: XmlElement[] = [];
  for (const ch of el.children) {
    if (typeof ch !== 'string' && ch.tag === tag) result.push(ch);
  }
  return result;
}

/**
 * Get concatenated text content of an element.
 */
export function textContent(el: XmlElement): string {
  const parts: string[] = [];
  for (const ch of el.children) {
    if (typeof ch === 'string') parts.push(ch);
  }
  return parts.join('');
}

/**
 * Get the text content of the first child element with the given tag.
 */
export function childText(el: XmlElement, tag: string): string | undefined {
  const child = findChild(el, tag);
  if (!child) return undefined;
  return textContent(child);
}

/**
 * Parse an integer from the first child element with the given tag.
 */
export function childInt(el: XmlElement, tag: string): number | undefined {
  const t = childText(el, tag);
  if (t === undefined) return undefined;
  const n = parseInt(t, 10);
  if (Number.isNaN(n)) return undefined;
  return n;
}
