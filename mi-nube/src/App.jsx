// App.jsx  (archivo completo, con SOLO los cambios necesarios para la ordenación)

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  Plus,
  Search,
  Trash2,
  FileText,
  WifiOff,
  Loader2,
  BrainCircuit,
  Quote,
  Clock,
  HardDrive,
  AlertTriangle,
  X,
  Eye,
  Filter,
  ArrowUpDown   // ← NUEVO
} from 'lucide-react';

// DETECCIÓN AUTOMÁTICA DE IP
const getApiUrl = () => {
  const hostname = window.location.hostname;
  return `http://${hostname}:8000`;
};

const API_URL = getApiUrl();

export default function App() {
  const [files, setFiles] = useState([]);
  const [semanticResults, setSemanticResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // ───────────── NUEVO (ordenación)
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState(null); // 'title' | 'date' | 'size'
  const [sortDir, setSortDir] = useState('asc'); // asc | desc
  // ─────────────

  const fileInputRef = useRef(null);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${API_URL}/files`);
      if (response.ok) {
        setFiles(await response.json());
        setIsConnected(true);
      }
    } catch {
      setIsConnected(false);
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length >= 1) {
        setIsSearching(true);
        try {
          const response = await fetch(
            `${API_URL}/semantic-search?q=${encodeURIComponent(searchTerm)}&filter=${activeFilter}`
          );
          if (response.ok) setSemanticResults(await response.json());
        } finally { setIsSearching(false); }
      } else { setSemanticResults([]); }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeFilter]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage("");

    const upload = async (mode) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lastModified', file.lastModified.toString());
      formData.append('mode', mode);
      const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      if (response.ok) {
        await fetchFiles();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else if (response.status === 409) {
        const data = await response.json();
        if (data.detail === "DUPLICATE_NAME") {
          const reemplazar = window.confirm("Este archivo ya existe, ¿desea reemplazarlo?");
          if (reemplazar) await upload("replace");
          else await upload("rename");
        } else if (data.detail === "DUPLICATE_HASH") {
          window.alert("Este contenido ya está registrado");
        } else {
          setErrorMessage(data.detail || "Error desconocido al subir archivo");
        }
      } else {
        setErrorMessage("Error desconocido al subir archivo");
      }
    };

    await upload("ask");
    setIsUploading(false);
  };

  const handleOpenFile = async (id) => {
    const baseId = id.includes('_') ? id.split('_')[0] : id;
    try {
      await fetch(`${API_URL}/open/${baseId}`, { method: 'POST' });
    } catch {
      setErrorMessage("No se puede abrir el archivo físicamente desde un dispositivo remoto. Solo funciona en el servidor central.");
    }
  };

  const deleteFile = async (id) => {
    const baseId = id.includes('_') ? id.split('_')[0] : id;
    const res = await fetch(`${API_URL}/files/${baseId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchFiles();
      setSearchTerm("");
    }
  };

  const isQuerying = searchTerm.trim().length >= 1;

  const listaAVisualizarBase = isQuerying
    ? semanticResults
    : files.filter(f => activeFilter === "todos" || f.extension?.toLowerCase() === activeFilter.toLowerCase());

  // ───────────── NUEVO: ordenación
  const ordenar = (lista) => {
    if (!sortBy) return lista;

    const copia = [...lista];

    copia.sort((a, b) => {
      let va, vb;

      if (sortBy === 'title') {
        va = (a.name || a.archivo || '').toLowerCase();
        vb = (b.name || b.archivo || '').toLowerCase();
      } else if (sortBy === 'date') {
        va = new Date(a.createdAt || 0).getTime();
        vb = new Date(b.createdAt || 0).getTime();
      } else if (sortBy === 'size') {
        va = parseInt((a.size || '0').toString().replace(/\D/g, '')) || 0;
        vb = parseInt((b.size || '0').toString().replace(/\D/g, '')) || 0;
      }

      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return copia;
  };

  const listaAVisualizar = ordenar(listaAVisualizarBase);

  const handleSortClick = (key) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setSortMenuOpen(false);
  };
  // ─────────────

  const formatFecha = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 p-6 md:p-12 font-sans antialiased text-left">
      <div className="max-w-4xl mx-auto">
        {errorMessage && (
          <div className="mb-6 p-4 bg-orange-50 border-l-4 border-orange-500 rounded-xl shadow-sm flex items-center justify-between text-orange-800">
            <div className="flex items-center gap-3 text-xs font-bold uppercase">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> {errorMessage}
            </div>
            <button onClick={() => setErrorMessage("")} className="p-1 hover:bg-orange-100 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isConnected && (
          <div className="mb-8 p-4 bg-white border-l-4 border-red-500 rounded-xl shadow-sm flex items-center gap-3 text-red-600 animate-pulse font-bold text-xs uppercase">
            <WifiOff className="w-5 h-5" /> Servidor Central fuera de línea (IP: {window.location.hostname})
          </div>
        )}

        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="bg-black p-3 rounded-2xl shadow-xl transform transition-transform hover:rotate-3">
              <Folder className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase leading-none mb-1">Cerebro Local</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                <BrainCircuit className="w-3 h-3 text-emerald-500" /> Red: {window.location.hostname}
              </p>
            </div>
          </div>

          <label className={`flex items-center gap-2 px-8 py-3.5 bg-black text-white rounded-full text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{isUploading ? 'INDEXANDO IA...' : 'SUBIR DOCUMENTO'}</span>
            <input type="file" className="hidden" onChange={handleFileUpload} ref={fileInputRef} disabled={isUploading} />
          </label>
        </header>

        {/* Barra de búsqueda */}
        <div className="relative mb-3 group">
          <Search className={`absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isSearching ? 'text-blue-500 animate-pulse' : 'text-slate-300'}`} />
          <input
            type="text"
            placeholder="Busca por intención (ej: 'gastos de luz')..."
            className="w-full pl-16 pr-8 py-6 bg-white border-none rounded-[28px] text-sm shadow-2xl focus:ring-4 focus:ring-blue-50 transition-all outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ───────────── NUEVO: botón ordenar bajo la barra, a la derecha */}
        <div className="relative flex justify-end mb-8">
          <button
            onClick={() => setSortMenuOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-xs font-bold uppercase tracking-widest text-slate-500 shadow hover:bg-slate-50"
          >
            <ArrowUpDown className="w-4 h-4" />
            Ordenar
          </button>

          {sortMenuOpen && (
            <div className="absolute right-0 top-12 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden text-xs font-bold uppercase tracking-widest z-10">
              <button
                className="block w-full text-left px-5 py-3 hover:bg-slate-50"
                onClick={() => handleSortClick('title')}
              >
                Ordenar por título {sortBy === 'title' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </button>
              <button
                className="block w-full text-left px-5 py-3 hover:bg-slate-50"
                onClick={() => handleSortClick('date')}
              >
                Ordenar por fecha {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </button>
              <button
                className="block w-full text-left px-5 py-3 hover:bg-slate-50"
                onClick={() => handleSortClick('size')}
              >
                Ordenar por tamaño {sortBy === 'size' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </button>
            </div>
          )}
        </div>
        {/* ───────────── */}

        <div className="flex items-center gap-3 mb-12 overflow-x-auto pb-2 no-scrollbar">
          <Filter className="w-4 h-4 text-slate-300 ml-2" />
          {['todos', 'pdf', 'docx', 'xlsx', 'txt', 'csv'].map((tipo) => (
            <button key={tipo} onClick={() => setActiveFilter(tipo)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === tipo ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'}`}>
              {tipo}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {listaAVisualizar.map((item, idx) => (
            <div key={item.id || idx} className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex items-start justify-between mb-6 text-left">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                    <FileText className="w-7 h-7 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 leading-tight mb-2">{item.name || item.archivo}</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] font-black bg-[#1e293b] text-white px-3 py-1 rounded-lg uppercase tracking-widest">{item.type || 'Documento'}</span>
                      {!isQuerying && (
                        <>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tighter"><Clock className="w-3 h-3" /> {formatFecha(item.createdAt)}</div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-300 font-bold uppercase tracking-tighter"><HardDrive className="w-3 h-3" /> {item.size}</div>
                        </>
                      )}
                      {item.score && (
                        <span className="text-[10px] font-bold bg-[#dcfce7] text-[#166534] px-3 py-1 rounded-lg flex items-center gap-1">
                          🎯 {Math.round(item.score * 100)}% relevancia
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleOpenFile(item.id)} title="Abrir en servidor" className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Eye className="w-5 h-5" /></button>
                  <button onClick={() => deleteFile(item.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>

              {item.summary && (
                <div className="bg-[#F8FAFC] rounded-[20px] p-5 mb-5 border-l-4 border-blue-600 shadow-inner">
                  <div className="flex items-center gap-2 mb-3 text-blue-600"><Quote className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Resumen IA (Llama 3)</span></div>
                  <p className="text-sm text-slate-600 font-medium italic leading-relaxed text-left">"{item.summary}"</p>
                </div>
              )}

              {isQuerying && item.snippet && (
                <div className="mb-5 p-4 bg-[#fffbeb] border border-dashed border-[#fcd34d] rounded-xl text-sm text-[#92400e] text-left">
                  <strong>Fragmento relevante:</strong><br />
                  "...{item.snippet}..."
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
