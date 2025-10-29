const crypto = require('crypto');

/**
 * Módulo de encriptación para passwords de SQL Server
 * Usa AES-256-GCM para encriptar/desencriptar passwords
 */

// Clave de encriptación desde variable de entorno
// IMPORTANTE: En producción, establecer SYNC_PASSWORD_KEY con 32 bytes (64 caracteres hex)
const ENCRYPTION_KEY_HEX = process.env.SYNC_PASSWORD_KEY || '0'.repeat(64);
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Convierte la clave hexadecimal a Buffer
 */
function getEncryptionKey() {
  if (ENCRYPTION_KEY_HEX.length !== 64) {
    console.warn(
      'ADVERTENCIA: SYNC_PASSWORD_KEY debe tener 64 caracteres hexadecimales (32 bytes)'
    );
    // Generar clave temporal (NO usar en producción)
    return crypto.randomBytes(32);
  }
  return Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
}

/**
 * Encripta un password
 * @param {string} password - Password en texto plano
 * @returns {string} Password encriptado en formato base64
 */
function encryptPassword(password) {
  try {
    if (!password) {
      throw new Error('Password no puede estar vacío');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Formato: IV + AuthTag + Encrypted
    const result = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ]);

    return result.toString('base64');
  } catch (error) {
    console.error('Error al encriptar password:', error);
    throw new Error(`Error de encriptación: ${error.message}`);
  }
}

/**
 * Desencripta un password
 * @param {string} encryptedPassword - Password encriptado en base64
 * @returns {string} Password en texto plano
 */
function decryptPassword(encryptedPassword) {
  try {
    if (!encryptedPassword) {
      throw new Error('Password encriptado no puede estar vacío');
    }

    const key = getEncryptionKey();
    const buffer = Buffer.from(encryptedPassword, 'base64');

    // Extraer componentes
    const iv = buffer.slice(0, IV_LENGTH);
    const authTag = buffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error al desencriptar password:', error);
    throw new Error(`Error de desencriptación: ${error.message}`);
  }
}

/**
 * Genera una nueva clave de encriptación
 * @returns {string} Clave en formato hexadecimal (64 caracteres)
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verifica si hay una clave de encriptación configurada
 * @returns {boolean}
 */
function hasEncryptionKey() {
  return (
    process.env.SYNC_PASSWORD_KEY &&
    process.env.SYNC_PASSWORD_KEY.length === 64
  );
}

module.exports = {
  encryptPassword,
  decryptPassword,
  generateEncryptionKey,
  hasEncryptionKey,
};
