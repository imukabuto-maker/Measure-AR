/**
 * cameraSessionManager.js
 * ---------------------------------------------------------------
 * Modul inti pengelolaan siklus hidup SESI kamera: start/pause/
 * resume/stop, penanganan app visibility (background/foreground),
 * dan pemulihan otomatis saat stream berhenti tak terduga.
 *
 * KONTEKS SAFARI iOS (alasan modul ini ada):
 * Safari iOS sering MENGHENTIKAN MediaStream secara diam-diam saat
 * halaman masuk background (user pindah app, kunci layar, atau
 * switch tab) — video track berstatus 'ended' tanpa event error yang
 * jelas, dan stream TIDAK otomatis pulih saat halaman aktif lagi.
 * Camera Engine (Sprint 5) sendiri tidak menangani ini — modul inilah
 * yang menambahkan lapisan "kesadaran siklus hidup" di atasnya.
 *
 * MEMAKAI ULANG Camera Engine yang sudah ada (openCamera/closeCamera/
 * getActiveStream) — TIDAK ada logika buka/tutup stream baru di sini.
 * ---------------------------------------------------------------
 */

import { openCamera, closeCamera, getActiveStream } from './cameraManager.js';

// Status sesi kamera
export const SESSION_STATE = Object.freeze({
  INACTIVE: 'inactive',   // sesi belum pernah dimulai / sudah dihentikan penuh
  STARTING: 'starting',   // sedang memulai sesi
  ACTIVE: 'active',       // sesi aktif, preview tampil
  PAUSED: 'paused',       // sesi dijeda (stream dilepas) — bisa resume
  STOPPING: 'stopping',   // sedang menghentikan sesi
  ERROR: 'error',         // gagal start/resume, termasuk gagal recovery
});

const state = {
  status: SESSION_STATE.INACTIVE,
  pausedByVisibility: false, // true jika dijeda otomatis oleh visibilitychange (bukan manual)
  recoveryAttempts: 0,
  errorMessage: null,
};

const listeners = new Set();

// Konteks sesi terakhir — disimpan supaya resumeSession() bisa membuka
// ulang kamera persis dengan container & options yang sama.
let lastContainer = null;
let lastOptions = null;
let trackEndedHandler = null;
let visibilityHandlerAttached = false;

const MAX_RECOVERY_ATTEMPTS = 2;

/** Ambil salinan state sesi saat ini. */
export function getSessionState() {
  return { ...state };
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

function setSessionState(partial) {
  Object.assign(state, partial);
  const snapshot = getSessionState();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (err) {
      console.error('[cameraSessionManager] Listener gagal dijalankan:', err.message);
    }
  });
}

/**
 * Mulai sesi kamera baru. Menyimpan container & options untuk dipakai
 * ulang oleh pause/resume, lalu memasang pemantauan visibility &
 * pemantauan stream berakhir tak terduga.
 * @param {HTMLElement} container
 * @param {Object} [options] diteruskan apa adanya ke `cameraManager.openCamera()`
 * @returns {Promise<{success:boolean, error?:object}>}
 */
export async function startSession(container, options = {}) {
  if (!container) {
    throw new Error('[cameraSessionManager] Parameter container wajib diisi');
  }

  lastContainer = container;
  lastOptions = options;
  setSessionState({ status: SESSION_STATE.STARTING, errorMessage: null, recoveryAttempts: 0 });

  const result = await openCamera(container, options);
  if (!result.success) {
    setSessionState({ status: SESSION_STATE.ERROR, errorMessage: result.error?.message ?? 'Gagal memulai sesi kamera.' });
    return result;
  }

  attachTrackEndedWatcher();
  attachVisibilityHandling();
  setSessionState({ status: SESSION_STATE.ACTIVE, errorMessage: null, pausedByVisibility: false });
  return result;
}

/**
 * Jeda sesi kamera SECARA MANUAL (mis. user navigasi ke halaman lain
 * di dalam app tanpa benar-benar selesai memakai kamera). Melepas
 * stream (hemat baterai, hindari iOS mematikan paksa di background)
 * tapi TETAP mengingat konteks supaya bisa di-resume.
 */
export function pauseSession() {
  if (state.status !== SESSION_STATE.ACTIVE) return;
  detachTrackEndedWatcher();
  closeCamera();
  setSessionState({ status: SESSION_STATE.PAUSED, pausedByVisibility: false, errorMessage: null });
}

/**
 * Lanjutkan sesi yang sebelumnya di-pause, memakai container & options
 * yang sama dari `startSession()` terakhir.
 * @returns {Promise<{success:boolean, error?:object}>}
 */
export async function resumeSession() {
  if (state.status !== SESSION_STATE.PAUSED || !lastContainer) {
    return { success: false, error: { code: 'no_paused_session', message: 'Tidak ada sesi yang dijeda untuk dilanjutkan.' } };
  }

  setSessionState({ status: SESSION_STATE.STARTING, errorMessage: null });
  const result = await openCamera(lastContainer, lastOptions);

  if (!result.success) {
    setSessionState({ status: SESSION_STATE.ERROR, errorMessage: result.error?.message ?? 'Gagal melanjutkan sesi kamera.' });
    return result;
  }

  attachTrackEndedWatcher();
  setSessionState({ status: SESSION_STATE.ACTIVE, errorMessage: null, pausedByVisibility: false });
  return result;
}

/**
 * Hentikan sesi sepenuhnya: lepas stream, lepas semua listener
 * (visibility & track-ended), dan lupakan konteks sesi (container/options).
 * Setelah ini, resumeSession() tidak akan berfungsi sampai startSession()
 * dipanggil lagi.
 */
export function stopSession() {
  setSessionState({ status: SESSION_STATE.STOPPING, errorMessage: null });
  detachTrackEndedWatcher();
  detachVisibilityHandling();
  closeCamera();
  lastContainer = null;
  lastOptions = null;
  setSessionState({ status: SESSION_STATE.INACTIVE, pausedByVisibility: false, recoveryAttempts: 0, errorMessage: null });
}

/**
 * Pantau event 'ended' pada video track aktif — ini cara utama
 * mendeteksi Safari iOS mematikan stream diam-diam di background.
 * Saat terdeteksi ketika sesi masih berstatus ACTIVE (bukan karena
 * kita sendiri yang memanggil closeCamera), coba pulihkan otomatis.
 */
function attachTrackEndedWatcher() {
  detachTrackEndedWatcher();
  const stream = getActiveStream();
  if (!stream) return;

  const track = stream.getVideoTracks()[0];
  if (!track) return;

  trackEndedHandler = () => {
    if (state.status === SESSION_STATE.ACTIVE) {
      console.warn('[cameraSessionManager] Video track berakhir tak terduga — mencoba pemulihan otomatis.');
      attemptRecovery();
    }
  };
  track.addEventListener('ended', trackEndedHandler);
}

function detachTrackEndedWatcher() {
  const stream = getActiveStream();
  const track = stream ? stream.getVideoTracks()[0] : null;
  if (track && trackEndedHandler) {
    track.removeEventListener('ended', trackEndedHandler);
  }
  trackEndedHandler = null;
}

/**
 * Coba buka ulang kamera setelah stream berakhir tak terduga, dengan
 * batas percobaan (MAX_RECOVERY_ATTEMPTS) supaya tidak retry tanpa
 * henti jika kamera memang benar-benar tidak bisa dibuka (mis. dipakai
 * app lain terus-menerus).
 */
async function attemptRecovery() {
  if (!lastContainer) return;
  if (state.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    setSessionState({
      status: SESSION_STATE.ERROR,
      errorMessage: `Gagal memulihkan kamera setelah ${MAX_RECOVERY_ATTEMPTS}x percobaan.`,
    });
    return;
  }

  setSessionState({ status: SESSION_STATE.STARTING, recoveryAttempts: state.recoveryAttempts + 1 });
  const result = await openCamera(lastContainer, lastOptions);

  if (result.success) {
    attachTrackEndedWatcher();
    setSessionState({ status: SESSION_STATE.ACTIVE, errorMessage: null });
  } else {
    setSessionState({
      status: SESSION_STATE.ERROR,
      errorMessage: result.error?.message ?? 'Gagal memulihkan sesi kamera.',
    });
  }
}

/**
 * Pasang penanganan `visibilitychange`: jeda otomatis saat halaman
 * disembunyikan (background), lanjutkan otomatis saat aktif lagi —
 * TAPI hanya jika sesi sebelumnya aktif (bukan dijeda manual oleh user).
 */
function attachVisibilityHandling() {
  if (visibilityHandlerAttached) return;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  visibilityHandlerAttached = true;
}

function detachVisibilityHandling() {
  if (!visibilityHandlerAttached) return;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  visibilityHandlerAttached = false;
}

function handleVisibilityChange() {
  if (document.hidden) {
    // Halaman masuk background — jeda proaktif SEBELUM iOS mematikan
    // paksa, supaya transisi lebih terkendali & baterai lebih hemat.
    if (state.status === SESSION_STATE.ACTIVE) {
      detachTrackEndedWatcher();
      closeCamera();
      setSessionState({ status: SESSION_STATE.PAUSED, pausedByVisibility: true });
    }
  } else {
    // Halaman aktif lagi — hanya auto-resume jika sebelumnya dijeda
    // OTOMATIS oleh visibility (bukan karena user sengaja pause manual).
    if (state.status === SESSION_STATE.PAUSED && state.pausedByVisibility) {
      resumeSession();
    }
  }
}
