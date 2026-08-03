/**
 * cameraLifecycleManager.js
 * ---------------------------------------------------------------
 * Facade / orkestrator Camera Lifecycle Manager (Sprint 10).
 * Menggabungkan cameraSessionManager.js, cameraResolutionManager.js,
 * dan cameraOrientationManager.js menjadi satu API sederhana untuk
 * dipakai modul lain (Calibration Engine dst) — sama seperti pola
 * permissionManager.js sebagai facade Permission Manager.
 *
 * TIDAK ADA logika baru di sini selain pengaturan/wiring — setiap
 * pekerjaan sesungguhnya didelegasikan ke 3 modul di atas, masing-
 * masing dengan Single Responsibility sendiri.
 * ---------------------------------------------------------------
 */

import {
  SESSION_STATE,
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getSessionState,
  onSessionStateChange,
} from './cameraSessionManager.js';
import {
  RESOLUTION_PRESET,
  setResolutionPreset,
  buildResolutionConstraints,
  refreshActualResolution,
  getResolutionState,
  onResolutionStateChange,
} from './cameraResolutionManager.js';
import {
  ORIENTATION,
  getOrientation,
  onOrientationChange,
  initOrientationTracking,
} from './cameraOrientationManager.js';

// Re-export supaya modul lain cukup import dari satu pintu (cameraLifecycleManager)
export {
  SESSION_STATE,
  RESOLUTION_PRESET,
  ORIENTATION,
  getSessionState,
  onSessionStateChange,
  getResolutionState,
  onResolutionStateChange,
  getOrientation,
  onOrientationChange,
};

/**
 * Mulai sesi kamera dengan resolusi sesuai preset yang sedang dipilih
 * (default: `RESOLUTION_PRESET.HIGH`). Membaca resolusi aktual setelah
 * stream terbuka.
 * @param {HTMLElement} container
 * @param {Object} [options]
 * @param {'environment'|'user'} [options.facingMode]
 * @param {{label:string,width:number,height:number}} [options.resolutionPreset] override preset resolusi
 * @returns {Promise<{success:boolean, error?:object}>}
 */
export async function startCameraLifecycle(container, options = {}) {
  if (options.resolutionPreset) {
    setResolutionPreset(options.resolutionPreset);
  }

  const { width, height } = buildResolutionConstraints();
  const result = await startSession(container, {
    facingMode: options.facingMode ?? 'environment',
    width,
    height,
  });

  if (result.success) {
    refreshActualResolution();
  }
  return result;
}

/**
 * Jeda sesi kamera secara manual (lihat cameraSessionManager.pauseSession).
 */
export function pauseCameraLifecycle() {
  pauseSession();
}

/**
 * Lanjutkan sesi kamera yang dijeda, lalu baca ulang resolusi aktual.
 * @returns {Promise<{success:boolean, error?:object}>}
 */
export async function resumeCameraLifecycle() {
  const result = await resumeSession();
  if (result.success) {
    refreshActualResolution();
  }
  return result;
}

/**
 * Hentikan sesi kamera sepenuhnya (lihat cameraSessionManager.stopSession).
 */
export function stopCameraLifecycle() {
  stopSession();
}

// Saat orientasi berubah, browser terkadang melaporkan width/height
// video track tertukar — baca ulang resolusi aktual supaya modul lain
// (mis. Calibration Engine nanti) selalu punya data resolusi yang benar,
// TANPA membuka ulang stream atau menghitung ukuran apa pun di sini.
onOrientationChange(() => {
  if (getSessionState().status === SESSION_STATE.ACTIVE) {
    refreshActualResolution();
  }
});

// Pastikan pemantauan orientasi aktif begitu modul ini dimuat, supaya
// pemanggil tidak perlu memanggil initOrientationTracking() manual.
initOrientationTracking();
