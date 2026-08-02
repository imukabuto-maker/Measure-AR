/**
 * permissionManager.js
 * ---------------------------------------------------------------
 * Modul orkestrator (facade) untuk seluruh Permission Manager.
 * Menggabungkan permissionState, cameraPermission, motionPermission,
 * dan permissionDialog menjadi satu API sederhana yang bisa dipakai
 * modul lain (mis. Camera Engine di sprint mendatang) tanpa perlu
 * tahu detail implementasi tiap sensor.
 *
 * Modul ini TIDAK membuka kamera/motion secara langsung — ia hanya
 * mengatur alur (tampilkan dialog konfirmasi → delegasikan ke modul
 * sensor terkait → tangani hasil/error).
 * ---------------------------------------------------------------
 */

import {
  PERMISSION_STATUS,
  getPermissionState,
  onPermissionChange,
} from './permissionState.js';
import { checkCameraPermission, requestCameraPermission } from '../sensor/cameraPermission.js';
import { checkMotionPermission, requestMotionPermission } from '../sensor/motionPermission.js';
import { showPermissionDialog, showPermissionDeniedDialog } from '../ui/permissionDialog.js';

// Re-export supaya modul lain cukup import dari satu pintu (permissionManager)
export { PERMISSION_STATUS, getPermissionState, onPermissionChange };

/**
 * Periksa status izin kamera & motion sekaligus, tanpa memicu
 * prompt native apa pun. Cocok dipanggil saat aplikasi baru dibuka
 * untuk menentukan apakah perlu menampilkan ajakan meminta izin.
 * @returns {Promise<{camera: string, motion: string}>}
 */
export async function checkAllPermissions() {
  const [camera, motion] = await Promise.all([
    checkCameraPermission().catch((err) => {
      console.error('[permissionManager] checkCameraPermission gagal:', err.message);
      return PERMISSION_STATUS.UNSUPPORTED;
    }),
    checkMotionPermission().catch((err) => {
      console.error('[permissionManager] checkMotionPermission gagal:', err.message);
      return PERMISSION_STATUS.UNSUPPORTED;
    }),
  ]);
  return { camera, motion };
}

/**
 * Alur lengkap meminta izin kamera:
 * 1) Tampilkan dialog konfirmasi berisi alasan (best practice agar
 *    prompt native tidak muncul tiba-tiba tanpa konteks).
 * 2) Jika user setuju, panggil requestCameraPermission().
 * 3) Jika hasilnya ditolak, tampilkan dialog panduan ke Settings.
 * @returns {Promise<string>} status akhir (PERMISSION_STATUS)
 */
export async function requestCamera() {
  const confirmed = await showPermissionDialog({
    title: 'Akses Kamera',
    message: 'MeasureVision membutuhkan akses kamera untuk mengukur dimensi benda secara langsung.',
  });

  if (!confirmed) {
    return getPermissionState('camera');
  }

  const status = await requestCameraPermission().catch((err) => {
    console.error('[permissionManager] requestCameraPermission gagal:', err.message);
    return PERMISSION_STATUS.UNSUPPORTED;
  });

  if (status === PERMISSION_STATUS.DENIED) {
    await showPermissionDeniedDialog('Kamera');
  }

  return status;
}

/**
 * Alur lengkap meminta izin motion/orientation, sama pola dengan
 * requestCamera().
 * @returns {Promise<string>} status akhir (PERMISSION_STATUS)
 */
export async function requestMotion() {
  const confirmed = await showPermissionDialog({
    title: 'Akses Motion & Orientation',
    message: 'MeasureVision menggunakan sensor gerak untuk membantu menjaga sudut kamera tetap stabil saat pengukuran.',
  });

  if (!confirmed) {
    return getPermissionState('motion');
  }

  const status = await requestMotionPermission().catch((err) => {
    console.error('[permissionManager] requestMotionPermission gagal:', err.message);
    return PERMISSION_STATUS.UNSUPPORTED;
  });

  if (status === PERMISSION_STATUS.DENIED) {
    await showPermissionDeniedDialog('Motion & Orientation');
  }

  return status;
}
