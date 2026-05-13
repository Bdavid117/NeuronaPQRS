---
tags:
  - sistema
  - runbook
  - escalamiento
tipo: sistema
---

# Runbook: Escalamiento de PQRS

## Cuándo escala el agente automáticamente

| Condición | Acción |
|-----------|--------|
| `urgencia = alta` y contacto de seguridad o salud | Escalar de inmediato a Bienestar |
| `confidence_score < 0.60` | Escalar a cola humana para revisión |
| El usuario solicita explícitamente un humano | Escalar inmediatamente |
| El agente no encontró citas en la KB con score ≥ 0.4 | Escalar a área responsable |
| Más de 3 intentos fallidos de recolección de campo | Escalar para asistencia manual |

## Cola de escalamiento

Las PQRS escaladas aparecen en `90-Sistema/cola.md` con formato:

```
- [ ] {radicado} | {tipo} | {urgencia} | {motivo_escalamiento} | {fecha}
```

Los funcionarios deben revisar esta nota al inicio de cada jornada.

## Contactos por área

| Área | Responsable | Canal |
|------|------------|-------|
| Registro Académico | registroacademico@universidad.edu.co | Correo / Extensión 101 |
| Financiero / Cartera | cartera@universidad.edu.co | Correo / Extensión 102 |
| Bienestar Universitario | bienestar@universidad.edu.co | Correo / Extensión 103 |
| TI / Campus Virtual | soporte.ti@universidad.edu.co | Ticket / Extensión 104 |
| Secretaría General | secretaria@universidad.edu.co | Correo / Extensión 100 |
