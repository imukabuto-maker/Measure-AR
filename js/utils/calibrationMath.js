/**
 * calibrationMath.js
 * ---------------------------------------------------------------
 * Fungsi matematika MURNI untuk kalibrasi. Tanggung jawab TUNGGAL:
 * kalkulasi jarak & pixel-per-unit — TIDAK ada state, TIDAK ada
 * akses DOM/kamera/database di sini.
 * ---------------------------------------------------------------
 */

/**
 * Hitung jarak Euclidean antara dua titik piksel.
 * @param {{x:number, y:number}} pointA
 * @param {{x:number, y:number}} pointB
 * @returns {number} jarak dalam satuan piksel
 */
export function calculatePixelDistance(pointA, pointB) {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Hitung pixel-per-unit: berapa piksel mewakili 1 satuan panjang
 * referensi dunia nyata (mm/cm/in).
 *
 *   pixelPerUnit = jarak_piksel_dua_titik / panjang_referensi
 *
 * Contoh: user tap dua ujung koin 25mm, jaraknya di gambar 350px →
 * pixelPerUnit = 350 / 25 = 14 (artinya 14 piksel mewakili 1mm).
 * Nilai ini nanti dipakai Measurement Engine (sprint mendatang)
 * dengan rumus kebalikannya: ukuran_mm = jarak_piksel / pixelPerUnit.
 *
 * @param {number} pixelDistance jarak dua titik dalam piksel
 * @param {number} referenceLength panjang referensi dunia nyata (harus > 0)
 * @returns {number}
 * @throws {Error} jika referenceLength <= 0
 */
export function calculatePixelPerUnit(pixelDistance, referenceLength) {
  if (!referenceLength || referenceLength <= 0) {
    throw new Error('[calibrationMath] referenceLength harus lebih dari 0.');
  }
  return pixelDistance / referenceLength;
}
