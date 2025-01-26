import winston from 'npm:winston';
const { combine, timestamp, printf, colorize } = winston.format;

// TODO: Figure out how to make ESLint happy with this

const format = printf(({ level, message, timestamp }): string => {
  return `${timestamp} ${level}: ${message}`;
});

const generateLoggerOptions = (verbose: boolean): winston.LoggerOptions => {
  return {
    format: combine(colorize(), timestamp(), format),
    transports: [new winston.transports.Console({ level: verbose ? 'debug' : 'info' })],
  };
};

export const createLogger = (verbose: boolean): Logger =>
  winston.createLogger(generateLoggerOptions(verbose));

export interface Logger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (message: string, meta?: any) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message: string, meta?: any) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message: string, meta?: any) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message: string, meta?: any) => unknown;
}
