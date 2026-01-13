const express = require('express');
const cors = require('cors');
const config = require('./config/appConfig');
const logger = require('./utils/logger');
const PythonManager = require('./managers/PythonManager');
const biometriaRoutes = require('./routes/biometria.routes');

const app = express();

// --- INICIALIZAÇÃO ---
// Inicia o motor biométrico em segundo plano
PythonManager.start();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- ROTAS ---
app.use('/', biometriaRoutes);

// --- HANDLERS DE ERRO GLOBAIS ---
// Captura erros 404
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

// Captura erros internos (500)
app.use((err, req, res, next) => {
    logger.error('SERVER', 'Erro não tratado:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor',
        error: err.message 
    });
});

// --- LIMPEZA DE PROCESSOS ---
const cleanup = () => {
    logger.info('SERVER', 'Recebido sinal de encerramento. Parando serviços...');
    PythonManager.stop();
    process.exit(0);
};

process.on('SIGINT', cleanup);  // CTRL+C
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);
// process.exit é chamado dentro de cleanup, então não precisamos ouvir 'exit' aqui para evitar loop

// --- START ---
app.listen(config.port, () => {
    logger.info('SERVER', '==================================================');
    logger.info('SERVER', `🤖 DRIVER MANAGER RODANDO EM: http://localhost:${config.port}`);
    logger.info('SERVER', `🔌 DLL Alvo: ${config.dllPath}`);
    logger.info('SERVER', '==================================================');
});
