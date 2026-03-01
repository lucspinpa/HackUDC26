import os, json, shutil, hashlib, re, uuid, torch, platform, subprocess
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Procesamiento e IA
from docx import Document
from pypdf import PdfReader
import pandas as pd
from sentence_transformers import SentenceTransformer, util
from langchain_community.llms import Ollama

app = FastAPI(title="Cerebro Local Cloud - Backend Integral")

# --- CONFIGURACIÓN DE RUTAS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DB_FILE = os.path.join(BASE_DIR, "database.json")
SEARCH_INDEX_FILE = os.path.join(BASE_DIR, "search_index.json")

# Crear carpeta de subidas si no existe
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos
app.mount("/download", StaticFiles(directory=UPLOAD_DIR), name="download")

# --- CARGA DE MODELOS ---
print("🧠 Cargando modelo de búsqueda semántica (SentenceTransformer)...")
model_st = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

print("🦙 Conectando con Llama 3 mediante Ollama...")
try:
    llm = Ollama(model="llama3")
except Exception:
    llm = None
    print("⚠️ Ollama no detectado localmente. Funciones de resumen limitadas.")

# Variables globales para búsqueda rápida en memoria
documentos_memoria = []
embeddings_memoria = None

# --- FUNCIONES DE UTILIDAD ---

def load_json(f):
    if not os.path.exists(f): return []
    try:
        with open(f, "r", encoding="utf-8") as file:
            return json.load(file)
    except:
        return []

def save_json(f, d):
    with open(f, "w", encoding="utf-8") as file:
        json.dump(d, file, indent=4, ensure_ascii=False)

def extraer_a_string(ruta):
    ext = os.path.splitext(ruta)[1].lower()
    try:
        if ext == '.docx':
            return "\n".join([p.text for p in Document(ruta).paragraphs])
        if ext == '.pdf':
            return "\n".join([p.extract_text() or "" for p in PdfReader(ruta).pages])
        if ext in ['.xlsx', '.xls']:
            return pd.concat(pd.read_excel(ruta, sheet_name=None), axis=0).to_string()
        if ext in ['.txt', '.md']:
            with open(ruta, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
    except Exception as e:
        print(f"Error extrayendo texto: {e}")
    return ""

def analizar_ia_llama(texto):
    """Usa Llama 3 para generar metadatos inteligentes de forma robusta."""
    if not llm or len(texto) < 50:
        return "Documento", [], "Sin resumen disponible."
    
    prompt = f"""Task: Analyze the provided text and return ONLY a JSON object.
Do not include any text before or after the JSON.
IMPORTANT: Provide the "resumen" in the EXACT SAME LANGUAGE as the original text.
Format: {{"tipo": "Contrato|Factura|Informe|Manual", "keywords": ["tema1", "tema2"], "resumen": "string"}}
Text: {texto[:1500]}"""
    
    try:
        res = llm.invoke(prompt)
        # Limpieza básica de bloques de código markdown si el LLM los incluye
        res_clean = res.replace("```json", "").replace("```", "").strip()
        match = re.search(r'\{.*\}', res_clean, re.DOTALL)
        if match:
            json_str = match.group()
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError:
                # Intento de rescate si el LLM usó comillas simples
                data = json.loads(json_str.replace("'", '"'))
            
            # Asegurar que las keywords sean siempre una lista
            keywords = data.get('keywords', [])
            if isinstance(keywords, str): keywords = [keywords]
            
            return data.get('tipo', 'Documento'), keywords, data.get('resumen', '')
    except Exception as e:
        print(f"Error parseando IA: {e}")
    
    return "Documento", [], "Error analizando el contenido."

def actualizar_vectores():
    global documentos_memoria, embeddings_memoria
    documentos_memoria = load_json(SEARCH_INDEX_FILE)
    if documentos_memoria:
        textos = [d['contenido'] for d in documentos_memoria]
        embeddings_memoria = model_st.encode(textos, convert_to_tensor=True)

def abrir_archivo_sistema(ruta):
    try:
        if platform.system() == 'Windows':
            os.startfile(ruta)
        elif platform.system() == 'Darwin': # macOS
            subprocess.run(['open', ruta])
        else: # Linux
            subprocess.run(['xdg-open', ruta])
    except Exception as e:
        print(f"Error abriendo archivo: {e}")

@app.on_event("startup")
async def startup():
    actualizar_vectores()

# --- ENDPOINTS ---

@app.get("/files")
async def get_files():
    return load_json(DB_FILE)

@app.post("/open/{file_id}")
async def open_file(file_id: str):
    db = load_json(DB_FILE)
    meta = next((f for f in db if f.get('id') == file_id), None)
    if not meta: raise HTTPException(status_code=404)
    
    file_ref = meta.get('file_hash') or meta.get('id')
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(file_ref):
            abrir_archivo_sistema(os.path.join(UPLOAD_DIR, f))
            return {"status": "ok"}
    raise HTTPException(status_code=404)

@app.get("/semantic-search")
async def semantic_search(q: str, filter: str = "todos"):
    db = load_json(DB_FILE)
    if not db: return []
    
    query = q.lower()
    res_final = {}

    # 1. Búsqueda por NOMBRE
    for f in db:
        name = f.get('name', '').lower()
        ext = f.get('extension', '').lower()
        if query in name and (filter == "todos" or filter.lower() == ext):
            res_final[f['id']] = { **f, "score": 1.0, "snippet": "Coincidencia en el nombre" }

    # 2. Búsqueda por CONTENIDO
    if embeddings_memoria is not None:
        q_emb = model_st.encode(q, convert_to_tensor=True)
        scores = util.cos_sim(q_emb, embeddings_memoria)[0]
        top_k = min(20, len(documentos_memoria))
        vals, idxs = torch.topk(scores, k=top_k)

        for s, i in zip(vals, idxs):
            score_val = float(s)
            if score_val > 0.30:
                chunk = documentos_memoria[i.item()]
                f_id = chunk.get('file_id')
                meta = next((f for f in db if f.get('id') == f_id), None)
                if meta and (filter == "todos" or filter.lower() == meta.get('extension', '').lower()):
                    if meta['id'] not in res_final:
                        res_final[meta['id']] = { **meta, "score": round(score_val, 4), "snippet": chunk['contenido'][:250] + "..." }

    return sorted(res_final.values(), key=lambda x: x['score'], reverse=True)

@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    lastModified: Optional[str] = Form(None),
    mode: Optional[str] = Form("ask")
):
    file_content = await file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()[:12]
    db = load_json(DB_FILE)
    
    # 1. Buscar si existe por nombre o por contenido (hash) para heredar IA
    existing_by_name = next((f for f in db if f.get("name") == file.filename), None)
    existing_by_hash = next((f for f in db if f.get("file_hash") == file_hash), None)

    # Intentar capturar metadatos de IA de cualquier versión previa
    herencia_ia = None
    referencia = existing_by_name or existing_by_hash
    if referencia:
        herencia_ia = {
            "type": referencia.get("type"),
            "keywords": referencia.get("keywords"),
            "summary": referencia.get("summary")
        }

    def generar_nombre(nombre, existentes):
        base, ext = os.path.splitext(nombre)
        i = 1
        while any(f.get("name") == f"{base}({i}){ext}" for f in existentes): i += 1
        return f"{base}({i}){ext}"

    # Lógica de conflicto de nombres
    if existing_by_name and mode == "ask":
        raise HTTPException(status_code=409, detail="DUPLICATE_NAME")

    if existing_by_name and mode == "replace":
        db = [f for f in db if f.get("id") != existing_by_name["id"]]
        save_json(SEARCH_INDEX_FILE, [s for s in load_json(SEARCH_INDEX_FILE) if s.get("file_id") != existing_by_name["id"]])
    
    if existing_by_name and mode == "rename":
        file.filename = generar_nombre(file.filename, db)

    # Preparar guardado físico
    db_id = str(uuid.uuid4())[:8]
    ext_orig = os.path.splitext(file.filename)[1]
    final_path = os.path.join(UPLOAD_DIR, f"{file_hash}{ext_orig}")
    
    if not os.path.exists(final_path):
        with open(final_path, "wb") as b:
            b.write(file_content)
    
    # 2. PROCESAMIENTO INTELIGENTE O HERENCIA
    raw_text = extraer_a_string(final_path)
    clean_text = re.sub(r'\s+', ' ', raw_text).strip()

    if herencia_ia:
        # Si ya conocemos el archivo, no molestamos a Ollama
        tipo, keywords, resumen = herencia_ia["type"], herencia_ia["keywords"], herencia_ia["summary"]
        print(f"♻️ Heredando metadatos para: {file.filename}")
    else:
        # Si es nuevo, procesamos con IA
        tipo, keywords, resumen = analizar_ia_llama(clean_text)
        print(f"🧠 Procesando con IA: {file.filename}")
    
    createdAt = datetime.fromtimestamp(int(lastModified)/1000.0).isoformat() if lastModified else datetime.now().isoformat()
    
    meta = {
        "id": db_id, 
        "file_hash": file_hash,
        "name": file.filename, 
        "type": tipo, 
        "keywords": keywords, 
        "summary": resumen, 
        "createdAt": createdAt, 
        "size": f"{len(file_content)//1024} KB", 
        "extension": ext_orig.replace('.','').upper()
    }
    
    db.append(meta)
    save_json(DB_FILE, db)

    # Indexar para búsqueda semántica
    s_db = load_json(SEARCH_INDEX_FILE)
    chunks = [clean_text[i:i+1000] for i in range(0, len(clean_text), 1000)]
    for i, c in enumerate(chunks):
        s_db.append({"id": f"{db_id}_{i}", "file_id": db_id, "archivo": file.filename, "contenido": c})
    save_json(SEARCH_INDEX_FILE, s_db)
    
    actualizar_vectores()
    return meta

@app.delete("/files/{id}")
async def delete(id: str):
    db = load_json(DB_FILE)
    meta = next((f for f in db if f.get('id') == id), None)
    if not meta: return {"status": "already deleted"}

    hash_a_borrar = meta.get('file_hash')
    
    new_db = [f for f in db if f.get("id") != id]
    save_json(DB_FILE, new_db)
    save_json(SEARCH_INDEX_FILE, [s for s in load_json(SEARCH_INDEX_FILE) if s.get("file_id") != id])
    
    if hash_a_borrar:
        if not any(f.get('file_hash') == hash_a_borrar for f in new_db):
            for f in os.listdir(UPLOAD_DIR):
                if f.startswith(hash_a_borrar):
                    try: os.remove(os.path.join(UPLOAD_DIR, f))
                    except: pass
    
    actualizar_vectores()
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)