const moment = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });

const formatMessage = (scope, msg) => {
    return `[${moment()}] [${scope}] ${msg}`;
};

const logger = {
    info: (scope, msg) => console.log(formatMessage(scope, msg)),
    warn: (scope, msg) => console.warn('\x1b[33m%s\x1b[0m', formatMessage(scope, msg)), // Amarelo
    error: (scope, msg, err = '') => console.error('\x1b[31m%s\x1b[0m', formatMessage(scope, msg), err), // Vermelho
    debug: (scope, msg) => {
        if (process.env.DEBUG) console.log('\x1b[36m%s\x1b[0m', formatMessage(scope, msg)); // Ciano
    },
    
    // Log específico para o Python
    python: (msg) => console.log(`\x1b[32m[${moment()}] [PYTHON_ENGINE]\x1b[0m ${msg}`) // Verde
};

module.exports = logger;