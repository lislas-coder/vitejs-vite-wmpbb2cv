import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, ReferenceLine 
} from 'recharts';
import { Filter, Target, TrendingUp, AlertCircle, Briefcase, Zap, SearchX, ArrowRight, List, MapPin, Factory, Cpu, Search, Clock } from 'lucide-react';

const ANNUAL_GOAL = 450000000; // 450 Millones MXN

// PALETA CORPORATIVA
const COLORS = {
  primary: '#0a3663', 
  success: '#69b32d', 
  secondary: '#4b98d1', 
  danger: '#dc2626',
  warning: '#f59e0b',
  piePalette: [
    '#0a3663', '#f59e0b', '#69b32d', '#dc2626', '#4b98d1', 
    '#8b5cf6', '#84cc16', '#1e40af', '#4ade80', '#f97316', 
    '#0284c7', '#f43f5e', '#166534', '#d946ef', '#3b82f6'
  ]
};

// Formateadores globales
const formatCurrency = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '0 MXN';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num) + ' MXN';
};

const formatKW = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '0 KW';
  return num >= 1000 ? `${(num / 1000).toFixed(2)} MW` : `${num.toFixed(2)} KW`;
};

// Analizador de fechas estricto
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
          if (p2 < 100) p2 += 2000; 
          let year = p2;
          let month, day;
          
          if (p1 > 12) { month = p0; day = p1; } 
          else if (p0 > 12) { day = p0; month = p1; } 
          else { day = p0; month = p1; } 
          
          const manualDate = new Date(year, month - 1, day);
          if (!isNaN(manualDate.getTime())) return manualDate;
      }
  }
  
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

// Parser CSV Robusto
const parseAdvancedCSV = (text) => {
  const firstLineIdx = text.indexOf('\n');
  const firstLine = firstLineIdx !== -1 ? text.substring(0, firstLineIdx) : text;
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  const rawLines = text.split(/\r?\n/);
  const mergedLines = [];
  let tempLine = '';
  let openQuotes = false;

  for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];
      let quotesInLine = (line.match(/"/g) || []).length;
      
      if (openQuotes) {
          tempLine += '\n' + line;
          if (quotesInLine % 2 !== 0) { 
              openQuotes = false;
              mergedLines.push(tempLine);
              tempLine = '';
          }
      } else {
          if (quotesInLine % 2 !== 0) { 
              openQuotes = true;
              tempLine = line;
          } else {
              mergedLines.push(line);
          }
      }
  }
  if (openQuotes) mergedLines.push(tempLine); 

  return mergedLines.map(line => {
      let row = [];
      let val = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
          let c = line[i], nc = line[i+1];
          if (c === '"') {
              if (inQ && nc === '"') { val += '"'; i++; } 
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

// Funciones de Limpieza y Normalización
const cleanValue = (val) => {
    if (!val) return 'Sin Asignar';
    const trimmed = val.trim();
    return trimmed === '' ? 'Sin Asignar' : trimmed;
};

const toTitleCase = (str) => {
    if (!str || str === 'Sin Asignar' || str === 'TBD') return str;
    return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.substring(1)).join(' ');
};

const cleanOrigin = (val) => {
    let c = cleanValue(val);
    if (/op\s*sell/i.test(c) || /up\s*sell/i.test(c)) return 'Up Sell';
    return toTitleCase(c);
};

const cleanState = (val) => {
    let c = cleanValue(val);
    if (c === 'Sin Asignar') return c;
    c = c.replace(/\s+/g, ' ').trim();
    if (/quin/i.test(c) || /q\.?\s*roo/i.test(c) || /q\s*roo/i.test(c)) return 'Quintana Roo';
    if (/nuevo\s*le[oó]n/i.test(c) || /^nl$/i.test(c)) return 'Nuevo León';
    if (/cdmx/i.test(c) || /ciudad\s*de\s*m[eé]x/i.test(c)) return 'CDMX';
    if (/edo\.?\s*m[eé]x/i.test(c) || /estado\s*de\s*m[eé]x/i.test(c)) return 'Estado de México';
    if (/quer[eé]t/i.test(c) || /qro/i.test(c)) return 'Querétaro';
    if (/yucat[aá]n/i.test(c)) return 'Yucatán';
    if (/michoac[aá]n/i.test(c)) return 'Michoacán';
    return toTitleCase(c);
};

const cleanIndustry = (val) => {
    let c = cleanValue(val);
    if (c === 'Sin Asignar') return c;
    c = c.replace(/\s+/g, ' ').trim();
    if (/hospital/i.test(c) || /cl[ií]nica/i.test(c) || /salud/i.test(c)) return 'Hospitales';
    if (/hotel/i.test(c)) return 'Hoteles';
    return toTitleCase(c);
};

export default function App() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); 
  const [dataLoaded, setDataLoaded] = useState(false);
  const [pipelineData, setPipelineData] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');

  // ESTADOS DE BOTONES DINÁMICOS PARA GRÁFICAS
  const [techBreakdown, setTechBreakdown] = useState('total'); 
  const [industryBreakdown, setIndustryBreakdown] = useState('total'); 
  const [stateBreakdown, setStateBreakdown] = useState('total'); 
  
  const [channelView, setChannelView] = useState('won'); 
  const [contractView, setContractView] = useState('all'); 
  const [originView, setOriginView] = useState('all'); 

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

  const processData = (csvText) => {
    const rows = parseAdvancedCSV(csvText);
    if (rows.length < 2) return [];

    let headerRowIndex = 0;
    let maxMatches = 0;
    let map = { 
        name: -1, amount: -1, channel: -1, contractType: -1, origin: -1, competitor: -1, reason: -1, actionable: -1,
        fechaVenta: -1, fechaCierre: -1, fechaArribo: -1, estadoAcuerdo: -1, etapaComercial: -1, pv: -1, bess: -1, gas: -1,
        industry: -1, state: -1
    };

    const matchHeader = (h, keywords) => keywords.some(kw => h === kw);
    const includesHeader = (h, keywords) => keywords.some(kw => h.includes(kw));

    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const rawHeaders = rows[r];
      if (!rawHeaders || rawHeaders.length === 0) continue;
      const tempHeaders = rawHeaders.map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      
      let matches = 0;
      let tempMap = { ...map };

      tempHeaders.forEach((h, i) => {
        if (!h) return;
        if (tempMap.name === -1 && includesHeader(h, ['nombre del proyecto', 'proyecto'])) { tempMap.name = i; matches++; }
        else if (tempMap.fechaVenta === -1 && includesHeader(h, ['fecha de venta', 'fecha venta'])) { tempMap.fechaVenta = i; matches += 2; }
        else if (tempMap.fechaCierre === -1 && includesHeader(h, ['fecha estimada', 'fecha de cierre'])) { tempMap.fechaCierre = i; matches++; }
        else if (tempMap.fechaArribo === -1 && includesHeader(h, ['fecha de arribo', 'fecha arribo'])) { tempMap.fechaArribo = i; matches++; }
        else if (tempMap.amount === -1 && includesHeader(h, ['capex global mxn', 'capex global'])) { tempMap.amount = i; matches += 2; }
        else if (tempMap.estadoAcuerdo === -1 && h === 'estado del acuerdo') { tempMap.estadoAcuerdo = i; matches++; }
        else if (tempMap.etapaComercial === -1 && h === 'etapa comercial') { tempMap.etapaComercial = i; matches++; }
        else if (tempMap.pv === -1 && matchHeader(h, ['pv kw dc'])) { tempMap.pv = i; matches++; }
        else if (tempMap.bess === -1 && matchHeader(h, ['bess kwh'])) { tempMap.bess = i; matches++; }
        else if (tempMap.gas === -1 && includesHeader(h, ['gas'])) { tempMap.gas = i; matches++; } 
        else if (tempMap.origin === -1 && matchHeader(h, ['origen de la cuenta'])) { tempMap.origin = i; matches++; }
        else if (tempMap.channel === -1 && matchHeader(h, ['responsable de la cta'])) { tempMap.channel = i; matches++; }
        else if (tempMap.contractType === -1 && matchHeader(h, ['tipo de contrato'])) { tempMap.contractType = i; matches++; }
        else if (tempMap.competitor === -1 && includesHeader(h, ['contra quien'])) { tempMap.competitor = i; matches++; }
        else if (tempMap.reason === -1 && matchHeader(h, ['notas'])) { tempMap.reason = i; matches++; }
        else if (tempMap.actionable === -1 && includesHeader(h, ['accion especifica'])) { tempMap.actionable = i; matches++; }
        else if (tempMap.industry === -1 && matchHeader(h, ['rubro de la empresa'])) { tempMap.industry = i; matches++; }
        else if (tempMap.state === -1 && matchHeader(h, ['estado'])) { tempMap.state = i; matches++; }
      });

      if (matches > maxMatches) { maxMatches = matches; headerRowIndex = r; map = tempMap; }
    }

    const parsedData = rows.slice(headerRowIndex + 1).map((row, index) => {
      if (!row || row.length === 0) return null;
      const getVal = (idx) => idx !== -1 && row[idx] ? row[idx] : null;
      
      const name = getVal(map.name);
      if (!name || name.trim() === '' || name.includes('RECUENTO') || name.includes('No altere') || name.includes('Ventas totales')) return null;

      const fVenta = getVal(map.fechaVenta);
      const fCierre = getVal(map.fechaCierre);
      const fArribo = getVal(map.fechaArribo);

      const estadoAcuerdo = getVal(map.estadoAcuerdo) || '';
      const etapaComercial = getVal(map.etapaComercial) || '';
      const combinedStageStr = `${estadoAcuerdo} ${etapaComercial}`.toLowerCase();
      
      if (combinedStageStr.includes('2025')) return null; 

      const rawAmount = getVal(map.amount) || '0';
      let parsedAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g,"")) || 0;
      
      const pv = parseFloat((getVal(map.pv) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const bess = parseFloat((getVal(map.bess) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const gas = parseFloat((getVal(map.gas) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const parsedKw = pv + bess + gas;

      const hasPV = pv > 0;
      const hasBESS = bess > 0;
      const hasGAS = gas > 0;

      let pTypes = [];
      if (hasPV) pTypes.push('PV');
      if (hasBESS) pTypes.push('BESS');
      if (hasGAS) pTypes.push('GAS');
      const projectType = pTypes.length > 0 ? pTypes.join(' + ') : 'TBD';
      
      const hasFechaVentaValida = fVenta && fVenta.trim() !== '' && fVenta.trim() !== '0' && fVenta.trim() !== '-' && !fVenta.toLowerCase().includes('tbd');
      const hasFechaCierreValida = fCierre && fCierre.trim() !== '' && fCierre.trim() !== '0' && fCierre.trim() !== '-' && !fCierre.toLowerCase().includes('tbd');

      const isGanado = combinedStageStr.includes('ganado') || combinedStageStr.includes('cierre');
      const isFirmado = combinedStageStr.includes('firmado');
      const isWon = isGanado && isFirmado && hasFechaVentaValida;
      
      const isLost = combinedStageStr.includes('perdid') || combinedStageStr.includes('cancelad') || combinedStageStr.includes('pausad');
      const displayStage = isWon ? 'Cerrado/Ganado' : isLost ? 'Perdido/Pausado' : 'Abierto/Pipeline';

      const finalDateStr = isWon ? fVenta : (hasFechaCierreValida ? fCierre : null);
      const parsedDate = parseCustomDate(finalDateStr);
      
      const dVenta = parseCustomDate(fVenta);
      const dArribo = parseCustomDate(fArribo);
      const saleYear = dVenta ? dVenta.getFullYear() : null;

      let cycleDays = null;
      if (isWon && dVenta && dArribo) {
          const diffTime = Math.abs(dVenta - dArribo);
          cycleDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      let monthName = 'Mes No Especificado';
      if (parsedDate) {
          const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          monthName = meses[parsedDate.getMonth()];
      }

      let contractClean = cleanValue(getVal(map.contractType));
      if (contractClean === 'Sin Asignar') contractClean = 'TBD';
      else contractClean = contractClean.toUpperCase();
      
      let channelClean = cleanValue(getVal(map.channel));
      if (channelClean !== 'Sin Asignar') channelClean = channelClean.toUpperCase();

      return {
        id: index,
        name: name,
        month: monthName,
        amount: parsedAmount,
        kw: parsedKw,
        pvValue: pv,
        bessValue: bess,
        gasValue: gas,
        stageCategory: displayStage,
        etapaComercialRaw: etapaComercial,
        isWon: isWon,
        isLost: isLost,
        hasFechaVenta: hasFechaVentaValida,
        saleYear: saleYear,
        cycleDays: cycleDays,
        channel: channelClean,
        contractType: contractClean,
        projectType: projectType,
        hasPV, hasBESS, hasGAS,
        industry: cleanIndustry(getVal(map.industry)),
        state: cleanState(getVal(map.state)),
        origin: cleanOrigin(getVal(map.origin)),
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
        const data = processData(event.target.result);
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
      const data = processData(csvText);
      if(data.length > 0) { setPipelineData(data); setDataLoaded(true); localStorage.setItem('rer_sheet_url_v1', rawUrl); } 
      else setErrorMsg("Documento vacío o sin proyectos de 2026.");
    } catch (err) { setErrorMsg("Error de conexión."); } 
    finally { setIsLoading(false); }
  };

  const getOptions = (key) => ['Todos', ...Array.from(new Set(pipelineData.map(d => d[key]).filter(val => val !== 'Sin Asignar' && val !== 'TBD')))].sort();
  const months = ['Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Mes No Especificado'];
  const contractTypes = ['Todos', ...Array.from(new Set(pipelineData.map(d => d.contractType)))].sort();
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

  // KPIs Generales
  const allClosedProjects = filteredData.filter(d => d.isWon && d.hasFechaVenta);
  const closedProjects2026 = allClosedProjects.filter(d => d.saleYear === 2026);
  const totalCerrado2026 = closedProjects2026.reduce((acc, curr) => acc + curr.amount, 0);

  const totalPosibleCierre = filteredData.filter(d => !d.isWon && !d.isLost).reduce((acc, curr) => acc + curr.amount, 0);
  const progressPercent = Math.min(((totalCerrado2026 / ANNUAL_GOAL) * 100).toFixed(1), 100);

  const closedWithCycle = allClosedProjects.filter(d => d.cycleDays !== null);
  const avgCycleDays = closedWithCycle.length ? Math.round(closedWithCycle.reduce((acc, curr) => acc + curr.cycleDays, 0) / closedWithCycle.length) : 0;

  // Gráfica de Avance Trimestral
  const monthlyData = useMemo(() => {
    const dataByMonth = {};
    const monthsOrder = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const monthlyTargets = {
        'Enero': 30000000, 'Febrero': 30000000, 'Marzo': 30000000,
        'Abril': 30000000, 'Mayo': 30000000, 'Junio': 30000000,
        'Julio': 30000000, 'Agosto': 30000000, 'Septiembre': 30000000,
        'Octubre': 60000000, 'Noviembre': 60000000, 'Diciembre': 60000000
    };

    let cumulativeTarget = 0;
    monthsOrder.forEach(m => { 
        cumulativeTarget += monthlyTargets[m];
        dataByMonth[m] = { name: m, Ventas: 0, Meta: cumulativeTarget }; 
    });
    
    filteredData.forEach(item => {
      if (item.isWon && item.hasFechaVenta && item.saleYear === 2026 && dataByMonth[item.month]) {
          dataByMonth[item.month].Ventas += item.amount;
      }
    });

    let cumulative = 0;
    return monthsOrder.map(m => {
      cumulative += dataByMonth[m].Ventas;
      return { ...dataByMonth[m], Acumulado: cumulative };
    }); 
  }, [filteredData]);

  // NUEVO: Progreso por Trimestre (Q1, Q2, Q3, Q4)
  const quarterlyData = useMemo(() => {
    const qData = [
      { id: 'Q1', name: 'Q1 (Ene-Mar)', goal: 90000000, sales: 0, months: ['Enero', 'Febrero', 'Marzo'] },
      { id: 'Q2', name: 'Q2 (Abr-Jun)', goal: 90000000, sales: 0, months: ['Abril', 'Mayo', 'Junio'] },
      { id: 'Q3', name: 'Q3 (Jul-Sep)', goal: 90000000, sales: 0, months: ['Julio', 'Agosto', 'Septiembre'] },
      { id: 'Q4', name: 'Q4 (Oct-Dic)', goal: 180000000, sales: 0, months: ['Octubre', 'Noviembre', 'Diciembre'] }
    ];

    filteredData.forEach(item => {
      if (item.isWon && item.hasFechaVenta && item.saleYear === 2026) {
        const qIndex = qData.findIndex(q => q.months.includes(item.month));
        if (qIndex !== -1) {
          qData[qIndex].sales += item.amount;
        }
      }
    });

    return qData.map(q => ({
      ...q,
      progressPercent: Math.min(((q.sales / q.goal) * 100).toFixed(1), 100)
    }));
  }, [filteredData]);

  // Gráfica Pipeline Asignado
  const assignedData = useMemo(() => {
    const reps = {};
    filteredData.forEach(d => {
        if (!d.isWon && !d.isLost && d.etapaComercialRaw.toLowerCase().includes('asignado')) {
            const ch = d.channel;
            reps[ch] = (reps[ch] || 0) + d.amount;
        }
    });
    return Object.keys(reps).map(k => ({ name: k, value: reps[k] })).sort((a,b) => b.value - a.value);
  }, [filteredData]);

  // GRÁFICAS DINÁMICAS (Datos calculados según el Breakdown seleccionado)
  const techData = useMemo(() => {
    let pv = { name: 'Sistemas Solares (PV)', Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
    let bess = { name: 'Almacenamiento (BESS)', Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
    let gas = { name: 'Gas / Cogeneración', Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };

    filteredData.forEach(d => {
      if (d.pvValue > 0) { pv.Total += d.pvValue; pv[d.stageCategory] += d.pvValue; }
      if (d.bessValue > 0) { bess.Total += d.bessValue; bess[d.stageCategory] += d.bessValue; }
      if (d.gasValue > 0) { gas.Total += d.gasValue; gas[d.stageCategory] += d.gasValue; }
    });
    return [pv, bess, gas].filter(t => t.Total > 0);
  }, [filteredData]);

  const industryData = useMemo(() => {
    const map = {};
    filteredData.forEach(d => {
        const ind = d.industry;
        if (!map[ind]) map[ind] = { name: ind, Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
        map[ind].Total += 1;
        map[ind][d.stageCategory] += 1;
    });
    return Object.values(map).sort((a,b) => b.Total - a.Total).slice(0, 15);
  }, [filteredData]);

  const stateData = useMemo(() => {
    const map = {};
    filteredData.forEach(d => {
        const st = d.state;
        if (!map[st]) map[st] = { name: st, Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
        map[st].Total += 1;
        map[st][d.stageCategory] += 1;
    });
    return Object.values(map).sort((a,b) => b.Total - a.Total).slice(0, 15);
  }, [filteredData]);

  // MODIFICADO: Conteo General por Etapa Comercial (Ahora suma dinero)
  const stageData = useMemo(() => {
    const amounts = {};
    filteredData.forEach(item => { 
        amounts[item.stageCategory] = (amounts[item.stageCategory] || 0) + item.amount; 
    });
    return Object.keys(amounts).map(key => ({ name: key, value: amounts[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData]);

  // Gráficas de Pastel Dinámicas (Botón: Ganados vs Todos)
  const channelData = useMemo(() => {
    const counts = {};
    const dataToUse = channelView === 'won' ? filteredData.filter(d => d.isWon && d.hasFechaVenta) : filteredData;
    dataToUse.forEach(item => {
      const ch = item.channel;
      counts[ch] = (counts[ch] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData, channelView]);

  const kwByContractData = useMemo(() => {
    const kws = {};
    const dataToUse = contractView === 'won' ? filteredData.filter(d => d.isWon && d.hasFechaVenta) : filteredData;
    dataToUse.forEach(item => { 
        const ct = item.contractType;
        kws[ct] = (kws[ct] || 0) + item.kw; 
    });
    return Object.keys(kws).map(key => ({ name: key, value: kws[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData, contractView]);

  const originData = useMemo(() => {
    const kws = {};
    const dataToUse = originView === 'won' ? filteredData.filter(d => d.isWon && d.hasFechaVenta) : filteredData;
    dataToUse.forEach(item => { 
        const og = item.origin;
        kws[og] = (kws[og] || 0) + item.kw; 
    });
    return Object.keys(kws).map(key => ({ name: key, value: kws[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData, originView]);

  // Recálculos de Totales Dinámicos para el centro del pastel
  const dynamicChannelTotal = channelData.reduce((acc, curr) => acc + curr.value, 0);
  const dynamicContractKW = kwByContractData.reduce((acc, curr) => acc + curr.value, 0);
  const dynamicOriginKW = originData.reduce((acc, curr) => acc + curr.value, 0);

  const matchesSearch = (str) => str ? str.toLowerCase().includes(searchTerm.toLowerCase()) : false;
  const searchFilter = (item) => {
    if (!searchTerm) return true;
    return matchesSearch(item.name) || matchesSearch(item.channel) || matchesSearch(item.actionable) || 
           matchesSearch(item.reason) || matchesSearch(item.competitor) || matchesSearch(item.industry) || matchesSearch(item.state);
  };

  const sortedAndSearchedData = useMemo(() => {
    let data = filteredData.filter(searchFilter);
    return data.sort((a, b) => {
      const order = { 'Cerrado/Ganado': 1, 'Abierto/Pipeline': 2, 'Perdido/Pausado': 3 };
      return order[a.stageCategory] - order[b.stageCategory];
    });
  }, [filteredData, searchTerm]);

  const posibleCierreList = filteredData.filter(d => !d.isWon && !d.isLost).filter(searchFilter);
  const lostPausedList = filteredData.filter(d => d.isLost).filter(searchFilter);
  
  const competitorStats = useMemo(() => {
    const counts = {};
    lostPausedList.filter(d => d.competitor && d.competitor.trim() !== '').forEach(item => { counts[item.competitor] = (counts[item.competitor] || 0) + 1; });
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
            <img src="https://rerenergygroup.com/wp-content/uploads/2021/04/RER-Logo-2021-300x111.png" alt="RER Energy Group" className="h-12 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-xl font-bold text-[#0a3663] px-2">RER ENERGY</span>'; }} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.primary }}>Dashboard Comercial V2</h1>
            <p className="text-slate-500 text-sm mt-1">Gestión Estratégica, Inteligencia Dinámica y Análisis de Pipeline</p>
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
              <span className="text-xs mt-1" style={{ color: COLORS.secondary }}>Datos blindados y análisis profundo activado.</span>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Pega el enlace público de tu Google Sheet..." className="flex-1 p-2 border border-slate-300 rounded-md text-sm bg-slate-50" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
            <button onClick={() => fetchSheetData(sheetUrl)} disabled={isLoading || !sheetUrl} className="text-white px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: COLORS.success }}>Cargar</button>
          </div>
        )}
        {dataLoaded && !errorMsg && <p className="text-xs font-semibold mt-3" style={{ color: COLORS.success }}>✅ Datos cargados y depurados correctamente.</p>}
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
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Financiamiento</label><select name="contractType" value={filters.contractType} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{contractTypes.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Canal de Venta</label><select name="channel" value={filters.channel} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{channels.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Origen</label><select name="origin" value={filters.origin} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{origins.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Rango Energía</label><select name="kwRange" value={filters.kwRange} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{kwRanges.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
            </div>
          </div>

          {/* KPIs Y META */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="text-white p-6 rounded-xl shadow-md lg:col-span-2 relative overflow-hidden" style={{ backgroundColor: COLORS.primary }}>
              <div className="relative z-10">
                <h3 className="text-sky-100 text-sm font-semibold flex items-center gap-2 mb-1"><Target size={18} /> Progreso Meta Anual 2026 (Cerrados por Fecha Venta)</h3>
                <div className="flex items-end gap-4 mt-2">
                  <span className="text-4xl font-bold">{formatCurrency(totalCerrado2026)}</span>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <h3 className="text-slate-500 text-sm font-semibold flex items-center gap-2 mb-2"><Clock size={18} style={{ color: COLORS.success }} /> Ciclo de Venta Promedio</h3>
              <span className="text-3xl font-bold text-slate-800">{avgCycleDays} <span className="text-lg text-slate-500 font-medium">días</span></span>
            </div>
          </div>

          {/* === SECCIÓN PANORÁMICA DE GRÁFICAS (1 COLUMNA, 100% ANCHO) === */}
          <div className="flex flex-col gap-12 mb-12">
            
            {/* 1. AVANCE ACUMULADO */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Tendencia de Ventas (Curva Trimestral 2026)</h3>
              <p className="text-sm text-slate-500 mb-6">Gráfica de cumplimiento mensual proyectada por trimestres: Q1 (20%), Q2 (20%), Q3 (20%) y Q4 (40%).</p>
              
              {/* TARJETAS DE PROGRESO POR TRIMESTRE (Q) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {quarterlyData.map(q => (
                  <div key={q.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-700">{q.name}</span>
                      <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded">{q.progressPercent}%</span>
                    </div>
                    <div className="text-xl font-bold" style={{color: COLORS.primary}}>{formatCurrency(q.sales)}</div>
                    <div className="text-xs text-slate-500 mb-3">Meta: {formatCurrency(q.goal)}</div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-auto">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${q.progressPercent}%`, backgroundColor: q.progressPercent >= 100 ? COLORS.success : COLORS.secondary }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, bottom: 20, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    {/* EJE X OPTIMIZADO: Muestra las primeras 3 letras del mes en MAYÚSCULAS */}
                    <XAxis dataKey="name" tickFormatter={(val) => val.substring(0, 3).toUpperCase()} tick={{fontSize: 12, fill: '#475569'}} tickMargin={10} interval={0} />
                    <YAxis domain={[0, ANNUAL_GOAL]} tickFormatter={(val) => `$${val/1000000}M`} tick={{fontSize: 14, fill: '#475569'}} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Legend wrapperStyle={{fontSize: '14px', paddingTop: '20px'}} />
                    
                    {/* LÍNEAS DIVISORIAS POR TRIMESTRE */}
                    <ReferenceLine x="Marzo" stroke="#94a3b8" strokeDasharray="4 4" label={{ position: 'top', value: 'Fin Q1', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                    <ReferenceLine x="Junio" stroke="#94a3b8" strokeDasharray="4 4" label={{ position: 'top', value: 'Fin Q2', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                    <ReferenceLine x="Septiembre" stroke="#94a3b8" strokeDasharray="4 4" label={{ position: 'top', value: 'Fin Q3', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />

                    <Bar dataKey="Ventas" name="Venta del Mes" maxBarSize={80}>
                       {monthlyData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[index % COLORS.piePalette.length]} />)}
                    </Bar>
                    <Line type="monotone" dataKey="Acumulado" name="Cierre Acumulado" stroke={COLORS.primary} strokeWidth={4} dot={{r: 6}} />
                    <Line type="step" dataKey="Meta" name="Meta Trimestral (Curva de Cierre)" stroke={COLORS.danger} strokeDasharray="6 6" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PIPELINE ASIGNADOS (KPI DE RENDIMIENTO) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3"><Zap size={28} style={{color: COLORS.warning}}/> Pipeline Asignado por Responsable</h3>
              <p className="text-sm text-slate-500 mb-6">Monto económico de los proyectos filtrados estrictamente bajo la etapa "Asignado" (Empujando para cierre).</p>
              <div className="h-[450px] w-full">
                {assignedData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">No hay proyectos en etapa de asignación.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assignedData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(val) => `$${val/1000000}M`} tick={{fontSize: 14}} />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 14, fontWeight: 500, fill: '#334155'}} width={200} />
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                      <Bar dataKey="value" name="Monto Empujado" radius={[0, 6, 6, 0]} barSize={55}>
                        {assignedData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 7) % COLORS.piePalette.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 2. ETAPA COMERCIAL (AHORA EN MONTO ECONÓMICO) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6">Monto Económico por Etapa Comercial</h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    {/* Eje X y Tooltip actualizados para mostrar dinero en vez de sitios */}
                    <XAxis type="number" tickFormatter={(val) => `$${val/1000000}M`} tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fontWeight: 500, fill: '#334155'}} width={200} />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Bar dataKey="value" name="Monto Económico" radius={[0, 6, 6, 0]} barSize={55}>
                      {stageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 1) % COLORS.piePalette.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. TECNOLOGÍAS UTILIZADAS (DINÁMICA POR ETAPA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><Cpu size={28} style={{color: COLORS.primary}}/> Implementación por Tecnología</h3>
                  <p className="text-sm text-slate-500 mt-1">Muestra el valor total en Energía (KW / MW) que está activa o implementada según tecnología.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button onClick={() => setTechBreakdown('total')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${techBreakdown === 'total' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Ver Total</button>
                  <button onClick={() => setTechBreakdown('etapa')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${techBreakdown === 'etapa' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Por Etapa Comercial</button>
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={techData} margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 15, fontWeight: 500, fill: '#334155'}} tickMargin={10} />
                    <YAxis tickFormatter={(val) => formatKW(val)} tick={{fontSize: 14, fill: '#475569'}} width={100} />
                    <RechartsTooltip formatter={(value) => formatKW(Number(value))} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    
                    {techBreakdown === 'total' ? (
                      <Bar dataKey="Total" name="Volumen Implementado" maxBarSize={120}>
                        {techData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 4) % COLORS.piePalette.length]} />)}
                      </Bar>
                    ) : (
                      <>
                        <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px'}} />
                        <Bar dataKey="Cerrado/Ganado" stackId="a" fill={COLORS.success} maxBarSize={120} />
                        <Bar dataKey="Abierto/Pipeline" stackId="a" fill={COLORS.warning} maxBarSize={120} />
                        <Bar dataKey="Perdido/Pausado" stackId="a" fill={COLORS.danger} maxBarSize={120} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4. GANADOS POR CANAL (DINÁMICA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full flex flex-col md:flex-row items-center">
              <div className="w-full md:w-1/2">
                <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Sitios Ganados por Canal (Partners)</h3>
                <div className="relative h-[400px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={channelData} cx="50%" cy="50%" innerRadius={100} outerRadius={170} dataKey="value" stroke="none" label={false}>
                        {channelData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[index % COLORS.piePalette.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value) => `${value} sitios`} contentStyle={{fontSize: '15px', borderRadius: '8px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-7xl font-bold" style={{color: COLORS.primary}}>{dynamicChannelTotal}</span>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">{channelView === 'won' ? 'Sitios Ganados' : 'Sitios Activos'}</span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 mt-8 md:mt-0 px-4 md:px-12 max-h-[400px] overflow-y-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full mb-6">
                  <button onClick={() => setChannelView('won')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${channelView === 'won' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Solo Ganados</button>
                  <button onClick={() => setChannelView('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${channelView === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Todo el Pipeline</button>
                </div>
                <h4 className="text-lg font-bold text-slate-600 mb-4 border-b pb-2 sticky top-0 bg-white">Distribución de Sitios</h4>
                <ul className="space-y-4">
                  {channelData.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between text-slate-700 text-lg font-medium">
                      <div className="flex items-center gap-4">
                        <span className="w-5 h-5 rounded-md" style={{backgroundColor: COLORS.piePalette[index % COLORS.piePalette.length]}}></span>
                        {item.name}
                      </div>
                      <span className="bg-slate-100 px-4 py-1.5 rounded-lg text-slate-800">{item.value} sitios</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 5. FUENTE DE FINANCIAMIENTO (DINÁMICA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full flex flex-col md:flex-row items-center">
              <div className="w-full md:w-1/2">
                <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Fuente de Financiamiento</h3>
                <div className="relative h-[400px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={kwByContractData} cx="50%" cy="50%" innerRadius={100} outerRadius={170} dataKey="value" stroke="none" label={false}>
                        {kwByContractData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 3) % COLORS.piePalette.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value) => formatKW(Number(value))} contentStyle={{fontSize: '15px', borderRadius: '8px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-bold" style={{color: COLORS.primary}}>{formatKW(dynamicContractKW).replace(/ MW| KW/g, '')}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">{dynamicContractKW >= 1000 ? 'MW TOTALES' : 'KW TOTALES'}</span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 mt-8 md:mt-0 px-4 md:px-12 max-h-[400px] overflow-y-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full mb-6">
                  <button onClick={() => setContractView('won')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${contractView === 'won' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Solo Ganados</button>
                  <button onClick={() => setContractView('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${contractView === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Todo el Pipeline</button>
                </div>
                <h4 className="text-lg font-bold text-slate-600 mb-4 border-b pb-2 sticky top-0 bg-white">Financiamiento por Sitio</h4>
                <ul className="space-y-4">
                  {kwByContractData.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between text-slate-700 text-lg font-medium">
                      <div className="flex items-center gap-4">
                        <span className="w-5 h-5 rounded-md" style={{backgroundColor: COLORS.piePalette[(index + 3) % COLORS.piePalette.length]}}></span>
                        {item.name}
                      </div>
                      <span className="bg-slate-100 px-4 py-1.5 rounded-lg text-slate-800 font-bold">{formatKW(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 6. ORIGEN DE CUENTA (DINÁMICA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full flex flex-col md:flex-row items-center">
              <div className="w-full md:w-1/2">
                <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Energía por Origen de la Cuenta</h3>
                <div className="relative h-[400px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={originData} cx="50%" cy="50%" innerRadius={100} outerRadius={170} dataKey="value" stroke="none" label={false}>
                        {originData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 6) % COLORS.piePalette.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value) => formatKW(Number(value))} contentStyle={{fontSize: '15px', borderRadius: '8px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-bold" style={{color: COLORS.primary}}>{formatKW(dynamicOriginKW).replace(/ MW| KW/g, '')}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">{dynamicOriginKW >= 1000 ? 'MW TOTALES' : 'KW TOTALES'}</span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 mt-8 md:mt-0 px-4 md:px-12 max-h-[400px] overflow-y-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full mb-6">
                  <button onClick={() => setOriginView('won')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${originView === 'won' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Solo Ganados</button>
                  <button onClick={() => setOriginView('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${originView === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Todo el Pipeline</button>
                </div>
                <h4 className="text-lg font-bold text-slate-600 mb-4 border-b pb-2 sticky top-0 bg-white">Volumen por Origen</h4>
                <ul className="space-y-4">
                  {originData.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between text-slate-700 text-lg font-medium">
                      <div className="flex items-center gap-4">
                        <span className="w-5 h-5 rounded-md" style={{backgroundColor: COLORS.piePalette[(index + 6) % COLORS.piePalette.length]}}></span>
                        {item.name}
                      </div>
                      <span className="bg-slate-100 px-4 py-1.5 rounded-lg text-slate-800 font-bold">{formatKW(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 7. INDUSTRIAS (DINÁMICA POR ETAPA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><Factory size={28} style={{color: COLORS.primary}}/> Top Industrias (Rubro de Empresa)</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button onClick={() => setIndustryBreakdown('total')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${industryBreakdown === 'total' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Ver Total</button>
                  <button onClick={() => setIndustryBreakdown('etapa')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${industryBreakdown === 'etapa' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Por Etapa Comercial</button>
                </div>
              </div>
              <div className="h-[600px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industryData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fill: '#334155'}} width={250} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    
                    {industryBreakdown === 'total' ? (
                      <Bar dataKey="Total" name="Cantidad Total" barSize={35}>
                         {industryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 2) % COLORS.piePalette.length]} />)}
                      </Bar>
                    ) : (
                      <>
                        <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px'}} />
                        <Bar dataKey="Cerrado/Ganado" stackId="a" fill={COLORS.success} barSize={35} />
                        <Bar dataKey="Abierto/Pipeline" stackId="a" fill={COLORS.warning} barSize={35} />
                        <Bar dataKey="Perdido/Pausado" stackId="a" fill={COLORS.danger} barSize={35} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 8. ESTADOS (DINÁMICA POR ETAPA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><MapPin size={28} style={{color: COLORS.success}}/> Top Estados (Presencia Geográfica)</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button onClick={() => setStateBreakdown('total')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${stateBreakdown === 'total' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Ver Total</button>
                  <button onClick={() => setStateBreakdown('etapa')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${stateBreakdown === 'etapa' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Por Etapa Comercial</button>
                </div>
              </div>
              <div className="h-[600px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stateData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fill: '#334155'}} width={250} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    
                    {stateBreakdown === 'total' ? (
                      <Bar dataKey="Total" name="Proyectos Totales" barSize={35}>
                         {stateData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 5) % COLORS.piePalette.length]} />)}
                      </Bar>
                    ) : (
                      <>
                        <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px'}} />
                        <Bar dataKey="Cerrado/Ganado" stackId="a" fill={COLORS.success} barSize={35} />
                        <Bar dataKey="Abierto/Pipeline" stackId="a" fill={COLORS.warning} barSize={35} />
                        <Bar dataKey="Perdido/Pausado" stackId="a" fill={COLORS.danger} barSize={35} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
          {/* === FIN DE SECCIÓN DE GRÁFICAS === */}

          {/* BARRA DE BÚSQUEDA GLOBAL PARA DIRECTORIO E INSIGHTS */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-center gap-3">
             <Search size={24} className="text-slate-400" />
             <input 
                type="text" 
                placeholder="Buscar sitio, responsable, notas, competidor o ubicación..." 
                className="w-full bg-transparent outline-none text-lg text-slate-700 placeholder-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
             {searchTerm && <button onClick={() => setSearchTerm('')} className="text-xs text-slate-500 hover:text-danger font-bold">Limpiar</button>}
          </div>

          {/* VISTA DETALLADA DE PROYECTOS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-12">
            <div className="p-5 border-b border-slate-900 flex justify-between items-center" style={{backgroundColor: COLORS.primary}}>
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><List size={24}/> Directorio de Sitios Activos (Agrupado por Estatus)</h3>
              <span className="text-sky-200 text-sm">{sortedAndSearchedData.length} resultados</span>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-base text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="p-4 border-b">Nombre del Sitio</th>
                    <th className="p-4 border-b">Responsable</th>
                    <th className="p-4 border-b">Estatus</th>
                    <th className="p-4 border-b">Tecnología / Energía</th>
                    <th className="p-4 border-b">Ubicación / Industria</th>
                    <th className="p-4 border-b text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndSearchedData.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-4 text-slate-600 font-medium">{item.channel}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${item.stageCategory === 'Cerrado/Ganado' ? 'bg-[#e0f2fe] text-[#0369a1]' : item.stageCategory === 'Perdido/Pausado' ? 'bg-red-100 text-red-800' : 'bg-[#dcfce7] text-[#166534]'}`}>
                          {item.stageCategory}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{item.projectType} ({formatKW(item.kw)})</td>
                      <td className="p-4 text-slate-600">
                        <span className="block font-medium">{item.state}</span>
                        <span className="text-sm text-slate-400">{item.industry}</span>
                      </td>
                      <td className="p-4 text-right font-bold" style={{color: COLORS.primary}}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  {sortedAndSearchedData.length === 0 && <tr><td colSpan="6" className="p-8 text-lg text-center text-slate-500">No se encontraron sitios en la búsqueda.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECCIÓN DE INSIGHTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-amber-50 p-5 border-b border-amber-100 flex justify-between items-center">
                 <h3 className="text-xl font-bold text-amber-900 flex items-center gap-2"><AlertCircle size={24} className="text-amber-600" /> Posible Cierre (Accionables)</h3>
                 <span className="text-amber-700 text-sm font-bold">{posibleCierreList.length}</span>
              </div>
              <div className="p-6 flex-1 overflow-auto max-h-[500px]">
                {posibleCierreList.length === 0 ? <p className="text-slate-500 text-base text-center py-10">No hay sitios encontrados.</p> : (
                  <div className="space-y-5">
                    {posibleCierreList.map(item => (
                      <div key={item.id} className="p-5 border border-slate-100 rounded-xl bg-slate-50">
                        <div className="flex justify-between items-start mb-3"><h4 className="text-lg font-bold text-slate-800">{item.name}</h4><span className="text-base font-bold text-sky-700">{formatCurrency(item.amount)}</span></div>
                        <div className="text-sm text-slate-600 mb-4 grid grid-cols-2 gap-2"><span>Responsable: <b>{item.channel}</b></span><span>Contrato: <b>{item.contractType}</b></span></div>
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
              <div className="bg-slate-100 p-5 border-b border-slate-200"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><SearchX size={24} className="text-slate-600" /> Análisis de Perdidos / Pausados</h3></div>
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
                    {lostPausedList.filter(d => d.reason || d.competitor).map(item => (
                      <div key={item.id} className="text-base border-l-4 border-danger pl-4 py-1">
                        <p className="font-bold text-slate-800">{item.reason || 'Sin motivo capturado'}</p>
                        <p className="text-sm text-slate-500 mb-2">{item.name} ({item.channel})</p>
                        {item.competitor && <p className="text-xs font-bold text-danger bg-red-50 inline-block px-2 py-1 rounded">Competencia: {item.competitor}</p>}
                        {item.actionable && <p className="text-sm text-sky-800 bg-sky-50 inline-block px-3 py-1.5 rounded-md mt-1 block"><strong>Siguiente paso:</strong> {item.actionable}</p>}
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
}import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, ReferenceLine 
} from 'recharts';
import { Filter, Target, TrendingUp, AlertCircle, Briefcase, Zap, SearchX, ArrowRight, List, MapPin, Factory, Cpu, Search, Clock } from 'lucide-react';

const ANNUAL_GOAL = 450000000; // 450 Millones MXN

// PALETA ESTRICTAMENTE CORPORATIVA (Tonos ejecutivos de Azules, Verdes y neutros)
const COLORS = {
  primary: '#0a3663', 
  success: '#69b32d', 
  secondary: '#4b98d1', 
  danger: '#b91c1c', // Rojo oscuro apagado
  warning: '#d97706', // Ámbar/Ocre corporativo
  piePalette: [
    '#0a3663', // Azul RER oscuro
    '#69b32d', // Verde RER
    '#4b98d1', // Azul claro
    '#4d7c0f', // Verde musgo
    '#1e3a8a', // Azul profundo
    '#166534', // Verde oscuro
    '#0284c7', // Azul medio
    '#85c24e', // Verde lima apagado
    '#3b82f6', // Azul rey suave
    '#ca8a04', // Ocre/Dorado
    '#0f172a', // Gris muy oscuro
    '#0369a1'  // Azul acero
  ]
};

// Formateadores globales
const formatCurrency = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '0 MXN';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(num) + ' MXN';
};

const formatKW = (val) => {
  const num = Number(val);
  if (isNaN(num)) return '0 KW';
  return num >= 1000 ? `${(num / 1000).toFixed(2)} MW` : `${num.toFixed(2)} KW`;
};

// Analizador de fechas estricto
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
          if (p2 < 100) p2 += 2000; 
          let year = p2;
          let month, day;
          
          if (p1 > 12) { month = p0; day = p1; } 
          else if (p0 > 12) { day = p0; month = p1; } 
          else { day = p0; month = p1; } 
          
          const manualDate = new Date(year, month - 1, day);
          if (!isNaN(manualDate.getTime())) return manualDate;
      }
  }
  
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

// Parser CSV Robusto (A prueba de Enters en celdas de Excel)
const parseAdvancedCSV = (text) => {
  const firstLineIdx = text.indexOf('\n');
  const firstLine = firstLineIdx !== -1 ? text.substring(0, firstLineIdx) : text;
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  const rawLines = text.split(/\r?\n/);
  const mergedLines = [];
  let tempLine = '';
  let openQuotes = false;

  for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];
      let quotesInLine = (line.match(/"/g) || []).length;
      
      if (openQuotes) {
          tempLine += '\n' + line;
          if (quotesInLine % 2 !== 0) { 
              openQuotes = false;
              mergedLines.push(tempLine);
              tempLine = '';
          }
      } else {
          if (quotesInLine % 2 !== 0) { 
              openQuotes = true;
              tempLine = line;
          } else {
              mergedLines.push(line);
          }
      }
  }
  if (openQuotes) mergedLines.push(tempLine); 

  return mergedLines.map(line => {
      let row = [];
      let val = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
          let c = line[i], nc = line[i+1];
          if (c === '"') {
              if (inQ && nc === '"') { val += '"'; i++; } 
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

// Funciones de Limpieza y Normalización
const cleanValue = (val) => {
    if (!val) return 'Sin Asignar';
    const trimmed = val.trim();
    return trimmed === '' ? 'Sin Asignar' : trimmed;
};

const toTitleCase = (str) => {
    if (!str || str === 'Sin Asignar' || str === 'TBD') return str;
    return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.substring(1)).join(' ');
};

const cleanOrigin = (val) => {
    let c = cleanValue(val);
    if (/op\s*sell/i.test(c) || /up\s*sell/i.test(c)) return 'Up Sell';
    return toTitleCase(c);
};

const cleanState = (val) => {
    let c = cleanValue(val);
    if (c === 'Sin Asignar') return c;
    c = c.replace(/\s+/g, ' ').trim();
    if (/quin/i.test(c) || /q\.?\s*roo/i.test(c) || /q\s*roo/i.test(c)) return 'Quintana Roo';
    if (/nuevo\s*le[oó]n/i.test(c) || /^nl$/i.test(c)) return 'Nuevo León';
    if (/cdmx/i.test(c) || /ciudad\s*de\s*m[eé]x/i.test(c)) return 'CDMX';
    if (/edo\.?\s*m[eé]x/i.test(c) || /estado\s*de\s*m[eé]x/i.test(c)) return 'Estado de México';
    if (/quer[eé]t/i.test(c) || /qro/i.test(c)) return 'Querétaro';
    if (/yucat[aá]n/i.test(c)) return 'Yucatán';
    if (/michoac[aá]n/i.test(c)) return 'Michoacán';
    return toTitleCase(c);
};

const cleanIndustry = (val) => {
    let c = cleanValue(val);
    if (c === 'Sin Asignar') return c;
    c = c.replace(/\s+/g, ' ').trim();
    if (/hospital/i.test(c) || /cl[ií]nica/i.test(c) || /salud/i.test(c)) return 'Hospitales';
    if (/hotel/i.test(c)) return 'Hoteles';
    return toTitleCase(c);
};

export default function App() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); 
  const [dataLoaded, setDataLoaded] = useState(false);
  const [pipelineData, setPipelineData] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');

  // ESTADOS DE BOTONES DINÁMICOS PARA GRÁFICAS
  const [techBreakdown, setTechBreakdown] = useState('total'); 
  const [industryBreakdown, setIndustryBreakdown] = useState('total'); 
  const [stateBreakdown, setStateBreakdown] = useState('total'); 
  
  const [channelView, setChannelView] = useState('won'); 
  const [contractView, setContractView] = useState('all'); 
  const [originView, setOriginView] = useState('all'); 

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

  const processData = (csvText) => {
    const rows = parseAdvancedCSV(csvText);
    if (rows.length < 2) return [];

    let headerRowIndex = 0;
    let maxMatches = 0;
    let map = { 
        name: -1, amount: -1, channel: -1, contractType: -1, origin: -1, competitor: -1, reason: -1, actionable: -1,
        fechaVenta: -1, fechaCierre: -1, fechaArribo: -1, estadoAcuerdo: -1, etapaComercial: -1, pv: -1, bess: -1, gas: -1,
        industry: -1, state: -1
    };

    const matchHeader = (h, keywords) => keywords.some(kw => h === kw);
    const includesHeader = (h, keywords) => keywords.some(kw => h.includes(kw));

    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const rawHeaders = rows[r];
      if (!rawHeaders || rawHeaders.length === 0) continue;
      const tempHeaders = rawHeaders.map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      
      let matches = 0;
      let tempMap = { ...map };

      tempHeaders.forEach((h, i) => {
        if (!h) return;
        if (tempMap.name === -1 && includesHeader(h, ['nombre del proyecto', 'proyecto'])) { tempMap.name = i; matches++; }
        else if (tempMap.fechaVenta === -1 && includesHeader(h, ['fecha de venta', 'fecha venta'])) { tempMap.fechaVenta = i; matches += 2; }
        else if (tempMap.fechaCierre === -1 && includesHeader(h, ['fecha estimada', 'fecha de cierre'])) { tempMap.fechaCierre = i; matches++; }
        else if (tempMap.fechaArribo === -1 && includesHeader(h, ['fecha de arribo', 'fecha arribo'])) { tempMap.fechaArribo = i; matches++; }
        else if (tempMap.amount === -1 && includesHeader(h, ['capex global mxn', 'capex global'])) { tempMap.amount = i; matches += 2; }
        else if (tempMap.estadoAcuerdo === -1 && h === 'estado del acuerdo') { tempMap.estadoAcuerdo = i; matches++; }
        else if (tempMap.etapaComercial === -1 && h === 'etapa comercial') { tempMap.etapaComercial = i; matches++; }
        else if (tempMap.pv === -1 && matchHeader(h, ['pv kw dc'])) { tempMap.pv = i; matches++; }
        else if (tempMap.bess === -1 && matchHeader(h, ['bess kwh'])) { tempMap.bess = i; matches++; }
        else if (tempMap.gas === -1 && includesHeader(h, ['gas'])) { tempMap.gas = i; matches++; } 
        else if (tempMap.origin === -1 && matchHeader(h, ['origen de la cuenta'])) { tempMap.origin = i; matches++; }
        else if (tempMap.channel === -1 && matchHeader(h, ['responsable de la cta'])) { tempMap.channel = i; matches++; }
        else if (tempMap.contractType === -1 && matchHeader(h, ['tipo de contrato'])) { tempMap.contractType = i; matches++; }
        else if (tempMap.competitor === -1 && includesHeader(h, ['contra quien'])) { tempMap.competitor = i; matches++; }
        else if (tempMap.reason === -1 && matchHeader(h, ['notas'])) { tempMap.reason = i; matches++; }
        else if (tempMap.actionable === -1 && includesHeader(h, ['accion especifica'])) { tempMap.actionable = i; matches++; }
        else if (tempMap.industry === -1 && matchHeader(h, ['rubro de la empresa'])) { tempMap.industry = i; matches++; }
        else if (tempMap.state === -1 && matchHeader(h, ['estado'])) { tempMap.state = i; matches++; }
      });

      if (matches > maxMatches) { maxMatches = matches; headerRowIndex = r; map = tempMap; }
    }

    const parsedData = rows.slice(headerRowIndex + 1).map((row, index) => {
      if (!row || row.length === 0) return null;
      const getVal = (idx) => idx !== -1 && row[idx] ? row[idx] : null;
      
      const name = getVal(map.name);
      if (!name || name.trim() === '' || name.includes('RECUENTO') || name.includes('No altere') || name.includes('Ventas totales')) return null;

      const fVenta = getVal(map.fechaVenta);
      const fCierre = getVal(map.fechaCierre);
      const fArribo = getVal(map.fechaArribo);

      const estadoAcuerdo = getVal(map.estadoAcuerdo) || '';
      const etapaComercial = getVal(map.etapaComercial) || '';
      const combinedStageStr = `${estadoAcuerdo} ${etapaComercial}`.toLowerCase();
      
      // ELIMINADA LA EXCLUSIÓN DE 2025 AQUÍ. Todos los proyectos entran al Dashboard.
      
      const rawAmount = getVal(map.amount) || '0';
      let parsedAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g,"")) || 0;
      
      const pv = parseFloat((getVal(map.pv) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const bess = parseFloat((getVal(map.bess) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const gas = parseFloat((getVal(map.gas) || '0').replace(/[^0-9.-]+/g,"")) || 0;
      const parsedKw = pv + bess + gas;

      const hasPV = pv > 0;
      const hasBESS = bess > 0;
      const hasGAS = gas > 0;

      let pTypes = [];
      if (hasPV) pTypes.push('PV');
      if (hasBESS) pTypes.push('BESS');
      if (hasGAS) pTypes.push('GAS');
      const projectType = pTypes.length > 0 ? pTypes.join(' + ') : 'TBD';
      
      const hasFechaVentaValida = fVenta && fVenta.trim() !== '' && fVenta.trim() !== '0' && fVenta.trim() !== '-' && !fVenta.toLowerCase().includes('tbd');
      const hasFechaCierreValida = fCierre && fCierre.trim() !== '' && fCierre.trim() !== '0' && fCierre.trim() !== '-' && !fCierre.toLowerCase().includes('tbd');

      const isGanado = combinedStageStr.includes('ganado') || combinedStageStr.includes('cierre');
      const isFirmado = combinedStageStr.includes('firmado');
      const isWon = isGanado && isFirmado && hasFechaVentaValida;
      
      const isLost = combinedStageStr.includes('perdid') || combinedStageStr.includes('cancelad') || combinedStageStr.includes('pausad');
      const displayStage = isWon ? 'Cerrado/Ganado' : isLost ? 'Perdido/Pausado' : 'Abierto/Pipeline';

      const finalDateStr = isWon ? fVenta : (hasFechaCierreValida ? fCierre : null);
      const parsedDate = parseCustomDate(finalDateStr);
      
      const dVenta = parseCustomDate(fVenta);
      const dArribo = parseCustomDate(fArribo);
      const saleYear = dVenta ? dVenta.getFullYear() : null;

      let cycleDays = null;
      if (isWon && dVenta && dArribo) {
          const diffTime = Math.abs(dVenta - dArribo);
          cycleDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      let monthName = 'Mes No Especificado';
      if (parsedDate) {
          const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          monthName = meses[parsedDate.getMonth()];
      }

      let contractClean = cleanValue(getVal(map.contractType));
      if (contractClean === 'Sin Asignar') contractClean = 'TBD';
      else contractClean = contractClean.toUpperCase();
      
      let channelClean = cleanValue(getVal(map.channel));
      if (channelClean !== 'Sin Asignar') channelClean = channelClean.toUpperCase();

      return {
        id: index,
        name: name,
        month: monthName,
        amount: parsedAmount,
        kw: parsedKw,
        pvValue: pv,
        bessValue: bess,
        gasValue: gas,
        stageCategory: displayStage,
        etapaComercialRaw: cleanValue(getVal(map.etapaComercial)), // Atrapa la etapa real (ej. "1. Recibo")
        isWon: isWon,
        isLost: isLost,
        hasFechaVenta: hasFechaVentaValida,
        saleYear: saleYear,
        cycleDays: cycleDays,
        channel: channelClean,
        contractType: contractClean,
        projectType: projectType,
        hasPV, hasBESS, hasGAS,
        industry: cleanIndustry(getVal(map.industry)),
        state: cleanState(getVal(map.state)),
        origin: cleanOrigin(getVal(map.origin)),
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
        const data = processData(event.target.result);
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
      const data = processData(csvText);
      if(data.length > 0) { setPipelineData(data); setDataLoaded(true); localStorage.setItem('rer_sheet_url_v1', rawUrl); } 
      else setErrorMsg("Documento vacío o sin proyectos de 2026.");
    } catch (err) { setErrorMsg("Error de conexión."); } 
    finally { setIsLoading(false); }
  };

  const getOptions = (key) => ['Todos', ...Array.from(new Set(pipelineData.map(d => d[key]).filter(val => val !== 'Sin Asignar' && val !== 'TBD')))].sort();
  const months = ['Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Mes No Especificado'];
  const contractTypes = ['Todos', ...Array.from(new Set(pipelineData.map(d => d.contractType)))].sort();
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

  // KPIs Generales
  const allClosedProjects = filteredData.filter(d => d.isWon && d.hasFechaVenta);
  const closedProjects2026 = allClosedProjects.filter(d => d.saleYear === 2026);
  const totalCerrado2026 = closedProjects2026.reduce((acc, curr) => acc + curr.amount, 0);

  const totalPosibleCierre = filteredData.filter(d => !d.isWon && !d.isLost).reduce((acc, curr) => acc + curr.amount, 0);
  const progressPercent = Math.min(((totalCerrado2026 / ANNUAL_GOAL) * 100).toFixed(1), 100);

  const closedWithCycle = allClosedProjects.filter(d => d.cycleDays !== null);
  const avgCycleDays = closedWithCycle.length ? Math.round(closedWithCycle.reduce((acc, curr) => acc + curr.cycleDays, 0) / closedWithCycle.length) : 0;

  // Gráfica de Avance Trimestral
  const monthlyData = useMemo(() => {
    const dataByMonth = {};
    const monthsOrder = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const monthlyTargets = {
        'Enero': 30000000, 'Febrero': 30000000, 'Marzo': 30000000,
        'Abril': 30000000, 'Mayo': 30000000, 'Junio': 30000000,
        'Julio': 30000000, 'Agosto': 30000000, 'Septiembre': 30000000,
        'Octubre': 60000000, 'Noviembre': 60000000, 'Diciembre': 60000000
    };

    let cumulativeTarget = 0;
    monthsOrder.forEach(m => { 
        cumulativeTarget += monthlyTargets[m];
        dataByMonth[m] = { name: m, Ventas: 0, Meta: cumulativeTarget }; 
    });
    
    filteredData.forEach(item => {
      if (item.isWon && item.hasFechaVenta && item.saleYear === 2026 && dataByMonth[item.month]) {
          dataByMonth[item.month].Ventas += item.amount;
      }
    });

    let cumulative = 0;
    return monthsOrder.map(m => {
      cumulative += dataByMonth[m].Ventas;
      return { ...dataByMonth[m], Acumulado: cumulative };
    }); 
  }, [filteredData]);

  // NUEVO: Progreso por Trimestre (Q1, Q2, Q3, Q4)
  const quarterlyData = useMemo(() => {
    const qData = [
      { id: 'Q1', name: 'Q1 (Ene-Mar)', goal: 90000000, sales: 0, months: ['Enero', 'Febrero', 'Marzo'] },
      { id: 'Q2', name: 'Q2 (Abr-Jun)', goal: 90000000, sales: 0, months: ['Abril', 'Mayo', 'Junio'] },
      { id: 'Q3', name: 'Q3 (Jul-Sep)', goal: 90000000, sales: 0, months: ['Julio', 'Agosto', 'Septiembre'] },
      { id: 'Q4', name: 'Q4 (Oct-Dic)', goal: 180000000, sales: 0, months: ['Octubre', 'Noviembre', 'Diciembre'] }
    ];

    filteredData.forEach(item => {
      if (item.isWon && item.hasFechaVenta && item.saleYear === 2026) {
        const qIndex = qData.findIndex(q => q.months.includes(item.month));
        if (qIndex !== -1) {
          qData[qIndex].sales += item.amount;
        }
      }
    });

    return qData.map(q => ({
      ...q,
      progressPercent: Math.min(((q.sales / q.goal) * 100).toFixed(1), 100)
    }));
  }, [filteredData]);

  // Gráfica Pipeline Asignado
  const assignedData = useMemo(() => {
    const reps = {};
    filteredData.forEach(d => {
        if (!d.isWon && !d.isLost && d.etapaComercialRaw.toLowerCase().includes('asignado')) {
            const ch = d.channel;
            reps[ch] = (reps[ch] || 0) + d.amount;
        }
    });
    return Object.keys(reps).map(k => ({ name: k, value: reps[k] })).sort((a,b) => b.value - a.value);
  }, [filteredData]);

  // GRÁFICAS DINÁMICAS
  const techData = useMemo(() => {
    let pv = { name: 'Sistemas Solares (PV)', Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
    let bess = { name: 'Almacenamiento (BESS)', Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
    let gas = { name: 'Gas / Cogeneración', Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };

    filteredData.forEach(d => {
      if (d.pvValue > 0) { pv.Total += d.pvValue; pv[d.stageCategory] += d.pvValue; }
      if (d.bessValue > 0) { bess.Total += d.bessValue; bess[d.stageCategory] += d.bessValue; }
      if (d.gasValue > 0) { gas.Total += d.gasValue; gas[d.stageCategory] += d.gasValue; }
    });
    return [pv, bess, gas].filter(t => t.Total > 0);
  }, [filteredData]);

  const industryData = useMemo(() => {
    const map = {};
    filteredData.forEach(d => {
        const ind = d.industry;
        if (!map[ind]) map[ind] = { name: ind, Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
        map[ind].Total += 1;
        map[ind][d.stageCategory] += 1;
    });
    return Object.values(map).sort((a,b) => b.Total - a.Total).slice(0, 15);
  }, [filteredData]);

  const stateData = useMemo(() => {
    const map = {};
    filteredData.forEach(d => {
        const st = d.state;
        if (!map[st]) map[st] = { name: st, Total: 0, 'Cerrado/Ganado': 0, 'Abierto/Pipeline': 0, 'Perdido/Pausado': 0 };
        map[st].Total += 1;
        map[st][d.stageCategory] += 1;
    });
    return Object.values(map).sort((a,b) => b.Total - a.Total).slice(0, 15);
  }, [filteredData]);

  // MODIFICADO: Conteo General por Etapa Comercial (Ahora usa la etapa real y suma CAPEX)
  const stageData = useMemo(() => {
    const amounts = {};
    filteredData.forEach(item => { 
        const etapa = item.etapaComercialRaw !== 'Sin Asignar' ? item.etapaComercialRaw : item.stageCategory;
        amounts[etapa] = (amounts[etapa] || 0) + item.amount; 
    });
    return Object.keys(amounts).map(key => ({ name: key, value: amounts[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData]);

  // Gráficas de Pastel Dinámicas
  const channelData = useMemo(() => {
    const counts = {};
    const dataToUse = channelView === 'won' ? filteredData.filter(d => d.isWon && d.hasFechaVenta) : filteredData;
    dataToUse.forEach(item => {
      const ch = item.channel;
      counts[ch] = (counts[ch] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData, channelView]);

  const kwByContractData = useMemo(() => {
    const kws = {};
    const dataToUse = contractView === 'won' ? filteredData.filter(d => d.isWon && d.hasFechaVenta) : filteredData;
    dataToUse.forEach(item => { 
        const ct = item.contractType;
        kws[ct] = (kws[ct] || 0) + item.kw; 
    });
    return Object.keys(kws).map(key => ({ name: key, value: kws[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData, contractView]);

  const originData = useMemo(() => {
    const kws = {};
    const dataToUse = originView === 'won' ? filteredData.filter(d => d.isWon && d.hasFechaVenta) : filteredData;
    dataToUse.forEach(item => { 
        const og = item.origin;
        kws[og] = (kws[og] || 0) + item.kw; 
    });
    return Object.keys(kws).map(key => ({ name: key, value: kws[key] })).sort((a,b) => b.value - a.value);
  }, [filteredData, originView]);

  const dynamicChannelTotal = channelData.reduce((acc, curr) => acc + curr.value, 0);
  const dynamicContractKW = kwByContractData.reduce((acc, curr) => acc + curr.value, 0);
  const dynamicOriginKW = originData.reduce((acc, curr) => acc + curr.value, 0);

  const matchesSearch = (str) => str ? str.toLowerCase().includes(searchTerm.toLowerCase()) : false;
  const searchFilter = (item) => {
    if (!searchTerm) return true;
    return matchesSearch(item.name) || matchesSearch(item.channel) || matchesSearch(item.actionable) || 
           matchesSearch(item.reason) || matchesSearch(item.competitor) || matchesSearch(item.industry) || matchesSearch(item.state);
  };

  const sortedAndSearchedData = useMemo(() => {
    let data = filteredData.filter(searchFilter);
    return data.sort((a, b) => {
      const order = { 'Cerrado/Ganado': 1, 'Abierto/Pipeline': 2, 'Perdido/Pausado': 3 };
      return order[a.stageCategory] - order[b.stageCategory];
    });
  }, [filteredData, searchTerm]);

  const posibleCierreList = filteredData.filter(d => !d.isWon && !d.isLost).filter(searchFilter);
  const lostPausedList = filteredData.filter(d => d.isLost).filter(searchFilter);
  
  const competitorStats = useMemo(() => {
    const counts = {};
    lostPausedList.filter(d => d.competitor && d.competitor.trim() !== '').forEach(item => { counts[item.competitor] = (counts[item.competitor] || 0) + 1; });
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
            <img src="https://rerenergygroup.com/wp-content/uploads/2021/04/RER-Logo-2021-300x111.png" alt="RER Energy Group" className="h-12 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span class="text-xl font-bold text-[#0a3663] px-2">RER ENERGY</span>'; }} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.primary }}>Dashboard Comercial V2</h1>
            <p className="text-slate-500 text-sm mt-1">Gestión Estratégica, Inteligencia Dinámica y Análisis de Pipeline</p>
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
              <span className="text-xs mt-1" style={{ color: COLORS.secondary }}>Datos blindados y análisis profundo activado.</span>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Pega el enlace público de tu Google Sheet..." className="flex-1 p-2 border border-slate-300 rounded-md text-sm bg-slate-50" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
            <button onClick={() => fetchSheetData(sheetUrl)} disabled={isLoading || !sheetUrl} className="text-white px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: COLORS.success }}>Cargar</button>
          </div>
        )}
        {dataLoaded && !errorMsg && <p className="text-xs font-semibold mt-3" style={{ color: COLORS.success }}>✅ Datos cargados y depurados correctamente.</p>}
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
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Financiamiento</label><select name="contractType" value={filters.contractType} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{contractTypes.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Canal de Venta</label><select name="channel" value={filters.channel} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{channels.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Origen</label><select name="origin" value={filters.origin} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{origins.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="flex flex-col"><label className="text-xs text-slate-500 mb-1">Rango Energía</label><select name="kwRange" value={filters.kwRange} onChange={handleFilterChange} className="p-2 border rounded-md text-sm bg-slate-50">{kwRanges.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
            </div>
          </div>

          {/* KPIs Y META */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="text-white p-6 rounded-xl shadow-md lg:col-span-2 relative overflow-hidden" style={{ backgroundColor: COLORS.primary }}>
              <div className="relative z-10">
                <h3 className="text-sky-100 text-sm font-semibold flex items-center gap-2 mb-1"><Target size={18} /> Progreso Meta Anual 2026 (Cerrados por Fecha Venta)</h3>
                <div className="flex items-end gap-4 mt-2">
                  <span className="text-4xl font-bold">{formatCurrency(totalCerrado2026)}</span>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <h3 className="text-slate-500 text-sm font-semibold flex items-center gap-2 mb-2"><Clock size={18} style={{ color: COLORS.success }} /> Ciclo de Venta Promedio</h3>
              <span className="text-3xl font-bold text-slate-800">{avgCycleDays} <span className="text-lg text-slate-500 font-medium">días</span></span>
            </div>
          </div>

          {/* === SECCIÓN PANORÁMICA DE GRÁFICAS (1 COLUMNA, 100% ANCHO) === */}
          <div className="flex flex-col gap-12 mb-12">
            
            {/* 1. AVANCE ACUMULADO */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Tendencia de Ventas (Curva Trimestral 2026)</h3>
              <p className="text-sm text-slate-500 mb-6">Gráfica de cumplimiento mensual proyectada por trimestres: Q1 (20%), Q2 (20%), Q3 (20%) y Q4 (40%).</p>
              
              {/* TARJETAS DE PROGRESO POR TRIMESTRE (Q) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {quarterlyData.map(q => (
                  <div key={q.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-700">{q.name}</span>
                      <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded">{q.progressPercent}%</span>
                    </div>
                    <div className="text-xl font-bold" style={{color: COLORS.primary}}>{formatCurrency(q.sales)}</div>
                    <div className="text-xs text-slate-500 mb-3">Meta: {formatCurrency(q.goal)}</div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-auto">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${q.progressPercent}%`, backgroundColor: q.progressPercent >= 100 ? COLORS.success : COLORS.secondary }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, bottom: 20, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    {/* EJE X OPTIMIZADO: Muestra las primeras 3 letras del mes en MAYÚSCULAS */}
                    <XAxis dataKey="name" tickFormatter={(val) => val.substring(0, 3).toUpperCase()} tick={{fontSize: 12, fill: '#475569'}} tickMargin={10} interval={0} />
                    <YAxis domain={[0, ANNUAL_GOAL]} tickFormatter={(val) => `$${val/1000000}M`} tick={{fontSize: 14, fill: '#475569'}} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Legend wrapperStyle={{fontSize: '14px', paddingTop: '20px'}} />
                    
                    {/* LÍNEAS DIVISORIAS POR TRIMESTRE */}
                    <ReferenceLine x="Marzo" stroke="#94a3b8" strokeDasharray="4 4" label={{ position: 'top', value: 'Fin Q1', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                    <ReferenceLine x="Junio" stroke="#94a3b8" strokeDasharray="4 4" label={{ position: 'top', value: 'Fin Q2', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                    <ReferenceLine x="Septiembre" stroke="#94a3b8" strokeDasharray="4 4" label={{ position: 'top', value: 'Fin Q3', fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />

                    <Bar dataKey="Ventas" name="Venta del Mes" maxBarSize={80}>
                       {monthlyData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[index % COLORS.piePalette.length]} />)}
                    </Bar>
                    <Line type="monotone" dataKey="Acumulado" name="Cierre Acumulado" stroke={COLORS.primary} strokeWidth={4} dot={{r: 6}} />
                    <Line type="step" dataKey="Meta" name="Meta Trimestral (Curva de Cierre)" stroke={COLORS.danger} strokeDasharray="6 6" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PIPELINE ASIGNADOS (KPI DE RENDIMIENTO) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3"><Zap size={28} style={{color: COLORS.warning}}/> Pipeline Asignado por Responsable</h3>
              <p className="text-sm text-slate-500 mb-6">Monto económico de los proyectos filtrados estrictamente bajo la etapa "Asignado" (Empujando para cierre).</p>
              <div className="h-[450px] w-full">
                {assignedData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400">No hay proyectos en etapa de asignación.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assignedData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(val) => `$${val/1000000}M`} tick={{fontSize: 14}} />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 14, fontWeight: 500, fill: '#334155'}} width={200} />
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                      <Bar dataKey="value" name="Monto Empujado" radius={[0, 6, 6, 0]} barSize={55}>
                        {assignedData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 7) % COLORS.piePalette.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 2. ETAPA COMERCIAL (AHORA EN MONTO ECONÓMICO) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <h3 className="text-2xl font-bold text-slate-800 mb-6">Monto Económico por Etapa Comercial</h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    {/* Eje X y Tooltip actualizados para mostrar dinero en vez de sitios */}
                    <XAxis type="number" tickFormatter={(val) => `$${val/1000000}M`} tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fontWeight: 500, fill: '#334155'}} width={200} />
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    <Bar dataKey="value" name="Monto Económico" radius={[0, 6, 6, 0]} barSize={55}>
                      {stageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 1) % COLORS.piePalette.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. TECNOLOGÍAS UTILIZADAS (DINÁMICA POR ETAPA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><Cpu size={28} style={{color: COLORS.primary}}/> Implementación por Tecnología</h3>
                  <p className="text-sm text-slate-500 mt-1">Muestra el valor total en Energía (KW / MW) que está activa o implementada según tecnología.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button onClick={() => setTechBreakdown('total')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${techBreakdown === 'total' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Ver Total</button>
                  <button onClick={() => setTechBreakdown('etapa')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${techBreakdown === 'etapa' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Por Etapa Comercial</button>
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={techData} margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 15, fontWeight: 500, fill: '#334155'}} tickMargin={10} />
                    <YAxis tickFormatter={(val) => formatKW(val)} tick={{fontSize: 14, fill: '#475569'}} width={100} />
                    <RechartsTooltip formatter={(value) => formatKW(Number(value))} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    
                    {techBreakdown === 'total' ? (
                      <Bar dataKey="Total" name="Volumen Implementado" maxBarSize={120}>
                        {techData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 4) % COLORS.piePalette.length]} />)}
                      </Bar>
                    ) : (
                      <>
                        <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px'}} />
                        <Bar dataKey="Cerrado/Ganado" stackId="a" fill={COLORS.success} maxBarSize={120} />
                        <Bar dataKey="Abierto/Pipeline" stackId="a" fill={COLORS.warning} maxBarSize={120} />
                        <Bar dataKey="Perdido/Pausado" stackId="a" fill={COLORS.danger} maxBarSize={120} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4. GANADOS POR CANAL (DINÁMICA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full flex flex-col md:flex-row items-center">
              <div className="w-full md:w-1/2">
                <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Sitios Ganados por Canal (Partners)</h3>
                <div className="relative h-[400px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={channelData} cx="50%" cy="50%" innerRadius={100} outerRadius={170} dataKey="value" stroke="none" label={false}>
                        {channelData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[index % COLORS.piePalette.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value) => `${value} sitios`} contentStyle={{fontSize: '15px', borderRadius: '8px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-7xl font-bold" style={{color: COLORS.primary}}>{dynamicChannelTotal}</span>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">{channelView === 'won' ? 'Sitios Ganados' : 'Sitios Activos'}</span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 mt-8 md:mt-0 px-4 md:px-12 max-h-[400px] overflow-y-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full mb-6">
                  <button onClick={() => setChannelView('won')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${channelView === 'won' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Solo Ganados</button>
                  <button onClick={() => setChannelView('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${channelView === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Todo el Pipeline</button>
                </div>
                <h4 className="text-lg font-bold text-slate-600 mb-4 border-b pb-2 sticky top-0 bg-white">Distribución de Sitios</h4>
                <ul className="space-y-4">
                  {channelData.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between text-slate-700 text-lg font-medium">
                      <div className="flex items-center gap-4">
                        <span className="w-5 h-5 rounded-md" style={{backgroundColor: COLORS.piePalette[index % COLORS.piePalette.length]}}></span>
                        {item.name}
                      </div>
                      <span className="bg-slate-100 px-4 py-1.5 rounded-lg text-slate-800">{item.value} sitios</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 5. FUENTE DE FINANCIAMIENTO (DINÁMICA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full flex flex-col md:flex-row items-center">
              <div className="w-full md:w-1/2">
                <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Fuente de Financiamiento</h3>
                <div className="relative h-[400px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={kwByContractData} cx="50%" cy="50%" innerRadius={100} outerRadius={170} dataKey="value" stroke="none" label={false}>
                        {kwByContractData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 3) % COLORS.piePalette.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value) => formatKW(Number(value))} contentStyle={{fontSize: '15px', borderRadius: '8px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-bold" style={{color: COLORS.primary}}>{formatKW(dynamicContractKW).replace(/ MW| KW/g, '')}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">{dynamicContractKW >= 1000 ? 'MW TOTALES' : 'KW TOTALES'}</span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 mt-8 md:mt-0 px-4 md:px-12 max-h-[400px] overflow-y-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full mb-6">
                  <button onClick={() => setContractView('won')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${contractView === 'won' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Solo Ganados</button>
                  <button onClick={() => setContractView('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${contractView === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Todo el Pipeline</button>
                </div>
                <h4 className="text-lg font-bold text-slate-600 mb-4 border-b pb-2 sticky top-0 bg-white">Financiamiento por Sitio</h4>
                <ul className="space-y-4">
                  {kwByContractData.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between text-slate-700 text-lg font-medium">
                      <div className="flex items-center gap-4">
                        <span className="w-5 h-5 rounded-md" style={{backgroundColor: COLORS.piePalette[(index + 3) % COLORS.piePalette.length]}}></span>
                        {item.name}
                      </div>
                      <span className="bg-slate-100 px-4 py-1.5 rounded-lg text-slate-800 font-bold">{formatKW(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 6. ORIGEN DE CUENTA (DINÁMICA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full flex flex-col md:flex-row items-center">
              <div className="w-full md:w-1/2">
                <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Energía por Origen de la Cuenta</h3>
                <div className="relative h-[400px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={originData} cx="50%" cy="50%" innerRadius={100} outerRadius={170} dataKey="value" stroke="none" label={false}>
                        {originData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 6) % COLORS.piePalette.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value) => formatKW(Number(value))} contentStyle={{fontSize: '15px', borderRadius: '8px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-bold" style={{color: COLORS.primary}}>{formatKW(dynamicOriginKW).replace(/ MW| KW/g, '')}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">{dynamicOriginKW >= 1000 ? 'MW TOTALES' : 'KW TOTALES'}</span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 mt-8 md:mt-0 px-4 md:px-12 max-h-[400px] overflow-y-auto">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full mb-6">
                  <button onClick={() => setOriginView('won')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${originView === 'won' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Solo Ganados</button>
                  <button onClick={() => setOriginView('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${originView === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Todo el Pipeline</button>
                </div>
                <h4 className="text-lg font-bold text-slate-600 mb-4 border-b pb-2 sticky top-0 bg-white">Volumen por Origen</h4>
                <ul className="space-y-4">
                  {originData.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between text-slate-700 text-lg font-medium">
                      <div className="flex items-center gap-4">
                        <span className="w-5 h-5 rounded-md" style={{backgroundColor: COLORS.piePalette[(index + 6) % COLORS.piePalette.length]}}></span>
                        {item.name}
                      </div>
                      <span className="bg-slate-100 px-4 py-1.5 rounded-lg text-slate-800 font-bold">{formatKW(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 7. INDUSTRIAS (DINÁMICA POR ETAPA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><Factory size={28} style={{color: COLORS.primary}}/> Top Industrias (Rubro de Empresa)</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button onClick={() => setIndustryBreakdown('total')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${industryBreakdown === 'total' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Ver Total</button>
                  <button onClick={() => setIndustryBreakdown('etapa')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${industryBreakdown === 'etapa' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Por Etapa Comercial</button>
                </div>
              </div>
              <div className="h-[600px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industryData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fill: '#334155'}} width={250} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    
                    {industryBreakdown === 'total' ? (
                      <Bar dataKey="Total" name="Cantidad Total" barSize={35}>
                         {industryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 2) % COLORS.piePalette.length]} />)}
                      </Bar>
                    ) : (
                      <>
                        <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px'}} />
                        <Bar dataKey="Cerrado/Ganado" stackId="a" fill={COLORS.success} barSize={35} />
                        <Bar dataKey="Abierto/Pipeline" stackId="a" fill={COLORS.warning} barSize={35} />
                        <Bar dataKey="Perdido/Pausado" stackId="a" fill={COLORS.danger} barSize={35} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 8. ESTADOS (DINÁMICA POR ETAPA) */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3"><MapPin size={28} style={{color: COLORS.success}}/> Top Estados (Presencia Geográfica)</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button onClick={() => setStateBreakdown('total')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${stateBreakdown === 'total' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Ver Total</button>
                  <button onClick={() => setStateBreakdown('etapa')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${stateBreakdown === 'etapa' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Por Etapa Comercial</button>
                </div>
              </div>
              <div className="h-[600px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stateData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 14}} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 14, fill: '#334155'}} width={250} />
                    <RechartsTooltip formatter={(value) => typeof value === 'number' ? value : String(value)} contentStyle={{fontSize: '14px', borderRadius: '8px'}} />
                    
                    {stateBreakdown === 'total' ? (
                      <Bar dataKey="Total" name="Proyectos Totales" barSize={35}>
                         {stateData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.piePalette[(index + 5) % COLORS.piePalette.length]} />)}
                      </Bar>
                    ) : (
                      <>
                        <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px'}} />
                        <Bar dataKey="Cerrado/Ganado" stackId="a" fill={COLORS.success} barSize={35} />
                        <Bar dataKey="Abierto/Pipeline" stackId="a" fill={COLORS.warning} barSize={35} />
                        <Bar dataKey="Perdido/Pausado" stackId="a" fill={COLORS.danger} barSize={35} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
          {/* === FIN DE SECCIÓN DE GRÁFICAS === */}

          {/* BARRA DE BÚSQUEDA GLOBAL PARA DIRECTORIO E INSIGHTS */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-center gap-3">
             <Search size={24} className="text-slate-400" />
             <input 
                type="text" 
                placeholder="Buscar sitio, responsable, notas, competidor o ubicación..." 
                className="w-full bg-transparent outline-none text-lg text-slate-700 placeholder-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
             {searchTerm && <button onClick={() => setSearchTerm('')} className="text-xs text-slate-500 hover:text-danger font-bold">Limpiar</button>}
          </div>

          {/* VISTA DETALLADA DE PROYECTOS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-12">
            <div className="p-5 border-b border-slate-900 flex justify-between items-center" style={{backgroundColor: COLORS.primary}}>
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><List size={24}/> Directorio de Sitios Activos (Agrupado por Estatus)</h3>
              <span className="text-sky-200 text-sm">{sortedAndSearchedData.length} resultados</span>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-base text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="p-4 border-b">Nombre del Sitio</th>
                    <th className="p-4 border-b">Responsable</th>
                    <th className="p-4 border-b">Estatus</th>
                    <th className="p-4 border-b">Tecnología / Energía</th>
                    <th className="p-4 border-b">Ubicación / Industria</th>
                    <th className="p-4 border-b text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndSearchedData.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="p-4 text-slate-600 font-medium">{item.channel}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${item.stageCategory === 'Cerrado/Ganado' ? 'bg-[#e0f2fe] text-[#0369a1]' : item.stageCategory === 'Perdido/Pausado' ? 'bg-red-100 text-red-800' : 'bg-[#dcfce7] text-[#166534]'}`}>
                          {item.stageCategory}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{item.projectType} ({formatKW(item.kw)})</td>
                      <td className="p-4 text-slate-600">
                        <span className="block font-medium">{item.state}</span>
                        <span className="text-sm text-slate-400">{item.industry}</span>
                      </td>
                      <td className="p-4 text-right font-bold" style={{color: COLORS.primary}}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  {sortedAndSearchedData.length === 0 && <tr><td colSpan="6" className="p-8 text-lg text-center text-slate-500">No se encontraron sitios en la búsqueda.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECCIÓN DE INSIGHTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-amber-50 p-5 border-b border-amber-100 flex justify-between items-center">
                 <h3 className="text-xl font-bold text-amber-900 flex items-center gap-2"><AlertCircle size={24} className="text-amber-600" /> Posible Cierre (Accionables)</h3>
                 <span className="text-amber-700 text-sm font-bold">{posibleCierreList.length}</span>
              </div>
              <div className="p-6 flex-1 overflow-auto max-h-[500px]">
                {posibleCierreList.length === 0 ? <p className="text-slate-500 text-base text-center py-10">No hay sitios encontrados.</p> : (
                  <div className="space-y-5">
                    {posibleCierreList.map(item => (
                      <div key={item.id} className="p-5 border border-slate-100 rounded-xl bg-slate-50">
                        <div className="flex justify-between items-start mb-3"><h4 className="text-lg font-bold text-slate-800">{item.name}</h4><span className="text-base font-bold text-sky-700">{formatCurrency(item.amount)}</span></div>
                        <div className="text-sm text-slate-600 mb-4 grid grid-cols-2 gap-2"><span>Responsable: <b>{item.channel}</b></span><span>Contrato: <b>{item.contractType}</b></span></div>
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
              <div className="bg-slate-100 p-5 border-b border-slate-200"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><SearchX size={24} className="text-slate-600" /> Análisis de Perdidos / Pausados</h3></div>
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
                    {lostPausedList.filter(d => d.reason || d.competitor).map(item => (
                      <div key={item.id} className="text-base border-l-4 border-danger pl-4 py-1">
                        <p className="font-bold text-slate-800">{item.reason || 'Sin motivo capturado'}</p>
                        <p className="text-sm text-slate-500 mb-2">{item.name} ({item.channel})</p>
                        {item.competitor && <p className="text-xs font-bold text-danger bg-red-50 inline-block px-2 py-1 rounded">Competencia: {item.competitor}</p>}
                        {item.actionable && <p className="text-sm text-sky-800 bg-sky-50 inline-block px-3 py-1.5 rounded-md mt-1 block"><strong>Siguiente paso:</strong> {item.actionable}</p>}
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