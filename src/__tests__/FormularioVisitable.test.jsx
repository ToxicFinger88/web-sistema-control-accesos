import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FormularioVisitable from '../components/visitables/FormularioVisitable';

describe('FormularioVisitable', () => {
  const mockOnGuardar = vi.fn();
  const mockOnCancelar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería renderizar formulario de creación', () => {
    render(<FormularioVisitable onGuardar={mockOnGuardar} onCancelar={mockOnCancelar} />);
    
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear persona/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('debería llamar a onGuardar con los datos del formulario', () => {
    render(<FormularioVisitable onGuardar={mockOnGuardar} onCancelar={mockOnCancelar} />);
    
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/apellido/i), { target: { value: 'Pérez' } });
    fireEvent.click(screen.getByRole('button', { name: /crear persona/i }));
    
    expect(mockOnGuardar).toHaveBeenCalledWith({ nombre: 'Juan', apellido: 'Pérez' });
  });
});
