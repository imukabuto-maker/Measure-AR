/**
 * zoomState.js
 * ---------------------------------------------------------------
 * Modul state management untuk Zoom Manager.
 * Tanggung jawab TUNGGAL: menyimpan status & nilai zoom saat ini
 * di memori, dan menyediakan mekanisme subscribe untuk modul lain
 * (mis. UI indikator/slider).
 *
 * Pola sama persis dengan focusState.js / cameraState.js agar
 * konsisten di seluruh codebase.
 * ---------------------------------------------------------------
 */

// Kemungkinan status zoom yang valid
export const ZOOM_STATE = Object.freeze({
  IDLE: 'idle',               // belum ada aksi zoom / kamera belum aktif
  ZOOMING: 'zooming',         // sedang memproses perubahan zoom
  UNSUPPORTED: 'unsupported', // hardware zoom tidak tersedia (pakai fallback digital)
  ERROR: 'error',             // gagal menerapkan zoom
});

// Mode penerapan zoom: 'hardware' (via track.applyConstraints) atau
// 'digital' (fallback CSS transform pada elemen video)
export const ZOOM_MODE = Object.freeze({
  HARDWARE: 'hardware',
  DIGITAL: 'digital',
  NONE: 'none', // belum diketahui / kamera belum aktif
});

// State internal — tidak diekspor langsung agar tidak dimutasi dari luar
const state = {
  status: ZOOM_STATE.IDLE,
  mode: ZOOM_MODE.NONE,
  value: 1,     // nilai zoom saat ini (1 = tanpa zoom)
  min: 1,
  max: 1,
  step: 0.1,
  errorMessage: null,
};

const listeners = new Set();

/**
 * Ambil salinan state zoom saat ini (bukan referensi langsung).
 * @returns {{status:string, mode:string, value:number, min:number, max:number, step:number, errorMessage:string|null}}
 */
export function getZoomState() {
  return { ...state };
}

/**
 * Perbarui sebagian state zoom dan beri tahu semua listener.
 * @param {Partial<typeof state>} partial
 */
export function setZoomState(partial) {
  Object.assign(state, partial);
  const snapshot = getZoomState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      // Error pada satu listener tidak boleh menghentikan listener lain
      console.error('[zoomState] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang dipanggil setiap kali state zoom berubah.
 * @param {(state: typeof state) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 */
export function onZoomStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
