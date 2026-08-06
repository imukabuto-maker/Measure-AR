/**
 * calibrationProfileManager.js
 * ---------------------------------------------------------------
 * Facade Calibration Profile Manager (Sprint 13).
 * Tanggung jawab: create/edit/delete/duplicate/select/list PROFIL
 * kalibrasi (metadata saja) + menyimpan/memulihkan profil terakhir
 * dipakai. Akses data SELALU lewat calibrationProfileRepository.js
 * (Repository Pattern) — modul ini TIDAK PERNAH menyentuh
 * databaseManager.js atau IndexedDB secara langsung.
 *
 * BUKAN tanggung jawab modul ini (sengaja tidak dibuat sprint ini):
 * - Menjalankan proses kalibrasi (mengambil foto referensi, dst).
 * - Menghitung pixelPerUnit dari gambar (itu tugas Calibration Engine
 *   di Sprint 14) — pixelPerUnit di sini murni field yang DISIMPAN,
 *   nilainya boleh null sampai proses kalibrasi sungguhan mengisinya.
 * ---------------------------------------------------------------
 */

import * as calibrationProfileRepository from '../database/calibrationProfileRepository.js';
import {
  validateNewProfileInput,
  validateProfileName,
  CALIBRATION_UNIT,
  CALIBRATION_ORIENTATION,
} from '../utils/calibrationProfileValidator.js';
import {
  CALIBRATION_PROFILE_STATE,
  getCalibrationProfileState,
  setCalibrationProfileState,
  onCalibrationProfileStateChange,
  getActiveProfile,
} from './calibrationProfileState.js';

// Re-export supaya modul lain cukup import dari satu pintu (calibrationProfileManager)
export {
  CALIBRATION_PROFILE_STATE,
  CALIBRATION_UNIT,
  CALIBRATION_ORIENTATION,
  getCalibrationProfileState,
  onCalibrationProfileStateChange,
  getActiveProfile,
};

/** Buat id unik sederhana untuk profil baru. */
function generateProfileId() {
  return `calib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Muat seluruh profil dari database ke cache state, diurutkan dari
 * yang paling baru diperbarui.
 * @returns {Promise<object[]>}
 */
export async function listProfiles() {
  setCalibrationProfileState({ status: CALIBRATION_PROFILE_STATE.LOADING, errorMessage: null });
  try {
    const profiles = await calibrationProfileRepository.findAll();
    profiles.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    setCalibrationProfileState({ status: CALIBRATION_PROFILE_STATE.READY, profiles, errorMessage: null });
    return profiles;
  } catch (err) {
    setCalibrationProfileState({ status: CALIBRATION_PROFILE_STATE.ERROR, errorMessage: err.message ?? 'Gagal memuat daftar profil.' });
    throw err;
  }
}

/**
 * Buat profil kalibrasi baru. Memvalidasi input lebih dulu
 * (calibrationProfileValidator.js) sebelum menyimpan.
 * @param {{profileName:string, referenceLength:number, referenceUnit:string, pixelPerUnit?:number, cameraHeight?:number, orientation?:string, notes?:string}} input
 * @returns {Promise<object>} record profil yang tersimpan
 */
export async function createProfile(input) {
  const { valid, errors } = validateNewProfileInput(input);
  if (!valid) {
    const error = new Error(errors.join(' '));
    error.code = 'validation_error';
    error.details = errors;
    throw error;
  }

  const now = new Date().toISOString();
  const profile = {
    id: generateProfileId(),
    profileName: input.profileName.trim(),
    referenceLength: Number(input.referenceLength),
    referenceUnit: input.referenceUnit,
    // pixelPerUnit sengaja boleh null — baru diisi Calibration Engine
    // (Sprint 14) setelah proses kalibrasi sungguhan dijalankan.
    pixelPerUnit: input.pixelPerUnit != null ? Number(input.pixelPerUnit) : null,
    cameraHeight: input.cameraHeight != null ? Number(input.cameraHeight) : null,
    orientation: input.orientation ?? CALIBRATION_ORIENTATION.PORTRAIT,
    createdAt: now,
    updatedAt: now,
    notes: (input.notes ?? '').trim(),
  };

  await calibrationProfileRepository.insert(profile);
  const current = getCalibrationProfileState();
  setCalibrationProfileState({
    status: CALIBRATION_PROFILE_STATE.READY,
    profiles: [profile, ...current.profiles],
    errorMessage: null,
  });
  return profile;
}

/**
 * Edit profil (nama dan/atau field metadata lain) secara parsial.
 * `id`, `createdAt` tidak bisa diubah lewat fungsi ini.
 * @param {string} id
 * @param {Partial<object>} patch
 * @returns {Promise<object>} record profil setelah diperbarui
 */
export async function editProfile(id, patch) {
  const existing = await calibrationProfileRepository.findById(id);
  if (!existing) {
    const error = new Error(`Profil dengan id "${id}" tidak ditemukan.`);
    error.code = 'not_found';
    throw error;
  }

  let safePatch = patch;
  if (patch.profileName != null) {
    const { valid, errors, value } = validateProfileName(patch.profileName);
    if (!valid) {
      const error = new Error(errors.join(' '));
      error.code = 'validation_error';
      throw error;
    }
    safePatch = { ...patch, profileName: value };
  }

  const updated = {
    ...existing,
    ...safePatch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await calibrationProfileRepository.update(updated);
  const current = getCalibrationProfileState();
  setCalibrationProfileState({ profiles: current.profiles.map((p) => (p.id === id ? updated : p)) });
  return updated;
}

/**
 * Hapus profil. Jika profil yang dihapus sedang aktif, activeProfileId
 * ikut direset dan status "terakhir dipakai" ikut dihapus.
 * @param {string} id
 */
export async function deleteProfile(id) {
  await calibrationProfileRepository.remove(id);
  const current = getCalibrationProfileState();
  const wasActive = current.activeProfileId === id;

  setCalibrationProfileState({
    profiles: current.profiles.filter((p) => p.id !== id),
    activeProfileId: wasActive ? null : current.activeProfileId,
  });

  if (wasActive) {
    await calibrationProfileRepository.setLastUsedProfileId(null);
  }
}

/**
 * Duplikasi profil yang sudah ada: salin seluruh field kecuali
 * id/createdAt/updatedAt, nama baru diberi sufiks " (Salinan)".
 * @param {string} id
 * @returns {Promise<object>} record profil duplikat
 */
export async function duplicateProfile(id) {
  const existing = await calibrationProfileRepository.findById(id);
  if (!existing) {
    const error = new Error(`Profil dengan id "${id}" tidak ditemukan.`);
    error.code = 'not_found';
    throw error;
  }

  const now = new Date().toISOString();
  const duplicate = {
    ...existing,
    id: generateProfileId(),
    profileName: `${existing.profileName} (Salinan)`,
    createdAt: now,
    updatedAt: now,
  };

  await calibrationProfileRepository.insert(duplicate);
  const current = getCalibrationProfileState();
  setCalibrationProfileState({ profiles: [duplicate, ...current.profiles] });
  return duplicate;
}

/**
 * Pilih profil sebagai aktif, dan simpan sebagai "terakhir dipakai"
 * (persisten lewat store 'settings') supaya bisa dipulihkan otomatis
 * saat aplikasi dibuka lagi — tanpa perlu kalibrasi ulang dari awal.
 * @param {string} id
 * @returns {Promise<object>} record profil yang dipilih
 */
export async function selectActiveProfile(id) {
  const existing = await calibrationProfileRepository.findById(id);
  if (!existing) {
    const error = new Error(`Profil dengan id "${id}" tidak ditemukan.`);
    error.code = 'not_found';
    throw error;
  }
  setCalibrationProfileState({ activeProfileId: id, errorMessage: null });
  await calibrationProfileRepository.setLastUsedProfileId(id);
  return existing;
}

/**
 * Muat kembali profil terakhir dipakai (dari sesi sebelumnya) sebagai
 * profil aktif, jika ada dan masih tersedia di database. Cocok
 * dipanggil sekali saat aplikasi/halaman kalibrasi pertama dibuka.
 * @returns {Promise<object|null>} profil yang dipulihkan, atau null jika tidak ada
 */
export async function restoreLastUsedProfile() {
  const lastId = await calibrationProfileRepository.getLastUsedProfileId();
  if (!lastId) return null;

  const profile = await calibrationProfileRepository.findById(lastId);
  if (!profile) return null; // profil sudah dihapus sejak terakhir dipakai

  setCalibrationProfileState({ activeProfileId: lastId });
  return profile;
}
