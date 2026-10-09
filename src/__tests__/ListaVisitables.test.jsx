import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ListaVisitables from '../components/visitables/ListaVisitables';

describe('ListaVisitables', () => {
  it('muestra mensaje cuando no hay personas visitables', () => {
    render(
      <ListaVisitables
        visitables={[]}
        onEditar={vi.fn()}
        onCambiarEstado={vi.fn()}
        visitableProcesando={null}
      />
    );

    expect(
      screen.getByText('No hay personas visitables')
    ).toBeInTheDocument();
  });
});
