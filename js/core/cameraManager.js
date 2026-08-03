/**
 * cameraManager.js
 * ---------------------------------------------------------------
 * Facade / orkestrator Camera Engine (Sprint 5).
 * Tanggung jawab: membuka, menampilkan, dan menutup kamera SAJA.
 * Tidak ada zoom/focus/exposure/measurement/calibration di sini —
 * itu di luar scope sprint ini.
 *
 * PENTING: modul ini MEMAKAI ULANG Permission Manager yang sudah
 * ada dan sudah diuji (Sprint 4) — tidak membangun ulang logika
 * permission apa pun.
 * ---------------------------------------------------------------
 */

import { checkAllPermissions, requestCamera, PERMISSION_STATUS } from './permissionManager.js';
import {
  CAMERA_STATE,
  getCameraState,
  setCameraState,
  onCameraStateChange,
} from './cameraState.js';
import { mapCameraError, unsupportedCameraError } from '../utils/cameraError.js';
import {
  createPreviewElement,
  attachStream,
  detachStream,
  mountPreview,
  unmountPreview,
} from '../ui/cameraPreview.js';

// Re-export supaya modul lain cukup import dari satu pintu (cameraManager)
export { CAMERA_STATE, getCameraState, onCameraStateChange };

// Stream & elemen preview aktif — privat di modul ini, tidak diekspor
// langsung agar lifecycle-nya hanya dikontrol lewat fungsi di bawah.
let activeStream = null;
let previewEl = null;

/**
 * Buka kamera & tampilkan preview di dalam container yang diberikan.
 * Alur:
 * 1) Cek/lengkapi izin kamera lewat Permission Manager (Sprint 4).
 * 2) Minta MediaStream sesuai facingMode (dan resolusi jika diminta).
 * 3) Buat elemen <video>, pasang stream, mount ke container.
 * @param {HTMLElement} container elemen tempat preview akan dipasang
 * @param {Object} [options]
 * @param {'environment'|'user'} [options.facingMode] default 'environment' (kamera belakang)
 * @param {number} [options.width] [Sprint 10 — integrasi Resolution Manager] lebar ideal (px), opsional
 * @param {number} [options.height] [Sprint 10 — integrasi Resolution Manager] tinggi ideal (px), opsional
 * @returns {Promise<{success:boolean, error?:{code:string,message:string}}>}
 */
export async function openCamera(container, { facingMode = 'environment', width, height } = {}) {
  if (!container) {
    throw new Error('[cameraManager] Parameter container wajib diisi');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const error = unsupportedCameraError();
    setCameraState({ status: CAMERA_STATE.ERROR, errorMessage: error.message });
    return { success: false, error };
  }

  setCameraState({ status: CAMERA_STATE.OPENING, errorMessage: null, facingMode });

  try {
    // Pastikan izin sudah granted — memakai Permission Manager yang sudah ada,
    // bukan membuat ulang logika permission.
    const { camera } = await checkAllPermissions();
    if (camera !== PERMISSION_STATUS.GRANTED) {
      const status = await requestCamera();
      if (status !== PERMISSION_STATUS.GRANTED) {
        const error = { code: 'permission_denied', message: 'Izin kamera belum diberikan.' };
        setCameraState({ status: CAMERA_STATE.ERROR, errorMessage: error.message });
        return { success: false, error };
      }
    }

    // Tutup stream lama dulu jika sebelumnya sudah ada kamera aktif
    if (activeStream) {
      closeCamera();
    }

    // [Sprint 10] width/height bersifat opsional — jika tidak diisi,
    // constraint video persis sama seperti sebelum Sprint 10 (tidak
    // ada perubahan perilaku untuk pemanggil yang sudah ada).
    const videoConstraints = { facingMode: { ideal: facingMode } };
    if (width) videoConstraints.width = { ideal: width };
    if (height) videoConstraints.height = { ideal: height };

    activeStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });

    previewEl = createPreviewElement();
    mountPreview(container, previewEl);
    await attachStream(previewEl, activeStream);

    setCameraState({ status: CAMERA_STATE.PREVIEWING, errorMessage: null, facingMode });
    return { success: true };
  } catch (err) {
    const error = mapCameraError(err);
    setCameraState({ status: CAMERA_STATE.ERROR, errorMessage: error.message });
    console.error('[cameraManager] Gagal membuka kamera:', err.message);
    stopActiveStream(); // bersihkan stream parsial jika sempat terbuka sebagian
    return { success: false, error };
  }
}

/**
 * Tutup kamera: hentikan semua track aktif, lepas & hapus elemen preview.
 * Aman dipanggil meski kamera belum pernah/tidak sedang terbuka.
 */
export function closeCamera() {
  if (previewEl) {
    detachStream(previewEl);
    unmountPreview(previewEl);
    previewEl = null;
  }
  stopActiveStream();
  setCameraState({ status: CAMERA_STATE.CLOSED, errorMessage: null });
}

/**
 * Ganti kamera aktif antara belakang (environment) dan depan (user),
 * jika perangkat mendukung — dengan membuka ulang di container yang sama.
 * @param {HTMLElement} container
 * @returns {Promise<{success:boolean, error?:{code:string,message:string}}>}
 */
export async function switchCamera(container) {
  const current = getCameraState();
  const nextFacing = current.facingMode === 'environment' ? 'user' : 'environment';
  return openCamera(container, { facingMode: nextFacing });
}

/** Hentikan seluruh track dari stream aktif & bersihkan referensinya. */
function stopActiveStream() {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
}

/**
 * [Sprint 6 — integrasi Focus Manager]
 * Ambil video track yang sedang aktif, agar modul lain (Focus Manager)
 * bisa membaca capability & menerapkan constraint fokus TANPA membuka
 * stream sendiri atau menduplikasi logika Camera Engine.
 * @returns {MediaStreamTrack|null}
 */
export function getActiveVideoTrack() {
  if (!activeStream) return null;
  const tracks = activeStream.getVideoTracks();
  return tracks.length > 0 ? tracks[0] : null;
}

/**
 * [Sprint 6 — integrasi Focus Manager]
 * Ambil elemen <video> preview yang sedang aktif, agar modul lain bisa
 * memasang listener (mis. tap-to-focus) tanpa membuat elemen preview
 * baru atau menduplikasi logika Camera Engine.
 * @returns {HTMLVideoElement|null}
 */
export function getPreviewElement() {
  return previewEl;
}

/**
 * [Sprint 10 — integrasi Camera Lifecycle Manager]
 * Ambil MediaStream yang sedang aktif, agar Lifecycle/Session Manager
 * bisa memantau event 'inactive'/track 'ended' (indikasi iOS Safari
 * menghentikan stream secara diam-diam di background) tanpa membuka
 * stream sendiri atau menduplikasi logika Camera Engine.
 * @returns {MediaStream|null}
 */
export function getActiveStream() {
  return activeStream;
}
