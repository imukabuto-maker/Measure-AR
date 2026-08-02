/**
 * zoomManager.js
 * ---------------------------------------------------------------
 * Facade / orkestrator Zoom Manager (Sprint 7).
 * Tanggung jawab: Pinch-to-Zoom, Slider Zoom, Zoom In/Out, deteksi
 * kapabilitas zoom hardware, fallback digital zoom, dan indikator
 * visual SAJA. Tidak ada exposure/measurement/calibration di sini.
 *
 * PENTING: modul ini MEMAKAI ULANG Camera Engine yang sudah ada
 * (Sprint 5) lewat getActiveVideoTrack()/getPreviewElement() —
 * TIDAK ada perubahan pada cameraManager.js untuk sprint ini,
 * getter yang dibutuhkan sudah tersedia sejak Sprint 6.
 *
 * MEKANISME FALLBACK:
 * Jika track.getCapabilities().zoom tidak tersedia (hardware zoom
 * tidak didukung — kondisi umum di banyak browser/device), modul
 * ini otomatis beralih ke DIGITAL ZOOM: menerapkan CSS
 * transform:scale() pada elemen <video> preview. Ini murni
 * memperbesar gambar yang sudah di-capture kamera (bukan
 * memanfaatkan lensa/sensor), sehingga kualitas gambar menurun
 * (blur/pecah) semakin tinggi nilai zoom-nya — akurasi pengukuran
 * visual pada level zoom digital tinggi TIDAK direkomendasikan
 * untuk sprint pengukuran nanti.
 * ---------------------------------------------------------------
 */

import {
  getActiveVideoTrack,
  getPreviewElement,
  onCameraStateChange,
  CAMERA_STATE,
} from './cameraManager.js';
import {
  ZOOM_STATE,
  ZOOM_MODE,
  getZoomState,
  setZoomState,
  onZoomStateChange,
} from './zoomState.js';
import { showZoomIndicator, hideZoomIndicator } from '../ui/zoomIndicator.js';

// Re-export supaya modul lain cukup import dari satu pintu (zoomManager)
export { ZOOM_STATE, ZOOM_MODE, getZoomState, onZoomStateChange };

// Batas & step default untuk fallback digital zoom (CSS transform)
const DIGITAL_ZOOM_MIN = 1;
const DIGITAL_ZOOM_MAX = 3;
const DIGITAL_ZOOM_STEP = 0.1;

// Referensi listener pinch aktif — privat, dikontrol lewat enable/disable
let pinchListenerEl = null;
let pinchHandlers = null;
let pinchStartDistance = 0;
let pinchStartValue = 1;

/**
 * Baca kapabilitas zoom dari video track aktif via getCapabilities().
 * Mengembalikan info hardware jika tersedia, atau konfigurasi digital
 * fallback jika tidak — TIDAK PERNAH melempar error ke pemanggil.
 * @returns {{mode:string, min:number, max:number, step:number}}
 */
function detectZoomCapabilities() {
  const track = getActiveVideoTrack();

  if (track && typeof track.getCapabilities === 'function') {
    try {
      const caps = track.getCapabilities();
      if (caps && typeof caps.zoom === 'object' && caps.zoom !== null) {
        return {
          mode: ZOOM_MODE.HARDWARE,
          min: caps.zoom.min ?? 1,
          max: caps.zoom.max ?? 1,
          step: caps.zoom.step ?? 0.1,
        };
      }
    } catch (err) {
      console.warn('[zoomManager] Gagal membaca zoom capabilities:', err.message);
    }
  }

  // Fallback: hardware zoom tidak tersedia → digital zoom via CSS transform
  return {
    mode: ZOOM_MODE.DIGITAL,
    min: DIGITAL_ZOOM_MIN,
    max: DIGITAL_ZOOM_MAX,
    step: DIGITAL_ZOOM_STEP,
  };
}

/**
 * Inisialisasi Zoom Manager untuk sesi kamera aktif saat ini: deteksi
 * kapabilitas & reset nilai zoom ke titik awal (1x). Dipanggil otomatis
 * saat kamera masuk status PREVIEWING.
 */
function initZoomForActiveSession() {
  const caps = detectZoomCapabilities();
  setZoomState({
    status: caps.mode === ZOOM_MODE.DIGITAL ? ZOOM_STATE.UNSUPPORTED : ZOOM_STATE.IDLE,
    mode: caps.mode,
    value: caps.min,
    min: caps.min,
    max: caps.max,
    step: caps.step,
    errorMessage: caps.mode === ZOOM_MODE.DIGITAL
      ? 'Zoom hardware tidak didukung — menggunakan digital zoom (kualitas gambar menurun pada level tinggi).'
      : null,
  });
}

/**
 * Terapkan nilai zoom baru (di-clamp ke rentang min-max), lewat jalur
 * hardware (applyConstraints) atau digital (CSS transform), sesuai
 * mode yang terdeteksi. Selalu memperbarui state & indikator visual.
 * @param {number} value nilai zoom yang diinginkan
 * @returns {Promise<string>} status akhir (salah satu nilai ZOOM_STATE)
 */
export async function setZoom(value) {
  const current = getZoomState();
  const clamped = Math.min(current.max, Math.max(current.min, value));

  setZoomState({ status: ZOOM_STATE.ZOOMING, errorMessage: null });

  if (current.mode === ZOOM_MODE.HARDWARE) {
    const track = getActiveVideoTrack();
    if (!track) {
      setZoomState({ status: ZOOM_STATE.ERROR, errorMessage: 'Kamera tidak aktif.' });
      return ZOOM_STATE.ERROR;
    }
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped }] });
      setZoomState({ status: ZOOM_STATE.IDLE, value: clamped, errorMessage: null });
      renderIndicator(clamped, current.mode);
      return ZOOM_STATE.IDLE;
    } catch (err) {
      console.error('[zoomManager] Gagal menerapkan zoom hardware:', err.message);
      setZoomState({ status: ZOOM_STATE.ERROR, errorMessage: 'Gagal menerapkan zoom pada kamera.' });
      return ZOOM_STATE.ERROR;
    }
  }

  // Mode digital: terapkan CSS transform ke elemen <video> preview
  try {
    const videoEl = getPreviewElement();
    if (!videoEl) {
      setZoomState({ status: ZOOM_STATE.ERROR, errorMessage: 'Preview kamera tidak ditemukan.' });
      return ZOOM_STATE.ERROR;
    }
    videoEl.style.transform = `scale(${clamped})`;
    videoEl.style.transformOrigin = 'center center';
    setZoomState({ status: ZOOM_STATE.UNSUPPORTED, value: clamped, errorMessage: current.errorMessage });
    renderIndicator(clamped, current.mode);
    return ZOOM_STATE.UNSUPPORTED;
  } catch (err) {
    console.error('[zoomManager] Gagal menerapkan digital zoom:', err.message);
    setZoomState({ status: ZOOM_STATE.ERROR, errorMessage: 'Gagal menerapkan digital zoom.' });
    return ZOOM_STATE.ERROR;
  }
}

/**
 * Perbesar satu step dari nilai zoom saat ini.
 * @returns {Promise<string>} status akhir (ZOOM_STATE)
 */
export async function zoomIn() {
  const current = getZoomState();
  return setZoom(current.value + current.step);
}

/**
 * Perkecil satu step dari nilai zoom saat ini.
 * @returns {Promise<string>} status akhir (ZOOM_STATE)
 */
export async function zoomOut() {
  const current = getZoomState();
  return setZoom(current.value - current.step);
}

/**
 * Terapkan nilai zoom dari input slider (mis. <input type="range">).
 * Alias tipis di atas setZoom() supaya intensi pemanggilan jelas dari
 * sisi UI, tanpa duplikasi logika.
 * @param {number} rawValue nilai mentah dari slider
 * @returns {Promise<string>} status akhir (ZOOM_STATE)
 */
export async function setZoomFromSlider(rawValue) {
  return setZoom(Number(rawValue));
}

/**
 * Tampilkan indikator zoom dengan label "Nx" sesuai nilai & mode saat ini.
 * @param {number} value
 * @param {string} mode
 */
function renderIndicator(value, mode) {
  const videoEl = getPreviewElement();
  const container = videoEl ? videoEl.parentElement : null;
  if (!container) return;
  showZoomIndicator(container, `${value.toFixed(1)}x`, mode);
}

/**
 * Aktifkan gesture Pinch-to-Zoom pada container preview.
 * Aman dipanggil berulang — listener lama otomatis dilepas dulu.
 * @param {HTMLElement} container elemen pembungkus <video> preview
 */
export function enablePinchToZoom(container) {
  disablePinchToZoom(); // pastikan tidak ada listener ganda menumpuk
  if (!container) return;

  // Cegah browser melakukan native pinch-zoom/scroll pada area preview,
  // supaya gesture dua-jari sepenuhnya ditangani modul ini.
  container.style.touchAction = 'none';

  const getDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (event) => {
    if (event.touches.length !== 2) return;
    pinchStartDistance = getDistance(event.touches);
    pinchStartValue = getZoomState().value;
  };

  const onTouchMove = (event) => {
    if (event.touches.length !== 2 || pinchStartDistance === 0) return;
    event.preventDefault(); // cegah scroll/zoom halaman selama pinch
    const currentDistance = getDistance(event.touches);
    const scaleFactor = currentDistance / pinchStartDistance;
    setZoom(pinchStartValue * scaleFactor);
  };

  const onTouchEnd = (event) => {
    if (event.touches.length < 2) {
      pinchStartDistance = 0;
    }
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchEnd, { passive: true });

  pinchHandlers = { onTouchStart, onTouchMove, onTouchEnd };
  pinchListenerEl = container;
}

/**
 * Lepas listener Pinch-to-Zoom. Dipanggil otomatis saat kamera
 * ditutup/error, tapi bisa juga dipanggil manual.
 */
export function disablePinchToZoom() {
  if (pinchListenerEl && pinchHandlers) {
    pinchListenerEl.removeEventListener('touchstart', pinchHandlers.onTouchStart);
    pinchListenerEl.removeEventListener('touchmove', pinchHandlers.onTouchMove);
    pinchListenerEl.removeEventListener('touchend', pinchHandlers.onTouchEnd);
    pinchListenerEl.removeEventListener('touchcancel', pinchHandlers.onTouchEnd);
    pinchListenerEl.style.touchAction = '';
  }
  pinchListenerEl = null;
  pinchHandlers = null;
  pinchStartDistance = 0;
}

// Sinkronisasi otomatis dengan siklus hidup Camera Engine:
// - Saat preview aktif → deteksi kapabilitas zoom & pasang pinch gesture.
// - Saat kamera ditutup/error → lepas listener & reset state zoom,
//   supaya tidak ada listener menggantung atau state basi dari sesi lama.
onCameraStateChange((state) => {
  if (state.status === CAMERA_STATE.PREVIEWING) {
    initZoomForActiveSession();
    const videoEl = getPreviewElement();
    const container = videoEl ? videoEl.parentElement : null;
    if (container) enablePinchToZoom(container);
  } else if (state.status === CAMERA_STATE.CLOSED || state.status === CAMERA_STATE.ERROR) {
    disablePinchToZoom();
    hideZoomIndicator();
    setZoomState({
      status: ZOOM_STATE.IDLE,
      mode: ZOOM_MODE.NONE,
      value: 1,
      min: 1,
      max: 1,
      step: 0.1,
      errorMessage: null,
    });
  }
});
