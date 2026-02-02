const path = require('path');
require('dotenv').config();

// Se estiver rodando empacotado (pkg), a DLL está na mesma pasta do executável.
// Se estiver em dev, está na pasta ../../bin
const basePath = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '../../bin');

module.exports = {
    port: process.env.PORT || 4001,
    pythonPort: process.env.PYTHON_PORT || 5000,
    dllPath: path.join(basePath, 'ftrScanAPI.dll'),
    pythonApiUrl: process.env.PYTHON_API_URL || 'http://127.0.0.1:5000',
    useMock: process.env.USE_MOCK_DRIVER === 'true',
    env: process.env.NODE_ENV || 'development'
};