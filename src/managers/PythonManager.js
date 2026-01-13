const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const constants = require('../config/constants');

class PythonManager {
    constructor() {
        this.process = null;
        this.isStopping = false;
    }

    start() {
        if (this.process) {
            logger.warn('PYTHON', 'Tentativa de iniciar Python, mas já existe um processo rodando.');
            return;
        }

        const isWin = process.platform === "win32";
        let pythonExecutable;
        let args = [];

        // VERIFICAÇÃO DE AMBIENTE: ESTOU RODANDO DENTRO DE UM EXE (PKG)?
        if (process.pkg) {
            // --- MODO PRODUÇÃO (EXE) ---
            pythonExecutable = path.join(path.dirname(process.execPath), 'bio-engine.exe');
            args = []; // Executável compilado não precisa de argumentos
            logger.info('PYTHON', '🏭 MODO PRODUÇÃO DETECTADO (PKG)');
        } else {
            // --- MODO DESENVOLVIMENTO (VENV) ---
            const pythonDir = path.join(__dirname, '../../python-core');
            // Tenta achar o executável correto dependendo do SO
            const pythonBin = isWin ? 'Scripts/python.exe' : 'bin/python';
            pythonExecutable = path.join(pythonDir, 'venv', pythonBin);
            
            const pythonScript = path.join(pythonDir, 'engine.py');
            args = [pythonScript];
            logger.info('PYTHON', '🛠️ MODO DESENVOLVIMENTO');
        }

        logger.info('PYTHON', `🐍 Inicializando BioEngine: ${pythonExecutable}`);

        try {
            // windowsHide: true -> Impede que abra aquela janela preta do CMD
            this.process = spawn(pythonExecutable, args, {
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe'] // Garante captura de logs mesmo escondido
            });

            this.process.stdout.on('data', (data) => logger.python(data.toString().trim()));
            this.process.stderr.on('data', (data) => logger.python(`ERR: ${data.toString().trim()}`));

            this.process.on('close', (code) => {
                logger.warn('PYTHON', `Processo Python encerrado com código ${code}`);
                this.process = null;
                // Futuro: Implementar auto-restart aqui se !this.isStopping
            });

            this.process.on('error', (err) => {
                logger.error('PYTHON', 'FALHA CRÍTICA ao iniciar Python', err.message);
                this.process = null;
            });

        } catch (e) {
            logger.error('PYTHON', 'Erro ao tentar spawnar o processo Python', e);
        }
    }

    stop() {
        this.isStopping = true;
        if (this.process) {
            logger.info('PYTHON', 'Encerrando BioEngine Python...');
            this.process.kill();
            this.process = null;
        }
    }

    getStatus() {
        return this.process && !this.process.killed ? 'running' : 'stopped';
    }
}

// Singleton
module.exports = new PythonManager();
