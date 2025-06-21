// src/components/dashboard/DniReport.jsx
import React, { useState, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogContext } from "@/components/ui/dialog"; 
import { Textarea } from "@/components/ui/textarea";
import { Play, FileText, List, Volume2 } from "lucide-react";
import { AudioPlayer } from './AudioPlayer';

// Componente interno para la lista de llamadas
function CallList({ results, onSelect }) {
  const { close } = useContext(DialogContext);

  const handleSelect = (call) => {
    console.log('📞 Llamada seleccionada:', call);
    onSelect(call);
    close();
  };

  const getNivelFromScore = (score) => {
    if (score >= 0.8) return { text: "Excelente", color: "bg-green-100 text-green-800" };
    if (score >= 0.6) return { text: "Bueno", color: "bg-blue-100 text-blue-800" };
    if (score >= 0.4) return { text: "Regular", color: "bg-yellow-100 text-yellow-800" };
    if (score >= 0.2) return { text: "Deficiente", color: "bg-orange-100 text-orange-800" };
    return { text: "Crítico", color: "bg-red-100 text-red-800" };
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {results.map((call) => {
        const nivel = getNivelFromScore(call.PUNTUACION_TOTAL || 0);
        return (
          <div 
            key={call.ID_LLAMADA} 
            onClick={() => handleSelect(call)} 
            className="p-3 border rounded cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p><strong>ID Llamada:</strong> {call.ID_LLAMADA}</p>
                <p><strong>Fecha:</strong> {call.FECHA_LLAMADA_STR || call.FECHA_LLAMADA}</p>
                <p><strong>Vendedor:</strong> {call.VENDEDOR}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span><strong>Puntuación:</strong> {call.PUNTUACION_TOTAL?.toFixed(2) || 'N/A'}</span>
                  <span className={`px-2 py-1 rounded text-xs ${nivel.color}`}>
                    {nivel.text}
                  </span>
                </div>
                <p><strong>Conformidad:</strong> 
                  <span className={`ml-1 px-2 py-1 rounded text-xs ${
                    call.CONFORMIDAD === 'Conforme' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {call.CONFORMIDAD}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-center">
                {call.ID_AUDIO && (
                  <div className="text-blue-500 mb-1">
                    <Volume2 className="w-4 h-4" />
                  </div>
                )}
                <span className="text-xs text-gray-500">Seleccionar</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DniReport({ dni, onDniChange, results }) {
  const [selectedCall, setSelectedCall] = useState(null);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);

  const handlePlayAudio = () => {
    console.log('🎵 Intentando reproducir audio para:', selectedCall);
    
    if (selectedCall && selectedCall.ID_AUDIO) {
      console.log('✅ Audio disponible, mostrando reproductor');
      setShowAudioPlayer(true);
    } else {
      console.log('❌ No hay audio disponible');
      alert("No hay un audio asociado a esta llamada.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reporte detallado por DNI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>DNI</Label>
              <Input 
                value={dni} 
                onChange={(e) => onDniChange(e.target.value)} 
                placeholder="Ingrese DNI" 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Lista de grabaciones</Label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={results.length === 0}>
                    <List className="w-4 h-4 mr-2" />
                    Seleccionar ({results.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Grabaciones para DNI: {dni}</DialogTitle>
                  </DialogHeader>
                  <CallList results={results} onSelect={setSelectedCall} />
                </DialogContent>
              </Dialog>
            </div>
            
            <Button 
              onClick={handlePlayAudio} 
              disabled={!selectedCall || !selectedCall.ID_AUDIO}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Reproductor
            </Button>
            
            <Button disabled={!selectedCall} variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Ver transcripción
            </Button>
          </div>

          {/* Información de la llamada seleccionada */}
          {selectedCall && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md border">
              <h4 className="font-semibold text-blue-800 mb-2">Llamada Seleccionada:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><strong>ID:</strong> {selectedCall.ID_LLAMADA}</div>
                <div><strong>Fecha:</strong> {selectedCall.FECHA_LLAMADA_STR || selectedCall.FECHA_LLAMADA}</div>
                <div><strong>Vendedor:</strong> {selectedCall.VENDEDOR}</div>
                <div><strong>Puntuación:</strong> {selectedCall.PUNTUACION_TOTAL?.toFixed(2) || 'N/A'}</div>
              </div>
              <div className="mt-2 text-xs">
                <strong>Audio:</strong> {selectedCall.ID_AUDIO ? '✅ Disponible' : '❌ No disponible'}
                {selectedCall.ID_AUDIO && (
                  <div className="text-gray-600 break-all mt-1">
                    URL: {selectedCall.ID_AUDIO}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reproductor de Audio */}
      {showAudioPlayer && (
        <AudioPlayer 
          selectedCall={selectedCall}
          onClose={() => {
            console.log('🔒 Cerrando reproductor');
            setShowAudioPlayer(false);
          }}
        />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Comentarios sobre el reporte de conversación</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              readOnly 
              value={selectedCall?.COMENTARIO || 'Seleccione una llamada para ver los comentarios.'} 
              className="min-h-[120px]" 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Ver la conversación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-md min-h-[120px] border overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedCall?.TRANSCRIPCION || 'Seleccione una llamada para ver la transcripción.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DniReport;