
import {
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';

import {
  useAuth
} from '../../hooks/useAuth';

import {
  logout
} from '../../services/auth';

import AccesoBloqueado from './AccesoBloqueado';

function ProtectedRoute({
  children,
  allowedRoles = []
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    perfil,
    loading,
    errorPerfil
  } = useAuth();

  const handleVolverLogin = async () => {
    try {
      await logout();

      navigate('/login', {
        replace: true
      });
    } catch (error) {
      console.error(
        'Error al cerrar sesión:',
        error
      );
    }
  };

  if (loading) {
    return (
      <div className="dashboard-estado">
        Verificando sesión y permisos...
      </div>
    );
  }

if (!user) {
  const motivoBloqueo = sessionStorage.getItem(
    'controlVisitasMotivoBloqueo'
  );

  return (
    <Navigate
      to={
        motivoBloqueo
          ? '/acceso-bloqueado'
          : '/login'
      }
      replace
    />
  );
}

  if (errorPerfil === 'empresa') {
    return (
      <AccesoBloqueado
        tipo="empresa"
        onVolver={handleVolverLogin}
      />
    );
  }

  if (errorPerfil === 'usuario') {
    return (
      <AccesoBloqueado
        tipo="usuario"
        onVolver={handleVolverLogin}
      />
    );
  }

  if (errorPerfil || !perfil) {
    return (
      <div className="dashboard-estado dashboard-error">
        <h2>Acceso no disponible</h2>

        <p>
          {errorPerfil ||
            'No se pudo verificar la autorización.'}
        </p>

        <button
          type="button"
          onClick={handleVolverLogin}
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  if (perfil.estado === 'pendiente') {
    if (location.pathname === '/pendiente') {
      return children;
    }

    return (
      <Navigate
        to="/pendiente"
        replace
      />
    );
  }

  if (perfil.estado !== 'activo') {
    return (
      <AccesoBloqueado
        tipo="usuario"
        onVolver={handleVolverLogin}
      />
    );
  }

  if (location.pathname === '/pendiente') {
    return (
      <Navigate
        to={
          perfil.rol === 'superadmin'
            ? '/admin'
            : '/dashboard'
        }
        replace
      />
    );
  }

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(perfil.rol)
  ) {
    return (
      <Navigate
        to={
          perfil.rol === 'superadmin'
            ? '/admin'
            : '/dashboard'
        }
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;
