/**
 * databaseError.js
 * ---------------------------------------------------------------
 * Utilitas untuk menerjemahkan error native IndexedDB (DOMException)
 * menjadi kode & pesan yang konsisten dan mudah ditangani/ditampilkan.
 * Tanggung jawab TUNGGAL: pemetaan error — tidak menyimpan state,
 * tidak melakukan side effect. Sama pola dengan cameraError.js.
 * ---------------------------------------------------------------
 */

export const DB_ERROR_CODE = Object.freeze({
  UNSUPPORTED: 'unsupported',       // IndexedDB tidak tersedia di browser ini
  BLOCKED: 'blocked',               // upgrade diblokir oleh koneksi/tab lain
  VERSION_ERROR: 'version_error',   // versi yang diminta lebih rendah dari yang tersimpan
  QUOTA_EXCEEDED: 'quota_exceeded', // penyimpanan device penuh
  NOT_FOUND: 'not_found',           // store/index/record tidak ditemukan
  CONSTRAINT: 'constraint',         // pelanggaran constraint (mis. key duplikat pada add())
  ABORTED: 'aborted',               // transaksi dibatalkan
  UNKNOWN: 'unknown',
});

const MESSAGES = Object.freeze({
  [DB_ERROR_CODE.UNSUPPORTED]: 'Browser ini tidak mendukung IndexedDB.',
  [DB_ERROR_CODE.BLOCKED]: 'Upgrade database diblokir — tutup tab/instance lain aplikasi ini.',
  [DB_ERROR_CODE.VERSION_ERROR]: 'Versi database tidak valid.',
  [DB_ERROR_CODE.QUOTA_EXCEEDED]: 'Penyimpanan perangkat penuh.',
  [DB_ERROR_CODE.NOT_FOUND]: 'Data atau store yang diminta tidak ditemukan.',
  [DB_ERROR_CODE.CONSTRAINT]: 'Data dengan kunci tersebut sudah ada.',
  [DB_ERROR_CODE.ABORTED]: 'Operasi database dibatalkan.',
  [DB_ERROR_CODE.UNKNOWN]: 'Terjadi kesalahan tak terduga pada database.',
});

/**
 * Petakan native error (DOMException) dari IndexedDB ke kode error
 * internal aplikasi + pesan ramah-user.
 * @param {Error|DOMException|null} err
 * @returns {{code:string, message:string, original:string|null}}
 */
export function mapDatabaseError(err) {
  const name = err && err.name ? err.name : '';
  let code;

  switch (name) {
    case 'VersionError':
      code = DB_ERROR_CODE.VERSION_ERROR;
      break;
    case 'QuotaExceededError':
      code = DB_ERROR_CODE.QUOTA_EXCEEDED;
      break;
    case 'NotFoundError':
      code = DB_ERROR_CODE.NOT_FOUND;
      break;
    case 'ConstraintError':
      code = DB_ERROR_CODE.CONSTRAINT;
      break;
    case 'AbortError':
      code = DB_ERROR_CODE.ABORTED;
      break;
    default:
      code = DB_ERROR_CODE.UNKNOWN;
  }

  return {
    code,
    message: MESSAGES[code],
    original: err && err.message ? err.message : null,
  };
}

/**
 * Buat objek error standar untuk kasus browser tidak mendukung
 * IndexedDB sama sekali.
 * @returns {{code:string, message:string, original:null}}
 */
export function unsupportedDatabaseError() {
  return {
    code: DB_ERROR_CODE.UNSUPPORTED,
    message: MESSAGES[DB_ERROR_CODE.UNSUPPORTED],
    original: null,
  };
}

/** Buat objek error khusus saat upgrade database diblokir tab/koneksi lain. */
export function blockedDatabaseError() {
  return {
    code: DB_ERROR_CODE.BLOCKED,
    message: MESSAGES[DB_ERROR_CODE.BLOCKED],
    original: null,
  };
}
