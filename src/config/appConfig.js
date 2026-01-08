const path = require('path');

module.exports = {
    port: 4000,
    // Caminho relativo: sobe duas pastas (../..) para sair de src/config e entra em bin/
    dllPath: path.resolve(__dirname, '../../bin/ftrScanAPI.dll')
};