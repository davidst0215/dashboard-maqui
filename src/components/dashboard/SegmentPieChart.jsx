// src/components/dashboard/SegmentPieChart.jsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = { 
  'Muy Buena': '#10b981',   // Verde esmeralda - para la mejor categoría
  'Buena': '#3b82f6',       // Azul - para buena calidad
  'Media': '#f59e0b',       // Amarillo - para calidad media
  'Mala': '#ef4444',        // Rojo - para mala calidad
  'Pendiente': '#6b7280'    // Gris - para casos pendientes
};

export function SegmentPieChart({ data }) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .filter(item => item.value > 0);
  
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de segmentos</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 300 }}>
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(props) => `${(props.percent * 100).toFixed(0)}%`}>
                {chartData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={COLORS[entry.name]} />))}
              </Pie>
              <Tooltip formatter={(value) => `${value} (${(value / total * 100).toFixed(0)}%)`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">No hay datos para mostrar.</div>
        )}
      </CardContent>
    </Card>
  );
}