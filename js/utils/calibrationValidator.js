/**
 * calibrationValidator.js
 * ---------------------------------------------------------------
 * Validasi input & hasil proses kalibrasi. Tanggung jawab TUNGGAL:
 * memeriksa data — TIDAK ada state, TIDAK ada akses DOM/database.
 * ---------------------------------------------------------------
 */

export const CALIBRATION_QUALITY = Object.freeze({
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
});

const VALID_UNITS = ['mm', 'cm', 'in'];

// Di bawah jarak ini (piksel), dua titik dianggap terlalu berdekatan
// untuk menghasilkan kalibrasi yang akurat — kesalahan tap 1-2px akan
// berpengaruh besar secara proporsional terhadap hasil.
const MIN_PIXEL_DISTANCE = 20;

/**
 * Validasi input panjang & satuan referensi yang dimasukkan user.
 * @param {number|string} value
 * @param {string} unit
 * @returns {{valid:boolean, errors:string[], value:number}}
 */
export function validateReferenceLength(value, unit) {
  const errors = [];
  const num = Number(value);

  if (value === '' || value == null || Number.isNaN(num) || num <= 0) {
    errors.push('Panjang referensi harus berupa angka lebih dari 0.');
  }
  if (!unit || !VALID_UNITS.includes(unit)) {
    errors.push('Satuan referensi tidak valid.');
  }

  return { valid: errors.length === 0, errors, value: num };
}

/**
 * Validasi bahwa dua titik yang dipilih user cukup berjarak untuk
 * kalibrasi yang akurat.
 * @param {{x:number,y:number}|null} pointA
 * @param {{x:number,y:number}|null} pointB
 * @returns {{valid:boolean, errors:string[], pixelDistance:number}}
 */
export function validatePoints(pointA, pointB) {
  if (!pointA || !pointB) {
    return { valid: false, errors: ['Dua titik referensi harus dipilih.'], pixelDistance: 0 };
  }

  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);

  const errors = [];
  if (pixelDistance < MIN_PIXEL_DISTANCE) {
    errors.push(`Jarak dua titik terlalu dekat (${pixelDistance.toFixed(1)}px) — pilih titik yang lebih berjauhan.`);
  }

  return { valid: errors.length === 0, errors, pixelDistance };
}

/**
 * Nilai kualitas kalibrasi berdasarkan proporsi jarak piksel yang
 * dipakai terhadap diagonal frame kamera — semakin jauh jarak dua
 * titik (relatif terhadap ukuran frame), semakin presisi hasilnya,
 * karena kesalahan tap 1-2px berpengaruh lebih kecil secara proporsional.
 * @param {number} pixelDistance
 * @param {number} frameDiagonal diagonal frame dalam piksel (native video)
 * @returns {string} salah satu nilai CALIBRATION_QUALITY
 */
export function assessCalibrationQuality(pixelDistance, frameDiagonal) {
  if (!frameDiagonal || frameDiagonal <= 0) return CALIBRATION_QUALITY.FAIR;
  const ratio = pixelDistance / frameDiagonal;
  if (ratio >= 0.25) return CALIBRATION_QUALITY.GOOD;
  if (ratio >= 0.1) return CALIBRATION_QUALITY.FAIR;
  return CALIBRATION_QUALITY.POOR;
}
