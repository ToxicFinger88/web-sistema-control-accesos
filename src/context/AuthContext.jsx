import {
  createContext,
  useEffect,
  useState
} from 'react';

import {
  onAuthStateChanged
} from 'firebase/auth';

import {
  auth
} from '../services/firebase';



import {
  obtenerEmpresaActivaPorId,
  obtenerPerfilUsuario
} from '../services/usuarios';



export const AuthContext =
  createContext(null);

export function AuthProvider({
  children
}) {
  const [user, setUser] =
    useState(null);

  const [perfil, setPerfil] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    errorPerfil,
    setErrorPerfil
  ] = useState('');

  useEffect(() => {
    let activo = true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          usuarioFirebase
        ) => {
          if (!activo) {
            return;
          }

          setLoading(true);
          setErrorPerfil('');
          setPerfil(null);

          if (!usuarioFirebase) {
            setUser(null);
            setPerfil(null);
            setLoading(false);

            return;
          }

          try {
            /*
             * Mantenemos inmediatamente
             * el usuario de Authentication.
             */
            setUser(
              usuarioFirebase
            );

            /*
             * Cargamos su perfil una sola
             * vez para toda la aplicación.
             */
     const perfilUsuario =
  await obtenerPerfilUsuario(
    usuarioFirebase.uid
  );

if (!activo) {
  return;
}

/*
 * El superadministrador no depende
 * de ninguna empresa concreta.
 */
if (
  perfilUsuario.rol !== 'superadmin'
) {
  const empresaId =
    String(
      perfilUsuario.empresaId || ''
    ).trim();

  if (!empresaId) {
    throw new Error(
      'El usuario no tiene una empresa asignada.'
    );
  }

  /*
   * Además de comprobar que la empresa
   * existe, esta función rechaza empresas
   * cuyo campo activa sea false.
   */
  await obtenerEmpresaActivaPorId(
    empresaId
  );
}

if (!activo) {
  return;
}

setPerfil(
  perfilUsuario
);
          } catch (error) {
            if (!activo) {
              return;
            }

            console.error(
              'Error obteniendo el perfil del usuario:',
              error
            );

            setPerfil(null);

            setErrorPerfil(
              error.message ||
                'No fue posible cargar el perfil.'
            );
          } finally {
            if (activo) {
              setLoading(false);
            }
          }
        }
      );

    return () => {
      activo = false;
      unsubscribe();
    };
  }, []);

  const value = {
    user,
    perfil,
    loading,
    errorPerfil,

    autenticado:
      Boolean(user),

    activo:
      perfil?.estado ===
      'activo',

    rol:
      perfil?.rol ||
      null,

    empresaId:
      perfil?.empresaId ||
      null
  };

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}
