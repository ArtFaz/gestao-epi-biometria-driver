const path = require('path');

// Se estiver rodando empacotado (pkg), a DLL está na mesma pasta do executável.
// Se estiver em dev, está na pasta ../../bin
const basePath = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '../../bin');

module.exports = {

    port: process.env.PORT || 4001,

    // Agora a DLL sempre será buscada relativa ao executável ou raiz

    dllPath: path.join(basePath, 'ftrScanAPI.dll')

};
