/**
 * projectValidator.js
 * ---------------------------------------------------------------
 * Validasi data Project. Tanggung jawab TUNGGAL: memeriksa input,
 * TIDAK menyimpan state, TIDAK mengakses database — murni fungsi.
 * ---------------------------------------------------------------
 */

export const PROJECT_UNIT = Object.freeze({ MM: 'mm', CM: 'cm', IN: 'in' });
export const PROJECT_STATUS = Object.freeze({ ACTIVE: 'active', ARCHIVED: 'archived' });

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Validasi payload pembuatan project baru (field yang diisi user).
 * @param {{name:string, unit?:string, description?:string}} input
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateNewProjectInput(input) {
  const errors = [];
  const name = (input?.name ?? '').trim();

  if (!name) errors.push('Nama project wajib diisi.');
  if (name.length > MAX_NAME_LENGTH) errors.push(`Nama project maksimal ${MAX_NAME_LENGTH} karakter.`);

  if (input?.unit && !Object.values(PROJECT_UNIT).includes(input.unit)) {
    errors.push(`Satuan tidak valid: "${input.unit}".`);
  }

  if (input?.description && input.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`Deskripsi maksimal ${MAX_DESCRIPTION_LENGTH} karakter.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validasi nama project baru saat rename (trim otomatis).
 * @param {string} name
 * @returns {{valid:boolean, errors:string[], value:string}}
 */
export function validateProjectName(name) {
  const trimmed = (name ?? '').trim();
  const errors = [];
  if (!trimmed) errors.push('Nama project wajib diisi.');
  if (trimmed.length > MAX_NAME_LENGTH) errors.push(`Nama project maksimal ${MAX_NAME_LENGTH} karakter.`);
  return { valid: errors.length === 0, errors, value: trimmed };
}

/**
 * Validasi struktural record Project lengkap — sanity check bentuk
 * data (dipakai sebelum menyimpan), bukan business rule form input.
 * @param {object} project
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateProjectRecord(project) {
  if (!project || typeof project !== 'object') {
    return { valid: false, errors: ['Data project tidak valid.'] };
  }

  const errors = [];
  if (!project.id) errors.push('Project harus memiliki id.');
  if (!project.name || !String(project.name).trim()) errors.push('Project harus memiliki nama.');
  if (!project.createdAt) errors.push('Project harus memiliki createdAt.');
  if (typeof project.measurementCount !== 'number' || project.measurementCount < 0) {
    errors.push('measurementCount harus berupa angka >= 0.');
  }
  if (project.status && !Object.values(PROJECT_STATUS).includes(project.status)) {
    errors.push(`Status tidak valid: "${project.status}".`);
  }

  return { valid: errors.length === 0, errors };
}
