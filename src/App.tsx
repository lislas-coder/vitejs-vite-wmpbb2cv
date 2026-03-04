import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, ComposedChart 
} from 'recharts';
import { Filter, Target, TrendingUp, AlertCircle, Briefcase, Zap, SearchX, ArrowRight, List, MapPin, Factory, Cpu } from 'lucide-react';

const ANNUAL_GOAL = 450000000; // 450 Millones MXN

// PALETA CORPORATIVA RER ENERGY GROUP (Vibrante y variada)
const COLORS = {
  primary: '#0a3663', // Azul RER Oscuro
  success: '#69b32d', // Verde RER
  secondary: '#4b98d1', // Azul Claro
  danger: '#dc2626',
  warning: '#f59e0b',
  pieColorsA: ['#0a3663', '#69b32d', '#4b98d1', '#85c24e', '#2c5b8a', '#38bdf8', '#166534', '#0284c7'],
  pieColorsB: ['#4b98d1', '#0a3663', '#85c24e', '#38bdf8', '#166534', '#0284c7', '#69b32d', '#2c5b8a'],
  pieColorsC: ['#69b32d', '#4b98d1', '#0a3663', '#166534', '#38bdf8', '#2c5b8a', '#85c24e', '#0284c7']
};

// Formateadores globales seguros
const formatCurrency = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '0 MXN';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num) + ' MXN';
};

const formatKW = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '0 KW';
  return num >= 1000 ? `${(num / 1000).toFixed(2)} MW` : `${num} KW`;
};

// Analizador estricto de fechas (Prioriza Formato México DD/MM/YYYY)
const parseCustomDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  let cleanStr = dateStr.trim();
  if (cleanStr === '' || cleanStr === '0') return null;
  
  const parts = cleanStr.split(/[-/]/);
  if (parts.length === 3) {
      let p0 = parseInt(parts[0], 10);
      let p1 = parseInt(parts[1], 10);
      let p2 = parseInt(parts[2], 10);
      
      if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          if (p2 < 100) p2 += 2000; // Ej: 26 -> 2026
          let year = p2;
          let month, day;
          
          if (p1 > 12) { // Si el centro es mayor a 12, seguro es MM/DD/YYYY
              month = p0; day = p1; 
          } else if (p0 > 12) { // Si el inicio es mayor a 12, es DD/MM/YYYY
              day = p0; month = p1; 
          } else { // Si ambos son menores a 12 (ej. 12/02), PRIORIDAD FORMATO LATINO DD/MM/YYYY
              day = p0; month = p1; 
          }
          
          const manualDate = new Date(year, month - 1, day);
          if (!isNaN(manualDate.getTime())) return manualDate;
      }
  }
  
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

// Parser CSV Robusto (Resuelve "Enters" y saltos de línea internos en celdas de Excel)
const parseAdvancedCSV = (text) => {
  const firstLineIdx = text.indexOf('\n');
  const firstLine = firstLineIdx !== -1 ? text.substring(0, firstLineIdx) : text;
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  // Dividir por líneas reales
  const rawLines = text.split(/\r?\n/);
  const mergedLines = [];
  let tempLine = '';
  let openQuotes = false;

  for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];
      let quotesInLine = (line.match(/"/g) || []).length;
      
      if (openQuotes) {
          tempLine += '\n' + line;
          if (quotesInLine % 2 !== 0) { // Cierra si hay comillas impares que compensan
              openQuotes = false;
              mergedLines.push(tempLine);
              tempLine = '';
          }
      } else {
          if (quotesInLine % 2 !== 0) { // Abre si hay comillas impares
              openQuotes = true;
              tempLine = line;
          } else {
              mergedLines.push(line);
          }
      }
  }
  if (openQuotes) mergedLines.push(tempLine); // fallback de seguridad

  return mergedLines.map(line => {
      let row = [];
      let val = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
          let c = line[i], nc = line[i+1];
          if (c === '"') {
              if (inQ && nc === '"') { val += '"'; i++; } // Comilla escapada de excel ""
              else { inQ = !inQ; }
          } else if (c === delimiter && !inQ) {
              row.push(val.trim()); val = '';
          } else {
              val += c;
          }
      }
      row.push(val.trim());
      return row;
  }).filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''));
};

export default function App() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); 
  const [dataLoaded, setDataLoaded] = useState(false);
  const [pipelineData, setPipelineData] = useState([]);

  const [filters, setFilters] = useState({
    month: 'Todos', contractType: 'Todos', projectType: 'Todos', origin: 'Todos', channel: 'Todos', kwRange: 'Todos', stageFilter: 'Todos'
  });

  useEffect(() => {
    const savedUrl = localStorage.getItem('rer_sheet_url_v1');
    if (savedUrl) {
      setSheetUrl(savedUrl);
      fetchSheetData(savedUrl);
    }
  }, []);

  const parseCSVAndMap = (csvText) => {
    const rows = parseAdvancedCSV(csvText);
    if (rows.length < 2) return [];

    let headerRowIndex = 0;
    let maxMatches = 0;
    let map = { 
        name: -1, amount: -1, kw: -1, channel: -1, contractType: -1, origin: -1, competitor: -1, reason: -1, actionable: -1,
        fechaVenta: -1, fechaCierre: -1, estadoAcuerdo: -1, etapaComercial: -1, pv: -1, bess: -1, gas: -1,
        industry: -1, state: -1
    };

    // BÚSQUEDA EXACTA Y ESTRICTA DE COLUMNAS
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const rawHeaders = rows[r];
      const tempHeaders = rawHeaders.map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      let matches = 0;
      let tempMap = { ...map };

      tempHeaders.forEach((h, i) => {
        if (!h) return;
        if (h === 'nombre del proyecto' || h === 'proyecto') { tempMap.name = i; matches++; }
        if (h === 'fecha de venta' || h === 'fecha venta') { tempMap.fechaVenta = i; matches += 2; }
        if (h.includes('fecha estimada') || h.includes('fecha de arribo')) { tempMap.fechaCierre = i; matches++; }
        if (h === 'capex global mxn' || h === 'capex global') { tempMap.amount = i; matches += 2; }
        if (h === 'kw total' || (h.includes('kw') && !h.includes('pv') && !h.includes('ups') && !h.includes('gas'))) { tempMap.kw = i; matches++; }
        if (h.includes('estado del acuerdo') || h.includes('estatus')) { tempMap.estadoAcuerdo = i; matches++; }
        if (h.includes('etapa comercial') || h.includes('etapa del acuerdo') || h.includes('etapa')) { tempMap.etapaComercial = i; matches++; }
        if (h === 'pv kw dc' || h.includes('pv kw')) { tempMap.pv = i; matches++; }
        if (h === 'bess kwh' || h.includes('bess')) { tempMap.bess = i; matches++; }
        if (h === 'gas kw' || h.includes('gas kw')) { tempMap.gas = i; matches++; }
        if (h.includes('origen de la cuenta') || h.includes('origen')) { tempMap.origin = i; matches++; }
        if (h.includes('responsable de la cta') || h.includes('responsable') || h.includes('canal')) { tempMap.channel = i; matches++; }
        if (h.includes('tipo de contrato') || h.includes('contrato')) { tempMap.contractType = i; matches++; }
        if (h.includes('contra quien') || h.includes('competidor')) { tempMap.competitor = i; matches++; }
        if (h === 'notas' || h.includes('motivo') || h.includes('razon')) { tempMap.reason = i; matches++; }
        if (h.includes('siguiente accion') || h.includes('accion especifica')) { tempMap.actionable = i; matches++; }
        if (h.includes('rubro de la empresa') || h.includes('rubro')) { tempMap.industry = i; matches++; }
        if (h === 'estado' || (h.includes('estado') && !h.includes('acuerdo'))) { tempMap.state = i; matches++; }
      });

      if (matches > maxMatches) { maxMatches = matches; headerRowIndex = r; map = tempMap; }
    }

    const parsedData = rows.slice(headerRowIndex + 1).map((row, index) => {
      if (!row || row.length === 0) return null;
      const getVal = (idx) => idx !== -1 && row[idx] ? row[idx] : null;
      
      const name = getVal(map.name);
      // Validaciones para evitar leer basura o notas saltadas
      if (!name || name.trim() === '' || name.includes('RECUENTO') || name.includes('No altere')) return null;

      const estadoAcuerdo = getVal(map.estadoAcuerdo) || '';
      const etapaComercial = getVal(map.etapaComercial) || '';
      const combinedStageStr = `${estadoAcuerdo} ${etapaComercial}`.toLowerCase();
      
      // FILTRO ESTRICTO: Desechar 2025
      if (combinedStageStr.includes('2025')) return null; 

      const rawAmount = getVal(map.amount) || '0';
      let parsedAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g,"")) || 0;
      const parsedKw = parseFloat((getVal(map.kw) || '0').replace(/[^0-9.-]+/g,"")) || 0;

      const pv = parseFloat((getVal(map.pv) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const bess = parseFloat((getVal(map.bess) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const gas = parseFloat((getVal(map.gas) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      
      const hasPV = pv > 0;
      const hasBESS = bess > 0;
      const hasGAS = gas > 0;

      let pTypes = [];
      if (hasPV) pTypes.push('PV');
      if (hasBESS) pTypes.push('BESS');
      if (hasGAS) pTypes.push('GAS');
      const projectType = pTypes.length > 0 ? pTypes.join(' + ') : 'TBD';
      
      let isWon = combinedStageStr.includes('ganado') || combinedStageStr.includes('cerrado') || combinedStageStr.includes('5.');
      let isLost = combinedStageStr.includes('perdid') || combinedStageStr.includes('cancelad') || combinedStageStr.includes('pausad');
      const displayStage = isWon ? 'Cerrado/Ganado' : isLost ? 'Perdido/Pausado' : 'Abierto/Pipeline';

      const fechaVentaRaw = getVal(map.fechaVenta);
      const fechaCierreRaw = getVal(map.fechaCierre);
      const hasFechaVentaValida = fechaVentaRaw && fechaVentaRaw.trim() !== '' && fechaVentaRaw !== '0';
      const hasFechaCierreValida = fechaCierreRaw && fechaCierreRaw.trim() !== '' && fechaCierreRaw !== '0';
      
      const finalDateStr = isWon ? (hasFechaVentaValida ? fechaVentaRaw : null) : (hasFechaCierreValida ? fechaCierreRaw : null);
      const parsedDate = parseCustomDate(finalDateStr);

      if (parsedDate && parsedDate.getFullYear() < 2026) {
          return null; // Filtrar todo lo de 2025
      }

      let monthName = 'Mes No Especificado';
      if (parsedDate) {
          const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          monthName = meses[parsedDate.getMonth()];
      }

      return {
        id: index,
        name: name,
        month: monthName,
        amount: parsedAmount,
        kw: parsedKw,
        stageCategory: displayStage,
        isWon: isWon,
        isLost: isLost,
        hasFechaVenta: hasFechaVentaValida,
        channel: getVal(map.channel) || 'No especificado',
        contractType: getVal(map.contractType) || 'No especificado',
        projectType: projectType,
        hasPV, hasBESS, hasGAS,
        industry: getVal(map.industry) || 'No especificado',
        state: getVal(map.state) || 'No especificado',
        origin: getVal(map.origin) || 'No especificado',
        competitor: getVal(map.competitor) || '',
        reason: getVal(map.reason) || '',
        actionable: getVal(map.actionable) || ''
      };
    }).filter(item => item !== null);

    return parsedData;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true); setErrorMsg(''); 
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = parseCSVAndMap(event.target.result);
        if(data.length > 0) { setPipelineData(data); setDataLoaded(true); }
        else setErrorMsg("El archivo no tiene proyectos válidos del 2026.");
      } catch (err) { setErrorMsg("Error al procesar el archivo."); console.error(err); } 
      finally { setIsLoading(false); }
    };
    reader.onerror = () => { setErrorMsg("Error de lectura."); setIsLoading(false); };
    reader.readAsText(file);
  };

  const fetchSheetData = async (rawUrl) => {
    if(!rawUrl) return;
    setIsLoading(true); setErrorMsg(''); 
    let urlToFetch = rawUrl.trim();
    const sheetIdMatch = urlToFetch.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetIdMatch && sheetIdMatch[1] && !urlToFetch.includes('pub?')) {
      urlToFetch = `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/gviz/tq?tqx=out:csv`;
    }
    try {
      const response = await fetch(urlToFetch);
      if(!response.ok) throw new Error("Error HTTP");
      const csvText = await response.text();
      const data = parseCSVAndMap(csvText);
      if(data.length > 0) { setPipelineData(data); setDataLoaded(true); localStorage.setItem('rer_sheet_url_v1', rawUrl); } 
      else setErrorMsg("Documento vacío o sin proyectos de 2026.");
    } catch (err) { setErrorMsg("Error de conexión. Verifica que el enlace sea público."); } 
    finally { setIsLoading(false); }
  };

  const getOptions = (key) => ['Todos', ...Array.from(new Set(pipelineData.map(d => d[key]).filter(Boolean)))].sort();
  const months = ['Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Mes No Especificado'];
  const contractTypes = getOptions('contractType');
  const projectTypes = getOptions('projectType');
  const origins = getOptions('origin');
  const channels = getOptions('channel');
  const kwRanges = ['Todos', '0-1000 KW', '1001-3000 KW / 1-3 MW', '3000+ KW / 3+ MW'];
  const stageOptions = ['Todos', 'Cerrado/Ganado', 'Abierto/Pipeline', 'Perdido/Pausado'];

  const filteredData = useMemo(() => {
    return pipelineData.filter(item => {
      let kwMatch = true;
      if (filters.kwRange === '0-1000 KW') kwMatch = item.kw <= 1000;
      if (filters.kwRange === '1001-3000 KW / 1-3 MW') kwMatch = item.kw > 1000 && item.kw <= 3000;
      if (filters.kwRange === '3000+ KW / 3+ MW') kwMatch = item.kw > 3000;

      return (
        (filters.month === 'Todos' || item.month === filters.month) &&
        (filters.contractType === 'Todos' || item.contractType === filters.contractType) &&
        (filters.projectType === 'Todos' || item.projectType === filters.projectType) &&
        (filters.origin === 'Todos' || item.origin === filters.origin) &&
        (filters.channel === 'Todos' || item.channel === filters.channel) &&
        (filters.stageFilter === 'Todos' || item.stageCategory === filters.stageFilter) &&
        kwMatch
      );
    });
  }, [pipelineData, filters]);

  // KPIs
  const closedProjects = filteredData.filter(d => d.isWon && d.hasFechaVenta);
  const totalCerrado = closedProjects.reduce((acc, curr) => acc + curr.amount, 0);
  const totalProyectosCerrados = closedProjects.length;

  const totalPosibleCierre = filteredData.filter(d => !d.isWon && !d.isLost).reduce((acc, curr) => acc + curr.amount, 0);
  const progressPercent = Math.min(((totalCerrado / ANNUAL_GOAL) * 100).toFixed(1), 100);

  // Gráfica de Avance
  const monthlyData = useMemo(() => {
    const dataByMonth = {};
    const monthsOrder = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    monthsOrder.forEach(m => { dataByMonth[m] = { name: m, Ventas: 0, Meta: ANNUAL_GOAL }; });
    
    filteredData.forEach(item => {
      if (item.isWon && item.hasFechaVenta && dataByMonth[item.month]) {
          dataByMonth[item.month].Ventas += item.amount;
      }
    });

    let cumulative = 0;
    return monthsOrder.map(m => {
      cumulative += dataByMonth[m].Ventas;
      return { ...dataByMonth[m], Acumulado: cumulative };
    }); 
  }, [filteredData]);

  // Gráficas Individuales
  const channelData = useMemo(() => {
    const counts = {};
    filteredData.filter(d => d.isWon).forEach(item => {
      const ch = item.channel || 'Otros';
      counts[ch] = (counts[ch] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [filteredData]);

  const kwByContractData = useMemo(() => {
    const kws = {};
    filteredData.forEach(item => { kws[item.contractType] = (kws[item.contractType] || 0) + item.kw; });
    return Object.keys(kws).map(key => ({ name: key, value: kws[key] }));
  }, [filteredData]);

  const stageData = useMemo(() => {
    const counts = {};
    filteredData.forEach(item => { 
        counts[item.stageCategory] = (counts[item.stageCategory] || 0) + 1; 
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [filteredData]);

  const industryData = useMemo(() => {
    const counts = {};
    filteredData.forEach(item => { 
        const ind = item.industry || 'No especificado';
        counts[ind] = (counts[ind] || 0) + 1; 
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a,b) => b.value - a.value).slice(0, 15); 
  }, [filteredData]);

  const stateData = useMemo(() => {
    const counts = {};
    filteredData.forEach(item => { 
        const st = item.state || 'No especificado';
        counts[st] = (counts[st] || 0) + 1; 
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a,b) => b.value - a.value).slice(0, 15); 
  }, [filteredData]);

  const originData = useMemo(() => {
    const counts = {};
    filteredData.forEach(item => { 
        const og = item.origin || 'No especificado';
        counts[og] = (counts[og] || 0) + 1; 
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData]);

  const techData = useMemo(() => {
    let pv = 0, bess = 0, gas = 0;
    filteredData.forEach(d => {
      if (d.hasPV) pv++;
      if (d.hasBESS) bess++;
      if (d.hasGAS) gas++;
    });
    return [
      { name: 'Sistemas Solares (PV)', value: pv },
      { name: 'Almacenamiento (BESS)', value: bess },
      { name: 'Gas / Cogeneración', value: gas }
    ].filter(t => t.value > 0);
  }, [filteredData]);

  const posibleCierreList = filteredData.filter(d => !d.isWon && !d.isLost);
  const lostPausedList = filteredData.filter(d => d.isLost);
  const competitorStats = useMemo(() => {
    const counts = {};
    lostPausedList.filter(d => d.competitor).forEach(item => { counts[item.competitor] = (counts[item.competitor] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]);
  }, [lostPausedList]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans max-w-[1400px] mx-auto">
  
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
            <<img src="/logo.png" alt="Logo RER Energy" className="h-12 object-contain" />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.primary }}>Dashboard Comercial 2026</h1>
            <p className="text-slate-500 text-sm mt-1">Gestión Estratégica y Análisis de Pipeline</p>
          </div>
        </div>
      </header>

      {/* SECCIÓN DE CARGA DE DATOS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold flex items-center gap-2 text-sm" style={{ color: COLORS.primary }}>Carga tu Base de Datos</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('upload')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'upload' ? 'bg-white shadow-sm text-[#0a3663]' : 'text-slate-500'}`}>Archivo Local CSV</button>
            <button onClick={() => setActiveTab('url')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'url' ? 'bg-white shadow-sm text-[#0a3663]' : 'text-slate-500'}`}>Enlace Google Sheets</button>
          </div>
        </div>
        {activeTab === 'upload' ? (
          <div className="border-2 border-dashed bg-slate-50 rounded-lg p-4 text-center hover:bg-slate-100 transition-colors" style={{ borderColor: COLORS.secondary }}>
            <input type="file" accept=".csv" onChange={handleFileUpload} onClick={(e) => { e.target.value = null; }} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center w-full">
              <span className="font-bold text-sm" style={{ color: COLORS.primary }}>Haz clic para subir tu Excel (CSV)</span>
              <span className="text-xs mt-1" style={{ color: COLORS.secondary }}>Se excluirán automáticamente los proyectos de 2025.</span>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Pega el enlace público de tu Google Sheet..." className="flex-1 p-2 border border-slate-300 rounded-md text-sm bg-slate-50" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
            <button onClick={() => fetchSheetData(sheetUrl)} disabled={isLoading || !sheetUrl} className="text-white px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: COLORS.success }}>Cargar</button>
          </div>
        )}
        {dataLoaded && !errorMsg && <p className="text-xs font-semibold mt-3" style={{ color: COLORS.success }}>✅ Datos cargados correctamente. (Contratos 2025 omitidos).</p>}
        {errorMsg && <p className="text-danger text-xs font-semibold mt-3">{errorMsg}</p>}
      </div>

      {!dataLoaded && pipelineData.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200"><Target size={48} className="mx-auto text-slate-300 mb-4" /><h3 className="text-xl font-bold text-slate-500">Esperando Datos</h3></div>
      ) : (
        <>
          {/* FILTROS INTERACTIVOS */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8">
            <div className="flex items-center gap-2 mb-4 font-semibold" style={{ color: COLORS.primary }}><Filter size={20} /><h2>Filtros Activos</h2></div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Estatus</label><select name="stageFilter" value={filters.stageFilter} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{stageOptions.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Mes</label><select name="month" value={filters.month} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{months.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Tecnología</label><select name="projectType" value={filters.projectType} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{projectTypes.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Tipo Contrato</label><select name="contractType" value={filters.contractType} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{contractTypes.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Canal de Venta</label><select name="channel" value={filters.channel} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{channels.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Origen</label><select name="origin" value={filters.origin} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{origins.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Rango Energía</label><select name="kwRange" value={filters.kwRange} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{kwRanges.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
            </div>
          </div>

          {/* KPIs Y META */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="text-white p-6 rounded-xl shadow-md lg:col-span-2 relative overflow-hidden" style={{ backgroundColor: COLORS.primary }}>
              <div className="relative z-10">
                <h3 className="text-sky-100 text-sm font-semibold flex items-center gap-2 mb-1"><Target size={18} /> Progreso Meta Anual 2026 (Cerrados por Fecha Venta)</h3>
                <div className="flex items-end gap-4 mt-2">
                  <span className="text-4xl font-bold">{formatCurrency(totalCerrado)}</span>
                  <span className="text-sky-200 text-sm mb-1">/ {formatCurrency(ANNUAL_GOAL)}</span>
                </div>
                <div className="mt-5 bg-sky-900 rounded-full h-4 w-full overflow-hidden border border-sky-800">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%`, backgroundColor: COLORS.success }}></div>
                </div>
                <div className="mt-2 text-right text-xs text-sky-200 font-medium">{progressPercent}% Completado</div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full opacity-10 blur-2xl"></div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <h3 className="text-slate-500 text-sm font-semibold flex items-center gap-2 mb-2"><TrendingUp size={18} style={{ color: COLORS.warning }} /> Monto Abierto / Pipeline</h3>
              <span className="text-2xl font-bold text-slate-800">{formatCurrency(totalPosibleCierre)}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <h3 className="text-slate-500 text-sm font-semibold flex items-center gap-2 mb-2"><Briefcase size={18} style={{ color: COLORS.secondary }} /> Proyectos Evaluados</h3>
              <span className="text-3xl font-bold text-slate-800">{filteredData.length}</span>
            </div>
          </div>

          {/* === SECCIÓN PANORÁMICA DE GRÁFICAS (1 COLUMNA, 100% ANCHO, MULTICOLOR) === */}
          <div className="flex flex-col gap-12 mb-12">
            
            {/* 1. AVANCE ACUMULADO (SOLO VENTAS REALES) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Avance de Ventas Reales vs Meta</h3>
              <p className="text-sm text-slate-500 mb-6">Gráfica estricta de cumplimiento: Solo se contabilizan los montos de proyectos <b>Ganados</b> basados en su <b>Fecha de Venta</b>.</p>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, bottom: 20, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 14, fill: '#475569'}} tickMargin={10} />
                    <YAxis domain={[0, ANNUAL_GOAL]} tickFormatter={(val) => `$${val/1000000}M`} tick={{fontSize: 14, fill: '#475569'}} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Legend wrapperStyle={{fontSize: '14px', paddingTop: '20px'}} />
                    <Bar dataKey="Ventas" name="Venta del Mes" maxBarSize={80}>
                       {monthlyData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsA[index % COLORS.pieColorsA.length]} />)}
                    </Bar>
                    <Line type="monotone" dataKey="Acumulado" name="Cierre Acumulado" stroke={COLORS.primary} strokeWidth={4} dot={{r: 6}} />
                    <Line type="step" dataKey="Meta" name="Meta Anual (450M)" stroke={COLORS.danger} strokeDasharray="6 6" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. ETAPA COMERCIAL */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6">Conteo de Proyectos por Etapa Comercial</h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fontWeight: 500, fill: '#334155'}} width={200} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Bar dataKey="value" name="Cantidad de Proyectos" radius={[0, 6, 6, 0]} barSize={55}>
                      {stageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsB[index % COLORS.pieColorsB.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. TECNOLOGÍAS UTILIZADAS */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3"><Cpu size={28} style={{color: COLORS.primary}}/> Implementación por Tecnología</h3>
              <p className="text-sm text-slate-500 mb-6">Muestra en cuántos proyectos activos participa cada tecnología (un mismo proyecto puede incluir varias).</p>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={techData} margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 15, fontWeight: 500, fill: '#334155'}} tickMargin={10} />
                    <YAxis tick={{fontSize: 14, fill: '#475569'}} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Bar dataKey="value" name="Proyectos que la incluyen" radius={[6, 6, 0, 0]} maxBarSize={120}>
                       {techData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsC[index % COLORS.pieColorsC.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4. GANADOS POR CANAL (INDIVIDUAL PANORÁMICO) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Proyectos Ganados por Canal</h3>
              <div className="relative h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelData} cx="50%" cy="50%" innerRadius={120} outerRadius={180} dataKey="value" label={({name, value, percent}) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`} labelLine={true} style={{fontSize: '15px', fontWeight: 500, fill: '#334155'}}>
                      {channelData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsA[index % COLORS.pieColorsA.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-6xl font-bold" style={{color: COLORS.primary}}>{totalProyectosCerrados}</span>
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Cerrados</span>
                </div>
              </div>
            </div>

            {/* 5. ENERGÍA POR CONTRATO (INDIVIDUAL PANORÁMICO) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Distribución de Energía por Tipo de Contrato</h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={kwByContractData} cx="50%" cy="50%" outerRadius={180} dataKey="value" label={({name, value}) => `${name}: ${formatKW(value)}`} labelLine={true} style={{fontSize: '15px', fontWeight: 500, fill: '#334155'}}>
                      {kwByContractData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsB[index % COLORS.pieColorsB.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? formatKW(value) : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 6. ORIGEN DE CUENTA (INDIVIDUAL PANORÁMICO) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Origen de la Cuenta</h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={originData} cx="50%" cy="50%" outerRadius={180} dataKey="value" label={({name, value}) => `${name}: ${value} cuentas`} labelLine={true} style={{fontSize: '15px', fontWeight: 500, fill: '#334155'}}>
                      {originData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsC[index % COLORS.pieColorsC.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 7. INDUSTRIAS */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3"><Factory size={28} style={{color: COLORS.primary}}/> Top Industrias (Rubro de Empresa)</h3>
              <div className="h-[550px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industryData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fill: '#334155'}} width={250} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Bar dataKey="value" name="Cantidad" radius={[0, 6, 6, 0]} barSize={35}>
                       {industryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsA[index % COLORS.pieColorsA.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 8. ESTADOS */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3"><MapPin size={28} style={{color: COLORS.success}}/> Top Estados (Presencia Geográfica)</h3>
              <div className="h-[550px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stateData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fill: '#334155'}} width={250} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Bar dataKey="value" name="Proyectos" radius={[0, 6, 6, 0]} barSize={35}>
                       {stateData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.pieColorsB[index % COLORS.pieColorsB.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
          {/* === FIN DE SECCIÓN DE GRÁFICAS === */}

          {/* VISTA DETALLADA DE PROYECTOS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-12">
            <div className="p-5 border-b border-slate-900" style={{backgroundColor: COLORS.primary}}>
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><List size={24}/> Directorio de Proyectos Activos (2026)</h3>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-base text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="p-4 border-b">Nombre del Proyecto</th>
                    <th className="p-4 border-b">Estatus</th>
                    <th className="p-4 border-b">Tecnología / Energía</th>
                    <th className="p-4 border-b">Ubicación / Industria</th>
                    <th className="p-4 border-b">Mes Evaluado</th>
                    <th className="p-4 border-b text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${item.isWon ? 'bg-[#e0f2fe] text-[#0369a1]' : item.isLost ? 'bg-red-100 text-red-800' : 'bg-[#dcfce7] text-[#166534]'}`}>
                          {item.stageCategory}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{item.projectType} ({formatKW(item.kw)})</td>
                      <td className="p-4 text-slate-600">
                        <span className="block font-medium">{item.state}</span>
                        <span className="text-sm text-slate-400">{item.industry}</span>
                      </td>
                      <td className="p-4 text-slate-600">{item.month}</td>
                      <td className="p-4 text-right font-bold" style={{color: COLORS.primary}}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && <tr><td colSpan="6" className="p-8 text-lg text-center text-slate-500">No hay proyectos que coincidan con los filtros en 2026.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECCIÓN DE INSIGHTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-amber-50 p-5 border-b border-amber-100"><h3 className="text-xl font-bold text-amber-900 flex items-center gap-2"><AlertCircle size={24} className="text-amber-600" /> Posible Cierre (Accionables)</h3></div>
              <div className="p-6 flex-1 overflow-auto max-h-[500px]">
                {posibleCierreList.length === 0 ? <p className="text-slate-500 text-base text-center py-10">No hay proyectos en etapas abiertas o en propuesta.</p> : (
                  <div className="space-y-5">
                    {posibleCierreList.map(item => (
                      <div key={item.id} className="p-5 border border-slate-100 rounded-xl bg-slate-50">
                        <div className="flex justify-between items-start mb-3"><h4 className="text-lg font-bold text-slate-800">{item.name}</h4><span className="text-base font-bold text-sky-700">{formatCurrency(item.amount)}</span></div>
                        <div className="text-sm text-slate-600 mb-4 grid grid-cols-2 gap-2"><span>Tecnología: <b>{item.projectType} ({formatKW(item.kw)})</b></span><span>Contrato: <b>{item.contractType}</b></span></div>
                        <div className="bg-white p-4 rounded-lg border border-amber-200">
                          <strong className="text-amber-700 text-xs uppercase tracking-wide block mb-2">Próxima Acción / Estatus:</strong>
                          <span className="text-slate-700 flex items-start gap-2 text-base"><ArrowRight size={20} className="text-amber-500 shrink-0 mt-0.5" />{item.actionable || 'Revisar estatus de la negociación.'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-100 p-5 border-b border-slate-200"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><SearchX size={24} className="text-slate-600" /> Perdidos / Pausados</h3></div>
              <div className="p-6 flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[500px]">
                <div>
                  <h4 className="font-bold text-sm text-slate-500 mb-4 uppercase tracking-wider">Top Competidores</h4>
                  {competitorStats.length === 0 ? <p className="text-slate-400 text-base">Sin datos de competencia.</p> : (
                    <ul className="space-y-3">
                      {competitorStats.map(([comp, count]) => (
                        <li key={comp} className="flex justify-between items-center bg-white border border-slate-100 p-3 rounded-lg text-base shadow-sm"><span className="font-bold text-slate-700">{comp}</span><span className="bg-slate-200 text-slate-800 text-sm py-1 px-3 rounded-full font-bold">{count}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-500 mb-4 uppercase tracking-wider">Motivos & Notas</h4>
                  <div className="space-y-4">
                    {lostPausedList.filter(d => d.reason).map(item => (
                      <div key={item.id} className="text-base border-l-4 border-danger pl-4 py-1">
                        <p className="font-bold text-slate-800">{item.reason}</p>
                        <p className="text-sm text-slate-500 mb-2">{item.name}</p>
                        {item.actionable && <p className="text-sm text-sky-800 bg-sky-50 inline-block px-3 py-1.5 rounded-md mt-1"><strong>Siguiente paso:</strong> {item.actionable}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}