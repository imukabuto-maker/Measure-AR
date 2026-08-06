/**
 * projectManager.js
 * ---------------------------------------------------------------
 * Facade Project Manager (Sprint 12).
 * Tanggung jawab: create/open/rename/update/delete/list project,
 * memvalidasi input lewat projectValidator.js, dan mengelola state
 * lewat projectState.js. Akses data SELALU lewat projectRepository.js
 * (Repository Pattern) — modul ini TIDAK PERNAH menyentuh
 * databaseManager.js atau IndexedDB secara langsung.
 * ---------------------------------------------------------------
 */

import * as projectRepository from '../database/projectRepository.js';
import {
  validateNewProjectInput,
  validateProjectName,
  PROJECT_UNIT,
  PROJECT_STATUS,
} from '../utils/projectValidator.js';
import {
  PROJECT_MANAGER_STATE,
  getProjectManagerState,
  setProjectManagerState,
  onProjectManagerStateChange,
  getActiveProject,
} from './projectState.js';

// Re-export supaya modul lain cukup import dari satu pintu (projectManager)
export {
  PROJECT_MANAGER_STATE,
  PROJECT_UNIT,
  PROJECT_STATUS,
  getProjectManagerState,
  onProjectManagerStateChange,
  getActiveProject,
};

/** Buat id unik sederhana untuk project baru. */
function generateProjectId() {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Muat seluruh project dari database ke cache state, diurutkan dari
 * yang paling baru diperbarui. Dipanggil saat halaman daftar project dibuka.
 * @returns {Promise<object[]>}
 */
export async function listProjects() {
  setProjectManagerState({ status: PROJECT_MANAGER_STATE.LOADING, errorMessage: null });
  try {
    const projects = await projectRepository.findAll();
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    setProjectManagerState({ status: PROJECT_MANAGER_STATE.READY, projects, errorMessage: null });
    return projects;
  } catch (err) {
    setProjectManagerState({ status: PROJECT_MANAGER_STATE.ERROR, errorMessage: err.message ?? 'Gagal memuat daftar project.' });
    throw err;
  }
}

/**
 * Buat project baru. Memvalidasi input lebih dulu (projectValidator.js)
 * sebelum menyimpan lewat projectRepository.js.
 * @param {{name:string, unit?:string, description?:string, thumbnail?:string}} input
 * @returns {Promise<object>} record project yang tersimpan
 */
export async function createProject(input) {
  const { valid, errors } = validateNewProjectInput(input);
  if (!valid) {
    const error = new Error(errors.join(' '));
    error.code = 'validation_error';
    error.details = errors;
    throw error;
  }

  const now = new Date().toISOString();
  const project = {
    id: generateProjectId(),
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
    unit: input.unit ?? PROJECT_UNIT.MM,
    description: (input.description ?? '').trim(),
    thumbnail: input.thumbnail ?? null,
    calibrationProfileId: null, // Calibration Engine belum ada — diisi sprint mendatang
    measurementCount: 0,
    status: PROJECT_STATUS.ACTIVE,
  };

  try {
    await projectRepository.insert(project);
    const current = getProjectManagerState();
    setProjectManagerState({
      status: PROJECT_MANAGER_STATE.READY,
      projects: [project, ...current.projects],
      errorMessage: null,
    });
    return project;
  } catch (err) {
    setProjectManagerState({ status: PROJECT_MANAGER_STATE.ERROR, errorMessage: err.message ?? 'Gagal membuat project.' });
    throw err;
  }
}

/**
 * Buka project (jadikan project aktif) berdasarkan id. Selalu membaca
 * langsung dari database (bukan hanya cache) supaya data terbaru.
 * @param {string} id
 * @returns {Promise<object>} record project
 */
export async function openProject(id) {
  const project = await projectRepository.findById(id);
  if (!project) {
    const error = new Error(`Project dengan id "${id}" tidak ditemukan.`);
    error.code = 'not_found';
    throw error;
  }
  setProjectManagerState({ activeProjectId: id, errorMessage: null });
  return project;
}

/**
 * Ubah nama project.
 * @param {string} id
 * @param {string} newName
 * @returns {Promise<object>} record project setelah diperbarui
 */
export async function renameProject(id, newName) {
  const { valid, errors, value } = validateProjectName(newName);
  if (!valid) {
    const error = new Error(errors.join(' '));
    error.code = 'validation_error';
    throw error;
  }
  return updateProjectMetadata(id, { name: value });
}

/**
 * Perbarui metadata project secara parsial (unit, description,
 * thumbnail, status, calibrationProfileId, measurementCount, dst).
 * `id`, `createdAt` tidak bisa diubah lewat fungsi ini.
 * @param {string} id
 * @param {Partial<object>} patch
 * @returns {Promise<object>} record project setelah diperbarui
 */
export async function updateProjectMetadata(id, patch) {
  const existing = await projectRepository.findById(id);
  if (!existing) {
    const error = new Error(`Project dengan id "${id}" tidak ditemukan.`);
    error.code = 'not_found';
    throw error;
  }

  const updated = {
    ...existing,
    ...patch,
    id: existing.id,               // id tidak boleh berubah lewat patch
    createdAt: existing.createdAt, // createdAt tidak boleh berubah lewat patch
    updatedAt: new Date().toISOString(),
  };

  await projectRepository.update(updated);

  const current = getProjectManagerState();
  setProjectManagerState({
    projects: current.projects.map((p) => (p.id === id ? updated : p)),
  });
  return updated;
}

/**
 * Hapus project. Jika project yang dihapus sedang aktif, activeProjectId
 * ikut direset ke null.
 * @param {string} id
 */
export async function deleteProject(id) {
  await projectRepository.remove(id);
  const current = getProjectManagerState();
  setProjectManagerState({
    projects: current.projects.filter((p) => p.id !== id),
    activeProjectId: current.activeProjectId === id ? null : current.activeProjectId,
  });
}
