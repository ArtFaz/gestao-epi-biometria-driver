const path = require('path');

// Permite definir via .env se queremos simular (para devs sem o leitor)
const USE_MOCK = process.env.USE_MOCK === 'true';

module.exports = {
    port: process.env.PORT || 4000,
    useMock: USE_MOCK,
    dllPath: path.resolve(__dirname, '../../bin/ftrScanAPI.dll')
};