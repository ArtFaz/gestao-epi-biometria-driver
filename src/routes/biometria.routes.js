const express = require('express');
const BiometriaController = require('../controllers/BiometriaController');
const PythonManager = require('../managers/PythonManager');
const config = require('../config/appConfig');

const router = express.Router();

// --- Rotas de Monitoramento ---
router.get('/status', (req, res) => {
    res.json({
        status: 'online',
        service: 'Gestor Biométrico (Node.js)',
        python_status: PythonManager.getStatus(),
        node_port: config.port,
        python_url: config.pythonApiUrl
    });
});

// --- Rotas de Negócio ---
// 1. Cadastro: Node lê USB -> Manda img pro Python -> Python devolve Template
router.get('/capturar-cadastro', BiometriaController.capturarParaCadastro);

// 2. Entrega: Node lê USB -> Manda (TemplateBanco + ImgNova) pro Python -> Python devolve Match
router.post('/validar-entrega', BiometriaController.validarEntrega);

module.exports = router;
