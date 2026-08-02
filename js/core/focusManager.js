/**
 * focusManager.js
 * ---------------------------------------------------------------
 * Facade / orkestrator Focus Manager (Sprint 6).
 * Tanggung jawab: Tap-to-Focus, Focus Lock/Unlock, deteksi
 * kapabilitas fokus, dan indikator visual SAJA.
 * Tidak ada zoom/exposure/measurement/calibration di sini.
 *
 * PENTING: modul ini MEMAKAI ULANG Camera Engine yang sudah ada
 * (Sprint 5) lewat getActiveVideoTrack()/getPreviewElement() —
 * tidak membangun ulang Camera Engine.
 * ---------------------------------------------------------------
 */

import {
  getActiveVideoTrack,
  getPreviewElement,
  onCameraStateChange,
  CAMERA_STATE,
} from './cameraManager.js';
import {
  FOCUS_STATE,
  getFocusState,
  setFocusState,
  onFocusStateChange,
} from './focusState.js';
import {
  showFocusIndicator,
  updateFocusIndicatorState,
  hideFocusIndicator,
} from '../ui/focusIndicator.js';

// Re-export supaya modul lain cukup import dari satu pintu (focusManager)
export { FOCUS_STATE, getFocusState, onFocusStateChange };

// Referensi listener tap aktif — privat, dikontrol lewat enable/disableTapToFocus
let tapListenerEl = null;
let tapHandlerRef = null;
let hideTimer = null;

// Cache hasil deteksi kapabilitas fokus untuk stream aktif saat ini
let capabilities = null;

/**
 * Baca kapabilitas fokus dari video track aktif via getCapabilities().
 * API ini tidak didukung semua browser (khususnya Safari iOS saat ini
 * umumnya TIDAK mendukung kontrol focusMode manual) — fungsi ini
 * selalu mengembalikan objek aman meski API/atribut tidak tersedia.
 * @returns {{supportsManualFocus:boolean, supportsContinuous:boolean, modes:string[]}}
 */
function detectFocusCapabilities() {
  const track = getActiveVideoTrack();
  if (!track || typeof track.getCapabilities !== 'function') {
    return { supportsManualFocus: false, supportsContinuous: false, modes: [] };
  }

  try {
    const caps = track.getCapabilities();
    const modes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
    return {
      supportsManualFocus: modes.includes('manual') || modes.includes('single-shot'),
      supportsContinuous: modes.includes('continuous'),
      modes,
    };
  } catch (err) {
    console.warn('[focusManager] Gagal membaca focus capabilities:', err.message);
    return { supportsManualFocus: false, supportsContinuous: false, modes: [] };
  }
}

/**
 * Aktifkan Tap-to-Focus pada container preview yang sedang tampil.
 * Aman dipanggil berulang — listener lama otomatis dilepas dulu.
 * @param {HTMLElement} container elemen pembungkus <video> preview
 */
export function enableTapToFocus(container) {
  disableTapToFocus(); // pastikan tidak ada listener ganda menumpuk
  if (!container) return;

  capabilities = detectFocusCapabilities();

  tapHandlerRef = (event) => {
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const point = event.touches && event.touches[0] ? event.touches[0] : event;
    const x = (point.clientX - rect.left) / rect.width;
    const y = (point.clientY - rect.top) / rect.height;

    // Abaikan tap di luar batas container (mis. event bubbling tak terduga)
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    focusAt(container, x, y);
  };

  container.addEventListener('click', tapHandlerRef);
  tapListenerEl = container;
}

/**
 * Lepas listener Tap-to-Focus. Dipanggil otomatis saat kamera
 * ditutup/error, tapi bisa juga dipanggil manual.
 */
export function disableTapToFocus() {
  if (tapListenerEl && tapHandlerRef) {
    tapListenerEl.removeEventListener('click', tapHandlerRef);
  }
  tapListenerEl = null;
  tapHandlerRef = null;
}

/**
 * Picu proses fokus pada titik (x, y) dalam koordinat ternormalisasi (0-1).
 * Jika browser tidak mendukung kontrol fokus manual, indikator tetap
 * ditampilkan (feedback visual) dan status diset UNSUPPORTED dengan
 * pesan informatif — TIDAK melempar error, autofocus bawaan browser
 * tetap bekerja seperti biasa.
 * @param {HTMLElement} container
 * @param {number} x
 * @param {number} y
 * @returns {Promise<string>} status akhir (salah satu nilai FOCUS_STATE)
 */
export async function focusAt(container, x, y) {
  const track = getActiveVideoTrack();

  showFocusIndicator(container, x, y);
  setFocusState({ status: FOCUS_STATE.FOCUSING, point: { x, y }, errorMessage: null });
  updateFocusIndicatorState(FOCUS_STATE.FOCUSING);

  if (!track || !capabilities || !capabilities.supportsManualFocus) {
    setFocusState({
      status: FOCUS_STATE.UNSUPPORTED,
      errorMessage: 'Kontrol fokus manual tidak didukung browser ini — menggunakan autofocus bawaan.',
    });
    updateFocusIndicatorState(FOCUS_STATE.UNSUPPORTED);
    scheduleHideIndicator();
    return FOCUS_STATE.UNSUPPORTED;
  }

  try {
    const focusMode = capabilities.modes.includes('single-shot') ? 'single-shot' : 'manual';
    await track.applyConstraints({
      advanced: [{ focusMode, pointsOfInterest: [{ x, y }] }],
    });
    setFocusState({ status: FOCUS_STATE.FOCUSED, errorMessage: null });
    updateFocusIndicatorState(FOCUS_STATE.FOCUSED);
    scheduleHideIndicator();
    return FOCUS_STATE.FOCUSED;
  } catch (err) {
    console.error('[focusManager] Gagal fokus ke titik:', err.message);
    setFocusState({ status: FOCUS_STATE.ERROR, errorMessage: 'Gagal memproses fokus pada titik tersebut.' });
    updateFocusIndicatorState(FOCUS_STATE.ERROR);
    scheduleHideIndicator();
    return FOCUS_STATE.ERROR;
  }
}

/**
 * Kunci fokus pada titik saat ini (Focus Lock). Jika belum pernah tap,
 * mengunci pada titik tengah frame (0.5, 0.5).
 * @returns {Promise<string>} status akhir (FOCUS_STATE)
 */
export async function lockFocus() {
  const track = getActiveVideoTrack();

  if (!track || !capabilities || !capabilities.supportsManualFocus) {
    setFocusState({
      status: FOCUS_STATE.UNSUPPORTED,
      errorMessage: 'Focus lock tidak didukung browser ini.',
    });
    return FOCUS_STATE.UNSUPPORTED;
  }

  try {
    const current = getFocusState();
    const point = current.point || { x: 0.5, y: 0.5 };
    await track.applyConstraints({
      advanced: [{ focusMode: 'manual', pointsOfInterest: [point] }],
    });
    setFocusState({ status: FOCUS_STATE.LOCKED, locked: true, point, errorMessage: null });
    updateFocusIndicatorState(FOCUS_STATE.LOCKED);
    return FOCUS_STATE.LOCKED;
  } catch (err) {
    console.error('[focusManager] Gagal mengunci fokus:', err.message);
    setFocusState({ status: FOCUS_STATE.ERROR, errorMessage: 'Gagal mengaktifkan focus lock.' });
    updateFocusIndicatorState(FOCUS_STATE.ERROR);
    return FOCUS_STATE.ERROR;
  }
}

/**
 * Lepas Focus Lock, kembalikan ke continuous autofocus jika didukung.
 * @returns {Promise<string>} status akhir (FOCUS_STATE)
 */
export async function unlockFocus() {
  const track = getActiveVideoTrack();

  if (!track || !capabilities) {
    setFocusState({ status: FOCUS_STATE.IDLE, locked: false, errorMessage: null });
    hideFocusIndicator();
    return FOCUS_STATE.IDLE;
  }

  try {
    if (capabilities.supportsContinuous) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    }
    setFocusState({ status: FOCUS_STATE.IDLE, locked: false, errorMessage: null });
    hideFocusIndicator();
    return FOCUS_STATE.IDLE;
  } catch (err) {
    console.error('[focusManager] Gagal melepas focus lock:', err.message);
    setFocusState({ status: FOCUS_STATE.ERROR, errorMessage: 'Gagal melepas focus lock.' });
    return FOCUS_STATE.ERROR;
  }
}

/** Jadwalkan indikator hilang otomatis, kecuali sedang dalam status locked. */
function scheduleHideIndicator() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    const current = getFocusState();
    if (!current.locked) hideFocusIndicator();
  }, 1000);
}

// Sinkronisasi otomatis dengan siklus hidup Camera Engine:
// - Saat preview aktif → pasang Tap-to-Focus otomatis di container preview.
// - Saat kamera ditutup/error → lepas listener & reset state fokus,
//   supaya tidak ada listener menggantung atau state basi dari sesi lama.
onCameraStateChange((state) => {
  if (state.status === CAMERA_STATE.PREVIEWING) {
    const previewEl = getPreviewElement();
    const container = previewEl ? previewEl.parentElement : null;
    if (container) enableTapToFocus(container);
  } else if (state.status === CAMERA_STATE.CLOSED || state.status === CAMERA_STATE.ERROR) {
    disableTapToFocus();
    hideFocusIndicator();
    capabilities = null;
    setFocusState({ status: FOCUS_STATE.IDLE, point: null, locked: false, errorMessage: null });
  }
});
