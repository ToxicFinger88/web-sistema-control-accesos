
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  crearPersonaVisitable,
  obtenerPersonasVisitables,
  obtenerPersonaVisitablePorId,
  actualizarPersonaVisitable,
  cambiarEstadoPersonaVisitable
} from '../services/visitables';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';

vi.mock('../services/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn()
}));

describe('VisitablesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(serverTimestamp).mockReturnValue({
      seconds: 0,
      nanoseconds: 0
    });

    vi.mocked(collection).mockReturnValue('coleccion');
    vi.mocked(doc).mockReturnValue('documento');
    vi.mocked(query).mockReturnValue('consulta');
    vi.mocked(where).mockReturnValue('filtro');
  });

  it('exporta las funciones actuales del servicio', () => {
    expect(typeof crearPersonaVisitable).toBe('function');
    expect(typeof obtenerPersonasVisitables).toBe('function');
    expect(typeof obtenerPersonaVisitablePorId).toBe('function');
    expect(typeof actualizarPersonaVisitable).toBe('function');
    expect(typeof cambiarEstadoPersonaVisitable).toBe('function');
  });

  it('rechaza crear personas sin empresaId', async () => {
    await expect(
      crearPersonaVisitable({
        empresaId: '',
        nombre: 'Ana',
        apellido: 'Pérez'
      })
    ).rejects.toThrow('No se pudo identificar la empresa');

    expect(addDoc).not.toHaveBeenCalled();
  });

  it('crea una persona con empresaId y estado activo', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'visitable-1' });

    const id = await crearPersonaVisitable({
      empresaId: 'empresa-A',
      nombre: 'Ana',
      apellido: 'Pérez',
      creadoPorUid: 'usuario-1'
    });

    expect(id).toBe('visitable-1');

    expect(addDoc).toHaveBeenCalledWith(
      'coleccion',
      expect.objectContaining({
        empresaId: 'empresa-A',
        nombre: 'Ana',
        apellido: 'Pérez',
        estado: 'activo',
        creadoPorUid: 'usuario-1'
      })
    );
  });

  it('consulta personas filtrando por empresaId', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: 'visitable-1',
          data: () => ({
            empresaId: 'empresa-A',
            nombre: 'Ana',
            apellido: 'Pérez',
            estado: 'activo'
          })
        }
      ]
    });

    const resultado = await obtenerPersonasVisitables({
      empresaId: 'empresa-A'
    });

    expect(where).toHaveBeenCalledWith(
      'empresaId',
      '==',
      'empresa-A'
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('visitable-1');
  });

  it('rechaza acceder a una persona de otra empresa', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        empresaId: 'empresa-B',
        nombre: 'Ana',
        apellido: 'Pérez'
      })
    });

    await expect(
      obtenerPersonaVisitablePorId({
        id: 'visitable-1',
        empresaId: 'empresa-A'
      })
    ).rejects.toThrow(
      'no pertenece a la empresa seleccionada'
    );
  });

  it('actualiza una persona de la empresa correcta', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'visitable-1',
      data: () => ({
        empresaId: 'empresa-A',
        nombre: 'Ana',
        apellido: 'Pérez'
      })
    });

    vi.mocked(updateDoc).mockResolvedValue(undefined);

    await actualizarPersonaVisitable({
      id: 'visitable-1',
      empresaId: 'empresa-A',
      nombre: 'Ana María',
      apellido: 'Pérez',
      actualizadoPorUid: 'usuario-1'
    });

    expect(updateDoc).toHaveBeenCalledWith(
      'documento',
      expect.objectContaining({
        nombre: 'Ana María',
        apellido: 'Pérez',
        actualizadoPorUid: 'usuario-1'
      })
    );
  });

  it('permite desactivar una persona', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'visitable-1',
      data: () => ({
        empresaId: 'empresa-A',
        estado: 'activo'
      })
    });

    vi.mocked(updateDoc).mockResolvedValue(undefined);

    await cambiarEstadoPersonaVisitable({
      id: 'visitable-1',
      empresaId: 'empresa-A',
      estado: 'inactivo',
      actualizadoPorUid: 'usuario-1'
    });

    expect(updateDoc).toHaveBeenCalledWith(
      'documento',
      expect.objectContaining({
        estado: 'inactivo',
        actualizadoPorUid: 'usuario-1'
      })
    );
  });

  it('rechaza estados no permitidos', async () => {
    await expect(
      cambiarEstadoPersonaVisitable({
        id: 'visitable-1',
        empresaId: 'empresa-A',
        estado: 'eliminado'
      })
    ).rejects.toThrow('El estado seleccionado no es válido');

    expect(updateDoc).not.toHaveBeenCalled();
  });
});
