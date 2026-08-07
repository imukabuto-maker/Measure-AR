/**
 * calibrationEngine.js
 * ---------------------------------------------------------------
 * Facade Calibration Engine (Sprint 14).
 *
 * ALUR: startCalibration() → user tap 2 titik di preview
 * (calibrationSession.js) → computeCalibration() menghitung
 * pixel-per-unit (calibrationMath.js) + validasi
 * (calibrationValidator.js) → saveCalibrationResult() menyimpan ke
 * Calibration Profile AKTIF lewat calibrationProfileManager.js
 * (Repository Pattern — TIDAK PERNAH menyentuh IndexedDB langsung).
 *
 * TIDAK membangun Measurement Engine, TIDAK membangun OpenCV, TIDAK
 * ada deteksi tepi otomatis — murni orkestrasi kalibrasi manual.
 * TIDAK ADA perubahan pada Camera Core — hanya memakai ulang
 * getPreviewElement() (lewat calibrationSession.js).
 * ---------------------------------------------------------------
 */

import {
  SESSION_STATE,
  getSessionState,
  onSessionStateChange,
  startPointSelection,
  resetPointSelection,
} from './calibrationSession.js';
import { calculatePixelDistance, calculatePixelPerUnit } from '../utils/calibrationMath.js';
import {
  CALIBRATION_QUALITY,
  validateReferenceLength,
  validatePoints,
  assessCalibrationQuality,
} from '../utils/calibrationValidator.js';
import { getActiveProfile, editProfile } from './calibrationProfileManager.js';
import { getPreviewElement } from './cameraManager.js';

// Re-export supaya modul lain cukup import dari satu pintu (calibrationEngine)
export { SESSION_STATE, CALIBRATION_QUALITY, getSessionState, onSessionStateChange };

/** Status proses kalibrasi tingkat-engine (berbeda dari SESSION_STATE — ini level lebih tinggi, mencakup hitung & simpan). */
export const ENGINE_STATE = Object.freeze({
  IDLE: 'idle',
  SELECTING_POINTS: 'selecting_points',
  COMPUTED: 'computed', // hasil sudah dihitung, belum disimpan
  SAVED: 'saved',        // hasil sudah tersimpan ke Calibration Profile
  ERROR: 'error',
});

let engineState = { status: ENGINE_STATE.IDLE, result: null, errorMessage: null };
const engineListeners = new Set();

function setEngineState(partial) {
  engineState = { ...engineState, ...partial };
  engineListeners.forEach((callback) => {
    try {
      callback({ ...engineState });
    } catch (err) {
      console.error('[calibrationEngine] Listener gagal dijalankan:', err.message);
    }
  });
}

/** Ambil salinan state engine saat ini. */
export function getEngineState() {
  return { ...engineState };
}

/**
 * Daftarkan listener yang dipanggil setiap kali state engine berubah.
 * @param {(state: ReturnType<typeof getEngineState>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onEngineStateChange(callback) {
  engineListeners.add(callback);
  return () => engineListeners.delete(callback);
}

/**
 * Mulai sesi kalibrasi baru: pastikan ada Calibration Profile aktif,
 * lalu mulai pemilihan 2 titik referensi pada preview kamera.
 * @throws {Error} code 'no_active_profile' jika belum ada profil dipilih,
 *                 atau error dari startPointSelection() jika kamera belum terbuka
 */
export function startCalibration() {
  const profile = getActiveProfile();
  if (!profile) {
    const error = new Error('Tidak ada Calibration Profile aktif — pilih profil terlebih dahulu.');
    error.code = 'no_active_profile';
    setEngineState({ status: ENGINE_STATE.ERROR, errorMessage: error.message });
    throw error;
  }

  startPointSelection(); // bisa throw 'no_preview' — dibiarkan menjalar ke pemanggil
  setEngineState({ status: ENGINE_STATE.SELECTING_POINTS, result: null, errorMessage: null });
}

/** Batalkan sesi kalibrasi yang sedang berjalan (reset titik & listener tap). */
export function cancelCalibration() {
  resetPointSelection();
  setEngineState({ status: ENGINE_STATE.IDLE, result: null, errorMessage: null });
}

/**
 * Hitung pixel-per-unit dari 2 titik yang sudah dipilih user + panjang
 * referensi yang diinput, lalu validasi hasilnya. BELUM menyimpan ke
 * database — panggil saveCalibrationResult() terpisah supaya user
 * bisa melihat ringkasan dulu sebelum memutuskan menyimpan.
 * @param {{referenceLength:number|string, referenceUnit:string}} input
 * @returns {{pixelPerUnit:number, pixelDistance:number, referenceLength:number, referenceUnit:string, calibrationQuality:string, timestamp:string}}
 * @throws {Error} code 'points_incomplete' atau 'validation_error'
 */
export function computeCalibration(input) {
  const session = getSessionState();
  if (session.status !== SESSION_STATE.READY) {
    const error = new Error('Dua titik referensi belum lengkap dipilih.');
    error.code = 'points_incomplete';
    throw error;
  }

  const lengthCheck = validateReferenceLength(input.referenceLength, input.referenceUnit);
  if (!lengthCheck.valid) {
    const error = new Error(lengthCheck.errors.join(' '));
    error.code = 'validation_error';
    setEngineState({ status: ENGINE_STATE.ERROR, errorMessage: error.message });
    throw error;
  }

  const pointsCheck = validatePoints(session.pointA, session.pointB);
  if (!pointsCheck.valid) {
    const error = new Error(pointsCheck.errors.join(' '));
    error.code = 'validation_error';
    setEngineState({ status: ENGINE_STATE.ERROR, errorMessage: error.message });
    throw error;
  }

  const pixelDistance = calculatePixelDistance(session.pointA, session.pointB);
  const pixelPerUnit = calculatePixelPerUnit(pixelDistance, lengthCheck.value);

  const video = getPreviewElement();
  const frameDiagonal = video ? Math.sqrt(video.videoWidth ** 2 + video.videoHeight ** 2) : 0;
  const calibrationQuality = assessCalibrationQuality(pixelDistance, frameDiagonal);

  const result = {
    pixelPerUnit,
    pixelDistance,
    referenceLength: lengthCheck.value,
    referenceUnit: input.referenceUnit,
    calibrationQuality,
    timestamp: new Date().toISOString(),
  };

  setEngineState({ status: ENGINE_STATE.COMPUTED, result, errorMessage: null });
  return result;
}

/**
 * Simpan hasil kalibrasi (dari computeCalibration()) ke Calibration
 * Profile yang sedang aktif — lewat calibrationProfileManager.editProfile()
 * (Repository Layer), BUKAN akses database langsung.
 * @param {{notes?:string, cameraHeight?:number}} [extra] field opsional tambahan
 * @returns {Promise<object>} record Calibration Profile setelah diperbarui
 * @throws {Error} code 'no_result' atau 'no_active_profile'
 */
export async function saveCalibrationResult(extra = {}) {
  if (engineState.status !== ENGINE_STATE.COMPUTED || !engineState.result) {
    const error = new Error('Belum ada hasil kalibrasi untuk disimpan.');
    error.code = 'no_result';
    throw error;
  }

  const profile = getActiveProfile();
  if (!profile) {
    const error = new Error('Tidak ada Calibration Profile aktif.');
    error.code = 'no_active_profile';
    throw error;
  }

  const video = getPreviewElement();
  const orientation = video && video.videoWidth < video.videoHeight ? 'portrait' : 'landscape';

  const patch = {
    pixelPerUnit: engineState.result.pixelPerUnit,
    referenceLength: engineState.result.referenceLength,
    referenceUnit: engineState.result.referenceUnit,
    orientation,
    calibrationQuality: engineState.result.calibrationQuality,
    notes: extra.notes ?? profile.notes,
    cameraHeight: extra.cameraHeight != null ? Number(extra.cameraHeight) : profile.cameraHeight,
  };

  // editProfile() otomatis mengisi updatedAt = waktu simpan sekarang,
  // yang berfungsi sebagai "timestamp" hasil kalibrasi ini.
  const updated = await editProfile(profile.id, patch);

  setEngineState({ status: ENGINE_STATE.SAVED, errorMessage: null });
  resetPointSelection();
  return updated;
}
