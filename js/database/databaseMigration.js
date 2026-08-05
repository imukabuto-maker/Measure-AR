/**
 * databaseMigration.js
 * ---------------------------------------------------------------
 * Modul khusus menjalankan migrasi skema IndexedDB.
 * Tanggung jawab TUNGGAL: membaca SCHEMA dari databaseConfig.js dan
 * membuat/menyesuaikan object store + index di dalam event
 * 'upgradeneeded' — TIDAK membuka koneksi database sendiri (itu
 * tanggung jawab databaseManager.js, satu-satunya pemanggil modul ini).
 *
 * STRATEGI MIGRASI:
 * Iterasi setiap nomor versi dari (oldVersion + 1) sampai newVersion,
 * secara BERURUTAN — persis seperti migration file di database SQL
 * konvensional. Setiap store/index dibuat hanya jika belum ada
 * (idempotent), sehingga aman dijalankan baik untuk instalasi baru
 * (oldVersion=0) maupun upgrade dari versi lama.
 * ---------------------------------------------------------------
 */

import { SCHEMA } from './databaseConfig.js';

/**
 * Jalankan seluruh migrasi yang diperlukan dari oldVersion ke
 * newVersion. HARUS dipanggil di dalam handler 'onupgradeneeded'
 * (satu-satunya momen browser mengizinkan create/alter object store).
 * @param {IDBDatabase} db
 * @param {number} oldVersion versi database sebelumnya (0 jika baru)
 * @param {number} newVersion versi database yang diminta
 * @param {IDBTransaction} transaction transaksi versionchange yang sedang berjalan
 */
export function runMigrations(db, oldVersion, newVersion, transaction) {
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    const versionSchema = SCHEMA[version];
    if (!versionSchema) {
      // Versi ini tidak menambah perubahan skema (mis. dipakai untuk
      // perubahan non-struktural di masa depan) — lewati dengan aman.
      continue;
    }

    applyStoreDefinitions(db, transaction, versionSchema.stores || []);
    console.log(`[databaseMigration] Migrasi ke versi ${version} selesai.`);
  }
}

/**
 * Terapkan daftar definisi store untuk satu versi skema: buat store
 * jika belum ada, lalu pastikan seluruh index yang didefinisikan ada.
 * @param {IDBDatabase} db
 * @param {IDBTransaction} transaction
 * @param {Array<{name:string, options:object, indexes?:Array<{name:string,keyPath:string,options?:object}>}>} storeDefs
 */
function applyStoreDefinitions(db, transaction, storeDefs) {
  storeDefs.forEach((storeDef) => {
    let store;

    if (!db.objectStoreNames.contains(storeDef.name)) {
      store = db.createObjectStore(storeDef.name, storeDef.options);
    } else {
      // Store sudah ada dari versi sebelumnya — ambil referensinya lewat
      // transaksi upgrade yang sedang berjalan supaya bisa tambah index baru.
      store = transaction.objectStore(storeDef.name);
    }

    (storeDef.indexes || []).forEach((indexDef) => {
      if (!store.indexNames.contains(indexDef.name)) {
        store.createIndex(indexDef.name, indexDef.keyPath, indexDef.options || {});
      }
    });
  });
}
