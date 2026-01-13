const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra'); // Vamos precisar instalar isso ou usar fs.cpSync (Node 16.7+)

// Função auxiliar para logs
const log = (msg) => console.log(`\x1b[36m[BUILD]\x1b[0m ${msg}`);

const DIST_DIR = path.join(__dirname, 'dist');
const RELEASE_DIR = path.join(DIST_DIR, 'GestaoEPI-Driver-Win64');

// Limpa pasta dist
log('Limpando pasta dist...');
if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(RELEASE_DIR, { recursive: true });

// 1. Compilar Node.js para EXE (usando pkg)
log('Empacotando Node.js (Driver Manager)...');
// Roda o pkg no diretório atual
try {
    execSync('npx pkg . --targets node18-win-x64 --output dist/GestaoEPI-Driver-Win64/GestaoEPI-Driver.exe', { stdio: 'inherit' });
} catch (e) {
    log('❌ Erro no PKG. Verifique se o pkg está instalado.');
    process.exit(1);
}

// 2. Copiar DLLs
log('Copiando Drivers (DLLs)...');
const dllSrc = path.join(__dirname, 'bin/ftrScanAPI.dll');
const dllDest = path.join(RELEASE_DIR, 'ftrScanAPI.dll');
if (fs.existsSync(dllSrc)) {
    fs.copyFileSync(dllSrc, dllDest);
} else {
    log('⚠️ AVISO: DLL ftrScanAPI.dll não encontrada em bin/! O driver não funcionará.');
}

// 3. Copiar Python Core (Alternativa leve: Copiar scripts e pedir para instalar Python)
// (Alternativa robusta Enterprise: Usar PyInstaller para gerar um .exe do Python)
log('Preparando BioEngine (Python)...');

// Vamos assumir que existe um passo prévio de PyInstaller que gerou 'bio-engine.exe'
// Se não existir, copiamos a pasta python-core crua (mas isso exigiria Python instalado no cliente)
// Para este script, vamos SIMULAR a busca pelo bio-engine.exe
const pythonDistPath = path.join(__dirname, 'python-core/dist/bio-engine/bio-engine.exe');

if (fs.existsSync(pythonDistPath)) {
    log('✅ Executável Python encontrado. Copiando...');
    // Copia a pasta inteira gerada pelo PyInstaller
    fse.copySync(path.join(__dirname, 'python-core/dist/bio-engine'), RELEASE_DIR);
} else {
    log('⚠️ Executável Python (bio-engine.exe) não encontrado.');
    log('⚠️ Execute "pyinstaller bio-engine.spec" na pasta python-core primeiro.');
}

log('===========================================================');
log(`✅ BUILD CONCLUÍDO!`);
log(`📂 Arquivos finais em: ${RELEASE_DIR}`);
log('===========================================================');
