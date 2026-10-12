/**
 * Utilidades puras para comparar nombres de clientes.
 * Sin dependencias ni acceso a red: se usan tanto con el Sheet como con DynamoDB.
 */

/** minúsculas, sin acentos, sin puntuación y con espacios colapsados */
export function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Nombre normalizado que se guarda como `nombreClave` (misma normalización que el matching) */
export function normalizarNombre(value) {
  return normalize(value);
}

/** Distancia de Levenshtein, con corte temprano para nombres de largo muy distinto */
export function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** true si `corto` aparece dentro de `largo` como palabra completa */
export function contienePalabra(largo, corto) {
  const escaped = corto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(largo);
}

/**
 * Nivel de coincidencia entre el nombre del sheet y el buscado.
 * 3 = exacto | 2 = uno contiene al otro como palabra completa | 1 = typo de una letra | 0 = no coincide
 *
 * El limite de palabra evita falsos positivos como "Saiko no manga" -> "aiko"
 * o "Tora" -> "Consultora Sevilla"; el nivel 1 rescata "Qhathu" -> "Qhatu".
 */
export function matchLevel(nombreSheet, buscado) {
  const a = normalize(nombreSheet);
  const b = normalize(buscado);
  if (!a || !b) return 0;
  if (a === b) return 3;

  const [largo, corto] = a.length >= b.length ? [a, b] : [b, a];
  if (corto.length >= 4 && contienePalabra(largo, corto)) return 2;

  const sinEspacios = [a.replace(/ /g, ''), b.replace(/ /g, '')];
  if (Math.max(sinEspacios[0].length, sinEspacios[1].length) >= 6 &&
      levenshtein(sinEspacios[0], sinEspacios[1]) <= 1) {
    return 1;
  }

  return 0;
}
