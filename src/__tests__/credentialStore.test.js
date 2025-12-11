import { describe, it, expect } from 'vitest';
import CryptoJS from 'crypto-js';

describe('CredentialStore', () => {
  it('should encrypt and decrypt data', () => {
    const secret = 'test-secret-key';
    const data = { username: 'user', password: 'pass' };

    const json = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(json, secret).toString();

    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('username');

    const decrypted = CryptoJS.AES.decrypt(encrypted, secret).toString(CryptoJS.enc.Utf8);
    const parsed = JSON.parse(decrypted);

    expect(parsed.username).toBe('user');
    expect(parsed.password).toBe('pass');
  });

  it('should generate consistent SHA256 hash', () => {
    const content = 'test-content';
    const hash1 = CryptoJS.SHA256(content).toString();
    const hash2 = CryptoJS.SHA256(content).toString();

    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', () => {
    const hash1 = CryptoJS.SHA256('content1').toString();
    const hash2 = CryptoJS.SHA256('content2').toString();

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty content', () => {
    const encrypted = CryptoJS.AES.encrypt('', 'secret').toString();
    const decrypted = CryptoJS.AES.decrypt(encrypted, 'secret').toString(CryptoJS.enc.Utf8);

    expect(decrypted).toBe('');
  });
});
