import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';

import {
  auth,
  db
} from './firebase';

const COLLECTION_NAME =
  'visitas';

const validarEmpresaId = (
  empresaId
) => {
  const id =
    String(
      empresaId || ''
    ).trim();

  if (!id) {
    throw new Error(
      'No se pudo identificar la empresa.'
    );
  }

  return id;
};

const obtenerMilisegundosFecha = (
  fecha
) => {
  if (!fecha) {
    return 0;
  }

  if (
    typeof fecha.toMillis ===
    'function'
  ) {
    return fecha.toMillis();
  }

  if (
    typeof fecha.toDate ===
    'function'
  ) {
    return fecha
      .toDate()
      .getTime();
  }

  if (fecha.seconds) {
    return (
      fecha.seconds *
      1000
    );
  }

  const resultado =
    new Date(fecha);

  if (
    Number.isNaN(
      resultado.getTime()
    )
  ) {
    return 0;
  }

  return resultado.getTime();
};

const normalizarUid = (
  uid
) =>
  String(
    uid || ''
  ).trim();

export const crearVisita =
  async ({
    empresaId,
    empresaNombre = '',
    visitanteNombre,
    visitanteApellido,
    visitanteCedula,
    visitanteFechaNacimiento,
    personaVisitableId,
    personaVisitableNombre,
    motivo = '',
    creadoPorUid = '',
    origen = 'web'
  }) => {
    try {
      const empresa =
        validarEmpresaId(
          empresaId
        );

      /*
       * La visita siempre queda asociada
       * al usuario autenticado.
       *
       * creadoPorUid recibido se conserva
       * como compatibilidad, pero si existe
       * una sesión Firebase usamos su UID.
       */
      const uidSesion =
        normalizarUid(
          auth.currentUser?.uid
        );

      const uidCreador =
        uidSesion ||
        normalizarUid(
          creadoPorUid
        );

      if (!uidCreador) {
        throw new Error(
          'No se pudo identificar al usuario que registra la visita.'
        );
      }

      const referencia =
        await addDoc(
          collection(
            db,
            COLLECTION_NAME
          ),
          {
            empresaId: empresa,

            empresaNombre:
              String(
                empresaNombre || ''
              ).trim(),

            visitanteNombre:
              String(
                visitanteNombre || ''
              ).trim(),

            visitanteApellido:
              String(
                visitanteApellido || ''
              ).trim(),

            visitanteCedula:
              String(
                visitanteCedula || ''
              ).trim(),

            visitanteFechaNacimiento:
              visitanteFechaNacimiento ||
              '',

            personaVisitableId:
              String(
                personaVisitableId || ''
              ).trim(),

            personaVisitableNombre:
              String(
                personaVisitableNombre || ''
              ).trim(),

            motivo:
              String(
                motivo || ''
              ).trim(),

            creadoPorUid:
              uidCreador,

            origen:
              origen === 'android'
                ? 'android'
                : 'web',

            fecha:
              serverTimestamp()
          }
        );

      return referencia.id;
    } catch (error) {
      throw new Error(
        `Error al crear visita: ${error.message}`
      );
    }
  };

// Consultas siempre acotadas por empresa; para operador, también por UID.
const crearRestricciones = ({ empresaId, creadoPorUid = '', fechaDesde = '', fechaHasta = '' }) => {
  const restricciones = [where('empresaId', '==', validarEmpresaId(empresaId))];
  const uid = normalizarUid(creadoPorUid);
  if (uid) restricciones.push(where('creadoPorUid', '==', uid));
  const desde = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
  const hasta = fechaHasta ? new Date(`${fechaHasta}T00:00:00`) : null;
  if (desde && Number.isNaN(desde.getTime())) throw new Error('Fecha inicial inválida.');
  if (hasta && Number.isNaN(hasta.getTime())) throw new Error('Fecha final inválida.');
  if (desde) restricciones.push(where('fecha', '>=', Timestamp.fromDate(desde)));
  if (hasta) {
    hasta.setDate(hasta.getDate() + 1);
    restricciones.push(where('fecha', '<', Timestamp.fromDate(hasta)));
  }
  return restricciones;
};

export const obtenerVisitasPaginadas = async ({
  empresaId, creadoPorUid = '', fechaDesde = '', fechaHasta = '',
  cursor = null, tamanoPagina = 50
}) => {
  const tamano = Math.min(50, Math.max(1, Number(tamanoPagina) || 50));
  const restricciones = crearRestricciones({ empresaId, creadoPorUid, fechaDesde, fechaHasta });
  const consulta = query(
    collection(db, COLLECTION_NAME), ...restricciones,
    orderBy('fecha', 'desc'), limit(tamano + 1),
    ...(cursor ? [startAfter(cursor)] : [])
  );
  const resultado = await getDocs(consulta);
  const documentos = resultado.docs.slice(0, tamano);
  return {
    visitas: documentos.map(documento => ({ id: documento.id, ...documento.data() })),
    cursorSiguiente: documentos.length ? documentos[documentos.length - 1] : null,
    hayMas: resultado.docs.length > tamano
  };
};

export const contarVisitas = async (filtros) => {
  const consulta = query(collection(db, COLLECTION_NAME), ...crearRestricciones(filtros));
  const resultado = await getCountFromServer(consulta);
  return resultado.data().count;
};

// Exportación explícita por lotes: no se ejecuta al abrir el historial.
export const obtenerVisitasParaExportar = async (filtros, maximo = 10000) => {
  const todas = [];
  let cursor = null;
  let hayMas = true;
  while (hayMas && todas.length < maximo) {
    const pagina = await obtenerVisitasPaginadas({ ...filtros, cursor });
    todas.push(...pagina.visitas);
    cursor = pagina.cursorSiguiente;
    hayMas = pagina.hayMas;
  }
  if (hayMas) throw new Error(`La exportación supera el máximo de ${maximo} registros. Acote el rango de fechas.`);
  return todas;
};

// Compatibilidad: las llamadas existentes quedan acotadas a una página.
export const obtenerVisitas = async (filtros) =>
  (await obtenerVisitasPaginadas(filtros)).visitas;

export const obtenerVisitaPorId =
  async ({
    id,
    empresaId,
    creadoPorUid = ''
  }) => {
    try {
      const visitaId =
        String(
          id || ''
        ).trim();

      const empresa =
        validarEmpresaId(
          empresaId
        );

      const uid =
        normalizarUid(
          creadoPorUid
        );

      if (!visitaId) {
        throw new Error(
          'No se pudo identificar la visita.'
        );
      }

      const referencia = doc(
        db,
        COLLECTION_NAME,
        visitaId
      );

      const resultado =
        await getDoc(
          referencia
        );

      if (!resultado.exists()) {
        throw new Error(
          'Visita no encontrada.'
        );
      }

      const visita =
        resultado.data();

      if (
        visita.empresaId !==
        empresa
      ) {
        throw new Error(
          'La visita no pertenece a la empresa seleccionada.'
        );
      }

      if (
        uid &&
        visita.creadoPorUid !==
          uid
      ) {
        throw new Error(
          'La visita no pertenece al usuario conectado.'
        );
      }

      return {
        id: resultado.id,
        ...visita
      };
    } catch (error) {
      throw new Error(
        `Error al obtener visita: ${error.message}`
      );
    }
  };

export const obtenerVisitasPorFecha = async ({ empresaId, fecha, creadoPorUid = '' }) => {
  if (!fecha) throw new Error('Indique una fecha para la consulta.');
  return obtenerVisitasParaExportar({ empresaId, creadoPorUid, fechaDesde: fecha, fechaHasta: fecha });
};
