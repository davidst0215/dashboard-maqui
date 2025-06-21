// src/components/dashboard/SegmentPieChart.jsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = { 'Excelente': '#1e3a8a', 'Alto': '#2563eb', 'Medio': '#3b82f6', 'Bajo': '#60a5fa', 'Muy bajo': '#93c5fd' };

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