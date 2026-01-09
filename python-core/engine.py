import base64
import numpy as np
import cv2
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from io import BytesIO
from PIL import Image

app = FastAPI(title="BioEngine - Motor Biométrico ORB", version="1.0.0")

class ExtractRequest(BaseModel):
    """Modelo para solicitação de extração de template."""
    image_base64: str

class MatchRequest(BaseModel):
    """Modelo para solicitação de comparação (match) biométrico."""
    template_stored: str     # Template (descritores) recuperado do banco
    image_new_base64: str    # Nova imagem capturada do leitor

def base64_to_cv2(b64_string: str) -> np.ndarray:
    """
    Converte uma string Base64 em uma imagem OpenCV (Grayscale).
    
    Args:
        b64_string (str): Imagem codificada. Pode conter cabeçalho 'data:image...'.
        
    Returns:
        np.ndarray: Imagem convertida em matriz NumPy (escala de cinza).
    """
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    image_data = base64.b64decode(b64_string)
    image = Image.open(BytesIO(image_data)).convert('L') # Converte para Cinza
    return np.array(image)

# Cria o detector ORB (Oriented FAST and Rotated BRIEF)
# É um algoritmo rápido, eficiente e livre de patentes (ao contrário do SIFT/SURF)
orb = cv2.ORB_create(nfeatures=500)

@app.post("/extract")
def extract_template(data: ExtractRequest):
    """
    Recebe uma imagem bruta, extrai os pontos característicos (minúcias)
    e retorna um 'template' matemático para armazenamento seguro.
    """
    img = base64_to_cv2(data.image_base64)

    # 1. Encontrar pontos chave (Keypoints) e Descritores
    # Descritores são vetores que descrevem a vizinhança de cada ponto chave.
    keypoints, descriptors = orb.detectAndCompute(img, None)

    if descriptors is None:
        return {"success": False, "error": "Qualidade ruim. Nenhuma minúcia encontrada."}

    # 2. Converter descritores (Array numpy) para Base64 para salvar no Banco
    # Isso transforma a imagem em um "hash biométrico" reverso-incompatível.
    descriptors_b64 = base64.b64encode(descriptors.tobytes()).decode('utf-8')

    # Retornamos também o shape (linhas:colunas) para reconstruir a matriz depois
    template_final = f"{descriptors.shape[0]}:{descriptors.shape[1]}|{descriptors_b64}"

    return {"success": True, "template": template_final}

@app.post("/match")
def match_fingerprint(data: MatchRequest):
    """
    Compara uma nova digital com um template armazenado usando distância de Hamming.
    Retorna score de similaridade e booleano de match.
    """
    # 1. Processar Imagem Nova
    img_nova = base64_to_cv2(data.image_new_base64)
    kp_nova, desc_nova = orb.detectAndCompute(img_nova, None)

    if desc_nova is None:
        return {"success": False, "match": False, "score": 0, "msg": "Dedo não detectado claramente"}

    # 2. Recuperar Template do Banco
    try:
        shape_str, blob_b64 = data.template_stored.split('|')
        rows, cols = map(int, shape_str.split(':'))
        desc_banco = np.frombuffer(base64.b64decode(blob_b64), dtype=np.uint8).reshape(rows, cols)
    except Exception as e:
        return {"success": False, "error": f"Template do banco inválido: {str(e)}"}

    # 3. O MATCH REAL (Brute Force Matcher com Hamming Distance)
    # Hamming é ideal para descritores binários como o ORB.
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(desc_banco, desc_nova)

    # Ordena pelos melhores matches (menor distância = mais parecido)
    matches = sorted(matches, key=lambda x: x.distance)

    # 4. Cálculo do Score
    # O score é simplesmente a contagem de pontos que "casaram" geometricamente entre as digitais.
    score = len(matches)

    # LIMIAR (Threshold) DE SEGURANÇA
    # Ajustado empiricamente. >20 geralmente indica a mesma pessoa com alta confiança.
    LIMIAR_SEGURANCA = 20
    is_match = score > LIMIAR_SEGURANCA

    return {
        "success": True,
        "match": is_match,
        "score": score,
        "debug_info": f"Encontrados {score} pontos coincidentes (Threshold: {LIMIAR_SEGURANCA})"
    }

if __name__ == "__main__":
    print("Iniciando BioEngine na porta 5000...")
    uvicorn.run(app, host="127.0.0.1", port=5000)