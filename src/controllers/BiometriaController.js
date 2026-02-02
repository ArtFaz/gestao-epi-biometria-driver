const FutronicService = require('../services/FutronicService');
const axios = require('axios/dist/node/axios.cjs');
const config = require('../config/appConfig');

const PYTHON_API = config.pythonApiUrl;

module.exports = {
    // CASO DE USO 1: CADASTRAR FUNCIONÁRIO
    async capturarParaCadastro(req, res) {
        try {
            console.log("1. Node: Solicitando captura ao Hardware...");

            // A. Captura imagem bruta (BMP/Base64) do Hardware
            const dadosHardware = await FutronicService.capturarDigital();

            // --- MOCK BYPASS ---
            if (dadosHardware.isMock) {
                console.log("⚠️ MOCK DETECTADO: Pulando processamento Python.");
                return res.json({
                    success: true,
                    image_preview: dadosHardware.image,
                    template_final: `MOCK_TEMPLATE|${Date.now()}`
                });
            }

            console.log("2. Node: Enviando imagem para o Python extrair template...");

            // B. Envia para o Python processar
            // O FutronicService retorna { image: "data:image/bmp;base64,..." }
            const responsePython = await axios.post(`${PYTHON_API}/extract`, {
                image_base64: dadosHardware.image
            });

            console.log("3. Node: Template recebido. Retornando ao Frontend.");

            // C. Retorna tudo para o Frontend React
            return res.json({
                success: true,
                // Imagem para mostrar no Modal (Preview)
                image_preview: dadosHardware.image,
                // Template para salvar no SQL Server (Escondido do usuário)
                template_final: responsePython.data.template
            });

        } catch (error) {
            console.error("Erro no fluxo de cadastro:", error.message);
            return res.status(500).json({
                success: false,
                error: error.message,
                details: error.response?.data || "Erro interno"
            });
        }
    },

    // CASO DE USO 2: ENTREGAR EPI (MATCH)
    async validarEntrega(req, res) {
        try {
            // O Frontend envia o template que estava salvo no banco
            const { templateSalvoNoBanco } = req.body;

            if (!templateSalvoNoBanco) {
                return res.status(400).json({ error: "Template do banco não fornecido" });
            }

            console.log("1. Node: Solicitando captura para validação...");
            const dadosHardware = await FutronicService.capturarDigital();

            // --- MOCK BYPASS ---
            if (dadosHardware.isMock) {
                console.log("⚠️ MOCK DETECTADO: Simulando Match Positivo.");
                return res.json({
                    success: true,
                    match: true,
                    score: 99
                });
            }

            console.log("2. Node: Enviando par (Template + Nova Imagem) para o Python...");
            const responsePython = await axios.post(`${PYTHON_API}/match`, {
                template_stored: templateSalvoNoBanco,
                image_new_base64: dadosHardware.image
            });

            console.log(`3. Node: Resultado do Match: ${responsePython.data.match}`);

            return res.json({
                success: true,
                match: responsePython.data.match, // true ou false
                score: responsePython.data.score
            });

        } catch (error) {
            console.error("Erro no fluxo de validação:", error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
};