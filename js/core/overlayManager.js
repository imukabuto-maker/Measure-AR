/**
 * overlayManager.js
 * ---------------------------------------------------------------
 * Facade / orkestrator Overlay Framework (Sprint 9).
 * Tanggung jawab: siklus hidup canvas overlay (buat/mount/resize/
 * lepas), kontrol visibility & opacity tiap layer, dan trigger
 * render ulang. TIDAK ADA logika pengukuran/kalkulasi dunia nyata
 * di sini — murni lapisan visual, fondasi untuk Calibration,
 * Measurement, Marker, OpenCV, dll di sprint-sprint mendatang.
 *
 * PENTING: modul ini MEMAKAI ULANG Camera Engine yang sudah ada
 * lewat getPreviewElement()/onCameraStateChange() — TIDAK ADA
 * perubahan pada cameraManager.js.
 *
 * initOverlay()/destroyOverlay() bersifat GENERIC (bisa dipasang di
 * container manapun, tidak wajib container kamera) — supaya nanti
 * Calibration/Measurement Engine bisa memakai canvas overlay yang
 * sama di atas gambar statis (hasil capture), bukan hanya preview
 * live. Integrasi otomatis dengan Camera Engine di bagian bawah
 * file ini hanyalah salah satu cara pakai, bukan satu-satunya.
 * ---------------------------------------------------------------
 */

import { getPreviewElement, onCameraStateChange, CAMERA_STATE } from './cameraManager.js';
import {
  OVERLAY_STATUS,
  OVERLAY_LAYERS,
  getOverlayState,
  setOverlayState,
  setLayerState,
  onOverlayStateChange,
} from './overlayState.js';
import {
  createOverlayCanvas,
  mountOverlayCanvas,
  unmountOverlayCanvas,
  resizeCanvasToContainer,
  getContext2D,
} from '../ui/overlayCanvas.js';
import { renderLayers } from '../ui/overlayRenderer.js';

// Re-export supaya modul lain cukup import dari satu pintu (overlayManager)
export { OVERLAY_STATUS, OVERLAY_LAYERS, getOverlayState, onOverlayStateChange };

// Referensi canvas & container aktif — privat, dikontrol lewat fungsi di bawah
let canvasEl = null;
let hostContainer = null;
let resizeObserver = null;

/**
 * Inisialisasi overlay pada container manapun. Aman dipanggil
 * berulang — overlay lama otomatis dilepas dulu.
 * @param {HTMLElement} container elemen yang akan "dipagari" canvas overlay
 */
export function initOverlay(container) {
  if (!container) {
    throw new Error('[overlayManager] Parameter container wajib diisi');
  }

  destroyOverlay(); // pastikan tidak ada overlay lama menumpuk

  try {
    canvasEl = createOverlayCanvas();
    mountOverlayCanvas(container, canvasEl);
    hostContainer = container;

    const size = resizeCanvasToContainer(canvasEl, container);
    setOverlayState({ status: OVERLAY_STATUS.ACTIVE, size, errorMessage: null });
    redraw();

    attachResizeHandling(container);
  } catch (err) {
    console.error('[overlayManager] Gagal inisialisasi overlay:', err.message);
    setOverlayState({ status: OVERLAY_STATUS.ERROR, errorMessage: 'Gagal menampilkan overlay.' });
  }
}

/**
 * Lepas overlay: hapus canvas dari DOM, lepas resize observer,
 * reset state. Aman dipanggil berulang meski overlay tidak aktif.
 */
export function destroyOverlay() {
  detachResizeHandling();
  if (canvasEl) unmountOverlayCanvas(canvasEl);
  canvasEl = null;
  hostContainer = null;
  setOverlayState({ status: OVERLAY_STATUS.IDLE, size: { width: 0, height: 0 }, errorMessage: null });
}

/**
 * Tampilkan/sembunyikan satu layer, lalu gambar ulang.
 * @param {string} layerName salah satu nilai OVERLAY_LAYERS
 * @param {boolean} visible
 */
export function setLayerVisible(layerName, visible) {
  setLayerState(layerName, { visible });
  redraw();
}

/**
 * Atur transparansi satu layer (di-clamp ke 0-1), lalu gambar ulang.
 * @param {string} layerName salah satu nilai OVERLAY_LAYERS
 * @param {number} opacity
 */
export function setLayerOpacity(layerName, opacity) {
  const clamped = Math.min(1, Math.max(0, opacity));
  setLayerState(layerName, { opacity: clamped });
  redraw();
}

/**
 * Atur area ROI (Region of Interest) dalam koordinat ternormalisasi
 * (0-1) relatif terhadap ukuran canvas. Murni visual — TIDAK
 * menghitung ukuran/dimensi nyata apa pun.
 * @param {{x:number,y:number,w:number,h:number}|null} rect null untuk menghapus ROI
 */
export function setROI(rect) {
  setLayerState(OVERLAY_LAYERS.ROI, { rect });
  redraw();
}

/** Gambar ulang seluruh layer sesuai state saat ini. Aman jika overlay belum aktif. */
function redraw() {
  if (!canvasEl) return;
  const ctx = getContext2D(canvasEl);
  if (!ctx) return;
  const { size, layers } = getOverlayState();
  renderLayers(ctx, size.width, size.height, layers);
}

/**
 * Pasang penyesuaian ukuran otomatis: ResizeObserver jika tersedia
 * (mendeteksi perubahan ukuran container termasuk saat orientasi
 * device berubah), fallback ke window 'resize'/'orientationchange'
 * untuk browser lama yang tidak mendukung ResizeObserver.
 * @param {HTMLElement} container
 */
function attachResizeHandling(container) {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
  } else {
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }
}

/** Lepas listener resize (ResizeObserver atau fallback window listener). */
function detachResizeHandling() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  } else {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
  }
}

/** Tangani perubahan ukuran container: sinkronkan canvas & gambar ulang. */
function handleResize() {
  if (!canvasEl || !hostContainer) return;
  const size = resizeCanvasToContainer(canvasEl, hostContainer);
  setOverlayState({ size });
  redraw();
}

// Sinkronisasi otomatis dengan siklus hidup Camera Engine — konsisten
// dengan pola Focus/Zoom/Exposure Manager (lihat docs/CAMERA_API.md §7):
// overlay otomatis terpasang mengikuti preview begitu kamera aktif,
// dan otomatis lepas saat kamera ditutup/error.
onCameraStateChange((state) => {
  if (state.status === CAMERA_STATE.PREVIEWING) {
    const videoEl = getPreviewElement();
    const container = videoEl ? videoEl.parentElement : null;
    if (container) initOverlay(container);
  } else if (state.status === CAMERA_STATE.CLOSED || state.status === CAMERA_STATE.ERROR) {
    destroyOverlay();
  }
});
