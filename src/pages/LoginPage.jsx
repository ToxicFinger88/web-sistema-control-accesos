import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  loginWithEmailAndPassword,
  logout
} from '../services/auth';

import {
  obtenerPerfilUsuario
} from '../services/usuarios';

function LoginPage() {
  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [error, setError] =
    useState('');

  const [cargando, setCargando] =
    useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setCargando(true);

    try {
      const usuarioFirebase =
        await loginWithEmailAndPassword(
          email,
          password
        );

      const perfil =
        await obtenerPerfilUsuario(
          usuarioFirebase.uid
        );

      if (perfil.estado === 'pendiente') {
        navigate('/pendiente', {
          replace: true
        });

        return;
      }

      if (perfil.estado !== 'activo') {
        await logout();

        setError(
          'La cuenta está inactiva. Comunícate con un administrador.'
        );

        return;
      }

      /*
       * El superadministrador entra
       * exclusivamente al panel global.
       */
      if (perfil.rol === 'superadmin') {
        navigate('/admin', {
          replace: true
        });

        return;
      }

      /*
       * Los usuarios empresariales entran
       * al dashboard de su empresa.
       */
      if (
        perfil.rol === 'admin_empresa' ||
        perfil.rol === 'operador'
      ) {
        if (!perfil.empresaId) {
          await logout();

          setError(
            'La cuenta no tiene una empresa asignada.'
          );

          return;
        }

        navigate('/dashboard', {
          replace: true
        });

        return;
      }

      await logout();

      setError(
        'La cuenta no tiene un rol válido.'
      );
    } catch (err) {
      console.error(
        'Error de acceso:',
        err
      );

      if (
        err.message?.includes(
          'no tiene perfil'
        )
      ) {
        setError(
          'La cuenta existe, pero todavía no tiene un perfil empresarial.'
        );
      } else {
        setError(
          'Correo o contraseña incorrectos.'
        );
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      <h1>
        Control de Visitas
      </h1>

      <h2>
        Iniciar sesión
      </h2>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">
            Correo electrónico
          </label>

          <input
            type="email"
            id="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="password">
            Contraseña
          </label>

          <input
            type="password"
            id="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
        >
          {cargando
            ? 'Verificando acceso...'
            : 'Acceder'}
        </button>
      </form>


    </div>
  );
}

export default LoginPage;
