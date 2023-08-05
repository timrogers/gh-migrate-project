import winston from 'winston';
const { combine, timestamp, printf, colorize } = winston.format;

// TODO: Figure out how to make ESLint happy with this
// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
const format = printf(({ level, message, timestamp }): string => {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return `${timestamp} ${level}: ${message}`;
});

const generateLoggerOptions = (verbose: boolean): winston.LoggerOptions => {
  return {
    format: combine(colorize(), timestamp(), format),
    transports: [new winston.transports.Console({ level: verbose ? 'debug' : 'info' })],
  };
};

export const createLogger = (verbose: boolean): winston.Logger =>
  winston.createLogger(generateLoggerOptions(verbose));
