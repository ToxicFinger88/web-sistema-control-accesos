
import fs from 'node:fs';
import path from 'node:path';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  test
} from 'vitest';

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

const PROJECT_ID = 'demo-control-visitas';

let env;

const base = (uid) =>
  env.authenticatedContext(uid).firestore();

const d = (db, collectionName, id) =>
  doc(db, collectionName, id);

const user = (uid, rol, empresaId, estado = 'activo') => ({
  rol,
  empresaId,
  estado
});

const visitable = (empresaId, creadoPorUid) => ({
  empresaId,
  creadoPorUid,
  nombre: 'Ana',
  apellido: 'Prueba',
  estado: 'activo'
});

const visita = (empresaId, creadoPorUid) => ({
  empresaId,
  creadoPorUid,
  nombre: 'Visitante de prueba'
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: fs.readFileSync(
        path.resolve(process.cwd(), 'firestore.rules'),
        'utf8'
      )
    }
  });
});

afterAll(async () => {
  if (env) {
    await env.cleanup();
  }
});

beforeEach(async () => {
  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await Promise.all([
      setDoc(
        d(db, 'empresas', 'empresa-A'),
        { activa: true }
      ),
      setDoc(
        d(db, 'empresas', 'empresa-B'),
        { activa: true }
      ),
      setDoc(
        d(db, 'empresas', 'empresa-C'),
        { activa: false }
      ),

      setDoc(
        d(db, 'usuarios', 'adminA'),
        user('adminA', 'admin_empresa', 'empresa-A')
      ),
      setDoc(
        d(db, 'usuarios', 'adminB'),
        user('adminB', 'admin_empresa', 'empresa-B')
      ),
      setDoc(
        d(db, 'usuarios', 'operA'),
        user('operA', 'operador', 'empresa-A')
      ),
      setDoc(
        d(db, 'usuarios', 'operA2'),
        user('operA2', 'operador', 'empresa-A')
      ),
      setDoc(
        d(db, 'usuarios', 'inactivo'),
        user('inactivo', 'operador', 'empresa-A', 'inactivo')
      ),
      setDoc(
        d(db, 'usuarios', 'operC'),
        user('operC', 'operador', 'empresa-C')
      ),
      setDoc(
        d(db, 'usuarios', 'super'),
        user('super', 'superadmin', null)
      ),

      setDoc(
        d(db, 'personasVisitable', 'personaA'),
        visitable('empresa-A', 'adminA')
      ),
      setDoc(
        d(db, 'personasVisitable', 'personaB'),
        visitable('empresa-B', 'adminB')
      ),

      setDoc(
        d(db, 'visitas', 'visitaA'),
        visita('empresa-A', 'operA')
      ),
      setDoc(
        d(db, 'visitas', 'visitaA2'),
        visita('empresa-A', 'operA2')
      ),
      setDoc(
        d(db, 'visitas', 'visitaB'),
        visita('empresa-B', 'adminB')
      ),

      setDoc(
        d(db, 'lecturasOCR', 'ocrA'),
        {
          empresaId: 'empresa-A',
          texto: 'PRUEBA'
        }
      )
    ]);
  });
});

describe('Reglas Firestore - Control de Visitas', () => {

  test('admin A puede consultar sus visitables, no los de B', async () => {
    const db = base('adminA');

    await assertSucceeds(
      getDoc(d(db, 'personasVisitable', 'personaA'))
    );

    await assertFails(
      getDoc(d(db, 'personasVisitable', 'personaB'))
    );

    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'personasVisitable'),
          where('empresaId', '==', 'empresa-A')
        )
      )
    );

    await assertFails(
      getDocs(collection(db, 'personasVisitable'))
    );
  });

  test('admin A crea y actualiza visitable propio sin cambiar empresa ni autor', async () => {
    const db = base('adminA');

    await assertSucceeds(
      setDoc(
        d(db, 'personasVisitable', 'nuevoA'),
        visitable('empresa-A', 'adminA')
      )
    );

    await assertFails(
      setDoc(
        d(db, 'personasVisitable', 'nuevoB'),
        visitable('empresa-B', 'adminA')
      )
    );

    await assertFails(
      setDoc(
        d(db, 'personasVisitable', 'falsoAutor'),
        visitable('empresa-A', 'operA')
      )
    );

    await assertSucceeds(
      updateDoc(
        d(db, 'personasVisitable', 'personaA'),
        {
          nombre: 'Ana María',
          actualizadoPorUid: 'adminA'
        }
      )
    );

    await assertFails(
      updateDoc(
        d(db, 'personasVisitable', 'personaA'),
        {
          empresaId: 'empresa-B',
          actualizadoPorUid: 'adminA'
        }
      )
    );

    await assertFails(
      updateDoc(
        d(db, 'personasVisitable', 'personaA'),
        {
          creadoPorUid: 'operA',
          actualizadoPorUid: 'adminA'
        }
      )
    );

    await assertFails(
      deleteDoc(d(db, 'personasVisitable', 'personaA'))
    );
  });

  test('operador lee visitables de su empresa, pero no los modifica', async () => {
    const db = base('operA');

    await assertSucceeds(
      getDoc(d(db, 'personasVisitable', 'personaA'))
    );

    await assertFails(
      getDoc(d(db, 'personasVisitable', 'personaB'))
    );

    await assertFails(
      setDoc(
        d(db, 'personasVisitable', 'nuevoOper'),
        visitable('empresa-A', 'operA')
      )
    );

    await assertFails(
      updateDoc(
        d(db, 'personasVisitable', 'personaA'),
        { nombre: 'Cambio' }
      )
    );
  });

  test('operador Android crea visita propia y no suplanta UID o empresa', async () => {
    const db = base('operA');

    await assertSucceeds(
      setDoc(
        d(db, 'visitas', 'nuevaA'),
        visita('empresa-A', 'operA')
      )
    );

    await assertFails(
      setDoc(
        d(db, 'visitas', 'otraEmpresa'),
        visita('empresa-B', 'operA')
      )
    );

    await assertFails(
      setDoc(
        d(db, 'visitas', 'otroUid'),
        visita('empresa-A', 'operA2')
      )
    );
  });

  test('operador solo lee y modifica sus propias visitas', async () => {
    const db = base('operA');

    await assertSucceeds(
      getDoc(d(db, 'visitas', 'visitaA'))
    );

    await assertFails(
      getDoc(d(db, 'visitas', 'visitaA2'))
    );

    await assertFails(
      getDoc(d(db, 'visitas', 'visitaB'))
    );

    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'visitas'),
          where('empresaId', '==', 'empresa-A'),
          where('creadoPorUid', '==', 'operA')
        )
      )
    );

    await assertFails(
      getDocs(
        query(
          collection(db, 'visitas'),
          where('empresaId', '==', 'empresa-A')
        )
      )
    );

    await assertSucceeds(
      updateDoc(
        d(db, 'visitas', 'visitaA'),
        { nombre: 'Actualizado' }
      )
    );

    await assertFails(
      updateDoc(
        d(db, 'visitas', 'visitaA2'),
        { nombre: 'Intrusión' }
      )
    );

    await assertFails(
      updateDoc(
        d(db, 'visitas', 'visitaA'),
        { creadoPorUid: 'operA2' }
      )
    );
  });

  test('administrador de empresa puede leer todas sus visitas pero no las de otra empresa', async () => {
    const db = base('adminA');

    await assertSucceeds(
      getDoc(d(db, 'visitas', 'visitaA'))
    );

    await assertSucceeds(
      getDoc(d(db, 'visitas', 'visitaA2'))
    );

    await assertFails(
      getDoc(d(db, 'visitas', 'visitaB'))
    );

    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'visitas'),
          where('empresaId', '==', 'empresa-A')
        )
      )
    );
  });

  test('usuarios y empresas desactivados no pueden operar', async () => {
    await assertFails(
      getDoc(d(base('inactivo'), 'visitas', 'visitaA'))
    );

    await assertFails(
      setDoc(
        d(base('inactivo'), 'visitas', 'visitaInactiva'),
        visita('empresa-A', 'inactivo')
      )
    );

    await assertFails(
      setDoc(
        d(base('operC'), 'visitas', 'visitaC'),
        visita('empresa-C', 'operC')
      )
    );

    await assertFails(
      getDoc(d(base('operC'), 'empresas', 'empresa-C'))
    );
  });

  test('un usuario desactivado aún puede consultar su propio perfil para mostrar bloqueo', async () => {
    await assertSucceeds(
      getDoc(d(base('inactivo'), 'usuarios', 'inactivo'))
    );

    await assertFails(
      getDoc(d(base('inactivo'), 'usuarios', 'adminA'))
    );
  });

  test('superadmin puede consultar globalmente sin crear visitas con el cliente', async () => {
    const db = base('super');

    await assertSucceeds(
      getDoc(d(db, 'visitas', 'visitaB'))
    );

    await assertSucceeds(
      getDoc(d(db, 'personasVisitable', 'personaA'))
    );

    await assertFails(
      setDoc(
        d(db, 'visitas', 'superNueva'),
        visita('empresa-A', 'super')
      )
    );
  });

  test('lecturasOCR está bloqueada para usuarios autenticados', async () => {
    const db = base('super');

    await assertFails(
      getDoc(d(db, 'lecturasOCR', 'ocrA'))
    );

    await assertFails(
      setDoc(
        d(db, 'lecturasOCR', 'nuevoOCR'),
        { empresaId: 'empresa-A' }
      )
    );
  });

  test('visitante no autenticado no puede leer datos', async () => {
    const db = env.unauthenticatedContext().firestore();

    await assertFails(
      getDoc(d(db, 'visitas', 'visitaA'))
    );

    await assertFails(
      getDoc(d(db, 'personasVisitable', 'personaA'))
    );
  });

});
