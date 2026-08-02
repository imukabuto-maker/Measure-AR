/**
 * focusState.js
 * ---------------------------------------------------------------
 * Modul state management untuk Focus Manager.
 * Tanggung jawab TUNGGAL: menyimpan status fokus saat ini di memori
 * (idle/focusing/focused/locked/unsupported/error) dan menyediakan
 * mekanisme subscribe untuk modul lain (mis. UI indikator).
 *
 * Pola sama persis dengan cameraState.js / permissionState.js agar
 * konsisten di seluruh codebase.
 * ---------------------------------------------------------------
 */

// Kemungkinan status fokus yang valid
export const FOCUS_STATE = Object.freeze({
  IDLE: 'idle',               // belum ada aksi fokus
  FOCUSING: 'focusing',       // sedang memproses fokus ke titik tertentu
  FOCUSED: 'focused',         // berhasil fokus
  LOCKED: 'locked',           // focus lock aktif
  UNSUPPORTED: 'unsupported', // browser/device tidak mendukung kontrol fokus manual
  ERROR: 'error',             // gagal memproses fokus
});

// State internal — tidak diekspor langsung agar tidak dimutasi dari luar
const state = {
  status: FOCUS_STATE.IDLE,
  point: null,        // {x, y} ternormalisasi (0-1) titik fokus terakhir, atau null
  locked: false,       // true jika focus lock sedang aktif
  errorMessage: null,
};

const listeners = new Set();

/**
 * Ambil salinan state fokus saat ini (bukan referensi langsung).
 * @returns {{status:string, point:{x:number,y:number}|null, locked:boolean, errorMessage:string|null}}
 */
export function getFocusState() {
  return { ...state };
}

/**
 * Perbarui sebagian state fokus dan beri tahu semua listener.
 * @param {Partial<{status:string, point:{x:number,y:number}|null, locked:boolean, errorMessage:string|null}>} partial
 */
export function setFocusState(partial) {
  Object.assign(state, partial);
  const snapshot = getFocusState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      // Error pada satu listener tidak boleh menghentikan listener lain
      console.error('[focusState] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang dipanggil setiap kali state fokus berubah.
 * @param {(state: {status:string, point:{x:number,y:number}|null, locked:boolean, errorMessage:string|null}) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 */
export function onFocusStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
