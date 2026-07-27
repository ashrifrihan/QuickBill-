/**
 * Generates the QuickBill app icons from code — the same scan-bracket mark used
 * on the login screen.
 *
 * Deliberately dependency-free: shapes are rasterised from signed-distance
 * functions and the PNGs are encoded with Node's built-in zlib. That keeps the
 * icon reproducible (re-run to change the colour or radius) without adding a
 * native image toolchain to the project.
 *
 *   node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BRAND = { r: 0x16, g: 0x17, b: 0x1d }; // theme.colors.darkCapsule
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

// ---------------------------------------------------------------------------
// PNG encoding (RGBA, 8-bit, no interlace)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with filter type 0 (None).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Signed distance helpers (all in pixel units, origin at canvas centre)
// ---------------------------------------------------------------------------

/** Distance from p to a rounded box of half-extents (bx, by) and radius r. */
function sdRoundBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

/** Distance from p to the segment ab. Round caps come free when thresholded. */
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const denom = bax * bax + bay * bay;
  const h = denom === 0 ? 0 : Math.min(1, Math.max(0, (pax * bax + pay * bay) / denom));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/** Distance to a circular arc centred at c, radius r, limited to one quadrant. */
function sdQuarterArc(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  // Only the outward quadrant (dx >= 0, dy >= 0) belongs to this arc; the
  // straight arms already cover everything else.
  if (dx < 0 || dy < 0) return Infinity;
  return Math.abs(Math.hypot(dx, dy) - r);
}

/** 1 → fully inside, 0 → fully outside, with a 1px anti-aliased edge. */
function coverage(distance, aa) {
  return Math.min(1, Math.max(0, 0.5 - distance / aa));
}

/**
 * Renders the mark.
 *
 * @param {number} size            canvas size in px
 * @param {object} opts
 * @param {boolean} opts.background draw the dark rounded square behind the mark
 * @param {number} opts.scale       overall size of the mark, 1 = full bleed
 * @param {boolean} opts.squircle   round the background's corners
 */
function render(size, { background = true, scale = 1, squircle = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  const aa = 1.5;
  const half = size / 2;

  // Background plate.
  const plateHalf = (size / 2) * (squircle ? 0.98 : 1);
  const plateRadius = squircle ? size * 0.3 : 0;

  // Scan-bracket frame geometry, proportional to the canvas.
  const frameHalf = size * 0.19 * scale;
  const stroke = size * 0.034 * scale;
  const corner = size * 0.055 * scale;
  const arm = size * 0.072 * scale;
  const halfStroke = stroke / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Sample at pixel centres.
      const px = x + 0.5 - half;
      const py = y + 0.5 - half;

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      if (background) {
        const plate = coverage(sdRoundBox(px, py, plateHalf, plateHalf, plateRadius), aa);
        if (plate > 0) {
          r = BRAND.r;
          g = BRAND.g;
          b = BRAND.b;
          a = plate;
        }
      }

      // Fold into one quadrant — the mark is 4-way symmetric.
      const qx = Math.abs(px);
      const qy = Math.abs(py);
      const H = frameHalf;
      const V = frameHalf;

      const armH = sdSegment(qx, qy, H - corner - arm, V, H - corner, V);
      const armV = sdSegment(qx, qy, H, V - corner - arm, H, V - corner);
      const arc = sdQuarterArc(qx, qy, H - corner, V - corner, corner);

      const bracket = coverage(Math.min(armH, armV, arc) - halfStroke, aa);

      if (bracket > 0) {
        // Composite white over whatever is underneath.
        r = WHITE.r * bracket + r * (1 - bracket);
        g = WHITE.g * bracket + g * (1 - bracket);
        b = WHITE.b * bracket + b * (1 - bracket);
        a = bracket + a * (1 - bracket);
      }

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(a * 255);
    }
  }

  return encodePng(size, size, rgba);
}

/** Flat colour fill, for the adaptive-icon background layer. */
function renderSolid(size, colour) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    rgba[i * 4] = colour.r;
    rgba[i * 4 + 1] = colour.g;
    rgba[i * 4 + 2] = colour.b;
    rgba[i * 4 + 3] = 255;
  }
  return encodePng(size, size, rgba);
}

// ---------------------------------------------------------------------------

const assets = path.join(__dirname, '..', 'assets');

const outputs = [
  // iOS//store icon: a FULL SQUARE, no rounded corners and no transparency.
  // Both platforms apply their own mask; shipping pre-rounded corners gives
  // double-rounding on Android and black corners on iOS.
  ['icon.png', render(1024, { background: true, squircle: false })],

  // Adaptive icon: the outer 33% is cropped by the launcher's mask, so the
  // mark is scaled down to sit inside the safe zone.
  ['android-icon-foreground.png', render(1024, { background: false, scale: 0.62 })],
  ['android-icon-background.png', renderSolid(1024, BRAND)],
  ['android-icon-monochrome.png', render(1024, { background: false, scale: 0.62 })],

  // Splash and web favicon keep the rounded plate, since they sit on a
  // background rather than in a system mask.
  ['splash-icon.png', render(512, { background: true, squircle: true })],
  ['favicon.png', render(96, { background: true, squircle: true })],
];

for (const [name, buffer] of outputs) {
  const file = path.join(assets, name);
  fs.writeFileSync(file, buffer);
  console.log(`wrote ${name} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

console.log('\nIcons regenerated. Rebuild the native app to see them on the launcher.');
