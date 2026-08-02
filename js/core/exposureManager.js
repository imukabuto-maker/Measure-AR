/**
 * exposureManager.js
 * ---------------------------------------------------------------
 * Facade / orkestrator Exposure Manager (Sprint 8).
 * Tanggung jawab: Exposure Compensation, Exposure Lock/Unlock,
 * deteksi kapabilitas exposure hardware, dan indikator visual SAJA.
 * Tidak ada overlay/measurement/calibration di sini.
 *
 * PENTING: modul ini MEMAKAI ULANG Camera Engine yang sudah ada
 * (Sprint 5) lewat getActiveVideoTrack()/getPreviewElement() —
 * TIDAK ada perubahan pada cameraManager.js untuk sprint ini,
 * getter yang dibutuhkan sudah tersedia sejak Sprint 6.
 *
 * MEKANISME FALLBACK:
 * Jika track.getCapabilities() tidak melaporkan 'exposureCompensation'
 * atau 'exposureMode' (kondisi UMUM di iOS Safari — lihat Browser
 * Compatibility Report), modul ini TIDAK mensimulasikan efek apa pun
 * (tidak ada filter CSS palsu). Sesuai rule sprint ini: cukup
 * tampilkan informasi ke pengguna dan biarkan auto exposure bawaan
 * kamera bekerja seperti biasa — tidak ada perilaku yang bisa
 * menyesatkan pengguna seolah exposure benar-benar berubah.
 * ---------------------------------------------------------------
 */

import {
  getActiveVideoTrack,
  getPreviewElement,
  onCameraStateChange,
  CAMERA_STATE,
} from './cameraManager.js';
import {
  EXPOSURE_STATE,
  EXPOSURE_MODE,
  getExposureState,
  setExposureState,
  onExposureStateChange,
} from './exposureState.js';
import { showExposureIndicator, hideExposureIndicator } from '../ui/exposureIndicator.js';

// Re-export supaya modul lain cukup import dari satu pintu (exposureManager)
export { EXPOSURE_STATE, EXPOSURE_MODE, getExposureState, onExposureStateChange };

// Cache hasil deteksi kapabilitas exposure untuk stream aktif saat ini
let capabilities = null;

/**
 * Baca kapabilitas exposure dari video track aktif via getCapabilities().
 * TIDAK PERNAH melempar error ke pemanggil — selalu mengembalikan
 * objek aman meski API/atribut tidak tersedia.
 * @returns {{supportsCompensation:boolean, supportsLock:boolean, min:number, max:number, step:number, modes:string[]}}
 */
function detectExposureCapabilities() {
  const track = getActiveVideoTrack();
  if (!track || typeof track.getCapabilities !== 'function') {
    return { supportsCompensation: false, supportsLock: false, min: 0, max: 0, step: 0.1, modes: [] };
  }

  try {
    const caps = track.getCapabilities();
    const modes = Array.isArray(caps.exposureMode) ? caps.exposureMode : [];
    const comp = caps.exposureCompensation;

    return {
      supportsCompensation: typeof comp === 'object' && comp !== null,
      supportsLock: modes.includes('manual') && modes.includes('continuous'),
      min: comp?.min ?? 0,
      max: comp?.max ?? 0,
      step: comp?.step ?? 0.1,
      modes,
    };
  } catch (err) {
    console.warn('[exposureManager] Gagal membaca exposure capabilities:', err.message);
    return { supportsCompensation: false, supportsLock: false, min: 0, max: 0, step: 0.1, modes: [] };
  }
}

/**
 * Inisialisasi Exposure Manager untuk sesi kamera aktif saat ini:
 * deteksi kapabilitas & reset state ke titik awal. Dipanggil otomatis
 * saat kamera masuk status PREVIEWING.
 */
function initExposureForActiveSession() {
  capabilities = detectExposureCapabilities();
  const supported = capabilities.supportsCompensation || capabilities.supportsLock;

  setExposureState({
    status: supported ? EXPOSURE_STATE.IDLE : EXPOSURE_STATE.UNSUPPORTED,
    mode: supported ? EXPOSURE_MODE.HARDWARE : EXPOSURE_MODE.NONE,
    locked: false,
    compensation: 0,
    min: capabilities.min,
    max: capabilities.max,
    step: capabilities.step,
    errorMessage: supported
      ? null
      : 'Kontrol exposure tidak didukung browser ini — menggunakan auto exposure bawaan kamera.',
  });

  if (!supported) {
    const videoEl = getPreviewElement();
    const container = videoEl ? videoEl.parentElement : null;
    if (container) showExposureIndicator(container, 'Auto (bawaan)');
  }
}

/**
 * Terapkan nilai exposure compensation baru (di-clamp ke rentang
 * min-max hasil deteksi kapabilitas). Jika tidak didukung, TIDAK
 * melakukan apa pun pada video — hanya memperbarui state/indikator
 * dengan pesan informatif, sesuai aturan fallback sprint ini.
 * @param {number} value nilai EV yang diinginkan
 * @returns {Promise<string>} status akhir (salah satu nilai EXPOSURE_STATE)
 */
export async function setExposureCompensation(value) {
  const current = getExposureState();

  if (!capabilities || !capabilities.supportsCompensation) {
    setExposureState({
      status: EXPOSURE_STATE.UNSUPPORTED,
      errorMessage: 'Exposure compensation tidak didukung browser ini — auto exposure bawaan tetap aktif.',
    });
    renderIndicator('Auto (bawaan)', false);
    return EXPOSURE_STATE.UNSUPPORTED;
  }

  const track = getActiveVideoTrack();
  if (!track) {
    setExposureState({ status: EXPOSURE_STATE.ERROR, errorMessage: 'Kamera tidak aktif.' });
    return EXPOSURE_STATE.ERROR;
  }

  const clamped = Math.min(current.max, Math.max(current.min, value));
  setExposureState({ status: EXPOSURE_STATE.ADJUSTING, errorMessage: null });

  try {
    await track.applyConstraints({ advanced: [{ exposureCompensation: clamped }] });
    setExposureState({ status: EXPOSURE_STATE.IDLE, compensation: clamped, errorMessage: null });
    renderIndicator(formatEvLabel(clamped), false);
    return EXPOSURE_STATE.IDLE;
  } catch (err) {
    console.error('[exposureManager] Gagal menerapkan exposure compensation:', err.message);
    setExposureState({ status: EXPOSURE_STATE.ERROR, errorMessage: 'Gagal menerapkan exposure compensation.' });
    return EXPOSURE_STATE.ERROR;
  }
}

/**
 * Kunci exposure pada kondisi pencahayaan saat ini (Exposure Lock),
 * lewat exposureMode: 'manual'. Jika tidak didukung, TIDAK melempar
 * error — status diset UNSUPPORTED dengan pesan informatif.
 * @returns {Promise<string>} status akhir (EXPOSURE_STATE)
 */
export async function lockExposure() {
  if (!capabilities || !capabilities.supportsLock) {
    setExposureState({
      status: EXPOSURE_STATE.UNSUPPORTED,
      errorMessage: 'Exposure lock tidak didukung browser ini.',
    });
    return EXPOSURE_STATE.UNSUPPORTED;
  }

  const track = getActiveVideoTrack();
  if (!track) {
    setExposureState({ status: EXPOSURE_STATE.ERROR, errorMessage: 'Kamera tidak aktif.' });
    return EXPOSURE_STATE.ERROR;
  }

  try {
    await track.applyConstraints({ advanced: [{ exposureMode: 'manual' }] });
    setExposureState({ status: EXPOSURE_STATE.LOCKED, locked: true, errorMessage: null });
    renderIndicator('Terkunci (AE Lock)', true);
    return EXPOSURE_STATE.LOCKED;
  } catch (err) {
    console.error('[exposureManager] Gagal mengunci exposure:', err.message);
    setExposureState({ status: EXPOSURE_STATE.ERROR, errorMessage: 'Gagal mengaktifkan exposure lock.' });
    return EXPOSURE_STATE.ERROR;
  }
}

/**
 * Lepas Exposure Lock, kembalikan ke exposureMode: 'continuous'
 * (auto exposure) jika didukung.
 * @returns {Promise<string>} status akhir (EXPOSURE_STATE)
 */
export async function unlockExposure() {
  if (!capabilities || !capabilities.supportsLock) {
    setExposureState({ status: EXPOSURE_STATE.IDLE, locked: false, errorMessage: null });
    hideExposureIndicator();
    return EXPOSURE_STATE.IDLE;
  }

  const track = getActiveVideoTrack();
  if (!track) {
    setExposureState({ status: EXPOSURE_STATE.ERROR, errorMessage: 'Kamera tidak aktif.' });
    return EXPOSURE_STATE.ERROR;
  }

  try {
    await track.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] });
    setExposureState({ status: EXPOSURE_STATE.IDLE, locked: false, errorMessage: null });
    hideExposureIndicator();
    return EXPOSURE_STATE.IDLE;
  } catch (err) {
    console.error('[exposureManager] Gagal melepas exposure lock:', err.message);
    setExposureState({ status: EXPOSURE_STATE.ERROR, errorMessage: 'Gagal melepas exposure lock.' });
    return EXPOSURE_STATE.ERROR;
  }
}

/** Format angka EV jadi label bertanda, mis. 0.3 → "+0.3 EV". */
function formatEvLabel(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} EV`;
}

/**
 * Tampilkan indikator exposure dengan label saat ini.
 * @param {string} label
 * @param {boolean} persist
 */
function renderIndicator(label, persist) {
  const videoEl = getPreviewElement();
  const container = videoEl ? videoEl.parentElement : null;
  if (!container) return;
  showExposureIndicator(container, label, persist);
}

// Sinkronisasi otomatis dengan siklus hidup Camera Engine:
// - Saat preview aktif → deteksi kapabilitas exposure.
// - Saat kamera ditutup/error → reset state exposure & sembunyikan
//   indikator, supaya tidak ada state basi dari sesi kamera lama.
onCameraStateChange((state) => {
  if (state.status === CAMERA_STATE.PREVIEWING) {
    initExposureForActiveSession();
  } else if (state.status === CAMERA_STATE.CLOSED || state.status === CAMERA_STATE.ERROR) {
    hideExposureIndicator();
    capabilities = null;
    setExposureState({
      status: EXPOSURE_STATE.IDLE,
      mode: EXPOSURE_MODE.NONE,
      locked: false,
      compensation: 0,
      min: 0,
      max: 0,
      step: 0.1,
      errorMessage: null,
    });
  }
});
