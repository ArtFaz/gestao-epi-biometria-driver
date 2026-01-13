const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Determina onde salvar os logs
// Se for PKG (EXE), salva ao lado do executável ou em %APPDATA% (futuro)
// Por enquanto, vamos salvar numa pasta 'logs' relativa ao executável
const logDir = process.pkg 
    ? path.join(path.dirname(process.execPath), 'logs') 
    : path.join(__dirname, '../../logs');

// Garante que a pasta existe
if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch(e){}
}

// Formato Customizado
const logFormat = winston.format.printf(({ level, message, timestamp, scope }) => {
    const scopeStr = scope ? `[${scope}]` : '';
    return `${timestamp} ${level.toUpperCase()} ${scopeStr} ${message}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        // 1. Arquivo Diário: 'driver-2026-01-13.log'
        new DailyRotateFile({
            filename: path.join(logDir, 'driver-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',      // Máximo 20MB por arquivo
            maxFiles: '14d',     // Mantém histórico de 14 dias
            level: 'info'
        }),
        // 2. Arquivo só de Erros
        new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '30d'
        })
    ]
});

// Adiciona Console apenas se NÃO estiver em produção silenciosa (ou se forçado via ENV)
// Em dev, queremos ver cores.
if (!process.pkg || process.env.ENABLE_CONSOLE_LOG === 'true') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, scope }) => {
                const scopeStr = scope ? `[${scope}]` : '';
                return `${timestamp} ${level} ${scopeStr} ${message}`;
            })
        )
    }));
}

// Wrapper para manter compatibilidade com o código antigo
module.exports = {
    info: (scope, msg) => logger.info(msg, { scope }),
    warn: (scope, msg) => logger.warn(msg, { scope }),
    error: (scope, msg, err = '') => logger.error(`${msg} ${err instanceof Error ? err.stack : err}`, { scope }),
    debug: (scope, msg) => logger.debug(msg, { scope }),
    
    // Log específico para o Python
    python: (msg) => logger.info(msg, { scope: 'PYTHON_ENGINE' })
};
