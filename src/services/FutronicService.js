const koffi = require('koffi');
const config = require('../config/appConfig');
const fs = require('fs');

let libFutronic = null;

// --- 1. Carregamento da DLL ---
try {
    if (fs.existsSync(config.dllPath)) {
        libFutronic = koffi.load(config.dllPath);
    } else {
        console.warn(`⚠️ DLL não encontrada em: ${config.dllPath}`);
    }
} catch (error) {
    console.error("❌ Erro ao carregar DLL:", error.message);
    console.error("Dica: Verifique se o seu Node.js é x64 e a DLL também é x64.");
}

// --- 2. Mapeamento de Funções (CORRIGIDO: minúsculas) ---
// Baseado no ftrScanAPI.h que você enviou: "ftrScanOpenDevice"
let ftrScanOpenDevice = null;
let ftrScanCloseDevice = null;
let ftrScanIsFingerPresent = null;
let ftrScanSetDiodesStatus = null;

if (libFutronic) {
    try {
        // CORREÇÃO: Nomes exatos como no arquivo .h (começando com 'f' minúsculo)

        // void* ftrScanOpenDevice();
        ftrScanOpenDevice = libFutronic.func('void* ftrScanOpenDevice()');

        // bool ftrScanCloseDevice(void* hDevice);
        ftrScanCloseDevice = libFutronic.func('bool ftrScanCloseDevice(void* hDevice)');

        // bool ftrScanIsFingerPresent(void* hDevice, void* pFrameParameters);
        ftrScanIsFingerPresent = libFutronic.func('bool ftrScanIsFingerPresent(void* hDevice, void* pFrameParams)');

        // bool ftrScanSetDiodesStatus(void* hDevice, char byGreen, char byRed);
        ftrScanSetDiodesStatus = libFutronic.func('bool ftrScanSetDiodesStatus(void* hDevice, char byGreen, char byRed)');

    } catch (err) {
        console.error("Erro crítico ao mapear funções da DLL:", err.message);
    }
}

module.exports = {
    capturarDigital: async () => {
        // Validação inicial
        if (!libFutronic || !ftrScanOpenDevice) {
            const arquitetura = process.arch;
            throw new Error(`Driver DLL não carregado ou função não encontrada. Verifique se a DLL é ${arquitetura}.`);
        }

        return new Promise(async (resolve, reject) => {
            let hDevice = null;

            try {
                console.log("🔌 Tentando conectar ao FS88H...");

                // 1. ABRIR DISPOSITIVO
                hDevice = ftrScanOpenDevice();

                // Verifica se o ponteiro é nulo/zero
                if (!hDevice || koffi.address(hDevice) === 0n) {
                    return reject(new Error("Falha ao abrir leitor (Retorno NULL). Verifique conexão USB e Driver WBF."));
                }

                console.log("✅ Leitor conectado! Ligando luz verde...");

                // 2. LIGAR LED VERDE (50 de intensidade)
                try {
                    ftrScanSetDiodesStatus(hDevice, 50, 0);
                } catch (e) {
                    console.warn("Aviso: Falha ao acender LED.", e);
                }

                console.log("👆 Aguardando dedo no sensor...");

                // 3. LOOP DE LEITURA (Polling)
                let attempts = 0;
                const maxAttempts = 20; // 10 segundos

                const checkFinger = setInterval(() => {
                    attempts++;

                    // Verifica presença
                    const hasFinger = ftrScanIsFingerPresent(hDevice, null);

                    if (hasFinger) {
                        clearInterval(checkFinger);
                        console.log("✨ DEDO DETECTADO!");

                        // SUCESSO: Desliga LED e Fecha
                        try { ftrScanSetDiodesStatus(hDevice, 0, 0); } catch(e) {}
                        ftrScanCloseDevice(hDevice);

                        // Retorno simulado por enquanto (até implementarmos o GetImage)
                        resolve("TEMPLATE_TESTE_FUTRONIC_SUCESSO");

                    } else {
                        process.stdout.write(".");
                    }

                    // Timeout
                    if (attempts >= maxAttempts) {
                        clearInterval(checkFinger);
                        console.log("\n❌ Tempo esgotado.");
                        try { ftrScanSetDiodesStatus(hDevice, 0, 0); } catch(e) {}
                        ftrScanCloseDevice(hDevice);
                        reject(new Error("Tempo esgotado: Nenhum dedo detectado."));
                    }
                }, 500);

            } catch (err) {
                if (hDevice && koffi.address(hDevice) !== 0n) {
                    try { ftrScanCloseDevice(hDevice); } catch (e) {}
                }
                reject(new Error("Erro interno durante execução: " + err.message));
            }
        });
    }
};