// src/components/dashboard/DashboardFilters.jsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function DashboardFilters({ filters, onFilterChange, uniqueValues }) {
  const handleSelectChange = (key) => (value) => onFilterChange(key, value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros de Búsqueda</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label>Período de gestión</Label>
            <Select value={filters.period} onValueChange={handleSelectChange('period')}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger> {/* Cambiamos el placeholder */}
                <SelectContent>
                <SelectItem value="">Todos</SelectItem> {/* <-- AÑADIR ESTA LÍNEA */}
                {uniqueValues.periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
            </Select>
            </div>
          <div className="space-y-2">
            <Label>Segmento de calidad</Label>
            <Select value={filters.segment} onValueChange={handleSelectChange('segment')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {uniqueValues.segments.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subgerente</Label>
            <Select value={filters.submanager} onValueChange={handleSelectChange('submanager')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {uniqueValues.subgerentes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gerencia</Label>
            <Select value={filters.gerencia} onValueChange={handleSelectChange('gerencia')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {uniqueValues.gerencias.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supervisor</Label>
            <Select value={filters.supervisor} onValueChange={handleSelectChange('supervisor')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {uniqueValues.supervisores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Asesor de venta</Label>
            <Select value={filters.advisor} onValueChange={handleSelectChange('advisor')}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {uniqueValues.vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}