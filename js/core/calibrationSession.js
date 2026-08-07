/**
 * calibrationSession.js
 * ---------------------------------------------------------------
 * Modul sesi interaktif kalibrasi: menangkap tap user pada preview
 * kamera untuk memilih DUA titik referensi secara MANUAL (tidak ada
 * deteksi tepi/marker otomatis — sesuai batasan sprint ini).
 *
 * Koordinat titik disimpan dalam RESOLUSI ASLI video
 * (video.videoWidth/videoHeight), BUKAN resolusi tampilan CSS —
 * penting supaya pixel-per-unit yang dihasilkan konsisten dengan
 * resolusi gambar yang nanti dianalisis (Measurement Engine).
 *
 * MEMAKAI ULANG Camera Core lewat getPreviewElement() dari
 * cameraManager.js — TIDAK ADA perubahan pada Camera Core, TIDAK
 * membuka stream sendiri, TIDAK menduplikasi logika kamera.
 * ---------------------------------------------------------------
 */

import { getPreviewElement } from './cameraManager.js';

export const SESSION_STATE = Object.freeze({
  IDLE: 'idle',                       // belum ada sesi berjalan
  AWAITING_POINT_A: 'awaiting_point_a', // menunggu tap pertama
  AWAITING_POINT_B: 'awaiting_point_b', // menunggu tap kedua
  READY: 'ready',                      // dua titik terpilih, siap dihitung
  ERROR: 'error',
});

const state = {
  status: SESSION_STATE.IDLE,
  pointA: null, // {x, y} dalam koordinat piksel NATIVE video, atau null
  pointB: null,
  errorMessage: null,
};

const listeners = new Set();
let tapHandler = null;
let attachedVideo = null;

/** Ambil salinan state sesi saat ini. */
export function getSessionState() {
  return {
    ...state,
    pointA: state.pointA ? { ...state.pointA } : null,
    pointB: state.pointB ? { ...state.pointB } : null,
  };
}

function setSessionState(partial) {
  Object.assign(state, partial);
  const snapshot = getSessionState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      console.error('[calibrationSession] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Daftarkan listener yang dipanggil setiap kali state sesi berubah.
 * @param {(state: ReturnType<typeof getSessionState>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onSessionStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Konversi koordinat tap (client/CSS px, relatif viewport) ke
 * koordinat piksel NATIVE video — memperhitungkan rasio antara
 * ukuran tampilan CSS video dan resolusi asli video.
 * @param {HTMLVideoElement} video
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{x:number, y:number}}
 */
function toNativeVideoCoordinates(video, clientX, clientY) {
  const rect = video.getBoundingClientRect();
  const scaleX = video.videoWidth / rect.width;
  const scaleY = video.videoHeight / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

/**
 * Mulai sesi pemilihan titik: reset titik sebelumnya (jika ada),
 * lalu pasang listener tap pada elemen <video> preview yang sedang
 * aktif. Titik pertama & kedua akan tertangkap dari 2 tap berikutnya.
 * @throws {Error} jika tidak ada preview kamera aktif saat ini
 */
export function startPointSelection() {
  const video = getPreviewElement();
  if (!video) {
    const error = new Error('Tidak ada preview kamera aktif — buka kamera terlebih dahulu.');
    error.code = 'no_preview';
    throw error;
  }

  stopPointSelection(); // lepas listener lama jika ada, sebelum pasang yang baru

  setSessionState({ status: SESSION_STATE.AWAITING_POINT_A, pointA: null, pointB: null, errorMessage: null });

  tapHandler = (event) => {
    const point = event.touches && event.touches[0] ? event.touches[0] : event;
    const coords = toNativeVideoCoordinates(video, point.clientX, point.clientY);
    const current = getSessionState();

    if (current.status === SESSION_STATE.AWAITING_POINT_A) {
      setSessionState({ pointA: coords, status: SESSION_STATE.AWAITING_POINT_B });
    } else if (current.status === SESSION_STATE.AWAITING_POINT_B) {
      setSessionState({ pointB: coords, status: SESSION_STATE.READY });
    }
    // Status READY: tap berikutnya diabaikan sampai resetPointSelection() dipanggil.
  };

  video.addEventListener('click', tapHandler);
  attachedVideo = video;
}

/** Lepas listener tap TANPA menghapus titik yang sudah terpilih. */
export function stopPointSelection() {
  if (attachedVideo && tapHandler) {
    attachedVideo.removeEventListener('click', tapHandler);
  }
  tapHandler = null;
  attachedVideo = null;
}

/** Reset sesi sepenuhnya: lepas listener + hapus titik yang sudah dipilih. */
export function resetPointSelection() {
  stopPointSelection();
  setSessionState({ status: SESSION_STATE.IDLE, pointA: null, pointB: null, errorMessage: null });
}
