#!/usr/bin/env python3
"""
Seed script para NeuronaPQRS vault.
Ejecutar desde la raíz del proyecto:
  python infra/seed_vault.py

Crea la estructura limpia de carpetas y archivos semilla.
NO borra casos ni usuarios existentes (hacer eso manualmente antes si necesario).
"""

from __future__ import annotations
from pathlib import Path

VAULT_ROOT = Path(__file__).parents[1] / "Neurona"

FOLDERS = [
    "00-Inbox",
    "10-Catalogo/Academico",
    "10-Catalogo/Administrativo",
    "20-Casos",
    "30-Conocimiento/Legal",
    "30-Conocimiento/Institucional",
    "30-Conocimiento/Procedimientos",
    "40-Plantillas",
    "50-Usuarios",
    "60-Metricas/mensual",
    "90-Sistema/Runbooks",
]

SEED_FILES: dict[str, str] = {
    # ── Catálogo tipos ─────────────────────────────────────────────────────────
    "10-Catalogo/Tipos.md": """---
tags: [catalogo, tipos]
---

# Tipos de PQRS

| Tipo | Descripción | Plazo |
|---|---|---|
| Petición | Solicitud de información, documentos o servicios | 15 días hábiles |
| Queja | Inconformidad con la atención o conducta | 15 días hábiles |
| Reclamo | Exigencia de revisión o corrección | 15 días hábiles |
| Sugerencia | Propuesta de mejora institucional | Acuse en 15 días hábiles |

Base legal: Ley 1755 de 2015 — Derecho de Petición.
""",

    # ── Categorías académicas ──────────────────────────────────────────────────
    "10-Catalogo/Academico/Reclamo-Nota.md": """---
categoria: Reclamo-Nota
tipo: reclamo
area: Registro Académico
plazo_dias: 15
required_fields_extra: [asignatura, docente, periodo_academico, nota_reclamada]
tags: [catalogo, academico, reclamo]
---

# Reclamo de Nota

Solicitud de revisión de una calificación académica.

## Campos requeridos
- `asignatura`: nombre de la materia
- `docente`: nombre del profesor
- `periodo_academico`: ej. 2026-1
- `nota_reclamada`: calificación cuestionada
""",

    "10-Catalogo/Academico/Certificado-Academico.md": """---
categoria: Certificado-Academico
tipo: peticion
area: Registro Académico
plazo_dias: 5
required_fields_extra: [tipo_certificado, destino]
auto_resolve: true
tags: [catalogo, academico, peticion]
---

# Certificado Académico

Solicitud de certificados de notas, matrícula, graduación o asistencia.

## Campos requeridos
- `tipo_certificado`: notas | matricula | graduacion | asistencia
- `destino`: uso del documento (becas, visa, laboral, etc.)
""",

    "10-Catalogo/Academico/Homologacion.md": """---
categoria: Homologacion
tipo: peticion
area: Registro Académico
plazo_dias: 15
required_fields_extra: [asignaturas_homologar, institucion_origen]
tags: [catalogo, academico, peticion]
---

# Homologación de Materias

Solicitud de reconocimiento de materias cursadas en otra institución.
""",

    "10-Catalogo/Administrativo/Servicios-TI.md": """---
categoria: Servicios-TI
tipo: peticion
area: Dirección de TI
plazo_dias: 3
required_fields_extra: [sistema_afectado, descripcion_problema]
auto_resolve: true
tags: [catalogo, administrativo, ti]
---

# Servicios de Tecnología

Soporte técnico, credenciales, acceso a sistemas, correo institucional.

## Campos requeridos
- `sistema_afectado`: nombre del sistema o plataforma
- `descripcion_problema`: descripción del inconveniente
""",

    "10-Catalogo/Administrativo/Biblioteca.md": """---
categoria: Biblioteca
tipo: peticion
area: Biblioteca
plazo_dias: 2
required_fields_extra: [servicio_solicitado]
auto_resolve: true
tags: [catalogo, administrativo, biblioteca]
---

# Servicios de Biblioteca

Préstamo, renovación, reserva de salas, acceso a bases de datos.
""",

    "10-Catalogo/Administrativo/Financiero-Cartera.md": """---
categoria: Financiero-Cartera
tipo: reclamo
area: Cartera y Tesorería
plazo_dias: 15
required_fields_extra: [concepto_cobro, monto, periodo]
tags: [catalogo, administrativo, financiero]
---

# Reclamo Financiero

Inconformidades con cobros, descuentos, becas o pagos de matrícula.
""",

    "10-Catalogo/Administrativo/Bienestar.md": """---
categoria: Bienestar
tipo: peticion
area: Bienestar Universitario
plazo_dias: 5
required_fields_extra: [servicio_bienestar]
tags: [catalogo, administrativo, bienestar]
---

# Servicios de Bienestar

Subsidios, apoyo psicológico, deportes, cultura, salud estudiantil.
""",

    # ── Conocimiento legal ─────────────────────────────────────────────────────
    "30-Conocimiento/Legal/Ley-1755-2015.md": """---
tipo: normativa
tags: [legal, derecho-peticion]
---

# Ley 1755 de 2015 — Derecho de Petición

## Artículos clave

**Art. 14** — Términos para resolver:
- Peticiones de información: **15 días hábiles**
- Peticiones de documentos: **10 días hábiles**
- Consultas: **30 días hábiles**

**Art. 16** — Peticiones incompletas:
Si la petición no reúne los requisitos, la entidad tiene **10 días hábiles** para informar al solicitante.

**Art. 20** — Desatención:
La no respuesta en los plazos legales constituye causal de mala conducta del funcionario.

## Aplicación en NeuronaPQRS
- Todo PQRS recibe radicado inmediato
- El plazo legal se calcula desde la fecha de radicación
- Se notifica al solicitante el vencimiento aproximado
""",

    # ── Conocimiento institucional ─────────────────────────────────────────────
    "30-Conocimiento/Institucional/Reglamento-Estudiantil.md": """---
tipo: reglamento
tags: [institucional, reglamento, academico]
---

# Reglamento Estudiantil

## Artículo 47 — Derecho de revisión de calificaciones

Todo estudiante tiene derecho a solicitar la revisión de una calificación dentro de los **5 días hábiles** siguientes a su publicación oficial.

El proceso:
1. Presentar solicitud escrita ante el docente o el PQRS
2. El docente tiene **3 días hábiles** para responder
3. Si no hay acuerdo, pasa al Comité de Evaluación
4. El Comité resuelve en **5 días hábiles adicionales**

## Artículo 52 — Cancelación de materias

Se puede cancelar materias hasta la semana 6 del semestre sin repercusión académica.
A partir de la semana 7, se requiere concepto del Director de Programa.
""",

    "30-Conocimiento/Institucional/Plazos-Respuesta.md": """---
tipo: procedimiento
tags: [institucional, plazos, sla]
---

# Plazos de Respuesta por Área

| Área | Tipo de caso | Plazo hábil |
|---|---|---|
| Registro Académico | Certificados | 5 días |
| Registro Académico | Reclamo nota | 15 días |
| Registro Académico | Homologación | 15 días |
| Cartera y Tesorería | Reclamo cobro | 15 días |
| Bienestar | Solicitudes | 5 días |
| Dirección de TI | Soporte técnico | 3 días |
| Biblioteca | Servicios | 2 días |
| Rectoría | Quejas graves | 15 días |

Base legal: Ley 1755/2015.
""",

    # ── Plantillas de respuesta ────────────────────────────────────────────────
    "40-Plantillas/Certificado-Academico.md": """---
categoria: Certificado-Academico
tipo: peticion
tags: [plantilla, auto-resolve]
---

Estimado/a {nombre_solicitante},

Hemos recibido su solicitud de certificado académico (tipo: **{tipo_certificado}**) registrada con el radicado **{radicado}**.

El proceso de expedición toma entre **3 y 5 días hábiles**. Le notificaremos al correo institucional registrado cuando el documento esté disponible para descarga en el portal estudiantil.

Si necesita el certificado con urgencia, puede comunicarse directamente con Registro Académico indicando su radicado.

Atentamente,
**Registro y Control Académico**
NeuronaPQRS · Sistema PQRS Institucional
""",

    "40-Plantillas/Servicios-TI.md": """---
categoria: Servicios-TI
tipo: peticion
tags: [plantilla, auto-resolve]
---

Estimado/a {nombre_solicitante},

Su solicitud de soporte técnico relacionada con **{sistema_afectado}** ha sido registrada con el radicado **{radicado}**.

Nuestro equipo de TI atenderá su requerimiento en un plazo máximo de **3 días hábiles**. Recibirá actualizaciones al correo institucional.

Si es urgente (sistema crítico caído), puede llamar a la línea de soporte: ext. 200.

Atentamente,
**Dirección de Tecnologías de la Información**
NeuronaPQRS · Sistema PQRS Institucional
""",

    "40-Plantillas/Biblioteca.md": """---
categoria: Biblioteca
tipo: peticion
tags: [plantilla, auto-resolve]
---

Estimado/a {nombre_solicitante},

Su solicitud de servicios de Biblioteca ha sido radicada bajo el número **{radicado}**.

Nuestro equipo atenderá su requerimiento en un plazo máximo de **2 días hábiles**.

Para consultas inmediatas sobre disponibilidad de material o reserva de salas, puede contactar directamente a la Biblioteca en el horario de atención (L-V 7am–8pm, S 8am–2pm).

Atentamente,
**Biblioteca Universitaria**
NeuronaPQRS · Sistema PQRS Institucional
""",

    # ── Sistema ────────────────────────────────────────────────────────────────
    "90-Sistema/Escalamiento.md": """---
tipo: sistema
tags: [sistema, escalamiento]
---

# Cola de Escalamiento

Casos que requieren revisión humana son registrados aquí por el agente Escalator.

| Radicado | Motivo | Área destino | Fecha |
|---|---|---|---|
| _(vacío — se llena automáticamente)_ | | | |

## Criterios de escalamiento
- Urgencia alta + reclamo
- Solicitudes que mencionan acciones legales
- Queja contra directivos
- Solicitudes de reposición de matrícula > 1 semestre
""",

    "90-Sistema/Runbooks/Reinicio-Agentes.md": """---
tipo: runbook
tags: [sistema, runbook, operaciones]
---

# Runbook: Reinicio de Agentes

## Síntomas: agentes no responden

1. Verificar que el backend está corriendo:
```bash
curl http://localhost:8000/healthz
```

2. Si el backend no responde, reiniciar:
```bash
cd apps/api && uv run uvicorn pae_api.main:app --reload --port 8000
```

3. Si hay errores de DB, verificar PostgreSQL:
```bash
docker ps | grep postgres
docker compose up -d
```

4. Si el vault no responde, verificar permisos:
```bash
ls -la Neurona/20-Casos/
```
""",

    "60-Metricas/Resumen.md": """---
tipo: metricas
actualizado: 2026-05-12
tags: [sistema, metricas]
---

# Métricas del Sistema PQRS

Este archivo se actualiza automáticamente por el agente de analytics.

## Resumen general

| Métrica | Valor |
|---|---|
| Total casos radicados | 0 |
| Resueltos automáticamente | 0 |
| Escalados a humano | 0 |
| Tiempo promedio (minutos) | — |

## Categorías más frecuentes
_(sin datos aún)_

## Estado del sistema
Sistema en producción desde 2026-05-12.
""",
}


def main() -> None:
    print(f"Seeding vault at {VAULT_ROOT}")

    for folder in FOLDERS:
        path = VAULT_ROOT / folder
        path.mkdir(parents=True, exist_ok=True)
        print(f"  {folder}/")

    for rel_path, content in SEED_FILES.items():
        full_path = VAULT_ROOT / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        if not full_path.exists():
            full_path.write_text(content, encoding="utf-8")
            print(f"  Created: {rel_path}")
        else:
            print(f"  Skipped (exists): {rel_path}")

    print(f"\nVault seeded. Folders: {len(FOLDERS)}, Files: {len(SEED_FILES)}")


if __name__ == "__main__":
    main()
