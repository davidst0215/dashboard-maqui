// src/components/dashboard/ExportReport.jsx
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { generatePdfReport } from "../../lib/reportGenerator";

const getNivelFromScore = (score) => {
    if (score >= 0.8) return "Excelente";
    if (score >= 0.6) return "Bueno";
    if (score >= 0.4) return "Regular";
    if (score >= 0.2) return "Deficiente";
    return "Crítico";
};

export function ExportReport({ processedAllData, uniqueValues }) {
  
  const [filters, setFilters] = useState({ 
    submanager: "", 
    supervisor: "", 
    advisor: "", 
    period: ""
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const { availableSupervisors, availableAdvisors } = useMemo(() => {
    const availableSupervisors = filters.submanager 
      ? [...new Set(processedAllData.filter(d => d.SUBGERENTE === filters.submanager).map(d => d.SUPERVISOR).filter(Boolean))] 
      : uniqueValues.supervisores;
    
    const availableAdvisors = filters.supervisor
      ? [...new Set(processedAllData.filter(d => d.SUPERVISOR === filters.supervisor).map(d => d.VENDEDOR).filter(Boolean))]
      : uniqueValues.vendedores;

    return { availableSupervisors, availableAdvisors };
  }, [filters.submanager, filters.supervisor, processedAllData, uniqueValues]);
  
  const handleFilterChange = (key) => (value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      if (key === 'submanager') { newFilters.supervisor = ''; newFilters.advisor = ''; }
      if (key === 'supervisor') { newFilters.advisor = ''; }
      return newFilters;
    });
  };

  const handleExport = () => {
    setIsGenerating(true);
    
    const filteredCalls = processedAllData.filter(item => {
      if (!item.FECHA_LLAMADA_STR) return false;
      const itemDateParts = item.FECHA_LLAMADA_STR.split('/');
      const itemPeriod = `${itemDateParts[2]}-${String(itemDateParts[1]).padStart(2, '0')}`;
      const periodMatch = filters.period ? itemPeriod === filters.period : true;
      const submanagerMatch = filters.submanager ? item.SUBGERENTE === filters.submanager : true;
      const supervisorMatch = filters.supervisor ? item.SUPERVISOR === filters.supervisor : true;
      const advisorMatch = filters.advisor ? item.VENDEDOR === filters.advisor : true;
      return periodMatch && submanagerMatch && supervisorMatch && advisorMatch;
    });

    if (filteredCalls.length === 0) {
      alert("No hay datos para exportar con los filtros seleccionados.");
      setIsGenerating(false);
      return;
    }
    
    let reportLevel = "General";
    let reportName = "Todos los Equipos";
    if (filters.advisor) { reportLevel = "Vendedor"; reportName = filters.advisor; }
    else if (filters.supervisor) { reportLevel = "Supervisor"; reportName = filters.supervisor; }
    else if (filters.submanager) { reportLevel = "Subgerente"; reportName = filters.submanager; }

    const totalScore = filteredCalls.reduce((sum, call) => sum + (call.PUNTUACION_TOTAL || 0), 0);
    const averageScore = filteredCalls.length > 0 ? totalScore / filteredCalls.length : 0;
    
    const conformityCount = filteredCalls.filter(call => call.CONFORMIDAD === 'Conforme').length;
    const conformityPercentage = filteredCalls.length > 0 ? (conformityCount / filteredCalls.length) * 100 : 0;

    const levels = filteredCalls.map(call => getNivelFromScore(call.PUNTUACION_TOTAL));
    const levelCounts = levels.reduce((acc, level) => { acc[level] = (acc[level] || 0) + 1; return acc; }, {});
    const nivelPredominante = Object.keys(levelCounts).length > 0
        ? Object.keys(levelCounts).reduce((a, b) => levelCounts[a] > levelCounts[b] ? a : b)
        : 'N/A';

    const globalAverages = { score: 0.69, conformity: 94.5 };
    
    const reportData = {
      level: reportLevel,
      name: reportName,
      period: filters.period || "Todos los períodos",
      calls: filteredCalls,
      metrics: {
        averageScore, conformityPercentage, nivelPredominante,
        differenceScore: averageScore - globalAverages.score,
        differenceConformity: conformityPercentage - globalAverages.conformity,
      },
      globalAverages,
    };

    try {
        generatePdfReport(reportData);
    } catch(error) {
        console.error("Error al generar el PDF:", error);
        alert("Ocurrió un error al generar el PDF. Revisa la consola para más detalles.");
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Generar Reporte de Desempeño</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
           <div className="space-y-2">
            <Label>Subgerencia</Label>
            <Select value={filters.submanager} onValueChange={handleFilterChange('submanager')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {uniqueValues.subgerentes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supervisor</Label>
            <Select value={filters.supervisor} onValueChange={handleFilterChange('supervisor')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {availableSupervisors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vendedor</Label>
            <Select value={filters.advisor} onValueChange={handleFilterChange('advisor')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {availableAdvisors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={filters.period} onValueChange={handleFilterChange('period')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {uniqueValues.periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleExport} disabled={isGenerating} className="w-full md:w-auto">
            {isGenerating ? 'Generando...' : <> <Download className="w-4 h-4 mr-2" /> Generar PDF </>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}