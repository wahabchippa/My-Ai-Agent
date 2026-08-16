// ═══════════════════════════════════════════════════════════════════════
// Chhota ZIP writer — koi dependency nahi.
//
// jszip/fflate add kar sakta tha, magar sirf text files ko ek saath
// baandhne ke liye poori library kheenchna zyadti hai. ZIP ka "store"
// mode (bina compression) ka format seedha hai: har file ke aage ek
// local header, phir aakhir me central directory. Code files waise bhi
// chhoti hain — compression ka faida na ke barabar hai.
//
// Sirf browser me chalta hai (Blob). Server par istemal na karein.
// ═══════════════════════════════════════════════════════════════════════

/** CRC-32 — ZIP spec ka lazmi hissa, warna unzip "corrupt" kehta hai. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS time/date — ZIP purana format hai, Unix timestamp nahi leta. */
function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface ZipEntry {
  path: string;
  content: string;
}

/**
 * Files ko ek ZIP Blob me baandho.
 * Sab kuch UTF-8 text maana jata hai (bit 11 set hai, to non-ASCII
 * naam bhi theek khulte hain).
 */
export function makeZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const now = dosTime(new Date());
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.path);
    const data = enc.encode(e.content);
    const crc = crc32(data);

    // Local file header — 30 bytes + naam
    const lh = new Uint8Array(30 + name.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // bit 11 = UTF-8 naam
    lv.setUint16(8, 0, true); // method 0 = store
    lv.setUint16(10, now.time, true);
    lv.setUint16(12, now.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // compressed
    lv.setUint32(22, data.length, true); // uncompressed
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); // extra field
    lh.set(name, 30);

    chunks.push(lh, data);

    // Central directory entry — 46 bytes + naam
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, now.time, true);
    cv.setUint16(14, now.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); // is file ka local header kahan hai
    cd.set(name, 46);
    central.push(cd);

    offset += lh.length + data.length;
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0);

  // End of central directory — 22 bytes
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true); // central directory ka aaghaz

  // TS ko Uint8Array<ArrayBufferLike> BlobPart ke tor par qubool nahi —
  // .buffer nikaal kar dena padta hai (runtime par farq nahi parta).
  const parts: BlobPart[] = [...chunks, ...central, eocd].map(
    (u) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer,
  );
  return new Blob(parts, { type: "application/zip" });
}

/** ZIP bana kar foran download karwa do. */
export function downloadZip(name: string, entries: ZipEntry[]): void {
  const url = URL.createObjectURL(makeZip(entries));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".zip") ? name : `${name}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
