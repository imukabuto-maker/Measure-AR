/**
 * calibrationProfileRepository.js
 * ---------------------------------------------------------------
 * Wrapper domain-specific di atas Repository generik (repository.js,
 * Sprint 11) khusus untuk store "calibrationProfiles". Ini SATU-
 * SATUNYA modul yang boleh dipakai calibrationProfileManager.js untuk
 * membaca/menulis data profil — TIDAK PERNAH memanggil
 * createRepository()/databaseManager.js langsung dari luar sini.
 *
 * Juga menyediakan penyimpanan "profil terakhir dipakai" lewat store
 * generik 'settings' (dibuat Sprint 11) — bukan store terpisah, supaya
 * tidak perlu skema baru hanya untuk satu nilai key-value.
 * ---------------------------------------------------------------
 */

import { createRepository } from './repository.js';

const STORE_NAME = 'calibrationProfiles';
const LAST_USED_SETTING_KEY = 'lastUsedCalibrationProfileId';

const repo = createRepository(STORE_NAME);
const settingsRepo = createRepository('settings');

/** Ambil satu profil berdasarkan id. @param {string} id */
export async function findById(id) {
  return repo.getById(id);
}

/** Ambil seluruh profil. */
export async function findAll() {
  return repo.getAll();
}

/** Simpan profil baru. Gagal jika id sudah ada. @param {object} profile */
export async function insert(profile) {
  return repo.add(profile);
}

/** Simpan perubahan pada profil yang sudah ada (timpa). @param {object} profile */
export async function update(profile) {
  return repo.put(profile);
}

/** Hapus profil berdasarkan id. @param {string} id */
export async function remove(id) {
  return repo.remove(id);
}

/** Hitung jumlah profil tersimpan. */
export async function countAll() {
  return repo.count();
}

/**
 * Ambil id profil yang terakhir dipakai (dari sesi sebelumnya),
 * disimpan di store 'settings'. Null jika belum pernah ada yang dipilih.
 * @returns {Promise<string|null>}
 */
export async function getLastUsedProfileId() {
  const record = await settingsRepo.getById(LAST_USED_SETTING_KEY);
  return record ? record.value : null;
}

/**
 * Simpan id profil sebagai "terakhir dipakai" di store 'settings'.
 * @param {string|null} id
 */
export async function setLastUsedProfileId(id) {
  return settingsRepo.put({ key: LAST_USED_SETTING_KEY, value: id });
}
