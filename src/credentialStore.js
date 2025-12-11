import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { logger } from './logger.js';

const MODULE = 'CredentialStore';

class CredentialStore {
  constructor() {
    this.secret = this.deriveSecret();
    this.credentials = {};
  }

  deriveSecret() {
    const machineId = crypto.randomBytes(16).toString('hex');
    const appSecret = process.env.APP_SECRET || 'posawesome-default-secret';
    return CryptoJS.SHA256(appSecret + machineId).toString();
  }

  encryptData(data) {
    try {
      const json = JSON.stringify(data);
      return CryptoJS.AES.encrypt(json, this.secret).toString();
    } catch (error) {
      logger.error(MODULE, 'Failed to encrypt credentials', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  decryptData(encrypted) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, this.secret).toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error(MODULE, 'Failed to decrypt credentials', { error: error.message });
      throw new Error('Decryption failed');
    }
  }

  storeCredentials(token, secret) {
    try {
      this.credentials = {
        token,
        secret,
        storedAt: new Date().toISOString(),
      };
      logger.info(MODULE, 'Credentials stored securely');
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to store credentials', { error: error.message });
      return false;
    }
  }

  getCredentials() {
    try {
      if (!this.credentials || !this.credentials.token) {
        return null;
      }
      return {
        token: this.credentials.token,
        secret: this.credentials.secret,
      };
    } catch (error) {
      logger.error(MODULE, 'Failed to retrieve credentials', { error: error.message });
      return null;
    }
  }

  clearCredentials() {
    try {
      this.credentials = {};
      logger.info(MODULE, 'Credentials cleared');
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to clear credentials', { error: error.message });
      return false;
    }
  }

  hasCredentials() {
    return this.credentials && !!this.credentials.token;
  }
}

export const credentialStore = new CredentialStore();
