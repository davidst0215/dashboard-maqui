// src/components/dashboard/SummaryTable.jsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SummaryTable({ data }) {

  return (
    <div className="space-y-6">
      {/* Tabla de datos existente */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Datos Filtrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DNI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conformidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Puntuación Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data && data.length > 0 ? data.map((item, index) => (
                  <tr key={item.ID_LLAMADA || index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.DNI}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.CONFORMIDAD}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.CATEGORÍA}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.PUNTUACION_TOTAL}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No hay datos para mostrar con los filtros actuales.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Nueva sección de criterios de evaluación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📋</span>
            <span>Criterios de Evaluación de Calidad - Call Center</span>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Los 5 puntos clave que se evalúan en cada llamada de validación
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="border border-gray-200 rounded-lg p-4" style={{backgroundColor: '#F7F7F7'}}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{backgroundColor: '#7F9982'}}>
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1" style={{color: '#2C4156'}}>🆔 Identidad y Presentación</h3>
                  <p className="text-sm" style={{color: '#39566D'}}>
                    El agente se presenta a sí mismo y a la empresa, menciona que es una llamada de validación/calidad 
                    y consulta sobre la identidad correcta del cliente o asociado.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4" style={{backgroundColor: '#F7F7F7'}}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{backgroundColor: '#39566D'}}>
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1" style={{color: '#2C4156'}}>📋 Términos del Producto</h3>
                  <p className="text-sm" style={{color: '#39566D'}}>
                    El agente verifica datos clave del producto (tipo de plan, monto) 
                    y menciona las formas de adjudicación (sorteo/remate).
                  </p>
                </div>
              </div>
            </div>

            <div className="border-2 rounded-lg p-4" style={{borderColor: '#2C4156', backgroundColor: '#D2D7DB'}}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{backgroundColor: '#2C4156'}}>
                  3
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold" style={{color: '#2C4156'}}>🎲 Claridad sobre "Ganar"</h3>
                    <span className="px-2 py-1 text-white text-xs font-bold rounded-full" style={{backgroundColor: '#2C4156'}}>CRÍTICO</span>
                  </div>
                  <p className="text-sm" style={{color: '#39566D'}}>
                    <strong>PUNTO CRÍTICO:</strong> El agente menciona explícitamente que la adjudicación NO es segura 
                    y que depende de "ganar" un sorteo/remate, o que no hay fecha fija. 
                    Para productos de Autopronto, se puede adjudicar completando el pago de 24 cuotas.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4" style={{backgroundColor: '#F7F7F7'}}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{backgroundColor: '#98A1AA'}}>
                  4
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1" style={{color: '#2C4156'}}>❓ Consulta de Dudas</h3>
                  <p className="text-sm" style={{color: '#39566D'}}>
                    El agente pregunta activamente si el cliente tiene alguna duda o si todo está claro 
                    respecto a la información proporcionada.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4" style={{backgroundColor: '#F7F7F7'}}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{backgroundColor: '#7F9982'}}>
                  5
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1" style={{color: '#2C4156'}}>📧 Siguientes Pasos</h3>
                  <p className="text-sm" style={{color: '#39566D'}}>
                    El agente explica los siguientes pasos del proceso, como el envío de correo electrónico, 
                    una próxima llamada, u otros procedimientos relevantes.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">ℹ️ Información del Sistema de Evaluación:</h4>
            <div className="text-xs text-gray-700 space-y-1">
              <p>• <strong>Sistema binario:</strong> Cada criterio se evalúa como Cumple (1) o No Cumple (0)</p>
              <p>• <strong>Punto crítico:</strong> El Punto 3 - "Ganar" es especialmente importante para la validación</p>
              <p>• <strong>Evaluación automática:</strong> Se realiza usando análisis de IA sobre las transcripciones</p>
              <p>• <strong>Objetivo:</strong> Asegurar que los clientes comprendan completamente los términos del producto</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}