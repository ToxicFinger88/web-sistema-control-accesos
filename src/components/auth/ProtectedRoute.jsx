import {
  Navigate,
  useNavigate
} from 'react-router-dom';

import {
  useAuth
} from '../../hooks/useAuth';

import {
  logout
} from '../../services/auth';

function ProtectedRoute({
  children,
  allowedRoles = []
}) {


  const navigate =
    useNavigate();

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


  const {
    user,
    perfil,
    loading,
    errorPerfil
  } = useAuth();

  /*
   * Esto debería aparecer únicamente
   * durante la carga inicial de la aplicación,
   * no en cada navegación.
   */
  if (loading) {
    return (
      <div className="dashboard-estado">
        Verificando sesión y permisos...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

if (
  errorPerfil ||
  !perfil
) {
  const empresaInactiva =
    errorPerfil ===
    'La empresa asignada está inactiva.';

  return (
    <div className="dashboard-estado dashboard-error">
      <h2>
        {empresaInactiva
          ? 'Empresa deshabilitada'
          : 'No se pudo cargar el perfil'}
      </h2>

      <p>
        {errorPerfil ||
          'El usuario no tiene un perfil registrado.'}
      </p>

      <button
        type="button"
        onClick={handleVolverLogin}
      >
        Volver al inicio
      </button>
    </div>
  );
}

  if (
    perfil.estado ===
    'pendiente'
  ) {
    return (
      <Navigate
        to="/pendiente"
        replace
      />
    );
  }

  if (
    perfil.estado !==
    'activo'
  ) {
    return (
      <div className="dashboard-estado dashboard-error">
        <h2>
          Cuenta deshabilitada
        </h2>

        <p>
          Comunícate con un administrador
          para revisar el estado de tu cuenta.
        </p>
      </div>
    );
  }

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(
      perfil.rol
    )
  ) {
    if (
      perfil.rol ===
      'superadmin'
    ) {
      return (
        <Navigate
          to="/admin"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;
