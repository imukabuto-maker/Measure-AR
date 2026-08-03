/**
 * cameraResolutionManager.js
 * ---------------------------------------------------------------
 * Modul khusus manajemen resolusi kamera.
 * Tanggung jawab: menyediakan preset resolusi, membangun constraint
 * width/height untuk dikirim ke Camera Engine (lewat opsi width/height
 * yang sudah diintegrasikan ke openCamera() di Sprint 10), dan membaca
 * resolusi AKTUAL yang benar-benar diberikan browser via
 * `track.getSettings()` — karena iOS Safari sering tidak memberikan
 * persis resolusi yang diminta.
 *
 * TIDAK membuka/menutup stream sendiri — itu tetap tanggung jawab
 * Camera Engine (dipanggil lewat cameraSessionManager.js).
 * ---------------------------------------------------------------
 */

import { getActiveVideoTrack } from './cameraManager.js';

// Preset resolusi umum. 'ideal' (bukan 'exact') supaya browser bebas
// memilih nilai terdekat yang didukung hardware — mencegah getUserMedia
// gagal total hanya karena resolusi persis tidak tersedia.
export const RESOLUTION_PRESET = Object.freeze({
  HIGH: { label: 'high', width: 1920, height: 1080 },
  MEDIUM: { label: 'medium', width: 1280, height: 720 },
  LOW: { label: 'low', width: 640, height: 480 },
});

const state = {
  presetLabel: RESOLUTION_PRESET.HIGH.label,
  requested: { width: RESOLUTION_PRESET.HIGH.width, height: RESOLUTION_PRESET.HIGH.height },
  actual: { width: 0, height: 0 }, // diisi setelah stream benar-benar terbuka
};

const listeners = new Set();

/**
 * Ambil salinan state resolusi saat ini.
 * @returns {{presetLabel:string, requested:{width:number,height:number}, actual:{width:number,height:number}}}
 */
export function getResolutionState() {
  return {
    presetLabel: state.presetLabel,
    requested: { ...state.requested },
    actual: { ...state.actual },
  };
}

/**
 * Daftarkan listener yang dipanggil setiap kali state resolusi berubah.
 * @param {(state: ReturnType<typeof getResolutionState>) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 */
export function onResolutionStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  const snapshot = getResolutionState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      console.error('[cameraResolutionManager] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Pilih preset resolusi yang akan dipakai pada `startSession()`/
 * `resumeSession()` berikutnya. Tidak langsung menerapkan ke stream
 * yang sedang berjalan — untuk mengganti resolusi stream aktif,
 * buka ulang sesi lewat cameraSessionManager.js.
 * @param {{label:string, width:number, height:number}} preset salah satu RESOLUTION_PRESET
 */
export function setResolutionPreset(preset) {
  if (!preset || typeof preset.width !== 'number' || typeof preset.height !== 'number') {
    throw new Error('[cameraResolutionManager] Preset resolusi tidak valid');
  }
  state.presetLabel = preset.label ?? 'custom';
  state.requested = { width: preset.width, height: preset.height };
  notifyListeners();
}

/**
 * Bangun object constraint `{width, height}` sesuai preset yang
 * sedang dipilih, untuk dioper ke `cameraManager.openCamera(container, {...})`.
 * @returns {{width:number, height:number}}
 */
export function buildResolutionConstraints() {
  return { ...state.requested };
}

/**
 * Baca resolusi AKTUAL dari video track yang sedang aktif via
 * `track.getSettings()`, dan simpan ke state. Aman dipanggil kapan
 * pun (mis. setelah openCamera() sukses, atau setelah orientasi
 * berubah) — tidak melempar error jika track/API tidak tersedia.
 * @returns {{width:number, height:number}} resolusi aktual (0×0 jika tidak diketahui)
 */
export function refreshActualResolution() {
  const track = getActiveVideoTrack();
  if (!track || typeof track.getSettings !== 'function') {
    state.actual = { width: 0, height: 0 };
    notifyListeners();
    return { ...state.actual };
  }

  try {
    const settings = track.getSettings();
    state.actual = {
      width: settings.width ?? 0,
      height: settings.height ?? 0,
    };
  } catch (err) {
    console.warn('[cameraResolutionManager] Gagal membaca getSettings():', err.message);
    state.actual = { width: 0, height: 0 };
  }

  notifyListeners();
  return { ...state.actual };
}
