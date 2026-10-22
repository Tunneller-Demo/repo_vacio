# Reparto de gastos

Cuentas compartidas entre amigos: se apunta quién pagó cada cosa y la app calcula quién debe dinero a quién para quedar en paz.

## Language

**Grupo**:
El viaje, la cena o la ocasión cuyos gastos se reparten; tiene una sola moneda.
_Avoid_: Viaje, evento, cuenta

**Participante**:
Cada persona del Grupo que puede pagar un Gasto o deber parte de él.
_Avoid_: Amigo, miembro, usuario

**Gasto**:
Un pago hecho por un Participante: concepto, importe y entre quiénes se reparte. Siempre se reparte a partes iguales entre los Participantes marcados (quien paga puede no estar entre ellos); un reparto desigual se apunta como varios Gastos.
_Avoid_: Pago, compra, transacción

**Saldo**:
Lo que un Participante ha pagado menos lo que le corresponde pagar; positivo si le deben, negativo si debe.
_Avoid_: Deuda, balance

**Liquidación**:
La lista de transferencias «A paga X a B» que deja todos los Saldos a cero.
_Avoid_: Ajuste, pagos pendientes
