import {

  useCallback,

  useEffect,

  useMemo,

  useState

} from 'react';





import { useLocation } from 'react-router-dom';







import {

  utils,

  writeFileXLSX

} from 'xlsx';



import { useAuth } from '../../hooks/useAuth';

import { obtenerVisitasPaginadas, obtenerVisitasParaExportar } from '../../services/visitas';

import { listarUsuarios } from '../../services/usuarios';



const FILTRO_SIN_USUARIO =

  '__sin_usuario__';



function HistorialVisitas() {



  const location = useLocation();



  const vistaHistorial =

    location.state?.vista || 'total';





  const {

    user,

    perfil

  } = useAuth();



  const [visitas, setVisitas] =

    useState([]);


    const [pagina, setPagina] = useState(1);

    const [cursores, setCursores] = useState([null]);

    const [hayMas, setHayMas] = useState(false);

    const [exportacionCompleta, setExportacionCompleta] =
      useState(false);


  const [usuariosEmpresa, setUsuariosEmpresa] =

    useState([]);



  const [usuarioFiltro, setUsuarioFiltro] =

    useState('');





const [

  fechaDesdeSeleccionada,

  setFechaDesdeSeleccionada

] = useState('');



const [

  fechaHastaSeleccionada,

  setFechaHastaSeleccionada

] = useState('');



const [

  fechaDesdeAplicada,

  setFechaDesdeAplicada

] = useState('');



const [

  fechaHastaAplicada,

  setFechaHastaAplicada

] = useState('');







  const [cargando, setCargando] =

    useState(true);



  const [exportando, setExportando] =

    useState(false);



  const [error, setError] =

    useState('');



  const esAdminEmpresa =

    perfil?.rol === 'admin_empresa';



  const esOperador =

    perfil?.rol === 'operador';



  const uidActual =

    String(

      perfil?.uid ||

      user?.uid ||

      ''

    ).trim();



  const empresaId = String(perfil?.empresaId || '').trim();
  const uidFiltro = esOperador ? uidActual : usuarioFiltro === FILTRO_SIN_USUARIO ? '' : usuarioFiltro;
  const cargarVisitas = useCallback(async (numeroPagina = 1, cursor = null) => {
    if (!empresaId || (esOperador && !uidActual)) {
      setError('No se pudo identificar la empresa o el usuario conectado.');
      setCargando(false);
      return;
    }
    try {
      setCargando(true);
      setError('');
  const promesaVisitas = obtenerVisitasPaginadas({
  empresaId,
  creadoPorUid: uidFiltro,
  fechaDesde: fechaDesdeAplicada,
  fechaHasta: fechaHastaAplicada,
  cursor,
  tamanoPagina: 5 // SOLO PARA PRUEBAS
});
      const promesaUsuarios = esAdminEmpresa && usuariosEmpresa.length === 0
        ? listarUsuarios({ empresaId }) : Promise.resolve(null);
      const [resultado, usuarios] = await Promise.all([promesaVisitas, promesaUsuarios]);
      // Para registros antiguos sin UID, el filtro se aplica en Firestore en una fase posterior.
      setVisitas(resultado.visitas);
      setHayMas(resultado.hayMas);
      setPagina(numeroPagina);
      setCursores(prev => {
        const nuevos = prev.slice(0, numeroPagina);
        nuevos[numeroPagina] = resultado.cursorSiguiente;
        return nuevos;
      });
      if (usuarios) setUsuariosEmpresa(usuarios);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setError(err.message || 'No fue posible cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [empresaId, uidFiltro, esOperador, uidActual, esAdminEmpresa,
      fechaDesdeAplicada, fechaHastaAplicada]);

  useEffect(() => {
    setCursores([null]);
    setPagina(1);
    cargarVisitas(1, null);
  }, [cargarVisitas]);

  const siguientePagina = () => {
    if (hayMas && !cargando) cargarVisitas(pagina + 1, cursores[pagina]);
  };
  const anteriorPagina = () => {
    if (pagina > 1 && !cargando) cargarVisitas(pagina - 1, cursores[pagina - 2] || null);
  };

  const mapaUsuarios =

    useMemo(() => {

      const mapa = {};



      usuariosEmpresa.forEach(

        (usuario) => {

          const nombre = [

            usuario.nombre,

            usuario.apellido

          ]

            .filter(Boolean)

            .join(' ')

            .trim();



          mapa[usuario.uid] =

            nombre ||

            usuario.email ||

            usuario.uid;

        }

      );



      /*

       * Si existe una visita cuyo UID ya no

       * aparece en la lista de usuarios,

       * conservamos igualmente el UID visible.

       */

      visitas.forEach(

        (visita) => {

          const uid =

            String(

              visita.creadoPorUid || ''

            ).trim();



          if (

            uid &&

            !mapa[uid]

          ) {

            mapa[uid] =

              `Usuario ${uid}`;

          }

        }

      );



      return mapa;

    }, [

      usuariosEmpresa,

      visitas

    ]);



  const opcionesUsuarios = useMemo(() => Object.entries(mapaUsuarios)
    .map(([uid, nombre]) => ({ uid, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [mapaUsuarios]);

const convertirFecha = (fecha) => {

  if (!fecha) {

    return null;

  }



  if (

    typeof fecha.toDate ===

    'function'

  ) {

    return fecha.toDate();

  }



  if (fecha.seconds) {

    return new Date(

      fecha.seconds * 1000

    );

  }



  const resultado =

    new Date(fecha);



  return Number.isNaN(

    resultado.getTime()

  )

    ? null

    : resultado;

};



const crearFechaLocal = (

  valor,

  finDelDia = false

) => {

  if (!valor) {

    return null;

  }



  const [

    anio,

    mes,

    dia

  ] = valor

    .split('-')

    .map(Number);



  if (finDelDia) {

    return new Date(

      anio,

      mes - 1,

      dia,

      23,

      59,

      59,

      999

    );

  }



  return new Date(

    anio,

    mes - 1,

    dia,

    0,

    0,

    0,

    0

  );

};





const visitasMostradas = useMemo(() => {
  if (esAdminEmpresa && usuarioFiltro === FILTRO_SIN_USUARIO) {
    return visitas.filter(v => !String(v.creadoPorUid || '').trim());
  }
  return visitas;
}, [visitas, esAdminEmpresa, usuarioFiltro]);

const resumenEmpresas = useMemo(() => {

  const mapa = new Map();



  visitasMostradas.forEach((visita) => {

    const nombre =

      String(

        visita.empresaNombre ||

        visita.empresa ||

        'Sin empresa'

      ).trim();



    const clave =

      nombre.toLocaleLowerCase('es');



    if (!mapa.has(clave)) {

      mapa.set(clave, {

        nombre,

        cantidad: 0

      });

    }



    mapa.get(clave).cantidad += 1;

  });



  return Array.from(mapa.values())

    .sort((a, b) =>

      b.cantidad - a.cantidad ||

      a.nombre.localeCompare(

        b.nombre,

        'es'

      )

    );

}, [visitasMostradas]);





  const resumenPersonas = useMemo(() => {
  const mapa = new Map();
  visitasMostradas.forEach((visita) => {
    const persona = String(visita.personaVisitableNombre || 'Sin persona identificada').trim();
    const visitante = [visita.visitanteNombre, visita.visitanteApellido].filter(Boolean).join(' ').trim() || 'Sin visitante identificado';
    const clave = `${persona.toLocaleLowerCase('es')}|${visitante.toLocaleLowerCase('es')}`;
    if (!mapa.has(clave)) mapa.set(clave, { persona, visitante, cantidad: 0 });
    mapa.get(clave).cantidad += 1;
  });
  return Array.from(mapa.values()).sort((a, b) => b.cantidad - a.cantidad || a.persona.localeCompare(b.persona, 'es') || a.visitante.localeCompare(b.visitante, 'es'));
}, [visitasMostradas]);


  const existeVisitaSinUsuario =

    useMemo(

      () =>

        visitas.some(

          (visita) =>

            !String(

              visita.creadoPorUid || ''

            ).trim()

        ),

      [visitas]

    );





const aplicarRango = () => {

  if (

    fechaDesdeSeleccionada &&

    fechaHastaSeleccionada &&

    fechaDesdeSeleccionada >

      fechaHastaSeleccionada

  ) {

    alert(

      'La fecha inicial no puede ser posterior a la fecha final.'

    );



    return;

  }



  setFechaDesdeAplicada(

    fechaDesdeSeleccionada

  );



  setFechaHastaAplicada(

    fechaHastaSeleccionada

  );

};



const formatearFechaInput = (

  fecha

) => {

  const anio =

    fecha.getFullYear();



  const mes =

    String(

      fecha.getMonth() + 1

    ).padStart(2, '0');



  const dia =

    String(

      fecha.getDate()

    ).padStart(2, '0');



  return `${anio}-${mes}-${dia}`;

};



const filtrarHoy = () => {

  const hoy =

    formatearFechaInput(

      new Date()

    );



  setFechaDesdeSeleccionada(hoy);

  setFechaHastaSeleccionada(hoy);

  setFechaDesdeAplicada(hoy);

  setFechaHastaAplicada(hoy);

};



const filtrarSemana = () => {

  const hoy = new Date();

  const desde = new Date();



  desde.setDate(

    hoy.getDate() - 6

  );



  const desdeTexto =

    formatearFechaInput(desde);



  const hastaTexto =

    formatearFechaInput(hoy);



  setFechaDesdeSeleccionada(

    desdeTexto

  );



  setFechaHastaSeleccionada(

    hastaTexto

  );



  setFechaDesdeAplicada(

    desdeTexto

  );



  setFechaHastaAplicada(

    hastaTexto

  );

};



const filtrarMes = () => {

  const hoy = new Date();



  const primerDia =

    new Date(

      hoy.getFullYear(),

      hoy.getMonth(),

      1

    );



  const desdeTexto =

    formatearFechaInput(

      primerDia

    );



  const hastaTexto =

    formatearFechaInput(hoy);



  setFechaDesdeSeleccionada(

    desdeTexto

  );



  setFechaHastaSeleccionada(

    hastaTexto

  );



  setFechaDesdeAplicada(

    desdeTexto

  );



  setFechaHastaAplicada(

    hastaTexto

  );

};



/*

 * Mostrar todo elimina únicamente

 * el período de fechas.

 * Conserva el usuario seleccionado.

 */

const mostrarTodo = () => {

  setFechaDesdeSeleccionada('');

  setFechaHastaSeleccionada('');

  setFechaDesdeAplicada('');

  setFechaHastaAplicada('');

};



/*

 * Limpiar filtros reinicia todos

 * los filtros del historial.

 */

const limpiarFiltros = () => {

  setFechaDesdeSeleccionada('');

  setFechaHastaSeleccionada('');

  setFechaDesdeAplicada('');

  setFechaHastaAplicada('');

  setUsuarioFiltro('');

};





  const obtenerNombreRegistrador = (

    visita

  ) => {

    const uid =

      String(

        visita.creadoPorUid || ''

      ).trim();



    if (!uid) {

      return 'Sin usuario identificado';

    }



    if (mapaUsuarios[uid]) {

      return mapaUsuarios[uid];

    }



    if (

      uid === uidActual

    ) {

      const nombre = [

        perfil?.nombre,

        perfil?.apellido

      ]

        .filter(Boolean)

        .join(' ')

        .trim();



      return (

        nombre ||

        user?.email ||

        'Usuario actual'

      );

    }



    return uid;

  };



  const formatearFecha = (fecha) => {

    if (!fecha) {

      return '';

    }



    if (

      typeof fecha.toDate ===

      'function'

    ) {

      return fecha

        .toDate()

        .toLocaleString(

          'es-UY'

        );

    }



    if (fecha.seconds) {

      return new Date(

        fecha.seconds * 1000

      ).toLocaleString(

        'es-UY'

      );

    }



    const resultado =

      new Date(fecha);



    if (

      Number.isNaN(

        resultado.getTime()

      )

    ) {

      return '';

    }



    return resultado.toLocaleString(

      'es-UY'

    );

  };



  const obtenerNombreEmpresa = (

    visita

  ) => {

    return (

      visita.empresaNombre ||

      visita.empresa ||

      perfil?.empresaNombre ||

      perfil?.empresaId ||

      ''

    );

  };



  const exportarXLS = async () => {

    if (

      visitasMostradas.length === 0 ||

      exportando

    ) {

      return;

    }



    try {

      setExportando(true);



      await new Promise((resolve) =>

        setTimeout(resolve, 50)

      );



      const datosExcel =

        visitasMostradas.map((visita) => ({

          Fecha:

            formatearFecha(

              visita.fecha

            ),



          Visitante: [

            visita.visitanteNombre,

            visita.visitanteApellido

          ]

            .filter(Boolean)

            .join(' '),



          Cédula:

            visita.visitanteCedula ||

            '',



          Empresa:

            obtenerNombreEmpresa(

              visita

            ),



          'Persona visitada':

            visita

              .personaVisitableNombre ||

            '',



          Motivo:

            visita.motivo || '',



          Origen:

            visita.origen || 'web',



          'Registrado por':

            obtenerNombreRegistrador(

              visita

            )

        }));



      const hoja =

        utils.json_to_sheet(

          datosExcel

        );



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

        ref:

          `A1:H${

            datosExcel.length + 1

          }`

      };



      const libro =

        utils.book_new();



      utils.book_append_sheet(

        libro,

        hoja,

        'Historial'

      );



      const fechaArchivo =

        new Date()

          .toISOString()

          .slice(0, 10);



      const empresaArchivo =

        String(

          perfil?.empresaId ||

          'empresa'

        )

          .trim()

          .replace(

            /[^a-zA-Z0-9-_]+/g,

            '-'

          );



      writeFileXLSX(

        libro,

        `historial_visitas_${empresaArchivo}_${fechaArchivo}.xlsx`

      );

    } catch (err) {

      console.error(

        'Error exportando historial:',

        err

      );



      alert(

        'No fue posible exportar el historial.'

      );

    } finally {

      setExportando(false);

    }

  };



  const nombreEmpresa =

    perfil?.empresaNombre ||

    perfil?.empresaId ||

    'Sin empresa asignada';



  if (cargando) {

    return (

      <div className="dashboard-estado">

        Cargando historial...

      </div>

    );

  }



  if (error) {

    return (

      <div className="dashboard-estado dashboard-error">

        <h2>

          No se pudo cargar el historial

        </h2>



        <p>

          {error}

        </p>

      </div>

    );

  }



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
            Empresa:{' '}
            <strong>{nombreEmpresa}</strong>
          </p>

          {esOperador && (

            <p>

              Mostrando únicamente los registros

              realizados por tu usuario.

            </p>

          )}

        </div>



        <div className="botones historial-botones">

          <button

            type="button"

            className="boton-actualizar-historial"

            onClick={() => { setCursores([null]); cargarVisitas(1, null); }}

            disabled={cargando || exportando}

          >

            {cargando

              ? 'Actualizando...'

              : 'Actualizar'}

          </button>



          <button

            type="button"

            className={

              exportando

                ? 'boton-exportar boton-exportando'

                : 'boton-exportar'

            }

            onClick={exportarXLS}

            disabled={

              visitasMostradas.length === 0 ||

              exportando ||

              cargando

            }

          >

            {exportando

              ? 'Exportando...'

              : exportacionCompleta ? 'Exportar período XLSX' : 'Exportar página XLSX'}

          </button>

        </div>

      </div>



      {esAdminEmpresa && (

        <section className="dashboard-filtros">

  {esAdminEmpresa && (

    <div className="filtro-fecha">

      <label htmlFor="filtro-usuario-historial">

        Usuario que registró

      </label>



      <select

        id="filtro-usuario-historial"

        value={usuarioFiltro}

        onChange={(event) =>

          setUsuarioFiltro(

            event.target.value

          )

        }

      >

        <option value="">

          Todos los usuarios

        </option>



        {opcionesUsuarios.map(

          (usuario) => (

            <option

              key={usuario.uid}

              value={usuario.uid}

            >

              {usuario.nombre}

            </option>

          )

        )}



        {false && existeVisitaSinUsuario && (

          <option

            value={FILTRO_SIN_USUARIO}

          >

            Sin usuario identificado

          </option>

        )}

      </select>

    </div>

  )}



  <div className="filtro-fecha">

    <label htmlFor="fecha-desde-historial">

      Fecha inicial

    </label>



    <input

      id="fecha-desde-historial"

      type="date"

      value={fechaDesdeSeleccionada}

      onChange={(event) =>

        setFechaDesdeSeleccionada(

          event.target.value

        )

      }

    />

  </div>



  <div className="filtro-fecha">

    <label htmlFor="fecha-hasta-historial">

      Fecha final

    </label>



    <input

      id="fecha-hasta-historial"

      type="date"

      value={fechaHastaSeleccionada}

      onChange={(event) =>

        setFechaHastaSeleccionada(

          event.target.value

        )

      }

    />

  </div>



  <div className="filtros-rapidos">

    <button

      type="button"

      onClick={aplicarRango}

    >

      Aplicar rango

    </button>



    <button

      type="button"

      onClick={filtrarHoy}

    >

      Visitas de hoy

    </button>



    <button

      type="button"

      onClick={filtrarSemana}

    >

      Últimos 7 días

    </button>



    <button

      type="button"

      onClick={filtrarMes}

    >

      Mes actual

    </button>



    <button

      type="button"

      onClick={mostrarTodo}

    >

      Mostrar todo

    </button>



    <button

      type="button"

      onClick={limpiarFiltros}

    >

      Limpiar filtros

    </button>

  </div>



  <div className="admin-contador">

    <strong>

      {visitasMostradas.length}

    </strong>



    {' '}



    {visitasMostradas.length === 1

      ? 'visita'

      : 'visitas'}

  </div>

</section>

      )}





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
                    <td><strong>{empresa.nombre}</strong></td>
                    <td>{empresa.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : vistaHistorial === 'personas' ? (
        resumenPersonas.length === 0 ? (
          <div className="dashboard-sin-datos">No hay personas visitadas para el filtro seleccionado.</div>
        ) : (
          <div className="tabla-responsive">
            <table>
              <thead><tr><th>Persona visitada</th><th>Visitante</th><th>Cantidad de visitas</th></tr></thead>
              <tbody>
                {resumenPersonas.map((item) => (
                  <tr key={`${item.persona}-${item.visitante}`}>
                    <td><strong>{item.persona}</strong></td><td>{item.visitante}</td><td>{item.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : visitasMostradas.length === 0 ? (
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
                {esAdminEmpresa && <th>Registrado por</th>}
              </tr>
            </thead>
            <tbody>
              {visitasMostradas.map((visita) => {
                const nombreVisitante = [
                  visita.visitanteNombre,
                  visita.visitanteApellido
                ].filter(Boolean).join(' ');
                return (
                  <tr key={visita.id}>
                    <td>{formatearFecha(visita.fecha)}</td>
                    <td>{nombreVisitante || 'Sin nombre'}</td>
                    <td>{visita.visitanteCedula || ''}</td>
                    <td>{obtenerNombreEmpresa(visita)}</td>
                    <td>{visita.personaVisitableNombre || ''}</td>
                    <td>{visita.motivo || ''}</td>
                    <td>{visita.origen || 'web'}</td>
                    {esAdminEmpresa && (
                      <td>{obtenerNombreRegistrador(visita)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Paginación del historial" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20 }}>
        <button type="button" onClick={anteriorPagina} disabled={cargando || pagina === 1}>Anterior</button>
        <span>Página {pagina} · Hasta 50 visitas por página</span>
        <button type="button" onClick={siguientePagina} disabled={cargando || !hayMas}>Siguiente</button>
      </nav>
      {vistaHistorial !== 'total' && (
        <p style={{ fontSize: 13 }}>Los resúmenes de empresas y personas corresponden solo a la página actual, no al total histórico.</p>
      )}
    </div>

  );

}



export default HistorialVisitas;

