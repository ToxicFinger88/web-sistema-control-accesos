
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useLocation } from 'react-router-dom';
import { utils, writeFileXLSX } from 'xlsx';

import { useAuth } from '../../hooks/useAuth';
import {
  obtenerVisitasPaginadas,
  obtenerVisitasParaExportar
} from '../../services/visitas';
import { listarUsuarios } from '../../services/usuarios';

import './HistorialVisitas.css';

const TAMANO_PAGINA = 50;
const MAXIMO_EXPORTACION = 10000;

function fechaInput(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function fechaLegible(valor) {
  if (!valor) return '';

  const fecha =
    typeof valor.toDate === 'function'
      ? valor.toDate()
      : typeof valor.seconds === 'number'
        ? new Date(valor.seconds * 1000)
        : new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? ''
    : fecha.toLocaleString('es-UY');
}

function HistorialVisitas() {
  const location = useLocation();
  const { user, perfil } = useAuth();

  const vistaHistorial = ['total', 'empresas', 'personas'].includes(
    location.state?.vista
  )
    ? location.state.vista
    : 'total';

  const esAdminEmpresa = perfil?.rol === 'admin_empresa';
  const esOperador = perfil?.rol === 'operador';

  const empresaId = String(perfil?.empresaId || '').trim();
  const uidActual = String(perfil?.uid || user?.uid || '').trim();

  const [visitas, setVisitas] = useState([]);
  const [usuariosEmpresa, setUsuariosEmpresa] = useState([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState('');

  const [fechaDesdeSeleccionada, setFechaDesdeSeleccionada] =
    useState('');
  const [fechaHastaSeleccionada, setFechaHastaSeleccionada] =
    useState('');

  const [fechaDesdeAplicada, setFechaDesdeAplicada] =
    useState('');
  const [fechaHastaAplicada, setFechaHastaAplicada] =
    useState('');

  const [periodoActivo, setPeriodoActivo] = useState('todas');

  const [pagina, setPagina] = useState(1);
  const [cursores, setCursores] = useState([null]);
  const [hayMas, setHayMas] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [exportandoPagina, setExportandoPagina] = useState(false);
  const [exportandoPeriodo, setExportandoPeriodo] = useState(false);

  const [error, setError] = useState('');
  const [errorFiltro, setErrorFiltro] = useState('');
  const [errorExportacion, setErrorExportacion] = useState('');

  const solicitudActual = useRef(0);

  const uidFiltro = esOperador ? uidActual : usuarioFiltro;
  const exportando = exportandoPagina || exportandoPeriodo;

  const filtrosAplicados = useMemo(() => ({
    empresaId,
    creadoPorUid: uidFiltro,
    fechaDesde: fechaDesdeAplicada,
    fechaHasta: fechaHastaAplicada
  }), [
    empresaId,
    uidFiltro,
    fechaDesdeAplicada,
    fechaHastaAplicada
  ]);

  const cargarVisitas = useCallback(
    async (numeroPagina = 1, cursor = null) => {
      const solicitud = ++solicitudActual.current;

      if (!empresaId || (esOperador && !uidActual)) {
        setVisitas([]);
        setError(
          'No se pudo identificar la empresa o el usuario conectado.'
        );
        setCargando(false);
        return;
      }

      setCargando(true);
      setError('');

      try {
        const resultado = await obtenerVisitasPaginadas({
          ...filtrosAplicados,
          cursor,
          tamanoPagina: TAMANO_PAGINA
        });

        if (solicitud !== solicitudActual.current) return;

        setVisitas(resultado.visitas);
        setHayMas(resultado.hayMas);
        setPagina(numeroPagina);

        setCursores((anteriores) => {
          const nuevos = anteriores.slice(0, numeroPagina);
          nuevos[numeroPagina] = resultado.cursorSiguiente;
          return nuevos;
        });
      } catch (err) {
        if (solicitud !== solicitudActual.current) return;

        console.error('Error cargando historial:', err);
        setError(
          err.message || 'No fue posible cargar el historial.'
        );
      } finally {
        if (solicitud === solicitudActual.current) {
          setCargando(false);
        }
      }
    },
    [
      empresaId,
      esOperador,
      uidActual,
      filtrosAplicados
    ]
  );

  useEffect(() => {
    setPagina(1);
    setCursores([null]);
    cargarVisitas(1, null);

    return () => {
      solicitudActual.current += 1;
    };
  }, [cargarVisitas]);

  useEffect(() => {
    if (!esAdminEmpresa || !empresaId) {
      setUsuariosEmpresa([]);
      return;
    }

    let vigente = true;

    listarUsuarios({ empresaId })
      .then((usuarios) => {
        if (vigente) {
          setUsuariosEmpresa(
            Array.isArray(usuarios) ? usuarios : []
          );
        }
      })
      .catch((err) => {
        console.error(
          'Error cargando usuarios del filtro:',
          err
        );
      });

    return () => {
      vigente = false;
    };
  }, [esAdminEmpresa, empresaId]);

  const mapaUsuarios = useMemo(() => {
    const mapa = {};

    usuariosEmpresa.forEach((usuario) => {
      const nombre = [usuario.nombre, usuario.apellido]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (usuario.uid) {
        mapa[usuario.uid] =
          nombre || usuario.email || usuario.uid;
      }
    });

    visitas.forEach((visita) => {
      const uid = String(visita.creadoPorUid || '').trim();

      if (uid && !mapa[uid]) {
        mapa[uid] = `Usuario ${uid}`;
      }
    });

    return mapa;
  }, [usuariosEmpresa, visitas]);

  const opcionesUsuarios = useMemo(
    () =>
      Object.entries(mapaUsuarios)
        .map(([uid, nombre]) => ({ uid, nombre }))
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es')
        ),
    [mapaUsuarios]
  );

  const obtenerNombreRegistrador = (visita) => {
    const uid = String(visita.creadoPorUid || '').trim();

    if (!uid) return 'Sin usuario identificado';

    if (mapaUsuarios[uid]) return mapaUsuarios[uid];

    if (uid === uidActual) {
      return [perfil?.nombre, perfil?.apellido]
        .filter(Boolean)
        .join(' ')
        .trim() ||
        user?.email ||
        'Usuario actual';
    }

    return uid;
  };

  const obtenerNombreEmpresa = (visita) =>
    visita.empresaNombre ||
    visita.empresa ||
    perfil?.empresaNombre ||
    perfil?.empresaId ||
    '';

  const resumenEmpresas = useMemo(() => {
    const mapa = new Map();

    visitas.forEach((visita) => {
      const nombre = String(
        visita.empresaNombre ||
        visita.empresa ||
        'Sin empresa'
      ).trim();

      const clave = nombre.toLocaleLowerCase('es');

      if (!mapa.has(clave)) {
        mapa.set(clave, { nombre, cantidad: 0 });
      }

      mapa.get(clave).cantidad += 1;
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.cantidad - a.cantidad ||
        a.nombre.localeCompare(b.nombre, 'es')
    );
  }, [visitas]);

  const resumenPersonas = useMemo(() => {
    const mapa = new Map();

    visitas.forEach((visita) => {
      const persona = String(
        visita.personaVisitableNombre ||
        'Sin persona identificada'
      ).trim();

      const visitante = [
        visita.visitanteNombre,
        visita.visitanteApellido
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Sin visitante identificado';

      const clave =
        `${persona.toLocaleLowerCase('es')}|` +
        visitante.toLocaleLowerCase('es');

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          persona,
          visitante,
          cantidad: 0
        });
      }

      mapa.get(clave).cantidad += 1;
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.cantidad - a.cantidad ||
        a.persona.localeCompare(b.persona, 'es') ||
        a.visitante.localeCompare(b.visitante, 'es')
    );
  }, [visitas]);

  const aplicarPeriodo = (desde, hasta, periodo) => {
    setErrorFiltro('');
    setFechaDesdeSeleccionada(desde);
    setFechaHastaSeleccionada(hasta);
    setFechaDesdeAplicada(desde);
    setFechaHastaAplicada(hasta);
    setPeriodoActivo(periodo);
  };

  const aplicarRango = () => {
    if (
      !fechaDesdeSeleccionada &&
      !fechaHastaSeleccionada
    ) {
      setErrorFiltro(
        'Seleccione al menos una fecha para realizar la búsqueda.'
      );
      return;
    }

    if (
      fechaDesdeSeleccionada &&
      fechaHastaSeleccionada &&
      fechaDesdeSeleccionada > fechaHastaSeleccionada
    ) {
      setErrorFiltro(
        'La fecha inicial no puede ser posterior a la fecha final.'
      );
      return;
    }

    setErrorFiltro('');
    setPeriodoActivo('personalizado');
    setFechaDesdeAplicada(fechaDesdeSeleccionada);
    setFechaHastaAplicada(fechaHastaSeleccionada);
  };

  const filtrarHoy = () => {
    const hoy = fechaInput(new Date());
    aplicarPeriodo(hoy, hoy, 'hoy');
  };

  const filtrarSemana = () => {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - 6);

    aplicarPeriodo(
      fechaInput(desde),
      fechaInput(hoy),
      'semana'
    );
  };

  const filtrarMes = () => {
    const hoy = new Date();
    const primero = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      1
    );

    aplicarPeriodo(
      fechaInput(primero),
      fechaInput(hoy),
      'mes'
    );
  };

  const mostrarTodo = () => {
    aplicarPeriodo('', '', 'todas');
  };

  const limpiarFiltros = () => {
    setUsuarioFiltro('');
    aplicarPeriodo('', '', 'todas');
  };

  const siguientePagina = () => {
    if (!cargando && !exportando && hayMas && cursores[pagina]) {
      cargarVisitas(pagina + 1, cursores[pagina]);
    }
  };

  const anteriorPagina = () => {
    if (!cargando && !exportando && pagina > 1) {
      cargarVisitas(
        pagina - 1,
        cursores[pagina - 2] || null
      );
    }
  };

  const actualizar = () => {
    setCursores([null]);
    cargarVisitas(1, null);
  };

  const crearArchivoXLSX = (registros, tipo) => {
    const datos = registros.map((visita) => ({
      Fecha: fechaLegible(visita.fecha),
      Visitante: [
        visita.visitanteNombre,
        visita.visitanteApellido
      ]
        .filter(Boolean)
        .join(' '),
      Cédula: visita.visitanteCedula || '',
      Empresa: obtenerNombreEmpresa(visita),
      'Persona visitada':
        visita.personaVisitableNombre || '',
      Motivo: visita.motivo || '',
      Origen: visita.origen || 'web',
      'Registrado por':
        obtenerNombreRegistrador(visita)
    }));

    const hoja = utils.json_to_sheet(datos);

    hoja['!cols'] = [
      { wch: 22 },
      { wch: 35 },
      { wch: 18 },
      { wch: 28 },
      { wch: 35 },
      { wch: 30 },
      { wch: 14 },
      { wch: 32 }
    ];

    hoja['!autofilter'] = {
      ref: `A1:H${datos.length + 1}`
    };

    const libro = utils.book_new();
    utils.book_append_sheet(libro, hoja, 'Historial');

    const fechaArchivo = fechaInput(new Date());

    const empresaArchivo = String(
      empresaId || 'empresa'
    ).replace(/[^a-zA-Z0-9-_]+/g, '-');

    const nombreArchivo =
      `historial_visitas_${empresaArchivo}_${tipo}_${fechaArchivo}.xlsx`;

    writeFileXLSX(libro, nombreArchivo);
  };

  const exportarPaginaXLSX = () => {
    if (cargando || exportando || visitas.length === 0) {
      return;
    }

    setErrorExportacion('');
    setExportandoPagina(true);

    try {
      crearArchivoXLSX(visitas, `pagina_${pagina}`);
    } catch (err) {
      console.error('Error exportando página:', err);
      setErrorExportacion(
        err.message || 'No fue posible exportar la página actual.'
      );
    } finally {
      setExportandoPagina(false);
    }
  };

  const exportarPeriodoXLSX = async () => {
    if (
      cargando ||
      exportando ||
      visitas.length === 0 ||
      !empresaId ||
      (esOperador && !uidActual)
    ) {
      return;
    }

    setErrorExportacion('');
    setExportandoPeriodo(true);

    // Se captura el filtro aplicado en el momento del clic.
    const filtrosExportacion = { ...filtrosAplicados };

    try {
      const registros = await obtenerVisitasParaExportar(
        filtrosExportacion,
        MAXIMO_EXPORTACION
      );

      if (registros.length === 0) {
        setErrorExportacion(
          'No se encontraron visitas para exportar.'
        );
        return;
      }

      crearArchivoXLSX(registros, 'periodo_completo');
    } catch (err) {
      console.error('Error exportando período:', err);
      setErrorExportacion(
        err.message ||
        'No fue posible exportar el período seleccionado.'
      );
    } finally {
      setExportandoPeriodo(false);
    }
  };

  const nombreEmpresa =
    perfil?.empresaNombre ||
    perfil?.empresaId ||
    'Sin empresa asignada';

  const textoPeriodo = {
    hoy: 'Visitas de hoy',
    semana: 'Visitas de los últimos 7 días',
    mes: 'Visitas de este mes',
    todas: 'Todo el historial',
    personalizado: 'Rango de fechas personalizado'
  }[periodoActivo];

  const primerRegistro = visitas.length
    ? (pagina - 1) * TAMANO_PAGINA + 1
    : 0;

  const ultimoRegistro = visitas.length
    ? primerRegistro + visitas.length - 1
    : 0;

  const botonPeriodo = (clave, texto, accion) => (
    <button
      key={clave}
      type="button"
      onClick={accion}
      disabled={cargando || exportando}
      className={
        'hv-boton-periodo' +
        (periodoActivo === clave ? ' activo' : '')
      }
      aria-pressed={periodoActivo === clave}
    >
      {texto}
    </button>
  );

  return (
    <div className="historial-visitas">
      <div className="historial-cabecera">
        <div>
          <h1>
            {vistaHistorial === 'empresas'
              ? 'Empresas representadas'
              : vistaHistorial === 'personas'
                ? 'Personas visitadas'
                : 'Historial de visitas'}
          </h1>

          <p>
            Empresa: <strong>{nombreEmpresa}</strong>
          </p>

          {esOperador && (
            <p>
              Mostrando únicamente los registros
              realizados por tu usuario.
            </p>
          )}
        </div>

        <div className="historial-botones">
          <button
            type="button"
            className="hv-boton hv-boton-primario"
            onClick={actualizar}
            disabled={cargando || exportando}
          >
            {cargando ? 'Actualizando...' : 'Actualizar'}
          </button>

          <button
            type="button"
            className="hv-boton hv-boton-exportar"
            onClick={exportarPaginaXLSX}
            disabled={
              cargando ||
              exportando ||
              visitas.length === 0
            }
          >
            {exportandoPagina
              ? 'Exportando página...'
              : 'Exportar página XLSX'}
          </button>

          <button
            type="button"
            className="hv-boton hv-boton-exportar"
            onClick={exportarPeriodoXLSX}
            disabled={
              cargando ||
              exportando ||
              visitas.length === 0
            }
            title="Exporta todas las visitas del filtro aplicado, hasta 10.000 registros"
          >
            {exportandoPeriodo
              ? 'Exportando período...'
              : 'Exportar período XLSX'}
          </button>
        </div>
      </div>

      <section className="hv-filtros">
        <h2 className="hv-titulo-filtros">
          Buscar visitas
        </h2>

        {esAdminEmpresa && (
          <div className="hv-filtro-usuario">
            <label
              htmlFor="filtro-usuario-historial"
              className="hv-etiqueta"
            >
              Usuario que registró
            </label>

            <select
              id="filtro-usuario-historial"
              className="hv-campo"
              value={usuarioFiltro}
              disabled={exportando}
              onChange={(event) =>
                setUsuarioFiltro(event.target.value)
              }
            >
              <option value="">
                Todos los usuarios
              </option>

              {opcionesUsuarios.map((usuario) => (
                <option
                  key={usuario.uid}
                  value={usuario.uid}
                >
                  {usuario.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="hv-panel-fechas">
          <h3 className="hv-titulo-fechas">
            📅 Buscar por fechas específicas
          </h3>

          <div className="hv-grid-fechas">
            <div>
              <label
                htmlFor="fecha-desde-historial"
                className="hv-etiqueta"
              >
                Desde
              </label>

              <input
                id="fecha-desde-historial"
                className="hv-campo"
                type="date"
                value={fechaDesdeSeleccionada}
                disabled={exportando}
                onChange={(event) => {
                  setFechaDesdeSeleccionada(
                    event.target.value
                  );
                  setErrorFiltro('');
                }}
              />
            </div>

            <div>
              <label
                htmlFor="fecha-hasta-historial"
                className="hv-etiqueta"
              >
                Hasta
              </label>

              <input
                id="fecha-hasta-historial"
                className="hv-campo"
                type="date"
                value={fechaHastaSeleccionada}
                disabled={exportando}
                onChange={(event) => {
                  setFechaHastaSeleccionada(
                    event.target.value
                  );
                  setErrorFiltro('');
                }}
              />
            </div>
          </div>

          {errorFiltro && (
            <p
              role="alert"
              className="hv-error-filtro"
            >
              {errorFiltro}
            </p>
          )}

          <button
            type="button"
            className="hv-boton hv-boton-primario hv-buscar-fechas"
            onClick={aplicarRango}
            disabled={cargando || exportando}
          >
            Buscar entre estas fechas
          </button>
        </div>

        <div className="hv-periodos">
          <h3 className="hv-titulo-periodos">
            O selecciona un período rápido
          </h3>

          <div className="hv-grupo-periodos">
            {botonPeriodo('hoy', 'Hoy', filtrarHoy)}
            {botonPeriodo(
              'semana',
              'Últimos 7 días',
              filtrarSemana
            )}
            {botonPeriodo(
              'mes',
              'Este mes',
              filtrarMes
            )}
            {botonPeriodo(
              'todas',
              'Todas',
              mostrarTodo
            )}
          </div>
        </div>

        <div className="hv-resultados">
          <div>
            <strong className="hv-resultados-titulo">
              Resultados de la búsqueda
            </strong>

            <p className="hv-resultados-periodo">
              {textoPeriodo}
            </p>
          </div>

          <div className="hv-resultados-acciones">
            <span className="hv-contador">
              {cargando
                ? 'Consultando...'
                : `${visitas.length} en esta página`}
            </span>

            <button
              type="button"
              className="hv-boton hv-boton-secundario"
              onClick={limpiarFiltros}
              disabled={cargando || exportando}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </section>

      {errorExportacion && (
        <div
          role="alert"
          className="dashboard-estado dashboard-error"
        >
          <p>{errorExportacion}</p>
          <button
            type="button"
            onClick={() => setErrorExportacion('')}
          >
            Cerrar mensaje
          </button>
        </div>
      )}

      {error && (
        <div
          className="dashboard-estado dashboard-error"
          role="alert"
        >
          <h2>No se pudo cargar el historial</h2>
          <p>{error}</p>

          <button
            type="button"
            onClick={actualizar}
            disabled={exportando}
          >
            Reintentar
          </button>
        </div>
      )}

      {cargando && (
        <div
          className="dashboard-estado"
          role="status"
        >
          Cargando visitas...
        </div>
      )}

      {!cargando && !error && (
        <>
          {vistaHistorial === 'empresas' ? (
            resumenEmpresas.length === 0 ? (
              <div className="dashboard-sin-datos">
                No hay empresas para el filtro seleccionado.
              </div>
            ) : (
              <div className="tabla-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Cantidad de visitas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenEmpresas.map((empresa) => (
                      <tr key={empresa.nombre}>
                        <td>
                          <strong>{empresa.nombre}</strong>
                        </td>
                        <td>{empresa.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : vistaHistorial === 'personas' ? (
            resumenPersonas.length === 0 ? (
              <div className="dashboard-sin-datos">
                No hay personas visitadas para el filtro seleccionado.
              </div>
            ) : (
              <div className="tabla-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Persona visitada</th>
                      <th>Visitante</th>
                      <th>Cantidad de visitas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPersonas.map((item) => (
                      <tr
                        key={`${item.persona}-${item.visitante}`}
                      >
                        <td>
                          <strong>{item.persona}</strong>
                        </td>
                        <td>{item.visitante}</td>
                        <td>{item.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : visitas.length === 0 ? (
            <div className="dashboard-sin-datos">
              No hay visitas registradas para el filtro seleccionado.
            </div>
          ) : (
            <div className="tabla-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Visitante</th>
                    <th>Cédula</th>
                    <th>Empresa</th>
                    <th>Persona visitada</th>
                    <th>Motivo</th>
                    <th>Origen</th>
                    {esAdminEmpresa && (
                      <th>Registrado por</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visitas.map((visita) => {
                    const nombreVisitante = [
                      visita.visitanteNombre,
                      visita.visitanteApellido
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <tr key={visita.id}>
                        <td>{fechaLegible(visita.fecha)}</td>
                        <td>
                          {nombreVisitante || 'Sin nombre'}
                        </td>
                        <td>
                          {visita.visitanteCedula || ''}
                        </td>
                        <td>
                          {obtenerNombreEmpresa(visita)}
                        </td>
                        <td>
                          {visita.personaVisitableNombre || ''}
                        </td>
                        <td>{visita.motivo || ''}</td>
                        <td>{visita.origen || 'web'}</td>
                        {esAdminEmpresa && (
                          <td>
                            {obtenerNombreRegistrador(visita)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <nav
            className="hv-paginacion"
            aria-label="Paginación del historial"
          >
            <button
              type="button"
              className="hv-boton hv-boton-secundario"
              onClick={anteriorPagina}
              disabled={
                cargando ||
                exportando ||
                pagina === 1
              }
            >
              Anterior
            </button>

            <span className="hv-paginacion-texto">
              Página {pagina}
              {' · '}
              Mostrando {primerRegistro}–{ultimoRegistro}
              {' · '}
              Máximo {TAMANO_PAGINA} visitas por página
            </span>

            <button
              type="button"
              className="hv-boton hv-boton-secundario"
              onClick={siguientePagina}
              disabled={
                cargando ||
                exportando ||
                !hayMas
              }
            >
              Siguiente
            </button>
          </nav>

          {vistaHistorial !== 'total' && (
            <p className="hv-nota-paginacion">
              Los resúmenes de empresas y personas
              corresponden únicamente a las visitas
              de la página actual, no al total histórico.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default HistorialVisitas;
