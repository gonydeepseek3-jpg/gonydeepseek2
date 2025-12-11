import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';
import { credentialStore } from './credentialStore.js';
import { offlineQueueManager } from './offlineQueueManager.js';
import { logger } from './logger.js';

const MODULE = 'HTTPInterceptor';

class HTTPInterceptor {
  constructor() {
    this.isOnline = true;
    this.baseUrl = process.env.ERPNEXT_BASE_URL || 'http://localhost:8000';
    this.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000');
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
  }

  makeHttpRequest(url, options) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: this.requestTimeout,
      };

      const request = client.request(urlObj, reqOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: parsed,
            });
          } catch {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: data,
            });
          }
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        request.write(
          typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
        );
      }

      request.end();
    });
  }

  setOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    logger.info(MODULE, `Connection status changed to: ${isOnline ? 'online' : 'offline'}`);
  }

  generateRequestHash(method, url, body) {
    const content = `${method}:${url}:${body || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  addAuthHeaders(headers = {}) {
    const creds = credentialStore.getCredentials();

    if (creds && creds.token) {
      headers['Authorization'] = `token ${creds.token}:${creds.secret}`;
    }

    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    return headers;
  }

  async executeRequest(method, url, options = {}) {
    const requestHash = this.generateRequestHash(method, url, options.body);

    try {
      const headers = this.addAuthHeaders(options.headers || {});

      if (this.isOnline) {
        return await this.executeOnlineRequest(method, url, headers, options, requestHash);
      } else {
        return await this.handleOfflineRequest(method, url, headers, options, requestHash);
      }
    } catch (error) {
      logger.error(MODULE, 'Request execution failed', {
        method,
        url,
        error: error.message,
      });

      if (!this.isOnline) {
        return this.handleOfflineRequest(method, url, options.headers || {}, options, requestHash);
      }

      throw error;
    }
  }

  async executeOnlineRequest(method, url, headers, options, requestHash) {
    try {
      const response = await this.makeHttpRequest(url, {
        method,
        headers,
        body: options.body,
      });

      if (response.status >= 400) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      offlineQueueManager.cacheResponse(requestHash, response.body);
      logger.debug(MODULE, 'Online request successful', { method, url });

      return {
        ok: true,
        status: response.status,
        data: response.body,
      };
    } catch (error) {
      logger.warn(MODULE, 'Online request failed, attempting offline handling', {
        method,
        url,
        error: error.message,
      });

      return this.handleOfflineRequest(method, url, headers, options, requestHash);
    }
  }

  async handleOfflineRequest(method, url, headers, options, requestHash) {
    const httpMethods = ['GET', 'HEAD', 'OPTIONS'];

    if (httpMethods.includes(method.toUpperCase())) {
      const cachedResponse = offlineQueueManager.getCachedResponse(requestHash);
      if (cachedResponse) {
        logger.info(MODULE, 'Returning cached response for GET request', { url });
        return {
          ok: true,
          status: 200,
          data: cachedResponse,
          cached: true,
        };
      }

      return {
        ok: false,
        status: 503,
        data: { message: 'Request not cached and offline mode active' },
        offline: true,
      };
    }

    const id = offlineQueueManager.addRequest(method, url, headers, options.body, requestHash);

    if (!id) {
      return {
        ok: false,
        status: 500,
        data: { message: 'Failed to queue request' },
      };
    }

    logger.info(MODULE, 'Request queued for later processing', { id, method, url });

    return {
      ok: true,
      status: 202,
      data: { message: 'Request queued for processing', queueId: id },
      queued: true,
    };
  }
}

export const httpInterceptor = new HTTPInterceptor();
