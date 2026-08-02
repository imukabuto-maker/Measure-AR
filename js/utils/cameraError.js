/**
 * cameraError.js
 * ---------------------------------------------------------------
 * Utilitas untuk menerjemahkan error native dari getUserMedia
 * (DOMException) menjadi kode & pesan yang konsisten dan mudah
 * ditampilkan ke user. Tanggung jawab TUNGGAL: pemetaan error —
 * tidak menyimpan state, tidak melakukan side effect.
 * ---------------------------------------------------------------
 */

// Kode error internal aplikasi (independen dari nama DOMException)
export const CAMERA_ERROR_CODE = Object.freeze({
  PERMISSION_DENIED: 'permission_denied',
  NOT_FOUND: 'not_found',
  NOT_READABLE: 'not_readable',
  OVERCONSTRAINED: 'overconstrained',
  UNSUPPORTED: 'unsupported',
  UNKNOWN: 'unknown',
});

// Pesan ramah-user untuk setiap kode error
const MESSAGES = Object.freeze({
  [CAMERA_ERROR_CODE.PERMISSION_DENIED]: 'Izin kamera ditolak. Buka Settings untuk mengizinkan akses kamera.',
  [CAMERA_ERROR_CODE.NOT_FOUND]: 'Kamera tidak ditemukan pada perangkat ini.',
  [CAMERA_ERROR_CODE.NOT_READABLE]: 'Kamera sedang dipakai aplikasi lain atau tidak bisa diakses.',
  [CAMERA_ERROR_CODE.OVERCONSTRAINED]: 'Pengaturan kamera yang diminta tidak didukung perangkat ini.',
  [CAMERA_ERROR_CODE.UNSUPPORTED]: 'Browser ini tidak mendukung akses kamera.',
  [CAMERA_ERROR_CODE.UNKNOWN]: 'Terjadi kesalahan tak terduga saat membuka kamera.',
});

/**
 * Petakan native error (DOMException) dari getUserMedia ke kode
 * error internal aplikasi + pesan ramah-user.
 * @param {Error|DOMException} err
 * @returns {{code:string, message:string, original:string|null}}
 */
export function mapCameraError(err) {
  const name = err && err.name ? err.name : '';
  let code;

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      code = CAMERA_ERROR_CODE.PERMISSION_DENIED;
      break;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      code = CAMERA_ERROR_CODE.NOT_FOUND;
      break;
    case 'NotReadableError':
    case 'TrackStartError':
      code = CAMERA_ERROR_CODE.NOT_READABLE;
      break;
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      code = CAMERA_ERROR_CODE.OVERCONSTRAINED;
      break;
    default:
      code = CAMERA_ERROR_CODE.UNKNOWN;
  }

  return {
    code,
    message: MESSAGES[code],
    original: err && err.message ? err.message : null,
  };
}

/**
 * Buat objek error standar untuk kasus browser/device tidak
 * mendukung API kamera sama sekali (mis. getUserMedia tidak ada).
 * @returns {{code:string, message:string, original:null}}
 */
export function unsupportedCameraError() {
  return {
    code: CAMERA_ERROR_CODE.UNSUPPORTED,
    message: MESSAGES[CAMERA_ERROR_CODE.UNSUPPORTED],
    original: null,
  };
}
