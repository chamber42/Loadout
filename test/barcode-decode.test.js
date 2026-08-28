'use strict';
/* Covers the decode helpers in 21-food-lookup.js that both the live scanner
   and the photo path run on: tryDecode and rotateLuminance.

   A real EAN-13 is rendered from the spec and placed where people actually
   hold packets — off-centre, and turned sideways — because that is precisely
   what used to fail. Two library traps are pinned here:

     - MultiFormatReader.decode(image, hints) calls setHints(hints) on the way
       in, so decode(image) with no second argument wipes the hints that were
       configured earlier. Losing TRY_HARDER drops ZXing to fifteen rows
       around the middle of the frame.
     - RGBLuminanceSource.isRotateSupported() is false and rotating it throws,
       so a sideways barcode has to be rotated by hand.

   Needs @zxing/library, a devDependency: the app itself loads ZXing from a
   CDN only when someone actually scans, and has no runtime dependencies.
   ============================================================ */

const {loadFunctions, suite} = require('./helpers');

let ZX = null;
try { ZX = require('@zxing/library'); } catch (e) { /* reported below */ }

/* --- a genuine EAN-13, built from the specification ------------------- */
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
const CODE = '5901234123457';

function modules(code){
  const d = code.split('').map(Number);
  let bits = '101';
  for (let i = 0; i < 6; i++) bits += (PARITY[d[0]][i] === 'L' ? L : G)[d[i+1]];
  bits += '01010';
  for (let i = 0; i < 6; i++) bits += R[d[i+7]];
  return bits + '101';
}
const BITS = modules(CODE), MODULE = 3, BAR_H = 120, BAR_W = BITS.length * MODULE;

/* RGBA pixels, the way a canvas hands them over. */
function frame(W, H, ox, oy, sideways){
  const px = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 0; y < BAR_H; y++){
    for (let x = 0; x < BAR_W; x++){
      if (BITS[Math.floor(x / MODULE)] !== '1') continue;
      const cx = sideways ? ox + y : ox + x;
      const cy = sideways ? oy + x : oy + y;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const i = (cy * W + cx) * 4;
      px[i] = px[i+1] = px[i+2] = 0;
    }
  }
  return {data: px, width: W, height: H};
}

module.exports = () => suite('barcode decoding', t => {
  if (!ZX){
    t.check('@zxing/library is installed (run npm install)', false, 'module not found');
    return;
  }
  const ctx = loadFunctions('21-food-lookup.js',
    ['toLuminance', 'rotateLuminance', 'tryDecode']);

  const hints = () => {
    const h = new Map();
    h.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
      ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A,
      ZX.BarcodeFormat.UPC_E, ZX.BarcodeFormat.CODE_128, ZX.BarcodeFormat.ITF]);
    h.set(ZX.DecodeHintType.TRY_HARDER, true);
    return h;
  };

  /* Exactly the sequence decodeFrame and decodeBarcodePhoto run. */
  function read(img){
    const gray = ctx.toLuminance(img);
    const h = hints();
    const reader = new ZX.MultiFormatReader();
    reader.setHints(h);
    reader.reset();
    let text = ctx.tryDecode(reader, ZX, new ZX.RGBLuminanceSource(gray, img.width, img.height), h);
    if (!text){
      reader.reset();
      const turned = ctx.rotateLuminance(gray, img.width, img.height);
      text = ctx.tryDecode(reader, ZX, new ZX.RGBLuminanceSource(turned, img.height, img.width), h);
    }
    return (text || '').replace(/\D/g, '');
  }

  const W = 1280, H = 960, cx = Math.round((W - BAR_W) / 2);

  t.section('wherever the barcode sits in the frame');
  t.equal('dead centre',        read(frame(W, H, cx, 420, false)), CODE);
  t.equal('high in the frame',  read(frame(W, H, cx, 90,  false)), CODE);
  t.equal('very high',          read(frame(W, H, cx, 30,  false)), CODE);
  t.equal('low in the frame',   read(frame(W, H, cx, 760, false)), CODE);
  t.equal('off to one side',    read(frame(W, H, 40, 150, false)), CODE);

  t.section('and whichever way up it is held');
  t.equal('turned sideways',    read(frame(W, H, 560, 300, true)), CODE);
  t.equal('sideways, off-axis', read(frame(W, H, 180, 120, true)), CODE);

  t.section('the traps that made it finicky');
  {
    /* Pins the reason tryDecode takes a hints argument. Drop it and this
       reads again as a miss, which is what shipped for months. */
    const img = frame(W, H, cx, 90, false);
    const gray = ctx.toLuminance(img);
    const reader = new ZX.MultiFormatReader();
    reader.setHints(hints());          // set, but deliberately not passed on
    reader.reset();
    const withoutHints = ctx.tryDecode(reader, ZX,
      new ZX.RGBLuminanceSource(gray, img.width, img.height));
    t.check('hints set but not passed to decode() lose TRY_HARDER, missing an off-centre code',
      (withoutHints || '').replace(/\D/g, '') !== CODE, withoutHints);

    const src = new ZX.RGBLuminanceSource(gray, img.width, img.height);
    t.equal('RGBLuminanceSource still refuses to rotate itself', src.isRotateSupported(), false);
  }

  t.section('rotateLuminance itself');
  {
    /* A 3x2 ramp, turned a quarter turn clockwise into a 2x3. */
    const src = Uint8ClampedArray.from([1,2,3, 4,5,6]);
    const out = ctx.rotateLuminance(src, 3, 2);
    t.equal('dimensions swap', out.length, 6);
    t.equal('corner lands where a quarter turn puts it', Array.from(out).join(','), '4,1,5,2,6,3');
  }
});
