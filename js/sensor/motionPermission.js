/**
 * motionPermission.js
 * ---------------------------------------------------------------
 * Modul khusus penanganan izin motion & orientation sensor
 * (DeviceMotionEvent / DeviceOrientationEvent).
 * Tanggung jawab TUNGGAL: memeriksa & meminta izin motion.
 *
 * iOS 13+ mewajibkan permintaan izin eksplisit lewat
 * DeviceMotionEvent.requestPermission(), dan HARUS dipanggil dari
 * dalam event handler user gesture (mis. onclick tombol) agar
 * dialog native muncul.
 * ---------------------------------------------------------------
 */

import {
  PERMISSION_STATUS,
  getPermissionState,
  setPermissionState,
} from '../core/permissionState.js';

/**
 * Periksa apakah API motion tersedia & apakah device ini butuh
 * permintaan izin eksplisit (khusus iOS 13+). Tidak memicu prompt.
 * @returns {Promise<string>} salah satu nilai PERMISSION_STATUS
 */
export async function checkMotionPermission() {
  const supported = typeof DeviceMotionEvent !== 'undefined';
  if (!supported) {
    setPermissionState('motion', PERMISSION_STATUS.UNSUPPORTED);
    return PERMISSION_STATUS.UNSUPPORTED;
  }

  const needsExplicitRequest = typeof DeviceMotionEvent.requestPermission === 'function';
  if (!needsExplicitRequest) {
    // Browser/OS selain iOS 13+ umumnya mengizinkan motion tanpa prompt
    setPermissionState('motion', PERMISSION_STATUS.GRANTED);
    return PERMISSION_STATUS.GRANTED;
  }

  // iOS 13+: status pasti baru diketahui setelah requestMotionPermission()
  return getPermissionState('motion');
}

/**
 * Minta izin motion/orientation sensor ke pengguna.
 * HARUS dipanggil langsung dari dalam handler user gesture agar
 * dialog native iOS muncul (tidak bisa dipanggil otomatis/async
 * setelah delay).
 * @returns {Promise<string>} salah satu nilai PERMISSION_STATUS
 */
export async function requestMotionPermission() {
  const supported = typeof DeviceMotionEvent !== 'undefined';
  if (!supported) {
    setPermissionState('motion', PERMISSION_STATUS.UNSUPPORTED);
    return PERMISSION_STATUS.UNSUPPORTED;
  }

  if (typeof DeviceMotionEvent.requestPermission !== 'function') {
    // Tidak ada mekanisme permission eksplisit di platform ini
    setPermissionState('motion', PERMISSION_STATUS.GRANTED);
    return PERMISSION_STATUS.GRANTED;
  }

  try {
    const result = await DeviceMotionEvent.requestPermission();
    const status = result === 'granted' ? PERMISSION_STATUS.GRANTED : PERMISSION_STATUS.DENIED;
    setPermissionState('motion', status);
    return status;
  } catch (err) {
    console.error('[motionPermission] Gagal meminta izin motion:', err.message);
    setPermissionState('motion', PERMISSION_STATUS.DENIED);
    return PERMISSION_STATUS.DENIED;
  }
}
