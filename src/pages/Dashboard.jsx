import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { useAuth } from '../hooks/useAuth';

import { useNavigate } from 'react-router-dom';

import { obtenerVisitasPaginadas, contarVisitas } from '../services/visitas';

function Dashboard() {

const navigate = useNavigate();

  const {
    user,
    perfil
  } = useAuth();

  const [visitas, setVisitas] = useState([]);
  const [totalVisitas, setTotalVisitas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const esOperador =
    perfil?.rol === 'operador';

  const uidActual =
    String(
      perfil?.uid ||
      user?.uid ||
      ''
    ).trim();

  /*
   * Carga de visitas según el rol.
   *
   * operador:
   * - solamente sus propias visitas.
   *
   * admin_empresa:
   * - todas las visitas de su empresa.
   */
  const cargarDatos = useCallback(async () => {
    const empresaId =
      String(
        perfil?.empresaId || ''
      ).trim();

    if (!empresaId) {
      setVisitas([]);

      setError(
        'El usuario no tiene una empresa asignada.'
      );

      setCargando(false);
      return;
    }

    if (
      esOperador &&
      !uidActual
    ) {
      setVisitas([]);

      setError(
        'No se pudo identificar al usuario conectado.'
      );

      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError('');

      const filtros = { empresaId, creadoPorUid: esOperador ? uidActual : '' };
       const [pagina, total] = await Promise.all([
         obtenerVisitasPaginadas(filtros), contarVisitas(filtros)
       ]);
       setVisitas(pagina.visitas);
       setTotalVisitas(total);
    } catch (err) {
      console.error(
        'Error cargando dashboard:',
        err
      );

      setError(
        err.message ||
          'No fue posible cargar el dashboard.'
      );
    } finally {
      setCargando(false);
    }
  }, [
    perfil?.empresaId,
    esOperador,
    uidActual
  ]);

  useEffect(() => {
    cargarDatos();
  }, [
    cargarDatos
  ]);

  /*
   * Empresas distintas representadas
   * dentro de las visitas cargadas.
   *
   * empresaNombre es el campo actual.
   * empresa se conserva por compatibilidad
   * con registros antiguos.
   */
  const empresasRepresentadas =
    useMemo(() => {
      const empresas = new Set();

      visitas.forEach((visita) => {
        const nombreEmpresa =
          String(
            visita.empresaNombre ||
            visita.empresa ||
            ''
          ).trim();

        if (nombreEmpresa) {
          empresas.add(nombreEmpresa);
        }
      });

      return empresas.size;
    }, [
      visitas
    ]);

  /*
   * Personas distintas que fueron visitadas.
   */
  const personasVisitadas =
    useMemo(() => {
      const personas = new Set();

      visitas.forEach((visita) => {
        const persona =
          String(
            visita.personaVisitableNombre ||
            ''
          ).trim();

        if (persona) {
          personas.add(persona);
        }
      });

      return personas.size;
    }, [
      visitas
    ]);

  const nombreEmpresa =
    perfil?.empresaNombre ||
    perfil?.empresaId ||
    'Sin empresa asignada';

  if (cargando) {
    return (
      <div className="dashboard-estado">
        Cargando dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-estado dashboard-error">
        <h2>
          No se pudo cargar el panel
        </h2>

        <p>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard dashboard-mejorado">
      <div className="dashboard-cabecera">
        <div>
          <h1>
            Panel de visitas
          </h1>

          <p>
            Empresa:{' '}
            <strong>
              {nombreEmpresa}
            </strong>
          </p>

          {esOperador && (
            <p>
              Mostrando únicamente tus registros.
            </p>
          )}
        </div>

        <button
          type="button"
          className="boton-actualizar"
          onClick={cargarDatos}
        >
          Actualizar datos
        </button>
      </div>

      <section className="dashboard-indicadores">
  {/* Total de visitas */}
  <article
    className="indicador indicador-clickeable"
    onClick={() =>
      navigate('/visitas', {
        state: {
          vista: 'total'
        }
      })
    }
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        navigate('/visitas', {
          state: {
            vista: 'total'
          }
        });
      }
    }}
  >
    <span>
      Total de visitas
    </span>

    <strong>
      {totalVisitas}
    </strong>
  </article>

  {/* Empresas representadas */}
  <article
    className="indicador indicador-clickeable"
    onClick={() =>
      navigate('/visitas', {
        state: {
          vista: 'empresas'
        }
      })
    }
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        navigate('/visitas', {
          state: {
            vista: 'empresas'
          }
        });
      }
    }}
  >
    <span>
      Empresas representadas (últimas 50)
    </span>

    <strong>
      {empresasRepresentadas}
    </strong>
  </article>

  {/* Personas visitadas */}
  <article
    className="indicador indicador-clickeable"
    onClick={() =>
      navigate('/visitas', {
        state: {
          vista: 'personas'
        }
      })
    }
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        navigate('/visitas', {
          state: {
            vista: 'personas'
          }
        });
      }
    }}
  >
    <span>
      Personas visitadas (últimas 50)
    </span>

    <strong>
      {personasVisitadas}
    </strong>
  </article>
</section>
    </div>
  );
}

export default Dashboard;