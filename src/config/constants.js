module.exports = {
    FUTRONIC: {
        // Configurações de Hardware
        LED_INTENSITY: 50, // 0-255 (Baseado no seu teste, verde)
        FRAME_WIDTH: 320,
        FRAME_HEIGHT: 480,

        // Configurações de Polling (Tentativas)
        POLLING_INTERVAL_MS: 500, // Checa a cada 0.5s
        MAX_ATTEMPTS: 20,         // Desiste após 10s

        // Identificadores de Retorno
        STATUS_OK: "SUCCESS",
        STATUS_ERROR: "ERROR",
        STATUS_TIMEOUT: "TIMEOUT"
    }
};