// src/main.jsx - Con autenticación integrada
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider, LoginComponent, useAuth } from './components/auth/LoginComponent'
import DashboardView from './components/DashboardView'
import './index.css'

// Componente que maneja el login + dashboard
function App() {
  const { isAuthenticated } = useAuth();

  // Si no está autenticado, mostrar login
  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  // Si está autenticado, mostrar tu dashboard original
  return (
    <div>
      <LoginComponent /> {/* Header con info del usuario logueado */}
      <DashboardView />
    </div>
  );
}

// Renderizar con el AuthProvider
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)