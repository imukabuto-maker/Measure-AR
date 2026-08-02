/**
 * permissionState.js
 * ---------------------------------------------------------------
 * Modul state management untuk status izin (permission) aplikasi.
 * Tanggung jawab TUNGGAL: menyimpan status terkini setiap jenis
 * izin di memori dan menyediakan mekanisme subscribe agar modul
 * lain bisa bereaksi saat status berubah.
 *
 * Modul ini TIDAK melakukan permintaan izin apa pun secara
 * langsung — logika request ada di cameraPermission.js /
 * motionPermission.js (Single Responsibility Principle).
 * ---------------------------------------------------------------
 */

// Kemungkinan nilai status izin yang valid di seluruh aplikasi
export const PERMISSION_STATUS = Object.freeze({
  UNKNOWN: 'unknown',       // belum pernah dicek
  PROMPT: 'prompt',         // browser akan menampilkan dialog native saat diminta
  GRANTED: 'granted',       // izin diberikan
  DENIED: 'denied',         // izin ditolak user
  UNSUPPORTED: 'unsupported', // fitur/API tidak tersedia di device/browser ini
});

// State internal — tidak diekspor langsung agar tidak dimutasi dari luar modul
const state = {
  camera: PERMISSION_STATUS.UNKNOWN,
  motion: PERMISSION_STATUS.UNKNOWN,
};

// Daftar listener per jenis izin, memakai Set agar mudah unsubscribe
const listeners = {
  camera: new Set(),
  motion: new Set(),
};

/**
 * Ambil status izin saat ini untuk jenis tertentu.
 * @param {'camera'|'motion'} type
 * @returns {string} salah satu nilai PERMISSION_STATUS
 * @throws {Error} jika type tidak dikenal
 */
export function getPermissionState(type) {
  if (!(type in state)) {
    throw new Error(`[permissionState] Tipe izin tidak dikenal: "${type}"`);
  }
  return state[type];
}

/**
 * Perbarui status izin untuk jenis tertentu dan beri tahu semua listener
 * yang berlangganan pada jenis izin tersebut.
 * @param {'camera'|'motion'} type
 * @param {string} value salah satu nilai PERMISSION_STATUS
 * @throws {Error} jika type atau value tidak valid
 */
export function setPermissionState(type, value) {
  if (!(type in state)) {
    throw new Error(`[permissionState] Tipe izin tidak dikenal: "${type}"`);
  }
  if (!Object.values(PERMISSION_STATUS).includes(value)) {
    throw new Error(`[permissionState] Nilai status tidak valid: "${value}"`);
  }

  state[type] = value;

  listeners[type].forEach((callback) => {
    try {
      callback(value);
    } catch (err) {
      // Error pada satu listener tidak boleh menghentikan listener lain
      console.error('[permissionState] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang akan dipanggil setiap kali status izin
 * jenis tertentu berubah.
 * @param {'camera'|'motion'} type
 * @param {(value: string) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 * @throws {Error} jika type tidak dikenal
 */
export function onPermissionChange(type, callback) {
  if (!(type in listeners)) {
    throw new Error(`[permissionState] Tipe izin tidak dikenal: "${type}"`);
  }
  listeners[type].add(callback);
  return () => listeners[type].delete(callback);
}
