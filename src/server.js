const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const config = require('./config/appConfig');
const constants = require('./config/constants');
const logger = require('./utils/logger');
const BiometriaController = require('./controllers/BiometriaController');

const app = express();
let pythonProcess = null;

function startPythonEngine() {
    const isWin = process.platform === "win32";
    let pythonExecutable;
    let args = [];

    // VERIFICAÇÃO DE AMBIENTE: ESTOU RODANDO DENTRO DE UM EXE (PKG)?
    if (process.pkg) {
        // --- MODO PRODUÇÃO (EXE) ---
        pythonExecutable = path.join(path.dirname(process.execPath), 'bio-engine.exe');
        args = []; // Executável compilado não precisa de argumentos
        logger.info('SERVER', '🏭 MODO PRODUÇÃO DETECTADO (PKG)');
    } else {
        // --- MODO DESENVOLVIMENTO (VENV) ---
        const pythonDir = path.join(__dirname, '../python-core');
        pythonExecutable = path.join(pythonDir, 'venv', isWin ? 'Scripts/python.exe' : 'bin/python');
        const pythonScript = path.join(pythonDir, 'engine.py');
        args = [pythonScript];
        logger.info('SERVER', '🛠️ MODO DESENVOLVIMENTO');
    }

    logger.info('SERVER', `🐍 Inicializando BioEngine: ${pythonExecutable}`);

    try {
        pythonProcess = spawn(pythonExecutable, args);

        pythonProcess.stdout.on('data', (data) => logger.python(data.toString().trim()));
        pythonProcess.stderr.on('data', (data) => logger.python(`LOG: ${data.toString().trim()}`));

        pythonProcess.on('error', (err) => {
            logger.error('SERVER', 'FALHA CRÍTICA ao iniciar Python', err.message);
        });

    } catch (e) {
        logger.error('SERVER', 'Erro ao tentar spawnar o processo Python', e);
    }
}

// Inicia o Python assim que o Node arranca
startPythonEngine();

// --- MIDDLEWARE E ROTAS ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rota de Healthcheck
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        service: 'Gestor Biométrico (Node.js)',
        python_status: pythonProcess && !pythonProcess.killed ? 'running' : 'stopped',
        node_port: config.port,
        python_url: constants.PYTHON_ENGINE.BASE_URL
    });
});

// --- ROTAS DE NEGÓCIO ---

// 1. Cadastro: Node lê USB -> Manda img pro Python -> Python devolve Template
app.get('/capturar-cadastro', BiometriaController.capturarParaCadastro);

// 2. Entrega: Node lê USB -> Manda (TemplateBanco + ImgNova) pro Python -> Python devolve Match
app.post('/validar-entrega', BiometriaController.validarEntrega);


// --- LIMPEZA DE PROCESSOS ---
const cleanup = () => {
    if (pythonProcess) {
        logger.info('SERVER', 'Encerrando BioEngine Python...');
        pythonProcess.kill();
    }
    process.exit();
};

process.on('exit', cleanup);
process.on('SIGINT', cleanup);  // CTRL+C
process.on('SIGUSR1', cleanup);
process.on('SIGUSR2', cleanup);

// --- INICIAR SERVIDOR ---
app.listen(config.port, () => {
    logger.info('SERVER', '==================================================');
    logger.info('SERVER', `🤖 DRIVER MANAGER RODANDO EM: http://localhost:${config.port}`);
    logger.info('SERVER', `🔌 DLL Alvo: ${config.dllPath}`);
    logger.info('SERVER', '==================================================');
});