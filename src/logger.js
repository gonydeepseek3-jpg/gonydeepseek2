import fs from 'fs';
import path from 'path';
import { app } from 'electron';

class Logger {
  constructor() {
    this.logsDir = path.join(app.getPath('userData'), 'logs');
    this.logFile = path.join(this.logsDir, 'app.log');
    this.debugEnabled = process.env.DEBUG === 'true';

    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, module, message, data) {
    const timestamp = this.formatTimestamp();
    let msg = `[${timestamp}] [${level}] [${module}] ${message}`;
    if (data) {
      msg += ` ${JSON.stringify(data)}`;
    }
    return msg;
  }

  writeToFile(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, module, message, data) {
    const formatted = this.formatMessage(level, module, message, data);

    if (level === 'error' || level === 'warn' || this.debugEnabled) {
      console.log(formatted);
    }

    this.writeToFile(formatted);
  }

  info(module, message, data) {
    this.log('INFO', module, message, data);
  }

  warn(module, message, data) {
    this.log('WARN', module, message, data);
  }

  error(module, message, data) {
    this.log('ERROR', module, message, data);
  }

  debug(module, message, data) {
    if (this.debugEnabled) {
      this.log('DEBUG', module, message, data);
    }
  }
}

export const logger = new Logger();
