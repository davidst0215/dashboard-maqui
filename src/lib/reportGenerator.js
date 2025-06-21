// src/lib/reportGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// --- Constantes de Estilo para coincidir con el mockup ---
const TEAL_COLOR = [20, 184, 166];
const TEXT_DARK = [31, 41, 55]; // slate-800
const TEXT_GRAY = [107, 114, 128]; // slate-500
const BG_LIGHT_GRAY = [248, 250, 252]; // slate-50
const BORDER_COLOR = [229, 231, 235]; // gray-200
const NAVY_HEADER = [30, 41, 59]; // slate-800 en el mockup
const BLUE_TEXT = [59, 130, 246];
const GREEN_TEXT = [22, 163, 74];
const RED_TEXT = [220, 38, 38];
const PAGE_WIDTH = 595.28;
const MARGIN = 30;

// --- Funciones de Utilidad ---
function getNivelFromScore(score) {
  const numScore = typeof score === 'number' ? score : 0;
  if (numScore >= 0.8) return "Excelente";
  if (numScore >= 0.6) return "Bueno";
  if (numScore >= 0.4) return "Regular";
  if (numScore >= 0.2) return "Deficiente";
  return "Crítico";
}

function getNivelColors(nivel) {
  const colors = {
    'Excelente': { text: [22, 163, 74], bg: [240, 253, 244], border: [187, 247, 208] },
    'Bueno': { text: [59, 130, 246], bg: [239, 246, 255], border: [191, 219, 254] },
    'Regular': { text: [202, 138, 4], bg: [254, 252, 232], border: [254, 240, 138] },
    'Deficiente': { text: [249, 115, 22], bg: [255, 247, 237], border: [253, 218, 179] },
    'Crítico': { text: [220, 38, 38], bg: [254, 226, 226], border: [254, 202, 202] },
  };
  return colors[nivel] || { text: TEXT_GRAY, bg: BG_LIGHT_GRAY, border: BORDER_COLOR };
}

// --- Componentes del PDF ---
function addHeader(doc, title = 'Informe de Desempeño de Calidad', subtitle = 'Reporte Detallado de Gestión') {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_WIDTH, 80, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...TEAL_COLOR);
  doc.text('maqui+', MARGIN, 45);

  doc.setFontSize(20);
  doc.setTextColor(...TEXT_DARK);
  doc.text(title, PAGE_WIDTH / 2, 40, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, PAGE_WIDTH / 2, 55, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...TEAL_COLOR);
  doc.text('maqui+', PAGE_WIDTH - MARGIN, 45, { align: 'right' });
  
  doc.setDrawColor(...TEAL_COLOR);
  doc.setLineWidth(3);
  doc.line(0, 70, PAGE_WIDTH, 70);
}

function addFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.height;
        const footerY = pageHeight - 60;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(MARGIN, footerY, PAGE_WIDTH - (MARGIN * 2), 40, 8, 8, 'F');

        doc.setFontSize(9);
        doc.setTextColor(...TEXT_GRAY);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Reporte generado automáticamente por el sistema maqui+ | ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
            PAGE_WIDTH / 2, footerY + 18, { align: 'center' }
        );
        doc.text(
            'Este documento contiene información confidencial y está destinado únicamente para uso interno.',
            PAGE_WIDTH / 2, footerY + 30, { align: 'center' }
        );
    }
}

function drawTrendChart(doc, x, y, width, height, data, average) {
    // Dibuja el contenedor principal del gráfico
    doc.setDrawColor(...BORDER_COLOR);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 12, 12, 'FD');

    // Títulos dentro del contenedor
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_DARK);
    doc.text('Tendencia de Puntuación', x + 20, y + 30);
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_GRAY);
    doc.text(data.name, x + width / 2, y + 55, { align: 'center' });
    
    // Área del gráfico
    const chartBoxY = y + 70;
    const chartBoxHeight = height - 120;

    if (!data.tendenciaData || data.tendenciaData.length < 1) {
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_GRAY);
        doc.text('No hay suficientes datos para mostrar la tendencia.', x + width / 2, chartBoxY + chartBoxHeight / 2, { align: 'center' });
    } else {
        const trendData = data.tendenciaData;
        const margin = { top: 15, right: 15, bottom: 15, left: 15 };
        const chartX = x + margin.left;
        const chartY = chartBoxY + margin.top;
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = chartBoxHeight - margin.top - margin.bottom;

        const maxScore = 1.0;
        const minScore = 0.0;
        const pointCount = trendData.length;

        const avgY = chartY + chartHeight - (((typeof average === 'number' ? average : 0) - minScore) / (maxScore - minScore)) * chartHeight;
        doc.setDrawColor(...RED_TEXT);
        doc.setLineDashPattern([3, 3], 0);
        doc.line(chartX, avgY, chartX + chartWidth, avgY);
        doc.setLineDashPattern([], 0);

        if (pointCount > 1) {
            const points = trendData.map((point, index) => {
                const puntuacionSegura = typeof point.puntuacion === 'number' ? point.puntuacion : 0;
                const px = chartX + (index / (pointCount - 1)) * chartWidth;
                const py = chartY + chartHeight - ((puntuacionSegura - minScore) / (maxScore - minScore)) * chartHeight;
                return [px, py];
            });
            doc.setDrawColor(...BLUE_TEXT);
            doc.setLineWidth(1.5);
            doc.lines(points);

            points.forEach(([px, py]) => {
                doc.setFillColor(...BLUE_TEXT);
                doc.setDrawColor(255, 255, 255);
                doc.circle(px, py, 3, 'FD');
            });
        } else if (pointCount === 1) {
            const point = trendData[0];
            const puntuacionSegura = typeof point.puntuacion === 'number' ? point.puntuacion : 0;
            const px = chartX + chartWidth / 2;
            const py = chartY + chartHeight - ((puntuacionSegura - minScore) / (maxScore - minScore)) * chartHeight;
            doc.setFillColor(...BLUE_TEXT);
            doc.setDrawColor(255, 255, 255);
            doc.circle(px, py, 3, 'FD');
        }
    }

    // Leyenda del gráfico
    const legendY = y + height - 25;
    doc.setFillColor(...BLUE_TEXT);
    doc.circle(x + 20, legendY, 4, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_GRAY);
    doc.text('Puntuación Llamada', x + 30, legendY + 3);

    doc.setDrawColor(...RED_TEXT);
    doc.setLineWidth(1.5);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(x + width - 110, legendY, x + width - 100, legendY);
    doc.setLineDashPattern([], 0);
    doc.text(`Promedio: ${average.toFixed(2)}`, x + width - 95, legendY + 3);
}

// --- GENERADOR PRINCIPAL ---
export function generatePdfReport(reportData) {
  const { level, name, period, calls, metrics, globalAverages, tendenciaData } = reportData;
  const doc = new jsPDF('p', 'pt', 'a4');
  let yPos = 70;

  // =========================================================================
  // --- PÁGINA 1: RESUMEN EJECUTIVO Y ANÁLISIS VISUAL
  // =========================================================================
  addHeader(doc);
  yPos += 30;
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text(`${level}: ${name}`, MARGIN, yPos);
  
  yPos += 20;

  const cardY = yPos;
  const cardHeight = 50;
  const cardSpacing = 15;
  const cardWidth = (PAGE_WIDTH - (MARGIN * 2) - (cardSpacing * 2)) / 3;

  const drawCard = (x, y, label, value, valueSize = 11, isValueBold = true) => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, cardHeight, 8, 8, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 12, y + 20);
    doc.setFontSize(valueSize);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont('helvetica', isValueBold ? 'bold' : 'normal');
    doc.text(String(value || ''), x + 12, y + 38);
  };

  drawCard(MARGIN, cardY, 'Fecha de Generación:', format(new Date(), 'dd/MM/yyyy HH:mm'), 11, false);
  drawCard(MARGIN + cardWidth + cardSpacing, cardY, 'Período Analizado:', period, 11, false);
  drawCard(MARGIN + (cardWidth + cardSpacing) * 2, cardY, 'Total Llamadas Analizadas:', calls.length, 18, true);

  yPos = cardY + cardHeight + 30;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen General vs Promedio', MARGIN, yPos);
  yPos += 20;

  const summaryData = [
    ['Puntuación Media', metrics.averageScore.toFixed(2), globalAverages.score.toFixed(2), `${metrics.differenceScore >= 0 ? '+' : ''}${metrics.differenceScore.toFixed(2)}`],
    ['% Conformidad', `${metrics.conformityPercentage.toFixed(1)}%`, `${globalAverages.conformity.toFixed(1)}%`, `${metrics.differenceConformity >= 0 ? '+' : ''}${metrics.differenceConformity.toFixed(1)}%`],
    ['Nivel Predominante', metrics.nivelPredominante, getNivelFromScore(globalAverages.score), '-']
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Métrica', `Valor ${level}`, 'Promedio Global', 'Diferencia']],
    body: summaryData,
    theme: 'plain',
    headStyles: { fillColor: NAVY_HEADER, textColor: 255, fontSize: 11, fontStyle: 'bold', cellPadding: { top: 10, right: 8, bottom: 10, left: 8 } },
    bodyStyles: { fontSize: 11, cellPadding: 10, lineWidth: 0.5, lineColor: BORDER_COLOR, valign: 'middle' },
    alternateRowStyles: { fillColor: BG_LIGHT_GRAY },
    columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center', fontStyle: 'bold' },
        2: { halign: 'center', textColor: TEXT_GRAY },
        3: { halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: MARGIN, right: MARGIN },
    didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 1 && data.row.index === 2) {
            const nivel = String(data.cell.raw || '');
            const colors = getNivelColors(nivel);
            const badgeWidth = doc.getStringUnitWidth(nivel) * 6 + 20;
            const x = data.cell.x + (data.cell.width - badgeWidth) / 2;
            doc.setFillColor(...colors.bg);
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.5);
            doc.roundedRect(x, data.cell.y + (data.cell.height / 2) - 10, badgeWidth, 20, 10, 10, 'FD');
            doc.setFontSize(10);
            doc.setTextColor(...colors.text);
            doc.text(nivel, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 4, { align: 'center' });
        }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
          if(data.row.index === 0) { data.cell.styles.textColor = BLUE_TEXT; data.cell.styles.fontSize = 14; }
          if(data.row.index === 1) { data.cell.styles.textColor = GREEN_TEXT; data.cell.styles.fontSize = 14; }
      }
      if (data.section === 'body' && data.column.index === 3 && data.row.index < 2) {
        const value = parseFloat(data.cell.raw);
        data.cell.styles.textColor = value >= 0 ? GREEN_TEXT : RED_TEXT;
        data.cell.styles.fontSize = 14;
      }
    },
    willDrawCell: (data) => { if (data.section === 'body' && data.column.index === 1 && data.row.index === 2) { data.cell.text = ''; } },
    didDrawPage: (data) => { yPos = data.cursor.y; }
  });

  yPos += 25;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, yPos, PAGE_WIDTH - (MARGIN * 2), 85, 12, 12, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('Escala de Niveles:', MARGIN + 15, yPos + 20);
  
  const niveles = [
    { name: 'Excelente', range: '(P >= 0.8)', desc: 'Cumple o supera expectativas.' },
    { name: 'Bueno', range: '(0.6 <= P < 0.8)', desc: 'Cumple la mayoría de requisitos clave.' },
    { name: 'Regular', range: '(0.4 <= P < 0.6)', desc: 'Cumple requisitos básicos, con áreas de mejora.' },
    { name: 'Deficiente', range: '(0.2 <= P < 0.4)', desc: 'Requiere mejoras significativas.' },
    { name: 'Crítico', range: '(P < 0.2)', desc: 'Requiere intervención y formación inmediata.' }
  ];

  const nivelWidth = (PAGE_WIDTH - (MARGIN * 2) - 30) / 5;
  niveles.forEach((nivel, index) => {
    const x = MARGIN + 15 + index * (nivelWidth + 5);
    const y = yPos + 35;
    const cardHeight = 40; // Altura fija de la tarjeta
    const colors = getNivelColors(nivel.name);
    
    doc.setFillColor(...colors.bg);
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, nivelWidth, cardHeight, 8, 8, 'FD');
    
    // --- Título (una sola línea) ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.text);
    const titleText = `${nivel.name} ${nivel.range}`;
    doc.text(titleText, x + nivelWidth / 2, y + 12, { align: 'center' });

    // --- Descripción (con ajuste de texto automático) ---
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY); // Aseguramos el color del texto de la descripción
    const descMaxWidth = nivelWidth - 10; 
    const descLines = doc.splitTextToSize(nivel.desc, descMaxWidth);
    
    // Centramos el texto verticalmente dentro del espacio disponible
    const lineHeight = 8; 
    const totalTextHeight = descLines.length * lineHeight;
    const startY = y + 18 + ((cardHeight - 18 - totalTextHeight) / 2) + (lineHeight / 2); 
    
    doc.text(descLines, x + nivelWidth / 2, startY, { align: 'center' });
  });

  yPos += 85 + 25;

  const colWidth = (PAGE_WIDTH - (MARGIN * 2) - 20) / 2;
  const colHeight = 280;
  const leftColX = MARGIN;
  const rightColX = leftColX + colWidth + 20;

  // Columna Izquierda: Distribución Conformidad
  doc.setDrawColor(...BORDER_COLOR);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(leftColX, yPos, colWidth, colHeight, 12, 12, 'FD');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('Análisis Visual del Desempeño', leftColX + 20, yPos + 30);
  
  doc.setFontSize(12);
  doc.text('Distribución Conformidad', leftColX + colWidth / 2, yPos + 70, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_GRAY);
  doc.text(name, leftColX + colWidth / 2, yPos + 85, { align: 'center' });

  const conformePct = metrics.conformityPercentage;
  const centerX = leftColX + colWidth / 2;
  const centerY = yPos + 160;
  const radius = 55;
  doc.setFillColor(...GREEN_TEXT);
  doc.circle(centerX, centerY, radius, 'F');
  
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${conformePct.toFixed(0)}%`, centerX, centerY + 8, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Conforme', centerX, centerY + 22, { align: 'center' });
  
  const conformeCount = calls.filter(c => String(c.CONFORMIDAD).toLowerCase() === 'conforme').length;
  const legendBoxY = yPos + colHeight - 50;
  doc.setFillColor(...getNivelColors('Excelente').bg);
  doc.roundedRect(leftColX + 20, legendBoxY, colWidth - 40, 30, 8, 8, 'F');
  doc.setFillColor(...GREEN_TEXT);
  doc.circle(leftColX + 32, legendBoxY + 15, 5, 'F');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text('Conforme', leftColX + 42, legendBoxY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${conformeCount} (${conformePct.toFixed(1)}%)`, leftColX + colWidth - 25, legendBoxY + 18, { align: 'right' });

  // Columna Derecha: Tendencia de Puntuación
  drawTrendChart(doc, rightColX, yPos, colWidth, colHeight, { name, tendenciaData }, metrics.averageScore);
  
  addFooter(doc);

  // =========================================================================
  // --- PÁGINA 2: DETALLE ---
  // =========================================================================
  if (calls.length > 0) {
    doc.addPage();
    addHeader(doc, 'Detalle de Llamadas Analizadas', '');
    yPos = 70 + 40;

    if (level === 'Vendedor') {
      const callDetailsData = calls.map(c => {
        const puntuacion = typeof c.PUNTUACION_TOTAL === 'number' ? c.PUNTUACION_TOTAL : 0;
        return [
          c.FECHA_LLAMADA_STR || c.FECHA_LLAMADA || 'N/A',
          c.ID_LLAMADA || 'N/A',
          c.DNI || 'N/A',
          puntuacion.toFixed(2),
          getNivelFromScore(puntuacion),
          c.CONFORMIDAD || 'No Conforme',
          (c.COMENTARIO || '').replace(/\n/g, ' ')
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Archivo', 'DNI Cliente', 'Puntuación', 'Nivel', 'Conformidad', 'Comentarios Clave']],
        body: callDetailsData,
        theme: 'plain',
        headStyles: { fillColor: NAVY_HEADER, textColor: 255, fontSize: 10, fontStyle: 'bold', cellPadding: 8 },
        bodyStyles: { fontSize: 9, cellPadding: {top: 12, bottom: 12, left: 8, right: 8}, valign: 'middle', lineWidth: {bottom: 0.5}, lineColor: BORDER_COLOR },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { textColor: BLUE_TEXT, fontStyle: 'normal' },
            3: { halign: 'center', fontStyle: 'bold', textColor: BLUE_TEXT, fontSize: 12 },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { cellWidth: 160, fontSize: 8 }
        },
        margin: { left: MARGIN, right: MARGIN },
        didDrawCell: (data) => {
          try {
            if (data.section === 'body' && (data.column.index === 4 || data.column.index === 5)) {
                if (data.cell.raw === null || typeof data.cell.raw === 'undefined') return;
                const text = String(data.cell.raw);
                if (text.trim() === '') return;
                const isNivel = data.column.index === 4;
                const colors = isNivel ? getNivelColors(text) : (text.toLowerCase() === 'conforme' ? getNivelColors('Excelente') : getNivelColors('Crítico'));
                if (!colors) return;
                const badgeWidth = doc.getStringUnitWidth(text) * 5 + 18;
                const x = data.cell.x + (data.cell.width - badgeWidth) / 2;
                const y = data.cell.y + (data.cell.height / 2) - 9;
                doc.setFillColor(...colors.bg);
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.5);
                doc.roundedRect(x, y, badgeWidth, 18, 9, 9, 'FD');
                doc.setFontSize(8);
                doc.setTextColor(...colors.text);
                doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 3, { align: 'center' });
            }
          } catch (e) { console.error('Error al dibujar badge:', e); }
        },
        willDrawCell: (data) => { if (data.section === 'body' && (data.column.index === 4 || data.column.index === 5)) data.cell.text = ''; }
      });
    } else {
      const summaryLevel = level === 'Supervisor' ? 'Vendedor' : 'Supervisor';
      const subGroupKey = level === 'Supervisor' ? 'VENDEDOR' : 'SUPERVISOR';
      
      const subGroupData = calls.reduce((acc, call) => {
        const key = call[subGroupKey] || 'Sin Asignar';
        if (!acc[key]) acc[key] = [];
        acc[key].push(call);
        return acc;
      }, {});
      
      const body = Object.entries(subGroupData).map(([name, groupCalls]) => {
        const totalScore = groupCalls.reduce((s, c) => s + (typeof c.PUNTUACION_TOTAL === 'number' ? c.PUNTUACION_TOTAL : 0), 0);
        const avgScore = groupCalls.length > 0 ? totalScore / groupCalls.length : 0;
        const confCount = groupCalls.filter(c => String(c.CONFORMIDAD).toLowerCase() === 'conforme').length;
        const confPerc = groupCalls.length > 0 ? (confCount / groupCalls.length) * 100 : 0;
        return [ name, groupCalls.length, avgScore.toFixed(2), `${confPerc.toFixed(1)}%`, getNivelFromScore(avgScore) ];
      });
      
      autoTable(doc, {
        startY: yPos,
        head: [[summaryLevel, 'Total Llamadas', 'Puntuación Media', '% Conformidad', 'Nivel Predominante']],
        body,
        theme: 'plain',
        headStyles: { fillColor: NAVY_HEADER, textColor: 255, fontSize: 10, fontStyle: 'bold', cellPadding: 8 },
        bodyStyles: { fontSize: 9, cellPadding: 8, valign: 'middle', lineWidth: {bottom: 0.5}, lineColor: BORDER_COLOR },
        alternateRowStyles: { fillColor: BG_LIGHT_GRAY },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          2: { fontStyle: 'bold', textColor: [59, 130, 246] },
          3: { fontStyle: 'bold' }
        },
        margin: { left: MARGIN, right: MARGIN }
      });
    }
    addFooter(doc);
  }

  doc.save(`Reporte_${level}_${name.replace(/ /g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}