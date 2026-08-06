/**
 * projectState.js
 * ---------------------------------------------------------------
 * State management untuk Project Manager.
 * Tanggung jawab TUNGGAL: menyimpan cache daftar project, project
 * aktif, dan status loading/error di memori — serta menyediakan
 * mekanisme subscribe. TIDAK mengakses database — itu tanggung
 * jawab projectRepository.js (dipanggil dari projectManager.js).
 * ---------------------------------------------------------------
 */

export const PROJECT_MANAGER_STATE = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
});

const state = {
  status: PROJECT_MANAGER_STATE.IDLE,
  projects: [],           // cache hasil listProjects()
  activeProjectId: null,  // id project yang sedang dibuka
  errorMessage: null,
};

const listeners = new Set();

/**
 * Ambil salinan state saat ini (array projects juga disalin, bukan
 * referensi langsung, supaya pemanggil tidak bisa memutasi cache).
 * @returns {{status:string, projects:object[], activeProjectId:string|null, errorMessage:string|null}}
 */
export function getProjectManagerState() {
  return { ...state, projects: [...state.projects] };
}

/**
 * Perbarui sebagian state dan beri tahu semua listener.
 * @param {Partial<typeof state>} partial
 */
export function setProjectManagerState(partial) {
  Object.assign(state, partial);
  const snapshot = getProjectManagerState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      console.error('[projectState] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang dipanggil setiap kali state berubah.
 * @param {(state: ReturnType<typeof getProjectManagerState>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onProjectManagerStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Ambil record project yang sedang aktif dari cache (null jika tidak ada).
 * @returns {object|null}
 */
export function getActiveProject() {
  return state.projects.find((p) => p.id === state.activeProjectId) ?? null;
}
