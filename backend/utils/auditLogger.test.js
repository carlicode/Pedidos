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
  listAuditLogFiles
} from './auditLogger.js';

// auditLogger lee AUDIT_LOGS_DIR / AUDIT_MAX_BYTES / AUDIT_MAX_FILES en cada llamada,
// así que cada test usa su propio directorio temporal y sus propios límites.
let tmpDir;
const originalEnv = {};
const ENV_KEYS = ['AUDIT_LOGS_DIR', 'AUDIT_MAX_BYTES', 'AUDIT_MAX_FILES'];
const originalConsoleLog = console.log;

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
  process.env.AUDIT_LOGS_DIR = tmpDir;
  delete process.env.AUDIT_MAX_BYTES;
  delete process.env.AUDIT_MAX_FILES;
  console.log = () => {}; // Silenciar los "✅ [AUDIT]" durante los tests
});

afterEach(() => {
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
