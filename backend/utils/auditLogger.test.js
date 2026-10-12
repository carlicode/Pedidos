import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  logAuditEntry,
  getAuditLogsForOrder,
  getAuditStats,
  listAuditLogFiles,
  __resetAuditCacheForTests
} from './auditLogger.js';

// auditLogger lee AUDIT_LOGS_DIR / AUDIT_MAX_BYTES / AUDIT_MAX_FILES en cada llamada,
// así que cada test usa su propio directorio temporal y sus propios límites.
let tmpDir;
const originalEnv = {};
const ENV_KEYS = ['AUDIT_LOGS_DIR', 'AUDIT_MAX_BYTES', 'AUDIT_MAX_FILES', 'AUDIT_CACHE_TTL_MS'];
const originalConsoleLog = console.log;

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
  process.env.AUDIT_LOGS_DIR = tmpDir;
  delete process.env.AUDIT_MAX_BYTES;
  delete process.env.AUDIT_MAX_FILES;
  delete process.env.AUDIT_CACHE_TTL_MS; // default: caché de 60 s
  __resetAuditCacheForTests();
  console.log = () => {}; // Silenciar los "✅ [AUDIT]" durante los tests
});

afterEach(() => {
  __resetAuditCacheForTests();
  console.log = originalConsoleLog;
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const CURRENT = () => path.join(tmpDir, 'audit-log.jsonl');
const rotatedFiles = () =>
  fs.readdirSync(tmpDir).filter(f => /^audit-log-.*\.jsonl$/.test(f)).sort();
const readLines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
const order = (id, extra = {}) => ({ ID: id, Operador: 'Test', Cliente: 'ACME', ...extra });

test('1) cada logAuditEntry agrega exactamente una línea JSON válida', async () => {
  await logAuditEntry('crear', order('100'), { operator: 'Ana', ip: '1.1.1.1' });
  assert.equal(readLines(CURRENT()).length, 1);

  await logAuditEntry('EDITAR', order('100', { Cliente: 'Nuevo' }), { operator: 'Ana' }, order('100'));
  const lines = readLines(CURRENT());
  assert.equal(lines.length, 2);

  // Cada línea es JSON válido en una sola línea (sin pretty-print)
  const [crear, editar] = lines.map(l => JSON.parse(l));
  assert.equal(crear.action, 'CREAR');
  assert.equal(crear.orderId, '100');
  assert.equal(crear.operator, 'Ana');
  assert.equal(crear.ip, '1.1.1.1');
  assert.equal(crear.metadata.logFile, 'audit-log.jsonl');

  // EDITAR conserva before + changes (detectChanges)
  assert.equal(editar.action, 'EDITAR');
  assert.equal(editar.before.Cliente, 'ACME');
  assert.deepEqual(editar.changes, { Cliente: { before: 'ACME', after: 'Nuevo' } });
});

test('1b) nunca lanza ni rechaza, aunque los datos sean inválidos', async () => {
  assert.equal(await logAuditEntry('CREAR', null), null);

  const circular = { ID: '1' };
  circular.self = circular;
  assert.equal(await logAuditEntry('CREAR', circular), null);

  // Y la cola sigue funcionando después de un error
  assert.notEqual(await logAuditEntry('CREAR', order('2')), null);
  assert.equal(readLines(CURRENT()).length, 1);
});

test('2) con un audit-log.json legacy de varios MB, la escritura no lo lee', async () => {
  // Legacy de ~8 MB que NO es JSON válido: si se leyera/parseara, el viejo código
  // lo habría copiado a .backup.* y reescrito. Acá debe quedar intacto.
  const legacyPath = path.join(tmpDir, 'audit-log.json');
  fs.writeFileSync(legacyPath, '[' + 'x'.repeat(8 * 1024 * 1024) + '{no-es-json');
  const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(legacyPath)).digest('hex');
  const statBefore = fs.statSync(legacyPath);

  await logAuditEntry('CREAR', order('1')); // Calentamiento (crea directorio/archivo)

  const t0 = process.hrtime.bigint();
  await logAuditEntry('CREAR', order('2'));
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

  assert.ok(elapsedMs < 50, `la escritura tardó ${elapsedMs.toFixed(1)} ms (esperado < 50 ms)`);

  const hashAfter = crypto.createHash('sha256').update(fs.readFileSync(legacyPath)).digest('hex');
  const statAfter = fs.statSync(legacyPath);
  assert.equal(hashAfter, hashBefore, 'el legacy no debe modificarse');
  assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, 'el legacy no debe tocarse');
  assert.equal(
    fs.readdirSync(tmpDir).filter(f => f.includes('.backup.')).length,
    0,
    'no debe crear backups del legacy'
  );
  assert.equal(readLines(CURRENT()).length, 2);
});

test('3) rotación: se crea el rotado y se respeta AUDIT_MAX_FILES', async () => {
  process.env.AUDIT_MAX_BYTES = '50'; // Cada entrada supera 50 bytes: rota en cada escritura siguiente
  process.env.AUDIT_MAX_FILES = '2';

  for (let i = 1; i <= 6; i++) {
    await logAuditEntry('CREAR', order(String(i)));
  }

  // Quedan: archivo actual (orden 6) + los 2 rotados más recientes (órdenes 4 y 5)
  const rotated = rotatedFiles();
  assert.equal(rotated.length, 2, `rotados: ${rotated.join(', ')}`);
  for (const name of rotated) {
    assert.match(name, /^audit-log-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(-\d+)?\.jsonl$/);
  }

  const ids = file => readLines(file).map(l => JSON.parse(l).orderId);
  assert.deepEqual(ids(CURRENT()), ['6']);
  assert.deepEqual(rotated.flatMap(name => ids(path.join(tmpDir, name))).sort(), ['4', '5']);
});

test('3b) rotación con AUDIT_MAX_FILES=0 no conserva rotados', async () => {
  process.env.AUDIT_MAX_BYTES = '50';
  process.env.AUDIT_MAX_FILES = '0';

  for (let i = 1; i <= 3; i++) await logAuditEntry('CREAR', order(String(i)));

  assert.equal(rotatedFiles().length, 0);
  assert.equal(readLines(CURRENT()).length, 1);
});

test('4) 50 escrituras concurrentes -> 50 líneas, ninguna corrupta', async () => {
  const promises = [];
  for (let i = 1; i <= 50; i++) {
    promises.push(logAuditEntry('CREAR', order(String(i)), { operator: `op${i}` }));
  }
  await Promise.all(promises);

  const lines = readLines(CURRENT());
  assert.equal(lines.length, 50);
  const ids = new Set(lines.map(l => JSON.parse(l).orderId)); // JSON.parse lanza si hay línea corrupta
  assert.equal(ids.size, 50);
});

test('4b) 50 escrituras concurrentes durante rotaciones no pierden ni corrompen entradas', async () => {
  process.env.AUDIT_MAX_BYTES = '2000'; // Rota cada ~4 entradas
  process.env.AUDIT_MAX_FILES = '100';

  await Promise.all(
    Array.from({ length: 50 }, (_, i) => logAuditEntry('CREAR', order(String(i + 1))))
  );

  const files = [CURRENT(), ...rotatedFiles().map(f => path.join(tmpDir, f))];
  assert.ok(files.length > 1, 'debería haber rotado');
  const ids = new Set();
  for (const file of files) {
    for (const line of readLines(file)) ids.add(JSON.parse(line).orderId);
  }
  assert.equal(ids.size, 50);
});

test('5) getAuditLogsForOrder encuentra por orderId en actual + rotados y saltea líneas rotas', async () => {
  const entry = (orderId, action, timestamp) =>
    JSON.stringify({ timestamp, action, orderId, operator: 'Test', data: { ID: orderId } });

  // Rotado viejo (con una línea truncada), rotado nuevo y actual (con basura)
  fs.writeFileSync(
    path.join(tmpDir, 'audit-log-2026-10-10T10-00-00-000Z.jsonl'),
    [
      entry('15184', 'CREAR', '2026-10-10T09:00:00.000Z'),
      '{"timestamp":"2026-10-10T09:30:00.000Z","action":"CRE', // truncada
      entry('999', 'CREAR', '2026-10-10T09:45:00.000Z')
    ].join('\n') + '\n'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'audit-log-2026-10-11T10-00-00-000Z.jsonl'),
    entry('15184', 'EDITAR', '2026-10-11T09:00:00.000Z') + '\n'
  );
  fs.writeFileSync(
    CURRENT(),
    [
      'esto no es json',
      '',
      entry('151', 'CREAR', '2026-10-12T08:00:00.000Z'), // contiene "151" pero no es 15184
      entry('15184', 'EDITAR', '2026-10-12T09:00:00.000Z')
    ].join('\n') + '\n'
  );
  // Un legacy y un backup del formato viejo presentes: deben ignorarse
  fs.writeFileSync(path.join(tmpDir, 'audit-log.json'), JSON.stringify([
    { timestamp: '2026-01-01T00:00:00.000Z', action: 'CREAR', orderId: '15184' }
  ]));

  const logs = await getAuditLogsForOrder('15184');
  assert.equal(logs.length, 3);
  // Más reciente primero
  assert.deepEqual(logs.map(l => l.timestamp), [
    '2026-10-12T09:00:00.000Z',
    '2026-10-11T09:00:00.000Z',
    '2026-10-10T09:00:00.000Z'
  ]);

  // También acepta un id numérico y devuelve [] si no hay coincidencias
  assert.equal((await getAuditLogsForOrder(15184)).length, 3);
  assert.deepEqual(await getAuditLogsForOrder('no-existe'), []);
});

test('5b) getAuditStats y listAuditLogFiles mantienen su forma y no leen el legacy', async () => {
  process.env.AUDIT_MAX_BYTES = '50';
  process.env.AUDIT_MAX_FILES = '5';

  fs.writeFileSync(path.join(tmpDir, 'audit-log.json'), 'x'.repeat(1024)); // legacy: solo stat

  await logAuditEntry('CREAR', order('1'), { operator: 'Ana' });
  await logAuditEntry('CREAR', order('1'), { operator: 'Ana', warning: 'ID duplicado', existingId: '1' });
  await logAuditEntry('EDITAR', order('1'), { operator: 'Beto' }, order('1'));

  const stats = await getAuditStats();
  assert.equal(stats.totalOperations, 3);
  assert.deepEqual(stats.byAction, { CREAR: 2, EDITAR: 1 });
  assert.deepEqual(stats.byOperator, { Ana: 2, Beto: 1 });
  assert.equal(stats.recentOverwrites.length, 1);
  assert.equal(stats.suspiciousActivities.length, 1);
  assert.equal(Object.values(stats.byDate).reduce((a, b) => a + b, 0), 3);

  const files = await listAuditLogFiles();
  assert.equal(files.main.filename, 'audit-log.jsonl');
  assert.equal(files.main.entries, 1); // las otras 2 quedaron en rotados
  assert.ok(files.main.oldestEntry && files.main.newestEntry);
  assert.equal(files.backups.length, 2);
  assert.ok(files.backups.every(b => b.size > 0 && b.sizeHuman && b.modified));
  assert.equal(files.legacy.filename, 'audit-log.json');
  assert.equal(files.legacy.size, 1024);
});

test('5c) sin archivos, los lectores devuelven resultados vacíos sin romper', async () => {
  assert.deepEqual(await getAuditLogsForOrder('1'), []);
  const stats = await getAuditStats();
  assert.equal(stats.totalOperations, 0);
  const files = await listAuditLogFiles();
  assert.deepEqual(files, { main: null, backups: [], legacy: null });
});

// ---------------------------------------------------------------------------
// Caché con TTL y una sola lectura a la vez (getAuditStats / listAuditLogFiles / getAuditLogsForOrder)
// ---------------------------------------------------------------------------

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Archivo .jsonl grande (varios MB) para que una lectura tarde lo suficiente como para observarla
function writeBigJsonl(file, targetBytes) {
  const line = JSON.stringify({
    timestamp: '2026-10-12T09:00:00.000Z',
    action: 'CREAR',
    orderId: 'big',
    operator: 'Big',
    data: { pad: 'p'.repeat(1500) }
  });
  const count = Math.ceil(targetBytes / (line.length + 1));
  fs.writeFileSync(file, Array.from({ length: count }, () => line).join('\n') + '\n');
  return count;
}

test('6a) dentro del TTL getAuditStats devuelve lo mismo aunque se escriba una entrada nueva', async () => {
  await logAuditEntry('CREAR', order('1'));

  const first = await getAuditStats();
  assert.equal(first.totalOperations, 1);

  await logAuditEntry('CREAR', order('2')); // Entrada nueva entre las dos llamadas
  const second = await getAuditStats();
  assert.equal(second, first, 'dentro del TTL debe devolver el mismo resultado cacheado');
  assert.equal(second.totalOperations, 1);

  // Tras vaciar la caché, la entrada nueva sí aparece
  __resetAuditCacheForTests();
  const third = await getAuditStats();
  assert.equal(third.totalOperations, 2);
});

test('6a-2) con el TTL vencido getAuditStats vuelve a leer y ve la entrada nueva', async () => {
  process.env.AUDIT_CACHE_TTL_MS = '30';
  await logAuditEntry('CREAR', order('1'));
  const first = await getAuditStats();
  assert.equal(first.totalOperations, 1);

  await logAuditEntry('CREAR', order('2'));
  await sleep(60); // TTL vencido
  const second = await getAuditStats();
  assert.notEqual(second, first);
  assert.equal(second.totalOperations, 2);
});

test('6a-3) listAuditLogFiles también se cachea dentro del TTL', async () => {
  await logAuditEntry('CREAR', order('1'));
  const first = await listAuditLogFiles();
  assert.equal(first.main.entries, 1);

  await logAuditEntry('CREAR', order('2'));
  assert.equal(await listAuditLogFiles(), first);

  __resetAuditCacheForTests();
  assert.equal((await listAuditLogFiles()).main.entries, 2);
});

test('6b) 5 llamadas concurrentes a getAuditStats comparten un solo cálculo y devuelven lo mismo', async () => {
  for (let i = 1; i <= 3; i++) await logAuditEntry('CREAR', order(String(i)));

  const results = await Promise.all(Array.from({ length: 5 }, () => getAuditStats()));
  assert.equal(results[0].totalOperations, 3);
  for (const result of results) {
    assert.equal(result, results[0], 'todas esperan la misma promesa / el mismo resultado');
  }
});

test('6b-2) con TTL=0 las llamadas concurrentes siguen compartiendo el cálculo en curso', async () => {
  process.env.AUDIT_CACHE_TTL_MS = '0';
  await logAuditEntry('CREAR', order('1'));

  const results = await Promise.all(Array.from({ length: 5 }, () => getAuditStats()));
  for (const result of results) assert.equal(result, results[0]);
});

test('6c) con AUDIT_CACHE_TTL_MS=0 cada llamada ve los datos nuevos', async () => {
  process.env.AUDIT_CACHE_TTL_MS = '0';

  await logAuditEntry('CREAR', order('1'));
  const first = await getAuditStats();
  assert.equal(first.totalOperations, 1);

  await logAuditEntry('CREAR', order('2'));
  const second = await getAuditStats();
  assert.equal(second.totalOperations, 2);
  assert.notEqual(second, first);

  await logAuditEntry('CREAR', order('3'));
  assert.equal((await listAuditLogFiles()).main.entries, 3);
  await logAuditEntry('CREAR', order('4'));
  assert.equal((await listAuditLogFiles()).main.entries, 4);
});

test('6d) mientras un lector está en curso, logAuditEntry escribe y resuelve sin esperarlo', async () => {
  process.env.AUDIT_MAX_BYTES = String(1024 * 1024 * 1024); // Que el archivo grande no rote
  const bigCount = writeBigJsonl(CURRENT(), 25 * 1024 * 1024);

  let readerDone = false;
  const reader = getAuditStats().then(result => {
    readerDone = true;
    return result;
  });

  const written = await logAuditEntry('CREAR', order('9999'));
  assert.notEqual(written, null, 'la escritura debe completarse');
  assert.equal(readerDone, false, 'la escritura no debe esperar a que termine el lector');

  const stats = await reader;
  assert.ok(stats.totalOperations >= bigCount, 'el lector sí termina');

  const lines = readLines(CURRENT());
  assert.equal(JSON.parse(lines[lines.length - 1]).orderId, '9999');
});

test('6e) un error no se guarda en caché (stats devuelve null, files devuelve el fallback)', async () => {
  // Un archivo regular en el medio del path hace fallar mkdir (ENOTDIR)
  const blocker = path.join(tmpDir, 'blocker');
  fs.writeFileSync(blocker, 'no soy un directorio');
  process.env.AUDIT_LOGS_DIR = path.join(blocker, 'logs');

  const originalError = console.error;
  console.error = () => {}; // Silenciar los errores esperados
  try {
    assert.equal(await getAuditStats(), null);
    assert.deepEqual(await listAuditLogFiles(), { main: null, backups: [], legacy: null });
  } finally {
    console.error = originalError;
  }

  // Se arregla el problema: la siguiente llamada devuelve datos reales (no el error cacheado)
  fs.rmSync(blocker);
  fs.mkdirSync(path.join(blocker, 'logs'), { recursive: true });
  await logAuditEntry('CREAR', order('1'));

  assert.equal((await getAuditStats()).totalOperations, 1);
  assert.equal((await listAuditLogFiles()).main.entries, 1);
});

test('6f) solo una lectura de archivos a la vez entre los tres lectores', async () => {
  process.env.AUDIT_MAX_BYTES = String(1024 * 1024 * 1024);
  writeBigJsonl(CURRENT(), 25 * 1024 * 1024);
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-empty-'));

  try {
    // 1) Lector lento sobre el directorio grande (captura su directorio al arrancar)
    const finished = [];
    const slow = getAuditStats().then(() => finished.push('stats'));
    await sleep(5);

    // 2) Otros lectores sobre un directorio VACÍO: sin el límite terminarían casi al instante,
    //    antes que el lento. Con el límite deben esperar su turno en la cola.
    process.env.AUDIT_LOGS_DIR = emptyDir;
    const forOrder = getAuditLogsForOrder('no-existe').then(() => finished.push('order'));
    const files = listAuditLogFiles().then(() => finished.push('files'));
    await Promise.all([slow, forOrder, files]);

    assert.deepEqual(finished, ['stats', 'order', 'files']);
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});
