/**
 * cameraState.js
 * ---------------------------------------------------------------
 * Modul state management untuk Camera Engine.
 * Tanggung jawab TUNGGAL: menyimpan status kamera saat ini di
 * memori (idle/opening/previewing/closed/error) dan menyediakan
 * mekanisme subscribe untuk modul lain (mis. UI kamera nanti).
 *
 * Pola sama persis dengan permissionState.js (Sprint 4) agar
 * konsisten di seluruh codebase.
 * ---------------------------------------------------------------
 */

// Kemungkinan status kamera yang valid
export const CAMERA_STATE = Object.freeze({
  IDLE: 'idle',             // belum pernah dibuka
  OPENING: 'opening',       // sedang meminta izin/stream (loading)
  PREVIEWING: 'previewing', // stream aktif, preview tampil
  CLOSED: 'closed',         // pernah dibuka lalu ditutup oleh user/app
  ERROR: 'error',           // gagal membuka kamera
});

// State internal — tidak diekspor langsung agar tidak dimutasi dari luar
const state = {
  status: CAMERA_STATE.IDLE,
  facingMode: 'environment', // default kamera belakang
  errorMessage: null,
};

// Listener global (satu daftar saja, cukup untuk satu kamera aktif)
const listeners = new Set();

/**
 * Ambil salinan state kamera saat ini (bukan referensi langsung,
 * supaya pemanggil tidak bisa memutasi state dari luar).
 * @returns {{status:string, facingMode:string, errorMessage:string|null}}
 */
export function getCameraState() {
  return { ...state };
}

/**
 * Perbarui sebagian state kamera dan beri tahu semua listener.
 * @param {Partial<{status:string, facingMode:string, errorMessage:string|null}>} partial
 */
export function setCameraState(partial) {
  Object.assign(state, partial);
  const snapshot = getCameraState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      // Error pada satu listener tidak boleh menghentikan listener lain
      console.error('[cameraState] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang dipanggil setiap kali state kamera berubah.
 * @param {(state: {status:string, facingMode:string, errorMessage:string|null}) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 */
export function onCameraStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
