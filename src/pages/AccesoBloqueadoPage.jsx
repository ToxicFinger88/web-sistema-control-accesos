
import { Navigate, useNavigate } from 'react-router-dom';

import AccesoBloqueado from '../components/auth/AccesoBloqueado';

const CLAVE_BLOQUEO = 'controlVisitasMotivoBloqueo';

function AccesoBloqueadoPage() {
  const navigate = useNavigate();

  const motivo = sessionStorage.getItem(CLAVE_BLOQUEO);

  const handleVolverLogin = () => {
    sessionStorage.removeItem(CLAVE_BLOQUEO);
    navigate('/login', { replace: true });
  };

  if (!motivo) {
    return <Navigate to="/login" replace />;
  }

  if (motivo === 'empresa' || motivo === 'usuario') {
    return (
      <AccesoBloqueado
        tipo={motivo}
        onVolver={handleVolverLogin}
      />
    );
  }

  return (
    <main className="acceso-bloqueado-pagina">
      <section className="acceso-bloqueado-tarjeta">
        <h1>Acceso revocado</h1>

        <p className="acceso-bloqueado-descripcion">
          Su sesión fue cerrada porque ya no tiene
          autorización para acceder al sistema.
        </p>

        <p className="acceso-bloqueado-ayuda">
          Comuníquese con el administrador
          para obtener más información.
        </p>

        <button
          type="button"
          className="acceso-bloqueado-boton"
          onClick={handleVolverLogin}
        >
          Volver al inicio de sesión
        </button>
      </section>
    </main>
  );
}

export default AccesoBloqueadoPage;
