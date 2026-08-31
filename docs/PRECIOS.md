# Cómo se calcula el precio de una carrera

## De dónde sale cada número

| Paso | Dónde |
|---|---|
| Distancia | `GET /api/distance-proxy` → Google Routes, **ruta más corta en modo auto** |
| Precio | `frontend/src/utils/priceCalculator.js` — **único lugar** donde vive la fórmula |
| Guardado | El backend **no recalcula**: guarda el `precio_bs` que le manda el frontend |

## La fórmula

Los km se **redondean hacia arriba** (`Math.ceil`): 3,74 km se cobra como 4 km.

| Medio | Hasta 1 km | Cada km adicional | Fórmula |
|---|---|---|---|
| **Bicicleta** | 8 Bs | 2,50 Bs | `8 + (km−1) × 2,5` |
| **Scooter** | 8 Bs | 2,50 Bs | idéntico a Bicicleta |
| **Cargo** | 14 Bs | 2,50 Bs | `Bicicleta + 6` (recargo fijo) |
| **Beezero** (auto) | 10 Bs | 3,00 Bs | `10 + (km−1) × 3` |

Cualquier otro medio devuelve **0**.

**Ejemplo** — 3,74 km en bicicleta → 4 km → `8 + 3 × 2,5` = **15,50 Bs**. En Cargo: 21,50 Bs. En Beezero: 19 Bs.

## Qué NO afecta el precio

- **El método de pago no cambia el monto.** Efectivo, Cuenta, A cuenta, QR y Cortesía cobran igual; solo cambia el mensaje que se le muestra al operador.
- **El cliente no tiene tarifa propia.** No hay precio por cliente en el código.

## Precio manual

El operador puede sobrescribir el precio. Eso activa `precioEditadoManualmente`, que bloquea el recálculo automático — **pero el flag se resetea cada vez que se recalcula la distancia**, y el precio manual se pierde.

## Pago al biker

`frontend/src/services/bikersService.js`

- El biker cobra el **100 % del precio** de la carrera, sin porcentaje ni comisión.
- Excepción: las carreras con método **`A cuenta` pagan 0** al biker.
- Pago del turno = suma de los precios de sus carreras, excluyendo las `A cuenta`.

---

## Huecos a revisar

1. **Cortesía cobra precio completo.** Si la intención es que sea gratis, hoy no lo es.
2. **Precios especiales por cliente sin implementar.** El sheet de clientes tiene columnas con `tabla`, `Bs10,50`, `2bs más`, rangos `18-21`. Nada de eso llega al cálculo — se aplica a mano o no se aplica.
3. **El backend confía en el precio del frontend.** No hay validación server-side: un request puede guardar cualquier monto.
4. **La distancia de la bicicleta se mide en modo auto.** Usa la ruta de coche, que ignora ciclovías, contramanos y atajos.
5. **Scooter y Bicicleta cuestan exactamente lo mismo.** Puede ser intencional o un caso que quedó sin tarifa propia.
