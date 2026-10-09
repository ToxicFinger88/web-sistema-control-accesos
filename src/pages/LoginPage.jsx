import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithEmailAndPassword } from '../services/auth';
import { useAuth } from '../hooks/useAuth';

const CLAVE_BLOQUEO = 'controlVisitasMotivoBloqueo';
const MOTIVOS_BLOQUEO = ['usuario', 'empresa', 'autorizacion'];

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [esperandoAcceso, setEsperandoAcceso] = useState(false);
  const intentoRef = useRef(false);
  const { user, perfil, loading, errorPerfil } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (MOTIVOS_BLOQUEO.includes(errorPerfil)) {
      intentoRef.current = false;
      setEnviando(false);
      setEsperandoAcceso(false);
      navigate('/acceso-bloqueado', { replace: true });
      return;
    }

    if (user && perfil && !errorPerfil) {
      // El contexto confirmó la autorización; el bloqueo antiguo
      // no debe impedir el acceso de una cuenta reactivada.
      try {
        sessionStorage.removeItem(CLAVE_BLOQUEO);
      } catch (e) {
        console.warn('No se pudo limpiar el bloqueo anterior:', e);
      }
      intentoRef.current = false;
      setEnviando(false);
      setEsperandoAcceso(false);
      navigate(
        perfil.estado === 'pendiente'
          ? '/pendiente'
          : perfil.rol === 'superadmin'
            ? '/admin'
            : '/dashboard',
        { replace: true }
      );
      return;
    }

    if (errorPerfil && user) {
      intentoRef.current = false;
      setEnviando(false);
      setEsperandoAcceso(false);
      setError('No se pudieron confirmar los permisos. Compruebe la conexión y vuelva a intentarlo.');
    }
  }, [user, perfil, loading, errorPerfil, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (intentoRef.current) return;
    intentoRef.current = true;
    setError('');
    setEnviando(true);
    setEsperandoAcceso(true);

    try {
      // Se limpia únicamente al iniciar un nuevo intento explícito.
      // Si la cuenta sigue desactivada, AuthContext lo registra otra vez.
      sessionStorage.removeItem(CLAVE_BLOQUEO);
    } catch (e) {
      console.warn('No se pudo limpiar el estado anterior:', e);
    }

    try {
      await loginWithEmailAndPassword(email, password);
      // No navegar aquí. Esperar el perfil confirmado por Firestore.
      setEnviando(false);
    } catch (err) {
      console.error('Error de acceso:', err);
      setError('No fue posible iniciar sesión. Verifique sus credenciales.');
      setEnviando(false);
      setEsperandoAcceso(false);
      intentoRef.current = false;
    }
  };

  return (
    <div className="login-container">
      <h1>Control de Visitas</h1>
      <h2>Iniciar sesión</h2>
      {error && <div className="error" role="alert">{error}</div>}
      {esperandoAcceso && !error && (
        <p role="status">Verificando cuenta y permisos...</p>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Correo electrónico</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={esperandoAcceso || enviando}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Contraseña</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={esperandoAcceso || enviando}
            required
          />
        </div>
        <button type="submit" disabled={esperandoAcceso || enviando}>
          {esperandoAcceso || enviando ? 'Verificando acceso...' : 'Acceder'}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
