const express = require('express');
const cors = require('cors');
const config = require('./config/appConfig');
const BiometriaController = require('./controllers/BiometriaController');

const app = express();

// Middlewares
app.use(cors()); // Libera acesso para o React
app.use(express.json());

// Rotas
app.get('/', (req, res) => {
    res.send(`
    <h1>🤖 Driver Biométrico Rodando!</h1>
    <p>Status: <a href="/status">/status</a></p>
    <p>Capturar: <a href="/capturar-digital">/capturar-digital</a></p>
  `);
});

app.get('/capturar-digital', BiometriaController.capturar);

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        engine: 'koffi',
        port: config.port
    });
});

// Inicialização
app.listen(config.port, () => {
    console.log(`\n==================================================`);
    console.log(`🤖 AGENTE BIOMÉTRICO (DRIVER) RODANDO`);
    console.log(`📡 URL: http://localhost:${config.port}`);
    console.log(`🔌 DLL Alvo: ${config.dllPath}`);
    console.log(`==================================================\n`);
});