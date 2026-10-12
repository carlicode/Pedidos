import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchLevel, normalizarNombre, normalize, levenshtein, contienePalabra } from './clientMatch.js'

test('matchLevel: coincidencia exacta = 3 (ignora mayúsculas, acentos y puntuación)', () => {
  assert.equal(matchLevel('Caja Bancaria', 'caja bancaria'), 3)
  assert.equal(matchLevel('Café  Núñez.', 'cafe nunez'), 3)
})

test('matchLevel: palabra completa = 2 (en cualquier dirección)', () => {
  assert.equal(matchLevel('Consultora Sevilla', 'Sevilla'), 2)
  assert.equal(matchLevel('Sevilla', 'Consultora Sevilla'), 2)
})

test('matchLevel: typo de una letra = 1', () => {
  assert.equal(matchLevel('Qhatu', 'Qhathu'), 1)
  assert.equal(matchLevel('Qhathu', 'Qhatu'), 1)
})

test('matchLevel: falsos positivos conocidos = 0', () => {
  assert.equal(matchLevel('Saiko no manga', 'aiko'), 0)
  assert.equal(matchLevel('Tora', 'Consultora Sevilla'), 0)
})

test('matchLevel: vacíos y nombres distintos = 0', () => {
  assert.equal(matchLevel('', 'Caja'), 0)
  assert.equal(matchLevel('Caja Bancaria', ''), 0)
  assert.equal(matchLevel(undefined, null), 0)
  assert.equal(matchLevel('Releva', 'Otra empresa'), 0)
})

test('normalizarNombre: minúsculas, sin acentos, sin puntuación y espacios colapsados', () => {
  assert.equal(normalizarNombre('  Café   NÚÑEZ, S.R.L. '), 'cafe nunez s r l')
  assert.equal(normalizarNombre('Caja-Bancaria'), 'caja bancaria')
  assert.equal(normalizarNombre(null), '')
  assert.equal(normalizarNombre('Releva'), normalize('Releva'))
})

test('levenshtein y contienePalabra', () => {
  assert.equal(levenshtein('qhatu', 'qhathu'), 1)
  assert.equal(levenshtein('abc', 'abcdef'), 99) // corte temprano por diferencia de largo
  assert.equal(contienePalabra('consultora sevilla', 'sevilla'), true)
  assert.equal(contienePalabra('consultora sevilla', 'tora'), false)
})
