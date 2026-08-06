/**
 * calibrationProfileState.js
 * ---------------------------------------------------------------
 * State management untuk Calibration Profile Manager.
 * Tanggung jawab TUNGGAL: menyimpan cache daftar profil, profil
 * aktif, dan status loading/error di memori — serta menyediakan
 * mekanisme subscribe. TIDAK mengakses database (itu tanggung
 * jawab calibrationProfileRepository.js, dipanggil dari
 * calibrationProfileManager.js).
 * ---------------------------------------------------------------
 */

export const CALIBRATION_PROFILE_STATE = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
});

const state = {
  status: CALIBRATION_PROFILE_STATE.IDLE,
  profiles: [],          // cache hasil listProfiles()
  activeProfileId: null, // id profil yang sedang dipilih aktif
  errorMessage: null,
};

const listeners = new Set();

/**
 * Ambil salinan state saat ini (array profiles juga disalin, bukan
 * referensi langsung, supaya pemanggil tidak bisa memutasi cache).
 * @returns {{status:string, profiles:object[], activeProfileId:string|null, errorMessage:string|null}}
 */
export function getCalibrationProfileState() {
  return { ...state, profiles: [...state.profiles] };
}

/**
 * Perbarui sebagian state dan beri tahu semua listener.
 * @param {Partial<typeof state>} partial
 */
export function setCalibrationProfileState(partial) {
  Object.assign(state, partial);
  const snapshot = getCalibrationProfileState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      console.error('[calibrationProfileState] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang dipanggil setiap kali state berubah.
 * @param {(state: ReturnType<typeof getCalibrationProfileState>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onCalibrationProfileStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Ambil record profil yang sedang aktif dari cache (null jika tidak ada).
 * @returns {object|null}
 */
export function getActiveProfile() {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? null;
}
