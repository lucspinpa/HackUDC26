import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, Plus, Search, Trash2, FileText, WifiOff, 
  Loader2, BrainCircuit, Sparkles, Quote, Tags, CheckCircle2,
  FileSearch, Filter, Clock, HardDrive, AlertTriangle, X, Eye,
  Palette, Sun, Moon, FileSpreadsheet, FileCode, Cpu, FileBox, 
  Copy, RefreshCw, ChevronRight, Users
} from 'lucide-react';

// DETECCIÓN DINÁMICA DE IP PARA RED LOCAL
const API_URL = `http://${window.location.hostname}:8000`;

// CONFIGURACIÓN DE COLORES DE ACENTO
const THEMES = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', ring: 'focus:ring-emerald-200', shadow: 'shadow-emerald-100' },
  blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600', ring: 'focus:ring-blue-200', shadow: 'shadow-blue-100' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-600', ring: 'focus:ring-purple-200', shadow: 'shadow-purple-100' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500', ring: 'focus:ring-rose-200', shadow: 'shadow-rose-100' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', ring: 'focus:ring-amber-200', shadow: 'shadow-amber-100' },
};

// OPCIONES DE FONDO ADAPTATIVAS
const BACKGROUNDS = [
  { id: 'slate', name: 'Gris Profesional', class: 'bg-slate-50', text: 'text-slate-900', card: 'bg-white', border: 'border-slate-100', input: 'bg-white' },
  { id: 'white', name: 'Blanco Puro', class: 'bg-white', text: 'text-slate-900', card: 'bg-white', border: 'border-slate-100', input: 'bg-slate-50' },
  { id: 'cream', name: 'Crema Suave', class: 'bg-[#FAF9F6]', text: 'text-slate-900', card: 'bg-white', border: 'border-orange-50', input: 'bg-white' },
  { id: 'dark', name: 'Modo Noche', class: 'bg-slate-950', text: 'text-slate-100', card: 'bg-slate-900', border: 'border-slate-800', input: 'bg-slate-800' },
];

export default function App() {
  const [files, setFiles] = useState([]);
  const [semanticResults, setSemanticResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  
  // ESTADOS DE PERSONALIZACIÓN
  const [accent, setAccent] = useState('emerald');
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [showPalette, setShowPalette] = useState(false);

  // MODALES
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, name: "" });
  const [duplicateModal, setDuplicateModal] = useState({ show: false, file: null });

  const theme = THEMES[accent];
  const isDark = bg.id === 'dark';
  const fileInputRef = useRef(null);

  // --- LISTA DE AUTORES (Modificable) ---
  const autores = "Lucas Piñeiro, Alba Pérez, Saray López y Hugo Sánchez"; 

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${API_URL}/files`);
      if (response.ok) {
        setFiles(await response.json());
        setIsConnected(true);
      }
    } catch { setIsConnected(false); }
  };

  useEffect(() => { fetchFiles(); }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length >= 1) {
        setIsSearching(true);
        try {
          const response = await fetch(`${API_URL}/semantic-search?q=${encodeURIComponent(searchTerm)}&filter=${activeFilter}`);
          if (response.ok) setSemanticResults(await response.json());
        } finally { setIsSearching(false); }
      } else { setSemanticResults([]); }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeFilter]);

  const processUpload = async (file, mode = "ask") => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lastModified", file.lastModified.toString());
    formData.append("mode", mode);

    try {
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      if (res.status === 409) {
        setDuplicateModal({ show: true, file });
      } else if (res.ok) {
        await fetchFiles();
        if (fileInputRef.current) fileInputRef.current.value = "";
        setDuplicateModal({ show: false, file: null });
      } else {
        const data = await res.json();
        setErrorMessage(data.detail || "Error al subir documento.");
      }
    } catch { setErrorMessage("Error de conexión con el servidor central."); }
    finally { setIsUploading(false); }
  };

  const handleOpenFile = async (id) => {
    try { await fetch(`${API_URL}/open/${id}`, { method: 'POST' }); }
    catch { setErrorMessage("Solo disponible en el servidor central."); }
  };

  const confirmDelete = async () => {
    try {
      const res = await fetch(`${API_URL}/files/${deleteModal.id}`, { method: 'DELETE' });
      if (res.ok) { fetchFiles(); setSearchTerm(""); }
    } finally { setDeleteModal({ show: false, id: null, name: "" }); }
  };

  const getFileIcon = (ext) => {
    const e = ext?.toLowerCase();
    const size = "w-7 h-7";
    if (e === 'pdf') return <FileText className={`${size} text-red-500`} />;
    if (e === 'docx' || e === 'doc') return <FileText className={`${size} text-blue-500`} />;
    if (e === 'xlsx' || e === 'xls') return <FileSpreadsheet className={`${size} text-emerald-500`} />;
    if (e === 'csv') return <FileCode className={`${size} text-orange-500`} />;
    if (e === 'txt' || e === 'md') return <FileText className={`${size} text-slate-400`} />;
    return <FileBox className={`${size} text-slate-400`} />;
  };

  const isQuerying = searchTerm.trim().length >= 1;
  const listaAVisualizar = isQuerying 
    ? semanticResults 
    : files.filter(f => activeFilter === "todos" || f.extension?.toLowerCase() === activeFilter.toLowerCase());

  const formatFechaOriginal = (isoStr) => {
    if (!isoStr) return "N/A";
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${bg.class} ${bg.text} p-6 md:p-12 font-sans antialiased text-left flex flex-col relative`}>
      
      {/* MODAL DUPLICADOS */}
      {duplicateModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className={`${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'} rounded-[40px] p-10 max-w-md w-full shadow-2xl border transform animate-in zoom-in-95`}>
            <div className={`w-20 h-20 rounded-3xl ${theme.bg} bg-opacity-10 flex items-center justify-center mb-8 mx-auto`}>
              <RefreshCw className={`w-10 h-10 ${theme.text}`} />
            </div>
            <h2 className="text-2xl font-black text-center mb-4 uppercase tracking-tighter">Archivo Duplicado</h2>
            <p className="text-center opacity-60 text-sm mb-10 leading-relaxed">
              El archivo <span className="font-bold underline">"{duplicateModal.file?.name}"</span> ya existe en tu nube. ¿Qué prefieres hacer?
            </p>
            <div className="space-y-3">
              <button onClick={() => processUpload(duplicateModal.file, "replace")} className={`w-full py-5 ${theme.bg} text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3`}>
                <Trash2 className="w-4 h-4" /> Reemplazar el actual
              </button>
              <button onClick={() => processUpload(duplicateModal.file, "rename")} className={`w-full py-5 ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} rounded-3xl font-black uppercase text-xs active:scale-95 transition-all flex items-center justify-center gap-3`}>
                <Copy className="w-4 h-4" /> Guardar ambos (Copia)
              </button>
              <button onClick={() => setDuplicateModal({ show: false, file: null })} className="w-full py-4 opacity-40 text-[10px] font-black uppercase hover:opacity-100">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BORRADO */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className={`${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'} rounded-[32px] p-8 max-w-sm w-full shadow-2xl border transform animate-in zoom-in-95`}>
            <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6"><AlertTriangle className="w-8 h-8 text-red-500" /></div>
            <h2 className="text-xl font-black uppercase mb-2 tracking-tight">¿Borrar archivo?</h2>
            <p className="text-sm opacity-60 mb-8 leading-relaxed italic">"{deleteModal.name}"</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ show: false, id: null, name: "" })} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-red-200">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto w-full flex-grow">
        
        {/* PANEL DE PERSONALIZACIÓN */}
        <div className="fixed top-6 right-6 z-50">
          <button onClick={() => setShowPalette(!showPalette)} className={`p-3 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'} border rounded-full shadow-lg hover:scale-110 transition-all ${theme.text}`}><Palette className="w-6 h-6" /></button>
          {showPalette && (
            <div className={`absolute right-0 mt-4 p-6 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'} border rounded-3xl shadow-2xl w-72 animate-in zoom-in-95`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest opacity-40">Estilo</h3>
                <button onClick={() => setShowPalette(false)}><X className="w-4 h-4 opacity-30" /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-40 mb-3">Color de Acento</p>
                  <div className="flex gap-3 flex-wrap">
                    {Object.keys(THEMES).map(k => <button key={k} onClick={() => setAccent(k)} className={`w-8 h-8 rounded-full ${THEMES[k].bg} ${accent === k ? 'ring-4 ring-white/20 scale-110' : 'opacity-70'} transition-all`} />)}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-40 mb-3">Atmósfera</p>
                  <div className="grid grid-cols-1 gap-2">
                    {BACKGROUNDS.map(bgOpt => (
                      <button key={bgOpt.id} onClick={() => setBg(bgOpt)} className={`flex justify-between items-center px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${bg.id === bgOpt.id ? (isDark ? 'border-slate-500 bg-slate-700' : 'border-slate-800 bg-slate-50') : (isDark ? 'border-slate-700' : 'border-slate-100')}`}>
                        {bgOpt.name} {bgOpt.id === 'dark' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ALERTAS */}
        {errorMessage && (
          <div className={`mb-6 p-4 ${isDark ? 'bg-orange-900/30 text-orange-200 border-orange-800' : 'bg-orange-50 text-orange-800 border-orange-500'} border-l-4 rounded-xl flex items-center justify-between text-xs font-bold uppercase`}>
            <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-orange-500" /> {errorMessage}</div>
            <button onClick={() => setErrorMessage("")}><X className="w-4 h-4" /></button>
          </div>
        )}

        {!isConnected && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-xl flex items-center gap-3 text-red-600 animate-pulse text-xs font-bold uppercase">
            <WifiOff className="w-5 h-5" /> Nodo central desconectado (IP: {window.location.hostname})
          </div>
        )}

        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 text-left">
          <div className="flex items-center gap-4 w-full">
            <div className={`${isDark ? 'bg-slate-200' : 'bg-black'} p-3 rounded-2xl shadow-xl transform transition-transform hover:rotate-3`}><Folder className={`${isDark ? 'text-slate-800' : 'text-white'} w-8 h-8`} /></div>
            <div>
              <h1 className={`text-2xl font-black tracking-tight uppercase leading-none mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Datei</h1>
              <div className="flex items-center gap-3 mt-1">
                {/* IP DEL HOST */}
                <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest flex items-center gap-1">
                  <BrainCircuit className={`w-3 h-3 ${theme.text}`} /> Host: {window.location.hostname}
                </p>
                
                {/* SEPARADOR VISUAL */}
                <div className={`w-px h-2 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                
                {/* AUTORES */}
                <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Users className={`w-3 h-3 ${theme.text}`} /> {autores}
                </p>
              </div>
            </div>
          </div>
          <label className={`flex items-center gap-2 px-8 py-3.5 ${isDark ? 'bg-slate-200 text-slate-800 hover:bg-white' : 'bg-black text-white hover:bg-slate-800'} rounded-full text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 whitespace-nowrap ${isUploading ? 'opacity-50' : ''}`}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{isUploading ? 'PROCESANDO IA...' : 'SUBIR DOCUMENTO'}</span>
            <input type="file" className="hidden" onChange={(e) => processUpload(e.target.files[0])} ref={fileInputRef} disabled={isUploading} />
          </label>
        </header>

        {/* BUSCADOR */}
        <div className="relative mb-8 group">
          <Search className={`absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isSearching ? theme.text + ' animate-pulse' : 'text-slate-400'}`} />
          <input type="text" placeholder="Busca por intención o nombre..." className={`w-full pl-16 pr-8 py-6 ${bg.input} border-none rounded-[28px] text-sm shadow-2xl focus:ring-4 ${theme.ring} transition-all outline-none ${isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-700'}`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* FILTROS */}
        <div className="flex items-center gap-3 mb-12 overflow-x-auto pb-2 no-scrollbar">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          {['todos', 'pdf', 'docx', 'xlsx', 'txt', 'csv'].map((tipo) => (
            <button key={tipo} onClick={() => setActiveFilter(tipo)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === tipo ? `${theme.bg} text-white shadow-lg ${isDark ? 'shadow-black/40' : theme.shadow} scale-105` : `${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-100'} border hover:border-slate-400`}`}>{tipo}</button>
          ))}
        </div>

        {/* LISTA DE ARCHIVOS */}
        <div className="space-y-6 pb-12 text-left">
          {listaAVisualizar.map((item, idx) => (
            <div key={item.id || idx} className={`${bg.card} rounded-[32px] border ${bg.border} p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden`}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-5">
                  <div className={`p-4 ${isDark ? 'bg-slate-700' : 'bg-slate-50'} rounded-2xl transition-colors`}>{getFileIcon(item.extension || item.name?.split('.').pop())}</div>
                  <div className="flex flex-col">
                    <h3 className={`text-lg font-black leading-tight mb-2 truncate max-w-xs md:max-w-md ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.name || item.archivo}</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`text-[10px] font-black ${isDark ? 'bg-slate-600 text-slate-100' : 'bg-slate-900 text-white'} px-2 py-0.5 rounded-lg uppercase tracking-widest`}>{item.type || 'Documento'}</span>
                      <div className="flex items-center gap-4 text-[10px] opacity-40 font-bold uppercase">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatFechaOriginal(item.createdAt)}</span>
                        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {item.size}</span>
                      </div>
                      {item.score && item.score < 1.0 && <span className={`text-[10px] font-bold ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'} px-3 py-1 rounded-lg animate-in zoom-in`}>🎯 {Math.round(item.score * 100)}% relevancia</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenFile(item.id)} className={`p-2.5 opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-blue-500'}`} title="Abrir"><Eye className="w-5 h-5" /></button>
                  <button onClick={() => setDeleteModal({ show: true, id: item.id, name: item.name })} className={`p-2.5 opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'text-slate-400 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`} title="Borrar"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>

              {/* RESUMEN IA */}
              {item.summary && (
                <div className={`${isDark ? 'bg-slate-700/40 border-slate-600' : 'bg-slate-50 border-slate-100'} rounded-[20px] p-5 mb-3 border-l-4 ${theme.border} shadow-inner`}>
                  <div className={`flex items-center gap-2 mb-3 ${theme.text}`}>
                    <Quote className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Resumen IA</span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-600'} font-medium italic leading-relaxed`}>"{item.summary}"</p>
                </div>
              )}

              {/* PUNTOS CLAVE (Tags debajo del resumen, ocultos al buscar) */}
              {!isQuerying && item.keywords && item.keywords.length > 0 && (
                <div className="px-5 pb-2">
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {item.keywords.map((tag, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${theme.bg}`} />
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SNIPPET DE BÚSQUEDA */}
              {isQuerying && item.snippet && (
                <div className={`mb-2 p-4 ${isDark ? 'bg-amber-900/30 border-amber-800 text-amber-100' : 'bg-amber-50 border-amber-200 text-amber-800'} border border-dashed rounded-xl text-sm animate-in fade-in`}>
                  <strong>Fragmento relevante:</strong><br />"...{item.snippet}..."
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER TECNOLÓGICO */}
      <footer className={`mt-auto py-10 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} text-center opacity-40`}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-6 mb-4">
            <div className="flex items-center gap-2"><Cpu className={`w-4 h-4 ${theme.text}`} /><span className="text-[10px] font-bold uppercase tracking-widest">Meta Llama 3</span></div>
            <div className="flex items-center gap-2"><Sparkles className={`w-4 h-4 ${theme.text}`} /><span className="text-[10px] font-bold uppercase tracking-widest">RAG Engine</span></div>
            <div className="flex items-center gap-2"><BrainCircuit className={`w-4 h-4 ${theme.text}`} /><span className="text-[10px] font-bold uppercase tracking-widest">FastAPI + React</span></div>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.4em]">HackUDC 2026 • Private Cloud Architecture</p>
        </div>
      </footer>
    </div>
  );
}