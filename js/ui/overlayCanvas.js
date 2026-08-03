/**
 * overlayCanvas.js
 * ---------------------------------------------------------------
 * Modul view-layer untuk siklus hidup elemen <canvas> overlay.
 * Tanggung jawab TUNGGAL: membuat, memasang, melepas, dan
 * menyesuaikan ukuran canvas terhadap container-nya.
 *
 * TIDAK ada logika menggambar layer di sini — itu tanggung jawab
 * overlayRenderer.js (Single Responsibility).
 * ---------------------------------------------------------------
 */

/**
 * Buat elemen <canvas> overlay baru. Diposisikan absolute memenuhi
 * container, dan pointer-events:none supaya tidak menghalangi
 * interaksi (tap-to-focus, pinch-to-zoom) pada elemen di bawahnya.
 * @returns {HTMLCanvasElement}
 */
export function createOverlayCanvas() {
  const canvas = document.createElement('canvas');
  canvas.className = 'overlay-canvas';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '40';
  return canvas;
}

/**
 * Pasang canvas ke dalam container. Container otomatis diberi
 * position:relative jika masih static, supaya canvas (absolute)
 * terposisi relatif terhadapnya.
 * @param {HTMLElement} container
 * @param {HTMLCanvasElement} canvas
 */
export function mountOverlayCanvas(container, canvas) {
  if (!container || !canvas) return;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  if (canvas.parentElement !== container) {
    container.appendChild(canvas);
  }
}

/**
 * Lepas canvas sepenuhnya dari DOM.
 * @param {HTMLCanvasElement} canvas
 */
export function unmountOverlayCanvas(canvas) {
  if (canvas && canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
}

/**
 * Sinkronkan ukuran piksel internal canvas dengan ukuran CSS
 * container saat ini, memperhitungkan devicePixelRatio agar tetap
 * tajam di layar Retina. Mereset transform context sesuai DPR.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} container
 * @returns {{width:number, height:number}} ukuran CSS (bukan ukuran piksel internal)
 */
export function resizeCanvasToContainer(canvas, container) {
  if (!canvas || !container) return { width: 0, height: 0 };

  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Reset transform lalu skalakan sesuai DPR — supaya koordinat
    // gambar tetap dalam satuan CSS px meski canvas internal lebih rapat.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { width: rect.width, height: rect.height };
}

/**
 * Ambil 2D rendering context dari canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D|null}
 */
export function getContext2D(canvas) {
  return canvas ? canvas.getContext('2d') : null;
}
