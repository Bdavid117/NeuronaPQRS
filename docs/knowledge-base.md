# Base de conocimiento — Vault Obsidian (Neurona/)

El vault Obsidian `Neurona/` es el sistema de archivo vivo del agente. Almacena el catálogo de tipos PQRS, los casos radicados, la normativa institucional, las plantillas de respuesta automática y los registros del sistema. Los agentes lo leen y escriben a través del servidor MCP `packages/mcp-obsidian`.

## Estructura de carpetas

```
Neurona/
├── 10-Catalogo-PQRS/      Definición de tipos y categorías con sus campos requeridos
├── 20-Casos/              Una nota Markdown por caso radicado
├── 30-Conocimiento/       Normativa, reglamento, plazos, información de áreas
├── 40-Plantillas/         Plantillas de respuesta para resolver_auto
└── 90-Sistema/            Cola de escalamiento, runbooks, métricas
```

---

## 10-Catalogo-PQRS/

Define el vocabulario controlado que usan el agente classifier y el agente intake.

### Tipos PQRS

**`Tipos.md`** — Los cuatro tipos válidos con sus plazos legales:

| Tipo | Plazo | Uso |
|---|---|---|
| `peticion` | 15 días | Solicitar información, documentos o certificados |
| `queja` | 15 días | Reportar una situación irregular con un funcionario o servicio |
| `reclamo` | 15 días | Impugnar una decisión institucional (notas, sanciones, cobros) |
| `sugerencia` | 15 días (acuse) | Proponer mejoras a procesos o servicios |

### Categorías

Cada nota de categoría incluye frontmatter con `required_fields` — la lista exacta que el agente intake debe recolectar.

#### Académicas (`Categorias-Academicas.md`)

| Categoría | Campos adicionales obligatorios |
|---|---|
| `Reclamo-Nota` | asignatura, docente, periodo_academico, nota_obtenida, nota_esperada |
| `Homologacion` | materia_origen, materia_destino, universidad_origen, nota |
| `Certificado-Academico` | tipo_certificado, destino, idioma |
| `Cancelacion-Matricula` | periodo, motivo |
| `Beca-Apoyo` | tipo_apoyo, periodo, motivo |
| `Practica-Profesional` | empresa, tutor_empresa, semestre |

#### Administrativas (`Categorias-Administrativas.md`)

| Categoría | Área responsable |
|---|---|
| `Financiero-Cartera` | Financiero |
| `Biblioteca` | Biblioteca |
| `Bienestar` | Bienestar Universitario |
| `Infraestructura` | Planta Física |
| `Servicios-TI` | TI |
| `Proceso-Disciplinario` | Secretaría General |

> Estas categorías corresponden exactamente a los nombres de notas en `10-Catalogo-PQRS/` para que los wikilinks se resuelvan correctamente.

---

## 20-Casos/

Una nota Markdown por caso radicado. La crea el `finish_node` al terminar el grafo.

### Nombre del archivo

```
PQRS-YYYYMMDD-XXXXXX.md
```

Ejemplo: `PQRS-20260507-A3F9C1.md`

### Estructura de la nota

```markdown
---
radicado: PQRS-20260507-A3F9C1
tipo: reclamo
categoria: Reclamo-Nota
area: Registro Académico
urgencia: media
estado: resuelto_automaticamente
created_at: 2026-05-07
plazo_respuesta: 2026-05-22
---

# PQRS-20260507-A3F9C1

## Datos del solicitante
- **Nombre:** Ana Torres
- **Correo:** ana@universidad.edu
- **Programa:** Ingeniería de Sistemas
- **Código:** 20231234

## Descripción
El estudiante reporta...

## Resolución automática
Estimada Ana Torres, de acuerdo con el [[30-Conocimiento/Reglamento-Estudiantil]]...

### Fuentes consultadas
- [[30-Conocimiento/Reclamo-Nota]]
- [[30-Conocimiento/Reglamento-Estudiantil]]
```

### Escritura por el MCP

El `finish_node` usa los siguientes tools MCP en secuencia:

1. `obsidian_create_case` — crea la nota con los campos recolectados
2. `obsidian_write_note` — añade la sección `## Resolución automática` con el draft
3. `obsidian_update_frontmatter` — cambia `estado` a `resuelto_automaticamente`

---

## 30-Conocimiento/

Fuente de verdad institucional que consulta el agente resolver via RAG.

| Nota | Contenido |
|---|---|
| `Plazos-Institucionales.md` | Plazos legales por tipo de PQRS y norma que los sustenta |
| `Reglamento-Estudiantil.md` | Artículos del reglamento relevantes para PQRS académicas |
| `Registro Académico.md` | Procesos, contactos y horarios del área |
| `Bienestar Universitario.md` | Servicios de bienestar, convocatorias, apoyos |
| `Coordinación de Prácticas.md` | Requisitos y proceso de vinculación empresarial |
| `Financiero.md` | Política de cobros, paz y salvo, becas |
| `Biblioteca.md` | Préstamos, multas, acceso a bases de datos |
| `TI.md` | Correo institucional, acceso a sistemas, soporte |
| `Secretaría General.md` | Certificaciones, procesos disciplinarios |
| `Planta Física.md` | Reporte de daños, reservas de espacios |

### Búsqueda RAG

El agente resolver usa `obsidian.search(query, top_k=5)` del MCP y filtra resultados con `score ≥ 0.40`. Las notas encontradas se incluyen como contexto para el LLM y sus rutas se almacenan como `kb_citations` en el estado del caso.

---

## 40-Plantillas/

Plantillas Markdown para el agente `resolver_auto`. Se usan cuando la categoría es `Certificado-Academico`, `Biblioteca` o `Servicios-TI` y la confianza del clasificador es ≥ 0.8.

### Variables de sustitución

```
{nombre_solicitante}  → collected_fields["nombre"]
{radicado}            → radicado del caso
```

### Ejemplo: `Certificado-Academico.md`

```markdown
Estimado/a {nombre_solicitante},

Hemos recibido su solicitud de certificado académico con radicado {radicado}.
Su certificado será procesado en un plazo de 3 días hábiles...
```

Si la plantilla no existe en el vault, `resolver_auto` usa un texto de respaldo hardcodeado.

---

## 90-Sistema/

### `cola.md` — Cola de escalamiento

El agente escalator añade una línea por cada caso que requiere atención humana:

```markdown
- [ ] PQRS-20260507-A3F9C1 | reclamo | alta | automático | 2026-05-07
- [ ] PQRS-20260507-B8D2E3 | queja   | media | baja confianza | 2026-05-07
```

Formato: `[ ] {radicado} | {tipo} | {urgencia} | {motivo} | {fecha}`

Un funcionario puede marcar el ítem como `[x]` al resolver el caso desde Obsidian.

### `Runbook-Escalamiento.md`

Procedimientos internos para los funcionarios que atienden la cola: cómo acceder al caso, qué información revisar, a quién derivar según el área, plazos máximos de respuesta.

---

## Sintaxis Obsidian

Las notas usan la sintaxis estándar de Obsidian:

| Sintaxis | Significado |
|---|---|
| `[[Nota]]` | Wikilink a otra nota del vault |
| `[[Nota\|alias]]` | Wikilink con texto alternativo |
| `![[Nota]]` | Embed (inserta el contenido de la nota) |
| `#tag` | Etiqueta inline |
| `---` YAML `---` | Frontmatter de metadatos |

### Frontmatter de categorías

Las notas en `10-Catalogo-PQRS/` tienen frontmatter con los campos que el agente intake debe recolectar:

```yaml
---
tipo: reclamo
categoria: Reclamo-Nota
area: Registro Académico
required_fields:
  - nombre
  - identificacion
  - correo
  - programa
  - codigo_estudiante
  - descripcion
  - asignatura
  - docente
  - nota_obtenida
plazo_dias: 15
---
```

---

## MCP Obsidian

El servidor MCP expuesto en `packages/mcp-obsidian/` protege el vault con validación de rutas. Solo se puede escribir en `ALLOWED_WRITE_DIRS`:

```python
ALLOWED_WRITE_DIRS = ["20-Casos", "90-Sistema"]
```

Las carpetas `10-Catalogo-PQRS/`, `30-Conocimiento/` y `40-Plantillas/` son de solo lectura para los agentes.

### Herramientas MCP disponibles

| Tool | Acción |
|---|---|
| `obsidian_read_note` | Lee el contenido de una nota |
| `obsidian_write_note` | Escribe o sobreescribe una nota (solo dirs permitidos) |
| `obsidian_search` | Búsqueda semántica con score en el vault |
| `obsidian_list_by_tag` | Lista notas que tengan un tag específico |
| `obsidian_update_frontmatter` | Actualiza campos YAML del frontmatter |
| `obsidian_create_case` | Crea nota de caso en `20-Casos/` con plantilla estructurada |
| `obsidian_link` | Añade wikilink entre dos notas |
