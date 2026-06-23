import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

fs.mkdirSync(config.LOGS_DIR, { recursive: true });
fs.mkdirSync(path.join(config.LOGS_DIR, 'archive'), { recursive: true });

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp as string}] [${level}] ${message as string}${extras}`;
  })
);

export const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: path.join(config.LOGS_DIR, 'archiveforge.log'),
      maxsize: 1_048_576,
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(config.LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: 1_048_576,
      maxFiles: 3,
    }),
  ],
});
