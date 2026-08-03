/**
 * overlayState.js
 * ---------------------------------------------------------------
 * Modul state management untuk Overlay Framework.
 * Tanggung jawab TUNGGAL: menyimpan status overlay, ukuran canvas
 * saat ini, dan konfigurasi tiap layer (visible/opacity/dll) di
 * memori — serta menyediakan mekanisme subscribe untuk modul lain.
 *
 * TIDAK ada logika menggambar atau menghitung ukuran nyata di sini.
 * Pola sama persis dengan cameraState.js / zoomState.js dkk agar
 * konsisten di seluruh codebase.
 * ---------------------------------------------------------------
 */

// Status overlay secara keseluruhan
export const OVERLAY_STATUS = Object.freeze({
  IDLE: 'idle',     // belum ada canvas overlay aktif
  ACTIVE: 'active', // canvas terpasang & siap digambar
  ERROR: 'error',   // gagal inisialisasi overlay
});

// Nama-nama layer bawaan yang disediakan Overlay Framework
export const OVERLAY_LAYERS = Object.freeze({
  CROSSHAIR: 'crosshair',
  GRID: 'grid',
  SAFE_AREA: 'safeArea',
  ROI: 'roi',
});

// State internal — tidak diekspor langsung agar tidak dimutasi dari luar
const state = {
  status: OVERLAY_STATUS.IDLE,
  size: { width: 0, height: 0 }, // ukuran CSS canvas saat ini
  layers: {
    [OVERLAY_LAYERS.CROSSHAIR]: { visible: false, opacity: 0.9 },
    [OVERLAY_LAYERS.GRID]: { visible: false, opacity: 0.6 },
    [OVERLAY_LAYERS.SAFE_AREA]: { visible: false, opacity: 0.5, margin: 0.08 },
    [OVERLAY_LAYERS.ROI]: { visible: false, opacity: 0.8, rect: null }, // rect: {x,y,w,h} ternormalisasi 0-1
  },
  errorMessage: null,
};

const listeners = new Set();

/**
 * Ambil salinan state overlay saat ini (deep-copy dangkal per layer,
 * bukan referensi langsung, supaya pemanggil tidak bisa memutasi
 * state dari luar modul).
 * @returns {{status:string, size:{width:number,height:number}, layers:object, errorMessage:string|null}}
 */
export function getOverlayState() {
  return {
    status: state.status,
    size: { ...state.size },
    layers: Object.fromEntries(
      Object.entries(state.layers).map(([name, cfg]) => [name, { ...cfg }])
    ),
    errorMessage: state.errorMessage,
  };
}

/**
 * Perbarui sebagian state overlay di level atas (status/size/errorMessage).
 * Untuk mengubah konfigurasi satu layer, gunakan setLayerState().
 * @param {Partial<{status:string, size:{width:number,height:number}, errorMessage:string|null}>} partial
 */
export function setOverlayState(partial) {
  Object.assign(state, partial);
  notifyListeners();
}

/**
 * Perbarui konfigurasi satu layer tertentu (mis. visible/opacity/rect).
 * @param {string} layerName salah satu nilai OVERLAY_LAYERS
 * @param {object} partial field yang ingin diubah pada layer tsb
 * @throws {Error} jika layerName tidak dikenal
 */
export function setLayerState(layerName, partial) {
  if (!(layerName in state.layers)) {
    throw new Error(`[overlayState] Layer tidak dikenal: "${layerName}"`);
  }
  Object.assign(state.layers[layerName], partial);
  notifyListeners();
}

/**
 * Daftarkan listener yang dipanggil setiap kali state overlay berubah
 * (baik level atas maupun konfigurasi layer).
 * @param {(state: ReturnType<typeof getOverlayState>) => void} callback
 * @returns {() => void} fungsi untuk berhenti berlangganan (unsubscribe)
 */
export function onOverlayStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Beri tahu semua listener dengan snapshot state terbaru. */
function notifyListeners() {
  const snapshot = getOverlayState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      // Error pada satu listener tidak boleh menghentikan listener lain
      console.error('[overlayState] Listener gagal dijalankan:', err.message);
    }
  });
}
