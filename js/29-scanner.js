'use strict';
/* ============================================================
   LOADOUT - LIVE CAMERA BARCODE SCANNER

   Added alongside the photo-upload path in 21-food-lookup.js
   rather than replacing it. The upload route stays as the
   fallback for anyone with no camera, a denied permission, or
   a browser where getUserMedia is unavailable.

   Reuses the decoders already defined in 21-food-lookup.js:
   loadZxing(), toLuminance(), tryDecode() and useScannedCode().
   Those are top-level declarations there, so they are visible
   here because this file loads after it.

   getUserMedia requires a SECURE CONTEXT: https or localhost.
   Opened from a file:// path it does not exist at all, so the
   entry button stays hidden rather than offering a dead feature.
   ============================================================ */

  const SCAN_FORMATS = ['ean_13','ean_8','upc_a','upc_e','code_128','itf'];
  const SCAN_INTERVAL_MS = 250;   // decoding every frame pegs the CPU for no gain
  const SCAN_MAX_EDGE = 800;      // downscale before decoding; full sensor res is wasteful
  const CAMERA_TIMEOUT_MS = 12000; // getUserMedia can hang forever instead of rejecting

  let scanStream = null;
  let scanTimer  = null;
  let scanCanvas = null;
  let scanDetector = null;
  let scanZX = null;
  let scanReader = null;
  let scanBusy = false;

  const scanStage  = () => document.querySelector('#modalScan .scan-stage');
  const scanVideo  = () => document.getElementById('scanVideo');
  const scanStatus = () => document.getElementById('scanStatus');

  function cameraSupported(){
    /* file:// reports isSecureContext === true (file URLs count as potentially
       trustworthy), but there is no real origin for Chrome to attach a camera
       permission to, and getUserMedia there HANGS rather than rejecting --
       measured, not assumed. So the local Desktop copy hides the button and
       keeps the photo-upload path; the hosted version offers both. */
    if (location.protocol === 'file:') return false;
    return !!(window.isSecureContext &&
              navigator.mediaDevices &&
              typeof navigator.mediaDevices.getUserMedia === 'function');
  }

  function setScanStatus(msg){
    const el = scanStatus();
    if (el) el.textContent = msg;
  }

  /* ---- teardown ------------------------------------------------------
     Every exit path routes through here. A camera left running is the
     worst failure mode this feature has: the indicator light stays on
     and the user has no way to turn it off short of closing the tab. */
  function stopScan(){
    if (scanTimer){ clearInterval(scanTimer); scanTimer = null; }
    if (scanStream){
      scanStream.getTracks().forEach(function(t){ try{ t.stop(); }catch(e){} });
      scanStream = null;
    }
    const v = scanVideo();
    if (v){ try{ v.pause(); }catch(e){} v.srcObject = null; }
    const stage = scanStage();
    if (stage) stage.classList.remove('scan-hit');
    scanBusy = false;
  }

  function closeScan(){
    stopScan();
    const el = document.getElementById('modalScan');
    if (el) el.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---- decoding ------------------------------------------------------ */

  function frameToCanvas(video){
    if (!scanCanvas) scanCanvas = document.createElement('canvas');
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.min(1, SCAN_MAX_EDGE / Math.max(vw, vh));
    scanCanvas.width  = Math.round(vw * scale);
    scanCanvas.height = Math.round(vh * scale);
    scanCanvas.getContext('2d').drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
    return scanCanvas;
  }

  async function decodeFrame(){
    /* Ticks can overlap when a decode runs long; without this guard they
       queue up and the UI stalls. */
    if (scanBusy) return null;
    scanBusy = true;
    try{
      const v = scanVideo();
      if (!v || v.readyState < 2) return null;
      const cv = frameToCanvas(v);
      if (!cv) return null;

      if (scanDetector){
        try{
          const found = await scanDetector.detect(cv);
          if (found && found.length){
            const code = String(found[0].rawValue || '').replace(/\D/g,'');
            if (code.length >= 8) return code;
          }
        }catch(e){ /* fall through to ZXing */ }
      }

      if (scanReader && scanZX){
        try{
          const ctx = cv.getContext('2d');
          const px  = ctx.getImageData(0, 0, cv.width, cv.height);
          const lum = new scanZX.RGBLuminanceSource(toLuminance(px), cv.width, cv.height);
          scanReader.reset();
          const text = tryDecode(scanReader, scanZX, lum);
          const code = (text || '').replace(/\D/g,'');
          if (code.length >= 8) return code;
        }catch(e){ /* no barcode in this frame - normal */ }
      }
      return null;
    } finally {
      scanBusy = false;
    }
  }

  async function onHit(code){
    const stage = scanStage();
    if (stage) stage.classList.add('scan-hit');
    setScanStatus('Found ' + code);
    stopScan();
    closeScan();
    useScannedCode(code);
  }

  /* ---- start --------------------------------------------------------- */

  async function prepareDecoders(){
    scanDetector = null; scanZX = null; scanReader = null;

    if ('BarcodeDetector' in window){
      try{ scanDetector = new window.BarcodeDetector({formats: SCAN_FORMATS}); }
      catch(e){ scanDetector = null; }
    }
    /* iOS has no BarcodeDetector, so ZXing is the only decoder there and must
       be fetched before scanning is useful. Status text is owned by startScan()
       because this runs concurrently with camera startup. */
    if (!scanDetector){
      try{
        const ZX = await loadZxing();
        if (ZX && ZX.MultiFormatReader){
          const hints = new Map();
          hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
            ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8,
            ZX.BarcodeFormat.UPC_A,  ZX.BarcodeFormat.UPC_E,
            ZX.BarcodeFormat.CODE_128, ZX.BarcodeFormat.ITF
          ]);
          /* TRY_HARDER is deliberately off here. On a live stream the next
             frame arrives in milliseconds, so speed beats squeezing one
             difficult frame -- the opposite of the single-photo case. */
          const reader = new ZX.MultiFormatReader();
          reader.setHints(hints);
          scanZX = ZX; scanReader = reader;
        }
      }catch(e){ /* reported by the caller */ }
    }
    return !!(scanDetector || scanReader);
  }

  async function startScan(){
    const modal = document.getElementById('modalScan');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setScanStatus('Starting the camera…');

    /* Started but deliberately NOT awaited yet. On iOS the decoder is a CDN
       download; waiting for it here would leave the user staring at an empty
       box, and a slow or blocked CDN would mean no viewfinder at all. The
       camera comes up first, the decoder catches up. */
    const decoderReady = prepareDecoders();

    try{
      /* 'environment' asks for the rear camera; ideal rather than exact so a
         laptop with only a front camera still works instead of throwing. */
      const gum = navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      /* getUserMedia can hang indefinitely rather than rejecting -- some
         embedded browsers and virtualised cameras never settle the promise.
         Without this the user is stranded on "Starting the camera..." with
         no error and no way forward. */
      let timedOut = false;
      scanStream = await new Promise(function(resolve, reject){
        const t = setTimeout(function(){
          timedOut = true;
          const err = new Error('camera timeout');
          err.name = 'TimeoutError';
          reject(err);
        }, CAMERA_TIMEOUT_MS);
        gum.then(function(s){
          clearTimeout(t);
          /* Arrived after we gave up: release it rather than leaking a
             live camera with no UI attached. */
          if (timedOut){ s.getTracks().forEach(function(tr){ try{ tr.stop(); }catch(e){} }); return; }
          resolve(s);
        }, function(e){ clearTimeout(t); reject(e); });
      });
    }catch(e){
      const name = (e && e.name) || '';
      let msg;
      if (name === 'NotAllowedError' || name === 'SecurityError'){
        msg = 'Camera permission was refused. Allow camera access for this site, or upload a picture of the barcode instead.';
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError'){
        msg = 'No camera was found on this device. You can upload a picture of the barcode instead.';
      } else if (name === 'NotReadableError'){
        msg = 'The camera is already in use by another app. Close it and try again.';
      } else if (name === 'TimeoutError'){
        msg = 'The camera didn’t respond. Try again, or upload a picture of the barcode instead.';
      } else {
        msg = 'The camera could not be started. You can upload a picture of the barcode instead.';
      }
      setScanStatus(msg);
      return;
    }

    const v = scanVideo();
    v.srcObject = scanStream;
    /* Deliberately NOT awaited. play() can hang forever instead of settling
       under some autoplay policies, which would strand the whole scanner.
       Nothing here depends on it: decodeFrame() gates on readyState, and the
       stream renders regardless. */
    try{
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(function(){});
    }catch(e){}

    setScanStatus('Point the camera at a barcode…');

    const ready = await decoderReady;
    if (!ready){
      /* No decoder means the live view is decorative, so release the camera
         rather than leaving the indicator light on for nothing. */
      stopScan();
      setScanStatus('Couldn’t load the barcode reader. Close this and type the number from the packet, or upload a picture instead.');
      return;
    }
    /* Cancelled while the decoder was still loading. */
    if (!scanStream) return;

    scanTimer = setInterval(async function(){
      const code = await decodeFrame();
      if (code) onHit(code);
    }, SCAN_INTERVAL_MS);
  }

  /* ---- wiring -------------------------------------------------------- */

  const btnScanCam = document.getElementById('btnScanCam');
  if (btnScanCam && cameraSupported()){
    btnScanCam.hidden = false;             // only offered where it can actually work
    btnScanCam.addEventListener('click', startScan);
  }

  const scanCloseBtn  = document.getElementById('scanClose');
  const scanCancelBtn = document.getElementById('scanCancel');
  if (scanCloseBtn)  scanCloseBtn.addEventListener('click', closeScan);
  if (scanCancelBtn) scanCancelBtn.addEventListener('click', closeScan);

  const scanModal = document.getElementById('modalScan');
  if (scanModal){
    scanModal.addEventListener('click', function(e){ if (e.target === scanModal) closeScan(); });
  }
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && scanModal && !scanModal.hidden) closeScan();
  });
  /* Backgrounding the tab should release the camera, not keep it live. */
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && scanStream) closeScan();
  });
  window.addEventListener('pagehide', closeScan);
