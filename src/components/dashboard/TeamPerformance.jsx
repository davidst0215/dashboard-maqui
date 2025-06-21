// src/components/dashboard/TeamPerformance.jsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TeamPerformance({ data }) {
  const entries = Object.entries(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultados de Verificación de calidad por equipo de ventas (Subgerente)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entries.length > 0 ? entries.map(([name, stats]) => {
            const conformePct = stats.total > 0 ? Math.round((stats.conforme / stats.total) * 100) : 0;
            const noConformePct = 100 - conformePct;

            return (
              <div key={name} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium">{name}</span>
                  <span>Total: {stats.total}</span>
                </div>
                <div className="relative h-8 bg-slate-300 rounded overflow-hidden flex text-white font-semibold">
                  <div className="bg-slate-600 h-full flex items-center justify-center" style={{ width: `${conformePct}%` }}>
                    {conformePct > 15 && `${conformePct}%`}
                  </div>
                   <div className="bg-slate-300 h-full flex items-center justify-center text-slate-700" style={{ width: `${noConformePct}%` }}>
                    {noConformePct > 15 && `${noConformePct}%`}
                  </div>
                </div>
              </div>
            )
          }) : <p className="text-center text-gray-500">No hay datos para mostrar con los filtros actuales.</p>}
        </div>
      </CardContent>
    </Card>
  );
}