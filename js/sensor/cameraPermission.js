/**
 * cameraPermission.js
 * ---------------------------------------------------------------
 * Modul khusus penanganan izin kamera.
 * Tanggung jawab TUNGGAL: memeriksa & meminta izin kamera.
 *
 * PENTING (batasan Sprint 4):
 * Modul ini TIDAK menampilkan preview kamera, TIDAK menyimpan
 * stream untuk dipakai ulang, dan TIDAK membangun Camera Engine.
 * requestCameraPermission() membuka stream HANYA sesaat untuk
 * memicu dialog izin native iOS/Safari, lalu langsung menghentikan
 * seluruh track sebelum function selesai.
 * ---------------------------------------------------------------
 */

import {
  PERMISSION_STATUS,
  getPermissionState,
  setPermissionState,
} from '../core/permissionState.js';

/**
 * Periksa status izin kamera saat ini TANPA memunculkan prompt.
 * Menggunakan Permissions API jika tersedia (didukung sebagian
 * browser desktop). Safari iOS umumnya tidak mendukung query untuk
 * 'camera', sehingga hasilnya tetap UNKNOWN sampai
 * requestCameraPermission() benar-benar dipanggil.
 * @returns {Promise<string>} salah satu nilai PERMISSION_STATUS
 */
export async function checkCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setPermissionState('camera', PERMISSION_STATUS.UNSUPPORTED);
    return PERMISSION_STATUS.UNSUPPORTED;
  }

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      const mapped = mapPermissionApiState(result.state);
      setPermissionState('camera', mapped);

      // Pantau perubahan status secara real-time jika browser mendukung
      result.onchange = () => {
        setPermissionState('camera', mapPermissionApiState(result.state));
      };
      return mapped;
    } catch (err) {
      // Umum terjadi di Safari — Permissions API tidak mendukung 'camera'
      console.warn('[cameraPermission] Permissions API tidak tersedia:', err.message);
    }
  }

  return getPermissionState('camera');
}

/**
 * Minta izin kamera ke pengguna lewat dialog native browser.
 * Stream dibuka sesaat lalu langsung dihentikan — tidak ada preview,
 * tidak ada Camera Engine yang dibangun di sini.
 * @returns {Promise<string>} salah satu nilai PERMISSION_STATUS
 */
export async function requestCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setPermissionState('camera', PERMISSION_STATUS.UNSUPPORTED);
    return PERMISSION_STATUS.UNSUPPORTED;
  }

  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    setPermissionState('camera', PERMISSION_STATUS.GRANTED);
    return PERMISSION_STATUS.GRANTED;
  } catch (err) {
    const isDenied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
    const status = isDenied ? PERMISSION_STATUS.DENIED : PERMISSION_STATUS.UNSUPPORTED;
    setPermissionState('camera', status);
    console.error('[cameraPermission] Gagal meminta izin kamera:', err.message);
    return status;
  } finally {
    // Selalu hentikan track — memastikan tidak ada stream aktif tersisa
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }
}

/**
 * Terjemahkan nilai state dari Permissions API ke PERMISSION_STATUS internal.
 * @param {'granted'|'denied'|'prompt'} apiState
 * @returns {string} salah satu nilai PERMISSION_STATUS
 */
function mapPermissionApiState(apiState) {
  switch (apiState) {
    case 'granted': return PERMISSION_STATUS.GRANTED;
    case 'denied': return PERMISSION_STATUS.DENIED;
    case 'prompt': return PERMISSION_STATUS.PROMPT;
    default: return PERMISSION_STATUS.UNKNOWN;
  }
}
