const koffi = require('koffi');
const config = require('../config/appConfig');
const fs = require('fs');

let libFutronic = null;

// --- Carregamento da DLL ---
try {
    if (fs.existsSync(config.dllPath)) {
        libFutronic = koffi.load(config.dllPath);
    } else {
        console.warn(`⚠️ DLL não encontrada em: ${config.dllPath}`);
    }
} catch (error) {
    console.error("❌ Erro ao carregar DLL:", error.message);
}

// --- Mapeamento de Funções ---
let ftrScanOpenDevice = null;
let ftrScanCloseDevice = null;
let ftrScanIsFingerPresent = null;
let ftrScanGetImage = null;
let ftrScanSetDiodesStatus = null;

if (libFutronic) {
    try {
        // Funções Básicas
        ftrScanOpenDevice = libFutronic.func('void* ftrScanOpenDevice()');
        ftrScanCloseDevice = libFutronic.func('bool ftrScanCloseDevice(void* hDevice)');
        ftrScanIsFingerPresent = libFutronic.func('bool ftrScanIsFingerPresent(void* hDevice, void* pFrameParams)');
        ftrScanSetDiodesStatus = libFutronic.func('bool ftrScanSetDiodesStatus(void* hDevice, char byGreen, char byRed)');

        // Função de Imagem
        // bool ftrScanGetImage(void *hDevice, int nDose, void *pBuffer);
        ftrScanGetImage = libFutronic.func('bool ftrScanGetImage(void* hDevice, int nDose, _Out_ uint8_t* pBuffer)');

    } catch (err) {
        console.error("Erro ao mapear funções:", err.message);
    }
}

module.exports = {
    capturarDigital: async () => {
        if (!libFutronic || !ftrScanOpenDevice) throw new Error("Driver DLL não carregado.");

        return new Promise(async (resolve, reject) => {
            let hDevice = null;

            try {
                console.log("🔌 Conectando...");
                hDevice = ftrScanOpenDevice();

                if (!hDevice || koffi.address(hDevice) === 0n) {
                    return reject(new Error("Falha ao abrir leitor."));
                }

                console.log("✅ Conectado. Ligando sensores...");
                try { ftrScanSetDiodesStatus(hDevice, 50, 0); } catch(e) {}

                console.log("👆 Aguardando dedo...");

                let attempts = 0;
                const maxAttempts = 20;

                const checkFinger = setInterval(() => {
                    attempts++;
                    const hasFinger = ftrScanIsFingerPresent(hDevice, null);

                    if (hasFinger) {
                        clearInterval(checkFinger);
                        console.log("✨ DEDO DETECTADO! Capturando imagem...");

                        try {
                            // --- CORREÇÃO DO CRASH ---
                            // O FS88H tem resolução padrão de 320x480.
                            // Tamanho necessário = 320 * 480 = 153.600 bytes.
                            // Vamos alocar um pouco mais para garantir segurança.
                            const width = 320;
                            const height = 480;
                            const bufferSize = width * height;

                            console.log(`   Alocando Buffer Seguro: ${bufferSize} bytes`);

                            // Aloca memória suficiente para não estourar
                            const imageBuffer = new Uint8Array(bufferSize);

                            // Captura a imagem (Dose 4)
                            const successCapture = ftrScanGetImage(hDevice, 4, imageBuffer);

                            if (!successCapture) throw new Error("Falha ao capturar pixels da imagem.");

                            console.log("📸 Imagem capturada!");

                            // Fecha e apaga LED
                            try { ftrScanSetDiodesStatus(hDevice, 0, 0); } catch(e) {}
                            ftrScanCloseDevice(hDevice);

                            // --- GERAÇÃO DO BMP PARA O NAVEGADOR ---
                            const bmpHeader = createBMPHeader(width, height);
                            const finalBuffer = Buffer.concat([bmpHeader, Buffer.from(imageBuffer)]);
                            const base64Image = finalBuffer.toString('base64');

                            // Retorno de Sucesso
                            resolve({
                                msg: "Sucesso",
                                width: width,
                                height: height,
                                image: `data:image/bmp;base64,${base64Image}`,
                                // Aqui futuramente enviaremos o template real
                                template: "TEMPLATE_FUTRONIC_MOCK_" + Date.now()
                            });

                        } catch (captureErr) {
                            // Tenta fechar em caso de erro na captura
                            try { ftrScanCloseDevice(hDevice); } catch(e) {}
                            reject(captureErr);
                        }

                    } else {
                        process.stdout.write(".");
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(checkFinger);
                        try { ftrScanSetDiodesStatus(hDevice, 0, 0); } catch(e) {}
                        ftrScanCloseDevice(hDevice);
                        reject(new Error("Tempo esgotado."));
                    }
                }, 500);

            } catch (err) {
                if (hDevice) try { ftrScanCloseDevice(hDevice); } catch(e) {}
                reject(new Error("Erro interno: " + err.message));
            }
        });
    }
};

// --- FUNÇÃO AUXILIAR DE BMP (Essencial para ver a imagem) ---
function createBMPHeader(width, height) {
    // Cabeçalho padrão BMP Grayscale (copie exatamente assim)
    const fileSize = 54 + 1024 + (width * height);
    const buffer = Buffer.alloc(1078);

    // BMP Header
    buffer.write('BM');
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(54 + 1024, 10); // Offset

    // DIB Header
    buffer.writeUInt32LE(40, 14);
    buffer.writeUInt32LE(width, 18);
    // Altura negativa para corrigir imagem invertida (padrão top-down)
    buffer.writeInt32LE(-height, 22);
    buffer.writeUInt16LE(1, 26); // Planes
    buffer.writeUInt16LE(8, 28); // 8-bit
    buffer.writeUInt32LE(0, 30); // No compression
    buffer.writeUInt32LE(width * height, 34);
    buffer.writeUInt32LE(0, 46); // Colors used

    // Paleta de Cores (Grayscale)
    for (let i = 0; i < 256; i++) {
        const offset = 54 + i * 4;
        buffer[offset] = i;     // Blue
        buffer[offset + 1] = i; // Green
        buffer[offset + 2] = i; // Red
        buffer[offset + 3] = 0; // Alpha
    }
    return buffer;
}