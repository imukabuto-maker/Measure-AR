/**
 * calibrationProfileValidator.js
 * ---------------------------------------------------------------
 * Validasi data Calibration Profile. Tanggung jawab TUNGGAL:
 * memeriksa input — TIDAK menyimpan state, TIDAK mengakses database,
 * dan TIDAK melakukan kalkulasi piksel apa pun (hanya memvalidasi
 * bahwa field numerik yang DIBERIKAN masuk akal, mis. > 0).
 * ---------------------------------------------------------------
 */

export const CALIBRATION_UNIT = Object.freeze({ MM: 'mm', CM: 'cm', IN: 'in' });
export const CALIBRATION_ORIENTATION = Object.freeze({ PORTRAIT: 'portrait', LANDSCAPE: 'landscape' });

const MAX_NAME_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;

/**
 * Validasi payload pembuatan profil baru.
 * @param {{profileName:string, referenceLength:number, referenceUnit:string, pixelPerUnit?:number, cameraHeight?:number, orientation?:string, notes?:string}} input
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateNewProfileInput(input) {
  const errors = [];
  const profileName = (input?.profileName ?? '').trim();

  if (!profileName) errors.push('Nama profil wajib diisi.');
  if (profileName.length > MAX_NAME_LENGTH) errors.push(`Nama profil maksimal ${MAX_NAME_LENGTH} karakter.`);

  const referenceLength = Number(input?.referenceLength);
  if (input?.referenceLength == null || Number.isNaN(referenceLength) || referenceLength <= 0) {
    errors.push('Panjang referensi harus berupa angka lebih dari 0.');
  }

  if (!input?.referenceUnit || !Object.values(CALIBRATION_UNIT).includes(input.referenceUnit)) {
    errors.push('Satuan referensi tidak valid.');
  }

  // pixelPerUnit bersifat OPSIONAL saat profil dibuat — biasanya baru
  // terisi setelah proses kalibrasi sungguhan dijalankan (Sprint 14+).
  // Modul ini hanya memvalidasi kewajaran nilainya JIKA diisi, tidak
  // pernah menghitungnya sendiri.
  if (input?.pixelPerUnit != null) {
    const ppu = Number(input.pixelPerUnit);
    if (Number.isNaN(ppu) || ppu <= 0) errors.push('pixelPerUnit harus berupa angka lebih dari 0 jika diisi.');
  }

  if (input?.cameraHeight != null) {
    const height = Number(input.cameraHeight);
    if (Number.isNaN(height) || height <= 0) errors.push('cameraHeight harus berupa angka lebih dari 0 jika diisi.');
  }

  if (input?.orientation && !Object.values(CALIBRATION_ORIENTATION).includes(input.orientation)) {
    errors.push('Orientasi tidak valid.');
  }

  if (input?.notes && input.notes.length > MAX_NOTES_LENGTH) {
    errors.push(`Catatan maksimal ${MAX_NOTES_LENGTH} karakter.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validasi nama profil saat rename (trim otomatis).
 * @param {string} name
 * @returns {{valid:boolean, errors:string[], value:string}}
 */
export function validateProfileName(name) {
  const trimmed = (name ?? '').trim();
  const errors = [];
  if (!trimmed) errors.push('Nama profil wajib diisi.');
  if (trimmed.length > MAX_NAME_LENGTH) errors.push(`Nama profil maksimal ${MAX_NAME_LENGTH} karakter.`);
  return { valid: errors.length === 0, errors, value: trimmed };
}

/**
 * Validasi struktural record CalibrationProfile lengkap — sanity
 * check bentuk data, bukan business rule form input.
 * @param {object} profile
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateProfileRecord(profile) {
  if (!profile || typeof profile !== 'object') {
    return { valid: false, errors: ['Data profil tidak valid.'] };
  }

  const errors = [];
  if (!profile.id) errors.push('Profil harus memiliki id.');
  if (!profile.profileName || !String(profile.profileName).trim()) errors.push('Profil harus memiliki nama.');
  if (!profile.createdAt) errors.push('Profil harus memiliki createdAt.');
  if (typeof profile.referenceLength !== 'number' || profile.referenceLength <= 0) {
    errors.push('referenceLength harus berupa angka lebih dari 0.');
  }
  if (!Object.values(CALIBRATION_UNIT).includes(profile.referenceUnit)) {
    errors.push(`referenceUnit tidak valid: "${profile.referenceUnit}".`);
  }

  return { valid: errors.length === 0, errors };
}
