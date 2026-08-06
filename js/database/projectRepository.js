/**
 * projectRepository.js
 * ---------------------------------------------------------------
 * Wrapper domain-specific di atas Repository generik (repository.js,
 * Sprint 11) khusus untuk store "projects". Ini SATU-SATUNYA modul
 * yang boleh dipakai projectManager.js untuk membaca/menulis data
 * project — projectManager.js TIDAK PERNAH memanggil createRepository()
 * atau databaseManager.js secara langsung (sesuai Repository Pattern).
 * ---------------------------------------------------------------
 */

import { createRepository } from './repository.js';

const STORE_NAME = 'projects';
const repo = createRepository(STORE_NAME);

/** Ambil satu project berdasarkan id. @param {string} id */
export async function findById(id) {
  return repo.getById(id);
}

/** Ambil seluruh project. */
export async function findAll() {
  return repo.getAll();
}

/** Simpan project baru. Gagal jika id sudah ada. @param {object} project */
export async function insert(project) {
  return repo.add(project);
}

/** Simpan perubahan pada project yang sudah ada (timpa). @param {object} project */
export async function update(project) {
  return repo.put(project);
}

/** Hapus project berdasarkan id. @param {string} id */
export async function remove(id) {
  return repo.remove(id);
}

/** Hitung jumlah project tersimpan. */
export async function countAll() {
  return repo.count();
}
