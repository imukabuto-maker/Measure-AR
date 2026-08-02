/**
 * exposureState.js
 * ---------------------------------------------------------------
 * Modul state management untuk Exposure Manager.
 * Tanggung jawab TUNGGAL: menyimpan status & nilai exposure saat
 * ini di memori, dan menyediakan mekanisme subscribe untuk modul
 * lain (mis. UI indikator/slider).
 *
 * Pola sama persis dengan zoomState.js / focusState.js agar
 * konsisten di seluruh codebase.
 * ---------------------------------------------------------------
 */

// Kemungkinan status exposure yang valid
export const EXPOSURE_STATE = Object.freeze({
  IDLE: 'idle',               // auto exposure aktif, belum ada aksi manual
  ADJUSTING: 'adjusting',     // sedang menerapkan perubahan exposure compensation
  LOCKED: 'locked',           // exposure lock aktif (exposureMode: 'manual')
  UNSUPPORTED: 'unsupported', // kontrol exposure hardware tidak tersedia
  ERROR: 'error',             // gagal menerapkan exposure
});

// Mode kontrol exposure: 'hardware' (via track.applyConstraints) atau
// 'none' (browser tidak mendukung sama sekali — auto exposure bawaan dipakai)
export const EXPOSURE_MODE = Object.freeze({
  HARDWARE: 'hardware',
  NONE: 'none',
});

// State internal — tidak diekspor langsung agar tidak dimutasi dari luar
const state = {
  status: EXPOSURE_STATE.IDLE,
  mode: EXPOSURE_MODE.NONE,
  locked: false,
  compensation: 0,  // nilai exposure compensation saat ini (EV)
  min: 0,
  max: 0,
  step: 0.1,
  errorMessage: null,
};

const listeners = new Set();

/**
 * Ambil salinan state exposure saat ini (bukan referensi langsung).
 * @returns {{status:string, mode:string, locked:boolean, compensation:number, min:number, max:number, step:number, errorMessage:string|null}}
 */
export function getExposureState() {
  return { ...state };
}

/**
 * Perbarui sebagian state exposure dan beri tahu semua listener.
 * @param {Partial<typeof state>} partial
 */
export function setExposureState(partial) {
  Object.assign(state, partial);
  const snapshot = getExposureState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      // Error pada satu listener tidak boleh menghentikan listener lain
      console.error('[exposureState] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang dipanggil setiap kali state exposure berubah.
 * @param {(state: typeof state) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 */
export function onExposureStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
