const koffi = require('koffi');
const config = require('../config/appConfig');
const constants = require('../config/constants');
const logger = require('../utils/logger');
const fs = require('fs');

class FutronicDriver {
    constructor() {
        this.libFutronic = null;
        this.ftrFuncs = {};
        this.isScanning = false; // MUTEX: Trava de concorrência
        this.driverLoaded = false;
        
        this.init();
    }

    init() {
        if (config.useMock) {
            logger.info('DRIVER', '⚠️ INICIADO EM MODO MOCK (Simulação de Hardware) ⚠️');
            return;
        }

        try {
            if (!fs.existsSync(config.dllPath)) {
                logger.warn('DRIVER', `DLL não encontrada em: ${config.dllPath}`);
                return;
            }

            this.libFutronic = koffi.load(config.dllPath);

            // Mapeamento das funções (Sintaxe Koffi 2.9+)
            this.ftrFuncs = {
                openDevice: this.libFutronic.func('void* ftrScanOpenDevice()'),
                closeDevice: this.libFutronic.func('bool ftrScanCloseDevice(void* hDevice)'),
                isFingerPresent: this.libFutronic.func('bool ftrScanIsFingerPresent(void* hDevice, void* pFrameParams)'),
                setDiodesStatus: this.libFutronic.func('bool ftrScanSetDiodesStatus(void* hDevice, char byGreen, char byRed)'),
                getImage: this.libFutronic.func('bool ftrScanGetImage(void* hDevice, int nDose, _Out_ uint8_t* pBuffer)')
            };
            
            logger.info('DRIVER', 'DLL Futronic carregada com sucesso.');
            this.driverLoaded = true;
        } catch (error) {
            logger.error('DRIVER', "Erro crítico ao carregar DLL:", error.message);
        }
    }

    // Helper: Cria cabeçalho BMP
    createBMPHeader(width, height) {
        const fileSize = 54 + 1024 + (width * height);
        const buffer = Buffer.alloc(1078);

        buffer.write('BM');
        buffer.writeUInt32LE(fileSize, 2);
        buffer.writeUInt32LE(54 + 1024, 10);
        buffer.writeUInt32LE(40, 14);
        buffer.writeUInt32LE(width, 18);
        buffer.writeInt32LE(-height, 22); // Negativo para Top-Down
        buffer.writeUInt16LE(1, 26);
        buffer.writeUInt16LE(8, 28);
        buffer.writeUInt32LE(0, 30);
        buffer.writeUInt32LE(width * height, 34);
        buffer.writeUInt32LE(0, 46);

        // Paleta Grayscale
        for (let i = 0; i < 256; i++) {
            const offset = 54 + i * 4;
            buffer[offset] = buffer[offset + 1] = buffer[offset + 2] = i;
        }
        return buffer;
    }

    async capturarDigital() {
        // 1. Verificação de Concorrência (MUTEX)
        if (this.isScanning) {
            logger.warn('DRIVER', 'Bloqueio: Uma captura já está em andamento.');
            throw new Error("O leitor está ocupado. Aguarde a captura atual terminar.");
        }

        // Modo Mock (Sem Hardware)
        if (config.useMock || !this.driverLoaded) {
            return this.mockCapture();
        }

        this.isScanning = true;
        let hDevice = null;
        let checkFinger = null;

        try {
            return await new Promise(async (resolve, reject) => {
                try {
                    // A. Abrir Dispositivo
                    hDevice = this.ftrFuncs.openDevice();

                    if (!hDevice || koffi.address(hDevice) === 0n) {
                        throw new Error("Falha ao abrir leitor. Verifique conexão USB.");
                    }

                    // B. Feedback Visual (LED)
                    try {
                        this.ftrFuncs.setDiodesStatus(hDevice, constants.FUTRONIC.LED_INTENSITY, 0);
                    } catch (e) { 
                        logger.debug('DRIVER', `Falha ao acender LED: ${e.message}`);
                    }

                    let attempts = 0;
                    logger.info('DRIVER', 'Aguardando dedo no sensor...');

                    // C. Loop de Espera (Polling)
                    checkFinger = setInterval(() => {
                        attempts++;
                        const hasFinger = this.ftrFuncs.isFingerPresent(hDevice, null);

                        if (hasFinger) {
                            clearInterval(checkFinger);
                            logger.info('DRIVER', 'Dedo detectado! Capturando...');

                            // D. Captura Real
                            try {
                                const { FRAME_WIDTH, FRAME_HEIGHT } = constants.FUTRONIC;
                                const bufferSize = FRAME_WIDTH * FRAME_HEIGHT;
                                const imageBuffer = new Uint8Array(bufferSize);

                                const captured = this.ftrFuncs.getImage(hDevice, 4, imageBuffer);
                                if (!captured) throw new Error("Erro ao transferir imagem do sensor.");

                                // Processamento
                                const bmpHeader = this.createBMPHeader(FRAME_WIDTH, FRAME_HEIGHT);
                                const finalBuffer = Buffer.concat([bmpHeader, Buffer.from(imageBuffer)]);
                                const base64Image = finalBuffer.toString('base64');

                                resolve({
                                    status: constants.FUTRONIC.STATUS_OK,
                                    template: base64Image,
                                    image: `data:image/bmp;base64,${base64Image}`,
                                    metadata: { width: FRAME_WIDTH, height: FRAME_HEIGHT, device: "FS88H" }
                                });

                            } catch (captureErr) {
                                reject(captureErr);
                            }

                        } else if (attempts >= constants.FUTRONIC.MAX_ATTEMPTS) {
                            clearInterval(checkFinger);
                            reject(new Error("Tempo limite excedido. Nenhum dedo detectado."));
                        }
                    }, constants.FUTRONIC.POLLING_INTERVAL_MS);

                } catch (err) {
                    if (checkFinger) clearInterval(checkFinger);
                    reject(err);
                }
            });

        } finally {
            // BLOCO FINALLY: Garante limpeza e libera Mutex sempre
            if (hDevice) {
                try { this.ftrFuncs.setDiodesStatus(hDevice, 0, 0); } catch(e) {}
                try { this.ftrFuncs.closeDevice(hDevice); } catch(e) {}
            }
            this.isScanning = false; // LIBERA O DRIVER
        }
    }

    async mockCapture() {
        logger.warn('DRIVER', "Modo Mock ativado. Simulando...");
        this.isScanning = true;
        await new Promise(r => setTimeout(r, 1500)); // Simula tempo de leitura
        this.isScanning = false;
        
        return {
            status: constants.FUTRONIC.STATUS_OK,
            template: "MOCK_TEMPLATE_" + Date.now(),
            image: "data:image/bmp;base64,Qk2eAAAAAAAAAD4AAAAoAAAACAAAAAgAAAABAAEAAAAAACAAAAAAAAAAAAAAAP///wD///8A////AP///wD///8A////AP///wD///8AAAAA", // Um quadrado preto 8x8 válido
            isMock: true
        };
    }
}

// Exporta Instância Única (Singleton)
module.exports = new FutronicDriver();
