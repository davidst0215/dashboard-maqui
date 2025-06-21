// src/App.jsx - Con autenticación integrada (CORREGIDO)
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AuthProvider, LoginComponent, useAuth } from './components/auth/LoginComponent';
import DashboardView from './components/DashboardView'; // Tu componente real

// Componente principal del dashboard (lo que tenías antes)
function DashboardApp() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadExcelData();
    }
  }, [isAuthenticated]);

  const loadExcelData = async () => {
    try {
      // Cargar archivo desde public/data.xlsx
      const response = await fetch('/data.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log('Datos cargados:', jsonData);
      setData(jsonData);
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar Excel:', error);
      setLoading(false);
    }
  };

  // Si no está autenticado, mostrar login
  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  // Si está cargando datos
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <LoginComponent /> {/* Header con info del usuario */}
        <div className="flex items-center justify-center h-96">
          <div className="text-xl">Cargando datos...</div>
        </div>
      </div>
    );
  }

  // Si no hay datos
  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100">
        <LoginComponent /> {/* Header con info del usuario */}
        <div className="flex items-center justify-center h-96">
          <div className="text-xl text-red-600">Error: No se pudo cargar el archivo data.xlsx</div>
        </div>
      </div>
    );
  }

  // Dashboard funcionando - usar tu DashboardView original
  return (
    <div className="min-h-screen bg-gray-100">
      <LoginComponent /> {/* Header con info del usuario */}
      <DashboardView />
    </div>
  );
}

// App principal con el Provider
function App() {
  return (
    <AuthProvider>
      <DashboardApp />
    </AuthProvider>
  );
}

export default App;