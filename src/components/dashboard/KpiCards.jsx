// src/components/dashboard/KpiCards.jsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCards({ conforme, noConforme }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Base de datos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-8">
          <div className="flex-1">
            <div className="h-32 bg-slate-600 rounded flex items-center justify-center text-white text-4xl font-bold">
              {conforme}
            </div>
          </div>
          <div className="flex-1">
            <div className="h-32 bg-slate-300 rounded flex items-center justify-center text-slate-700 text-4xl font-bold">
              {noConforme}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-slate-600 rounded"></div>
              <span className="text-sm">Conforme</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-slate-300 rounded"></div>
              <span className="text-sm">No conforme</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}