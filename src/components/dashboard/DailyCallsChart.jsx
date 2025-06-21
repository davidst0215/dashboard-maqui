// src/components/dashboard/DailyCallsChart.jsx

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DailyCallsChart({ data }) {
  // ---- AÑADIR ESTE CONSOLE.LOG ----
  console.log("Datos recibidos por DailyCallsChart:", data); 
  // ----------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguimiento diario de llamadas</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 350 }}>
        {/* Añadimos una comprobación para mostrar un mensaje si no hay datos */}
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="conforme" stackId="a" fill="#475569" name="Conformes" />
              <Bar dataKey="noConforme" stackId="a" fill="#cbd5e1" name="No Conformes" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Seleccione un período para ver el seguimiento diario.
          </div>
        )}
      </CardContent>
    </Card>
  );
}