
import {
  createContext,
  useEffect,
  useState
} from 'react';

import {
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

import {
  doc,
  onSnapshot
} from 'firebase/firestore';

import {
  auth,
  db
} from '../services/firebase';

export const AuthContext = createContext(null);

const CLAVE_BLOQUEO =
  'controlVisitasMotivoBloqueo';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');

  useEffect(() => {
    let montado = true;
    let generacion = 0;

    let unsubscribeUsuario = null;
    let unsubscribeEmpresa = null;

    const detenerListeners = () => {
      if (unsubscribeUsuario) {
        unsubscribeUsuario();
        unsubscribeUsuario = null;
      }

      if (unsubscribeEmpresa) {
        unsubscribeEmpresa();
        unsubscribeEmpresa = null;
      }
    };

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (usuarioFirebase) => {
        const actual = ++generacion;

        const vigente = () =>
          montado && actual === generacion;

        detenerListeners();

        setLoading(true);
        setPerfil(null);
        setErrorPerfil('');
        setUser(usuarioFirebase);

        if (!usuarioFirebase) {
          setLoading(false);
          return;
        }

        const uid = usuarioFirebase.uid;

        let perfilActual = null;
        let usuarioVerificado = false;
        let empresaVerificada = false;
        let empresaActualId = null;

        let revocada = false;
        let bloqueoTemporal = '';

        /*
         * Cierre definitivo de la sesión.
         *
         * Se utiliza solamente cuando existe
         * una desactivación confirmada o una
         * revocación de autorización.
         */
        const revocarSesion = async (motivo) => {
          if (!vigente() || revocada) return;

          revocada = true;

          sessionStorage.setItem(
            CLAVE_BLOQUEO,
            motivo
          );

          setPerfil(null);
          setErrorPerfil(motivo);
          setLoading(false);

          detenerListeners();

          console.warn(
            '[SESION] Revocación:',
            motivo
          );

          try {
            await signOut(auth);
          } catch (error) {
            console.error(
              '[SESION] Error al cerrar sesión:',
              error
            );

            if (vigente()) {
              setErrorPerfil(
                'No se pudo completar el cierre de sesión.'
              );
            }
          }
        };

        /*
         * Bloqueo temporal.
         *
         * Un problema de conexión no debe
         * confundirse con una desactivación.
         */
        const bloquearTemporalmente = (mensaje) => {
          if (!vigente() || revocada) return;

          bloqueoTemporal = mensaje;

          setPerfil(null);
          setErrorPerfil(mensaje);
          setLoading(false);
        };

        const comprobarAcceso = () => {
          if (!vigente() || revocada) return;

          if (bloqueoTemporal) {
            setPerfil(null);
            setErrorPerfil(bloqueoTemporal);
            setLoading(false);
            return;
          }

          if (!usuarioVerificado || !perfilActual) {
            setPerfil(null);
            setLoading(true);
            return;
          }

          if (perfilActual.estado === 'pendiente') {
            setPerfil(perfilActual);
            setErrorPerfil('');
            setLoading(false);
            return;
          }

          if (perfilActual.estado !== 'activo') {
            void revocarSesion('usuario');
            return;
          }

          if (
            ![
              'superadmin',
              'admin_empresa',
              'operador'
            ].includes(perfilActual.rol)
          ) {
            void revocarSesion('autorizacion');
            return;
          }

          if (perfilActual.rol !== 'superadmin') {
            if (!empresaActualId) {
              void revocarSesion('autorizacion');
              return;
            }

            if (!empresaVerificada) {
              setPerfil(null);
              setLoading(true);
              return;
            }
          }

          setPerfil(perfilActual);
          setErrorPerfil('');
          setLoading(false);
        };

        const escucharEmpresa = (empresaId) => {
          if (unsubscribeEmpresa) {
            unsubscribeEmpresa();
            unsubscribeEmpresa = null;
          }

          empresaActualId = empresaId;
          empresaVerificada = false;

          if (!empresaId) {
            void revocarSesion('autorizacion');
            return;
          }

          const referencia = doc(
            db,
            'empresas',
            empresaId
          );

          unsubscribeEmpresa = onSnapshot(
            referencia,
            { includeMetadataChanges: true },

            (snapshot) => {
              if (!vigente() || revocada) return;

              if (snapshot.metadata.fromCache) {
                empresaVerificada = false;

                bloquearTemporalmente(
                  'No se pudo confirmar el estado actual de la empresa.'
                );

                return;
              }

              if (
                !snapshot.exists() ||
                snapshot.data().activa !== true
              ) {
                void revocarSesion('empresa');
                return;
              }

              bloqueoTemporal = '';
              empresaVerificada = true;

              comprobarAcceso();
            },

            (error) => {
              if (!vigente() || revocada) return;

              empresaVerificada = false;

              if (error.code === 'permission-denied') {
                void revocarSesion('autorizacion');
                return;
              }

              bloquearTemporalmente(
                'No se pudo verificar el estado de la empresa.'
              );
            }
          );
        };

        const referenciaUsuario = doc(
          db,
          'usuarios',
          uid
        );

        unsubscribeUsuario = onSnapshot(
          referenciaUsuario,
          { includeMetadataChanges: true },

          (snapshot) => {
            if (!vigente() || revocada) return;

            if (snapshot.metadata.fromCache) {
              usuarioVerificado = false;

              bloquearTemporalmente(
                'No se pudo confirmar el estado actual del usuario.'
              );

              return;
            }

            if (!snapshot.exists()) {
              void revocarSesion('autorizacion');
              return;
            }

            const nuevoPerfil = {
              uid: snapshot.id,
              ...snapshot.data()
            };

            const nuevoEmpresaId =
              nuevoPerfil.rol === 'superadmin'
                ? null
                : String(
                    nuevoPerfil.empresaId || ''
                  ).trim();

            const empresaCambio =
              nuevoEmpresaId !== empresaActualId;

            perfilActual = nuevoPerfil;
            usuarioVerificado = true;

            bloqueoTemporal = '';

            if (
              nuevoPerfil.estado !== 'activo' &&
              nuevoPerfil.estado !== 'pendiente'
            ) {
              void revocarSesion('usuario');
              return;
            }

            if (
              nuevoPerfil.estado === 'pendiente' ||
              nuevoPerfil.rol === 'superadmin'
            ) {
              if (unsubscribeEmpresa) {
                unsubscribeEmpresa();
                unsubscribeEmpresa = null;
              }

              empresaActualId = null;
              empresaVerificada = false;

              comprobarAcceso();
              return;
            }

            if (
              nuevoPerfil.rol !== 'admin_empresa' &&
              nuevoPerfil.rol !== 'operador'
            ) {
              void revocarSesion('autorizacion');
              return;
            }

            if (empresaCambio || !unsubscribeEmpresa) {
              escucharEmpresa(nuevoEmpresaId);
            }

            comprobarAcceso();
          },

          (error) => {
            if (!vigente() || revocada) return;

            usuarioVerificado = false;

            if (error.code === 'permission-denied') {
              void revocarSesion('autorizacion');
              return;
            }

            bloquearTemporalmente(
              'No se pudo verificar el estado del usuario.'
            );
          }
        );
      }
    );

    return () => {
      montado = false;
      generacion++;

      detenerListeners();
      unsubscribeAuth();
    };
  }, []);

  const value = {
    user,
    perfil,
    loading,
    errorPerfil,

    autenticado: Boolean(user),
    activo: perfil?.estado === 'activo',
    rol: perfil?.rol || null,
    empresaId: perfil?.empresaId || null
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
