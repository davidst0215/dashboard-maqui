// src/components/ui/select.jsx (CORREGIDO)

import React from 'react';

// El componente principal ahora aceptará `onValueChange` y lo convertirá a `onChange`.
export const Select = ({ onValueChange, value, children }) => {
  const handleChange = (event) => {
    // Cuando el <select> nativo cambie, llamamos a la función `onValueChange`
    // que nos pasaron desde DashboardFilters.
    if (onValueChange) {
      onValueChange(event.target.value);
    }
  };

  return (
    <select 
      className="w-full px-3 py-2 border rounded-md" 
      value={value} // Usamos la prop 'value' para controlar el estado
      onChange={handleChange} // Usamos la prop 'onChange' del HTML nativo
    >
      {children}
    </select>
  );
};

// Estos componentes siguen siendo "placeholders" para que la estructura funcione.
export const SelectValue = () => null;
export const SelectTrigger = ({ children }) => children; // En un <select> nativo, el trigger es el propio select.
export const SelectContent = ({ children }) => <>{children}</>; // Los <option> van directamente dentro del <select>.

export const SelectItem = ({ children, ...props }) => (
  <option {...props}>{children}</option>
);