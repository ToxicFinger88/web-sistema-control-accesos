import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';

import {
  getFunctions,
  httpsCallable
} from 'firebase/functions';

import { db } from './firebase';

const functions =
  getFunctions();

/**
 * Obtiene el perfil asociado a un UID.
 */
export const obtenerPerfilUsuario =
  async (uid) => {
    if (!uid) {
      throw new Error(
        'No se recibió el UID del usuario.'
      );
    }

    const referencia = doc(
      db,
      'usuarios',
      uid
    );

    const resultado =
      await getDoc(referencia);

    if (!resultado.exists()) {
      throw new Error(
        'La cuenta existe en Authentication, pero no tiene perfil en usuarios.'
      );
    }

    return {
      uid: resultado.id,
      ...resultado.data()
    };
  };

/**
 * Lista usuarios mediante Cloud Function.
 *
 * El backend decide automáticamente
 * qué usuarios puede consultar el perfil.
 */
export const listarUsuarios =
  async ({
    empresaId = ''
  } = {}) => {
    try {
      const ejecutarListado =
        httpsCallable(
          functions,
          'listarUsuariosAdministrados'
        );

      const respuesta =
        await ejecutarListado({
          empresaId
        });

      return (
        respuesta.data?.usuarios ||
        []
      );
    } catch (error) {
      console.error(
        'Error listando usuarios:',
        error
      );

      const mensaje =
        error?.details ||
        error?.message ||
        'No fue posible obtener los usuarios.';

      throw new Error(mensaje);
    }
  };

/**
 * Obtiene todas las empresas activas.
 * Uso exclusivo del superadministrador.
 */
export const obtenerEmpresasActivas =
  async () => {
    const consulta = query(
      collection(
        db,
        'empresas'
      ),
      where(
        'activa',
        '==',
        true
      )
    );

    const resultado =
      await getDocs(consulta);

    return resultado.docs
      .map((documento) => ({
        id: documento.id,
        ...documento.data()
      }))
      .sort(
        (
          empresaA,
          empresaB
        ) =>
          String(
            empresaA.nombre || ''
          ).localeCompare(
            String(
              empresaB.nombre || ''
            ),
            'es'
          )
      );
  };

/**
 * Obtiene únicamente una empresa.
 */
export const obtenerEmpresaActivaPorId =
  async (empresaId) => {
    const id =
      String(
        empresaId || ''
      ).trim();

    if (!id) {
      throw new Error(
        'No se pudo identificar la empresa.'
      );
    }

    const referencia = doc(
      db,
      'empresas',
      id
    );

    const resultado =
      await getDoc(referencia);

    if (!resultado.exists()) {
      throw new Error(
        'La empresa asignada no existe.'
      );
    }

    const datos =
      resultado.data();

        if (datos.activa !== true) {
      throw new Error(
        'La empresa asignada está inactiva.'
      );
    }

    return {
      id: resultado.id,
      ...datos
    };
  };

/**
 * Crea usuario.
 */
export const crearUsuarioAdministrado =
  async (datosUsuario) => {
    try {
      const ejecutarCreacion =
        httpsCallable(
          functions,
          'crearUsuarioAdministrado'
        );

      const respuesta =
        await ejecutarCreacion(
          datosUsuario
        );

      return respuesta.data;
    } catch (error) {
      console.error(
        'Error creando usuario:',
        error
      );

      throw new Error(
        error?.details ||
        error?.message ||
        'No fue posible crear el usuario.'
      );
    }
  };

/**
 * Actualiza usuario.
 */
export const actualizarUsuario =
  async (datosUsuario) => {
    try {
      const ejecutarActualizacion =
        httpsCallable(
          functions,
          'actualizarUsuarioAdministrado'
        );

      const respuesta =
        await ejecutarActualizacion(
          datosUsuario
        );

      return respuesta.data;
    } catch (error) {
      console.error(
        'Error actualizando usuario:',
        error
      );

      throw new Error(
        error?.details ||
        error?.message ||
        'No fue posible actualizar el usuario.'
      );
    }
  };

/**
 * Activa/desactiva usuario.
 */
export const cambiarEstadoUsuario =
  async ({
    uid,
    estado
  }) => {
    try {
      const ejecutar =
        httpsCallable(
          functions,
          'cambiarEstadoUsuarioAdministrado'
        );

      const respuesta =
        await ejecutar({
          uid,
          estado
        });

      return respuesta.data;
    } catch (error) {
      console.error(
        'Error cambiando estado:',
        error
      );

      throw new Error(
        error?.details ||
        error?.message ||
        'No fue posible cambiar el estado.'
      );
    }
  };

/**
 * Cambia contraseña temporal.
 */
export const cambiarPasswordTemporal =
  async ({
    uid,
    password
  }) => {
    try {
      const ejecutar =
        httpsCallable(
          functions,
          'cambiarPasswordTemporalAdministrado'
        );

      const respuesta =
        await ejecutar({
          uid,
          password
        });

      return respuesta.data;
    } catch (error) {
      console.error(
        'Error cambiando contraseña:',
        error
      );

      throw new Error(
        error?.details ||
        error?.message ||
        'No fue posible cambiar la contraseña.'
      );
    }
  };
  