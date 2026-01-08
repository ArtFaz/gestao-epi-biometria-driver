const koffi = require('koffi');
const config = require('../config/appConfig');
const constants = require('../config/constants');
const fs = require('fs');

// --- Definição de Tipos e DLL ---
let libFutronic = null;
let ftrFuncs = {}; // Objeto para guardar as funções carregadas

// Helper para carregar a DLL de forma segura
function loadDriver() {
    try {
        if (!fs.existsSync(config.dllPath)) {
            console.warn(`[Driver] DLL não encontrada em: ${config.dllPath}`);
            return false;
        }

        libFutronic = koffi.load(config.dllPath);

        // Mapeamento das funções (Sintaxe Koffi 2.9+)
        ftrFuncs = {
            openDevice: libFutronic.func('void* ftrScanOpenDevice()'),
            closeDevice: libFutronic.func('bool ftrScanCloseDevice(void* hDevice)'),
            isFingerPresent: libFutronic.func('bool ftrScanIsFingerPresent(void* hDevice, void* pFrameParams)'),
            setDiodesStatus: libFutronic.func('bool ftrScanSetDiodesStatus(void* hDevice, char byGreen, char byRed)'),
            getImage: libFutronic.func('bool ftrScanGetImage(void* hDevice, int nDose, _Out_ uint8_t* pBuffer)')
        };

        return true;
    } catch (error) {
        console.error("[Driver] Erro crítico ao carregar DLL:", error.message);
        return false;
    }
}

// Tenta carregar ao iniciar
const isDriverLoaded = loadDriver();

// --- Funções Auxiliares ---

// Gera o cabeçalho BMP para exibir a imagem no navegador
function createBMPHeader(width, height) {
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

// --- Serviço Principal ---

module.exports = {
    capturarDigital: async () => {
        // Modo Mock (Desenvolvimento)
        if (config.useMock || !isDriverLoaded) {
            console.log("[Mock] Simulando captura...");
            return new Promise(resolve => setTimeout(() => {
                resolve({
                    status: constants.FUTRONIC.STATUS_OK,
                    template: "MOCK_TEMPLATE_" + Date.now(),
                    image: null // Sem imagem no mock simples
                });
            }, 2000));
        }

        return new Promise(async (resolve, reject) => {
            let hDevice = null;

            try {
                // 1. Abrir Dispositivo
                hDevice = ftrFuncs.openDevice();

                if (!hDevice || koffi.address(hDevice) === 0n) {
                    return reject(new Error("Falha ao abrir leitor. Verifique conexão USB."));
                }

                // 2. Feedback Visual (LED)
                try {
                    ftrFuncs.setDiodesStatus(hDevice, constants.FUTRONIC.LED_INTENSITY, 0);
                } catch (e) { /* Ignora erro de LED */ }

                let attempts = 0;

                // 3. Loop de Espera (Polling)
                const checkFinger = setInterval(() => {
                    attempts++;

                    const hasFinger = ftrFuncs.isFingerPresent(hDevice, null);

                    if (hasFinger) {
                        clearInterval(checkFinger);

                        // --- Captura Real ---
                        try {
                            const { FRAME_WIDTH, FRAME_HEIGHT } = constants.FUTRONIC;
                            const bufferSize = FRAME_WIDTH * FRAME_HEIGHT;
                            const imageBuffer = new Uint8Array(bufferSize);

                            // nDose = 4 (Padrão)
                            const captured = ftrFuncs.getImage(hDevice, 4, imageBuffer);

                            if (!captured) throw new Error("Erro ao transferir imagem do sensor.");

                            // Processamento da Imagem
                            const bmpHeader = createBMPHeader(FRAME_WIDTH, FRAME_HEIGHT);
                            const finalBuffer = Buffer.concat([bmpHeader, Buffer.from(imageBuffer)]);
                            const base64Image = finalBuffer.toString('base64');

                            // Limpeza
                            try { ftrFuncs.setDiodesStatus(hDevice, 0, 0); } catch(e) {}
                            ftrFuncs.closeDevice(hDevice);

                            // Retorno Profissional
                            resolve({
                                status: constants.FUTRONIC.STATUS_OK,
                                // Na versão final, aqui enviariamos o template matemático.
                                // Por enquanto, enviamos a imagem Base64 como "template" para salvar no banco.
                                template: base64Image,
                                image: `data:image/bmp;base64,${base64Image}`,
                                metadata: {
                                    width: FRAME_WIDTH,
                                    height: FRAME_HEIGHT,
                                    device: "FS88H"
                                }
                            });

                        } catch (captureErr) {
                            try { ftrFuncs.closeDevice(hDevice); } catch(e) {}
                            reject(captureErr);
                        }

                    } else if (attempts >= constants.FUTRONIC.MAX_ATTEMPTS) {
                        clearInterval(checkFinger);
                        try { ftrFuncs.setDiodesStatus(hDevice, 0, 0); } catch(e) {}
                        ftrFuncs.closeDevice(hDevice);
                        reject(new Error("Tempo limite excedido. Nenhum dedo detectado."));
                    }
                }, constants.FUTRONIC.POLLING_INTERVAL_MS);

            } catch (err) {
                if (hDevice) try { ftrFuncs.closeDevice(hDevice); } catch(e) {}
                reject(new Error("Erro interno do driver: " + err.message));
            }
        });
    }
};