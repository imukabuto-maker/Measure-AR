/**
 * databaseManager.js
 * ---------------------------------------------------------------
 * SATU-SATUNYA modul yang boleh menyentuh IndexedDB secara langsung
 * (buka/buat database, tangani versioning, tangani upgrade). Modul
 * lain di luar folder js/database/ WAJIB mengakses data lewat
 * repository.js — bukan lewat modul ini.
 *
 * Tanggung jawab: siklus hidup KONEKSI database (buka sekali, cache
 * sebagai singleton, tutup saat diperlukan). Migrasi skema
 * didelegasikan ke databaseMigration.js.
 * ---------------------------------------------------------------
 */

import { DB_NAME, DB_VERSION } from './databaseConfig.js';
import { runMigrations } from './databaseMigration.js';
import { mapDatabaseError, unsupportedDatabaseError } from './databaseError.js';

// Koneksi database aktif — singleton di dalam modul ini, tidak
// diekspor langsung supaya siklus hidupnya hanya dikontrol lewat
// fungsi di bawah.
let dbInstance = null;
let openingPromise = null;

/**
 * Buka (atau buat jika belum ada) database IndexedDB aplikasi.
 * Aman dipanggil berkali-kali — jika sudah terbuka, mengembalikan
 * instance yang sama (singleton); jika sedang dalam proses membuka,
 * mengembalikan promise yang sama supaya tidak ada race condition
 * membuka koneksi ganda.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (openingPromise) return openingPromise;

  if (typeof indexedDB === 'undefined') {
    return Promise.reject(unsupportedDatabaseError());
  }

  openingPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Satu-satunya momen browser mengizinkan create/alter object store —
    // didelegasikan sepenuhnya ke databaseMigration.js.
    request.onupgradeneeded = (event) => {
      try {
        const db = event.target.result;
        const transaction = event.target.transaction;
        runMigrations(db, event.oldVersion, event.newVersion, transaction);
      } catch (err) {
        console.error('[databaseManager] Migrasi gagal:', err.message);
        // Batalkan transaksi upgrade supaya database tidak tersimpan
        // dalam kondisi skema setengah jadi.
        event.target.transaction.abort();
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // Jika versi baru diminta dari tab/instance lain, tutup koneksi
      // ini supaya upgrade di tab lain tidak terblokir selamanya.
      dbInstance.onversionchange = () => {
        console.warn('[databaseManager] Versi database berubah dari koneksi lain — menutup koneksi ini.');
        dbInstance.close();
        dbInstance = null;
      };

      openingPromise = null;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      openingPromise = null;
      console.error('[databaseManager] Gagal membuka database:', event.target.error?.message);
      reject(mapDatabaseError(event.target.error));
    };

    request.onblocked = () => {
      // Terjadi saat ada koneksi/tab lain yang masih membuka versi
      // lama dan belum ditutup — upgrade menunggu sampai itu selesai.
      console.warn('[databaseManager] Upgrade database diblokir oleh koneksi lain (tab/instance lain masih terbuka).');
    };
  });

  return openingPromise;
}

/**
 * Tutup koneksi database aktif (jika ada). Aman dipanggil berulang.
 * Koneksi akan otomatis dibuka lagi pada panggilan openDatabase()/
 * getDatabase() berikutnya.
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * [Internal — HANYA untuk dipakai repository.js]
 * Ambil instance database yang siap dipakai untuk membuat transaksi.
 * Modul di luar folder js/database/ TIDAK BOLEH memanggil ini
 * langsung — gunakan createRepository() dari repository.js.
 * @returns {Promise<IDBDatabase>}
 */
export async function getDatabase() {
  return openDatabase();
}
