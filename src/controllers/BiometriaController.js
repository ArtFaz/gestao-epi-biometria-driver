const FutronicService = require('../services/FutronicService');

module.exports = {
    async capturar(req, res) {
        try {
            console.log("👆 Recebida solicitação de leitura biométrica.");

            const template = await FutronicService.capturarDigital();

            return res.json({
                success: true,
                template: template,
                message: "Digital capturada com sucesso."
            });

        } catch (error) {
            console.error("❌ Erro na captura:", error.message);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};