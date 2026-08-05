/**
 * repository.js
 * ---------------------------------------------------------------
 * Generic Data Service (Repository Pattern) — SATU-SATUNYA cara
 * modul lain (Project Manager, Calibration, Measurement, dst di
 * sprint mendatang) boleh membaca/menulis data. Modul lain TIDAK
 * BOLEH mengimpor databaseManager.js atau menyentuh IndexedDB
 * secara langsung — semua akses lewat createRepository() di sini.
 *
 * Setiap operasi bersifat asynchronous (async/await + Promise) dan
 * seluruh error dipetakan lewat databaseError.js sebelum dilempar
 * ke pemanggil, supaya error selalu konsisten di seluruh aplikasi.
 * ---------------------------------------------------------------
 */

import { getDatabase } from './databaseManager.js';
import { mapDatabaseError } from './databaseError.js';

/**
 * Bungkus satu IDBRequest menjadi Promise.
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(mapDatabaseError(request.error));
  });
}

/**
 * Buat instance Repository untuk satu object store tertentu.
 * @param {string} storeName nama store, harus sudah terdaftar di databaseConfig.js SCHEMA
 * @returns {{
 *   getById: (id: any) => Promise<any>,
 *   getAll: () => Promise<any[]>,
 *   add: (item: object) => Promise<any>,
 *   put: (item: object) => Promise<any>,
 *   remove: (id: any) => Promise<void>,
 *   clear: () => Promise<void>,
 *   count: () => Promise<number>,
 *   queryByIndex: (indexName: string, value: any) => Promise<any[]>,
 * }}
 */
export function createRepository(storeName) {
  /**
   * Jalankan satu operasi pada store ini di dalam transaksi baru,
   * dengan error handling seragam (baik error sinkron saat membuat
   * transaksi/request, maupun error asynchronous dari request itu sendiri).
   * @param {'readonly'|'readwrite'} mode
   * @param {(store: IDBObjectStore) => IDBRequest} executor
   */
  async function run(mode, executor) {
    const db = await getDatabase();
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = executor(store);
      return await requestToPromise(request);
    } catch (err) {
      // Error sinkron (mis. store tidak ditemukan) juga dipetakan
      // konsisten lewat databaseError.js.
      throw err.code ? err : mapDatabaseError(err);
    }
  }

  return {
    /** Ambil satu record berdasarkan primary key. */
    getById: (id) => run('readonly', (store) => store.get(id)),

    /** Ambil seluruh record dalam store. */
    getAll: () => run('readonly', (store) => store.getAll()),

    /** Tambah record baru. Gagal (ConstraintError) jika key sudah ada. */
    add: (item) => run('readwrite', (store) => store.add(item)),

    /** Tambah record baru ATAU timpa jika key sudah ada. */
    put: (item) => run('readwrite', (store) => store.put(item)),

    /** Hapus satu record berdasarkan primary key. */
    remove: (id) => run('readwrite', (store) => store.delete(id)),

    /** Hapus seluruh record dalam store. */
    clear: () => run('readwrite', (store) => store.clear()),

    /** Hitung jumlah record dalam store. */
    count: () => run('readonly', (store) => store.count()),

    /** Ambil seluruh record yang cocok dengan nilai pada index tertentu. */
    queryByIndex: (indexName, value) =>
      run('readonly', (store) => store.index(indexName).getAll(value)),
  };
}
