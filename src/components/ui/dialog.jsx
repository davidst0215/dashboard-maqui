// src/components/ui/dialog.jsx
import React, { useState, useContext, createContext, cloneElement } from 'react';
import { X } from 'lucide-react';

export const DialogContext = createContext();

export function Dialog({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return <DialogContext.Provider value={{ isOpen, open, close }}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ children }) {
  const { open } = useContext(DialogContext);
  // Clona el botón hijo y le añade el evento onClick
  return cloneElement(children, { onClick: open });
}

export function DialogContent({ children }) {
  const { isOpen, close } = useContext(DialogContext);

  if (!isOpen) return null;

  return (
    // Fondo oscuro semi-transparente
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={close} // Cierra al hacer clic en el fondo
    >
      {/* Contenedor del diálogo */}
      <div 
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg m-4"
        onClick={(e) => e.stopPropagation()} // Evita que el clic se propague al fondo
      >
        {/* Contenido que pasas desde DniReport.jsx */}
        <div className="p-6">{children}</div>
        
        {/* Botón para cerrar */}
        <button onClick={close} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

// Estos dos son opcionales pero buenos para la estructura
export const DialogHeader = ({ children }) => <div className="mb-4">{children}</div>;
export const DialogTitle = ({ children }) => <h2 className="text-xl font-semibold">{children}</h2>;