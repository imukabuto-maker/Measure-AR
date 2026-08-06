/**
 * databaseConfig.js
 * ---------------------------------------------------------------
 * Konfigurasi & skema database IndexedDB MeasureVision.
 * Tanggung jawab TUNGGAL: mendeklarasikan nama/versi database dan
 * skema object store per versi — TIDAK ADA logika buka/migrasi di
 * sini (itu tanggung jawab databaseManager.js / databaseMigration.js).
 *
 * CARA MENAMBAH SKEMA BARU DI SPRINT MENDATANG:
 * 1) Naikkan DB_VERSION.
 * 2) Tambah entri baru di SCHEMA dengan key = versi baru tsb, berisi
 *    daftar store/index yang ingin ditambahkan pada versi itu.
 * 3) databaseMigration.js otomatis menjalankan entri baru ini saat
 *    database dibuka dengan versi lebih tinggi dari yang tersimpan
 *    di browser pengguna — tidak perlu mengubah kode migrasi.
 * ---------------------------------------------------------------
 */

export const DB_NAME = 'measurevision-db';

// Naikkan angka ini setiap kali menambah entri baru ke SCHEMA.
export const DB_VERSION = 3;

/**
 * Skema per versi. Setiap key adalah nomor versi; isinya daftar
 * store yang harus ADA pada versi tsb (dibuat jika belum ada — bukan
 * dihapus/diganti, supaya migrasi selalu aman & idempotent).
 */
export const SCHEMA = Object.freeze({
  1: {
    stores: [
      {
        name: 'projects',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
        ],
      },
    ],
  },
  2: {
    stores: [
      {
        name: 'settings',
        options: { keyPath: 'key' },
        indexes: [],
      },
    ],
  },
  // [Sprint 13] Calibration Profile Manager — hanya menyimpan
  // metadata profil kalibrasi, tidak ada logika kalkulasi di sini.
  3: {
    stores: [
      {
        name: 'calibrationProfiles',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ],
      },
    ],
  },
});
