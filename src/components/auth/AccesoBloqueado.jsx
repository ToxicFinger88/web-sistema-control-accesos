
import './AccesoBloqueado.css';

function AccesoBloqueado({
  tipo = 'empresa',
  onVolver
}) {
  const esEmpresa = tipo === 'empresa';

  const titulo = esEmpresa
    ? 'Empresa deshabilitada'
    : 'Cuenta deshabilitada';

  const descripcion = esEmpresa
    ? 'El acceso al sistema fue suspendido porque la empresa asignada a su cuenta está deshabilitada.'
    : 'Su cuenta de usuario fue deshabilitada por un administrador y ya no tiene autorización para acceder al sistema.';

  const ayuda = esEmpresa
    ? 'Comuníquese con el administrador para obtener más información.'
    : 'Comuníquese con el administrador para solicitar la revisión de su cuenta.';

  return (
    <main className="acceso-bloqueado-pagina">
      <section className="acceso-bloqueado-tarjeta">

        <div
          className="acceso-bloqueado-icono"
          aria-hidden="true"
        >
          {esEmpresa ? '🏢' : '🔒'}
        </div>

        <h1>{titulo}</h1>

        <p className="acceso-bloqueado-descripcion">
          {descripcion}
        </p>

        <p className="acceso-bloqueado-ayuda">
          {ayuda}
        </p>

        <button
          type="button"
          className="acceso-bloqueado-boton"
          onClick={onVolver}
        >
          Volver al inicio de sesión
        </button>

      </section>
    </main>
  );
}

export default AccesoBloqueado;
