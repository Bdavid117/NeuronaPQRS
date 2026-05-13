# NeuronaPQRS — Diseño de Mejoramiento Integral

**Fecha:** 2026-05-12  
**Enfoque aprobado:** C — Híbrido por capas (backend intacto, frontend nuevo, vault limpio)  
**Prioridad:** Rediseño de interfaz primero, luego vault, luego optimización de agentes

---

## 1. Contexto y objetivos

### Problema
El sistema NeuronaPQRS funciona correctamente a nivel de agentes y persistencia, pero tiene:
- Bug de respuesta doble en modo voz (`ChatStream.tsx` lines 91-108)
- 6 bugs adicionales en el sistema de voz (silenciosos, sin feedback de error)
- Interfaz actual sin diseño profesional, no adaptativa a móvil
- Sin diferenciación entre vista de estudiante y vista de administrador
- Vault Obsidian con datos de prueba desorganizados
- Agentes lentos por exceso de llamadas LLM en casos simples

### Criterios de éxito
1. Usuario no técnico radica un PQRS en menos de 2 minutos sin confundirse
2. Admin puede ver todos los casos con métricas, filtrar y actualizar estado desde la interfaz
3. El sistema luce profesional suficiente para presentar en una institución real

### Estilo visual aprobado
- Inspiración: Intercom — cálido, accesible, profesional
- Layout: mobile-first adaptativo (1 col móvil → 2 col desktop)
- No modo oscuro por defecto; paleta suave con acentos institucionales

---

## 2. Arquitectura general

```
FRONTEND (Next.js 15) — reconstruido
  /           → Journey Estudiante
  /admin      → Journey Admin
  /r/[rad]    → Vista pública de caso

BACKEND FastAPI — sin cambios + 2 endpoints nuevos
  GET  /admin/cases                    → lista paginada con filtros
  PATCH /admin/cases/{id}/status       → actualizar estado de caso

AGENTES LangGraph — optimizaciones menores
  + resolver_auto expandido
  + semantic cache más agresiva
  + classifier timeout 8s → 5s

VAULT OBSIDIAN — reconstruido desde cero
  Nueva estructura de carpetas + seed data limpio
```

El backend Python existente **no se modifica** salvo la adición de 2 endpoints de admin.

---

## 3. Capa 1 — Corrección de bugs de voz

### Bug #1 (crítico): Respuesta doble en modo voz
**Archivo:** `apps/web/src/components/chat/ChatStream.tsx` líneas 91-108  
**Causa:** El `useEffect` de auto-speak se dispara múltiples veces cuando `messages` se actualiza en rápida sucesión durante el SSE streaming, sin deduplicación.

**Solución:**
- Añadir campo `ttsPlayed?: boolean` a la interfaz `Message`
- Antes de llamar `speakRef.current()`, verificar `!lastCurr.ttsPlayed`
- Inmediatamente después de hablar, actualizar ese mensaje con `ttsPlayed: true`
- Esto garantiza que cada mensaje de asistente se sintetiza exactamente una vez

### Bug #2: Sin auto-stop al cambiar de modo voz→texto
**Solución:** `useEffect` en `ChatStream.tsx` que llama `voice.stop()` cuando `voiceMode` cambia a `false` y el estado del micrófono no es `idle`

### Bug #3: `voice.start()` sin manejo de errores tras TTS
**Solución:** Envolver en try/catch con mensaje de estado visible al usuario

### Bug #4: Transcripción Whisper sin feedback de error
**Archivo:** `apps/web/src/lib/useVoiceInput.ts`  
**Solución:** Emitir estado `"error"` en el hook y mostrar toast en la UI

### Bug #5: `finish_node` con try/except silencioso en escritura Obsidian
**Archivo:** `apps/api/src/pae_api/agents/graph.py`  
**Solución:** Loguear error con nivel `log.error` y emitir evento SSE `"warning"` al frontend cuando `vault_path is None`

---

## 4. Capa 2 — Rediseño completo del frontend

### 4.1 Journey del Estudiante (`/`)

**Pantalla de inicio (landing)**
- Header con logo institucional + nombre "NeuronaPQRS"
- Tagline: "Radica tu solicitud, queja o reclamo en minutos"
- CTA principal: botón "Iniciar solicitud" → navega a `/chat`
- Cards de tipos de PQRS con iconos y descripción breve
- Footer institucional

**Chat interactivo (`/chat`)**
Layout móvil (< 768px): columna única
- Top bar: logo + botón de voz + indicador de agente activo
- Área de chat ocupa toda la pantalla
- Input fijo en la parte inferior (texto + icono adjuntar + botón enviar/voz)
- Panel de estado del caso (tipo, categoría, urgencia) como sheet deslizable desde abajo

Layout desktop (≥ 768px): dos columnas
- Columna izquierda (60%): chat con mensajes
- Columna derecha (40%): estado del caso, acciones, QR cuando esté disponible

**Mejoras de UX:**
- Indicador de escritura animado mientras el agente procesa
- Chips de respuesta rápida para tipos de PQRS (Petición, Queja, Reclamo, Sugerencia)
- Notificación inline cuando se genera el radicado con link a `/r/{radicado}`
- Botón de voz con estados visuales claros: idle / grabando / procesando

**Vista de caso (`/r/[radicado]`)**
- Card central con: radicado, tipo, categoría, área, plazo, estado
- QR code descargable
- Timeline de estados del caso
- Botón "Continuar conversación" si el caso sigue abierto

### 4.2 Journey del Administrador (`/admin`)

**Autenticación:**
- Login simple con usuario/contraseña (sin LDAP por ahora)
- Sesión en cookie httpOnly, 8 horas
- Ruta `/admin/*` protegida con middleware Next.js

**Dashboard principal (`/admin`)**
Layout: sidebar izquierdo fijo + área de contenido

Métricas en cards superiores:
- Total casos hoy / esta semana / este mes
- Casos pendientes de revisión humana
- Tiempo promedio de resolución
- Casos por tipo (mini gráfico de barras)

Tabla de casos:
- Columnas: Radicado, Tipo, Categoría, Área, Urgencia, Estado, Fecha, Acciones
- Filtros: tipo, categoría, área, urgencia, estado, rango de fechas
- Búsqueda por radicado o palabras clave
- Paginación (20 por página)
- Badge de color por urgencia (alta=rojo, media=naranja, baja=verde)

**Vista de caso admin (`/admin/cases/[radicado]`)**
- Toda la información del caso
- Historial completo de la conversación
- Campos recolectados por los agentes
- Botón: cambiar estado (abierto → en revisión → resuelto → cerrado)
- Campo de notas internas (solo admin)
- Botón de escalamiento a otro departamento

### 4.3 Sistema de diseño

**Paleta de colores:**
```
Primary:   #2563EB (azul institucional)
Secondary: #0EA5E9 (azul claro)
Accent:    #7C3AED (violeta suave)
Success:   #16A34A (verde)
Warning:   #D97706 (naranja)
Error:     #DC2626 (rojo)
Neutral:   #F8FAFC → #1E293B (escala gris fría)
Background: #FFFFFF (blanco puro)
Surface:   #F1F5F9 (gris muy claro)
```

**Tipografía:**
- Fuente: Inter (Google Fonts) — sans-serif, excelente legibilidad
- Headings: Inter 600-700
- Body: Inter 400, tamaño base 16px
- Code/radicados: JetBrains Mono

**Componentes nuevos a crear:**
- `StatusBadge` — urgencia con color
- `AgentTypingIndicator` — tres puntos animados con nombre del agente
- `CaseCard` — card compacta con info del caso
- `MetricCard` — card de métrica con número grande + tendencia
- `FilterBar` — barra de filtros para tabla admin
- `VoiceOrb` — botón de voz con animación de onda sonora
- `RazonamientoToast` — notificación cuando se genera el radicado

---

## 5. Capa 3 — Vault Obsidian reconstruido

### 5.1 Nueva estructura de carpetas

```
Neurona/
├── 00-Inbox/           # Borradores y notas temporales
├── 10-Catalogo/        # Tipos y categorías (inmutable, seed)
│   ├── Tipos.md
│   ├── Academico/      # Categorías académicas (un .md por categoría)
│   └── Administrativo/ # Categorías administrativas
├── 20-Casos/           # Un .md por caso radicado (escritura automática)
├── 30-Conocimiento/    # Normativa, reglamentos, políticas
│   ├── Legal/          # Ley 1755/2015, normativa nacional
│   ├── Institucional/  # Reglamento estudiantil, políticas internas
│   └── Procedimientos/ # Pasos para cada tipo de trámite
├── 40-Plantillas/      # Respuestas automáticas por categoría
├── 50-Usuarios/        # Perfiles de solicitantes (escritura automática)
├── 60-Metricas/        # Dashboard de métricas (escritura automática)
│   ├── mensual/        # Reportes mensuales
│   └── Resumen.md      # Vista general actualizada automáticamente
└── 90-Sistema/         # Runbooks, cola de escalamiento, configuración
    ├── Escalamiento.md
    └── Runbooks/
```

**Cambios vs estructura actual:**
- `10-Catalogo-PQRS/` → `10-Catalogo/` con subcarpetas por dominio
- `90-Sistema/` se reduce — métricas pasan a `60-Metricas/`
- Se eliminan: `50-Usuarios/` con datos de prueba, todos los casos de `20-Casos/`
- Se añade: `60-Metricas/` con notas de reporte automático

### 5.2 Formato mejorado de nota de caso

```markdown
---
radicado: PQRS-YYYYMMDD-XXXXXX
tipo: reclamo
categoria: Reclamo-Nota
area: Registro Académico
urgencia: media
estado: abierto
plazo_respuesta: 2026-05-27
requiere_revision_humana: false
canal: web | voz
version: 2
---

## Solicitante
- **Nombre:** Juan Pérez
- **Código:** 2024001
- [[50-Usuarios/Juan-Pérez-2024001]]

## Descripción
(texto libre del solicitante)

## Campos recolectados
| Campo | Valor |
|---|---|
| programa_academico | Ingeniería de Sistemas |
| asignatura | Cálculo III |
| docente | Dr. García |

## Respuesta generada
(borrador del resolver)

## Fuentes consultadas
- [[30-Conocimiento/Institucional/Reglamento-Estudiantil]] — Art. 47

## Historial de estados
- 2026-05-12 09:30 → abierto (canal: voz)
- 2026-05-12 09:31 → resuelto_automaticamente
```

### 5.3 Seed data limpio

El script `infra/seed_vault.py` se reescribe para poblar:
- 4 tipos PQRS completos con `required_fields`
- 16 categorías con subcarpetas organizadas
- 8 documentos de conocimiento institucional (reglamento, plazos, áreas)
- 8 plantillas de respuesta por categoría frecuente
- Cero casos (vault limpio para producción)

---

## 6. Capa 4 — Optimización de agentes

### 6.1 Expansión de `resolver_auto`
Categorías que hoy pasan por LLM pero tienen respuesta determinística:
- `Certificado-Académico` → respuesta plantilla + link al proceso
- `Horario-Clases` → redirige a URL del sistema de horarios
- `Carnet-Estudiantil` → instrucciones fijas de reposición
- `Credenciales-Campus` → redirige a TI con ticket automático

Cada una se añade como caso en `resolver_auto.py` con respuesta en plantilla del vault.

### 6.2 Cache semántica más agresiva
- Ampliar el hash para incluir `area` además de `tipo:categoria:query`
- Pre-calentar cache con las 10 consultas más frecuentes al iniciar el servidor
- TTL de cache: 24h → 72h (la normativa no cambia frecuentemente)

### 6.3 Timeouts y concurrencia
- Timeout classifier: 8s → 5s (si supera, usar heurística de keywords)
- Timeout intake: sin cambio (necesita ser preciso)
- Timeout resolver: 12s → 10s
- Añadir `asyncio.wait_for` en cada llamada a OpenRouter

### 6.4 Nuevos endpoints de admin (backend)
```python
# GET /admin/cases?page=1&per_page=20&tipo=reclamo&estado=abierto
# PATCH /admin/cases/{radicado}/status
# Body: {"estado": "en_revision", "nota_interna": "..."}
```

---

## 7. Orden de implementación

| Capa | Tareas | Días estimados |
|---|---|---|
| 1 | 7 bug fixes de voz | 1-2 |
| 2a | Sistema de diseño + componentes base | 2 |
| 2b | Journey estudiante (/, /chat, /r/[rad]) | 2-3 |
| 2c | Journey admin (/admin, /admin/cases/[rad]) | 2-3 |
| 2d | 2 endpoints backend admin | 1 |
| 3 | Vault desde cero + seed limpio | 1-2 |
| 4 | Optimizaciones de agentes | 1-2 |
| **Total** | | **10-15 días** |

---

## 8. Ideas de mejoramiento adicionales (backlog)

Estas no están en el alcance actual pero vale la pena registrarlas:

1. **Notificaciones WhatsApp** — `services/notifications.py` ya tiene el placeholder; integrar Twilio para notificar al estudiante cuando su caso cambia de estado
2. **Analytics de patrones** — `analytics.py` placeholder; detectar categorías que se repiten (problemas sistémicos) y generar reporte semanal en `60-Metricas/`
3. **Login estudiantil con código institucional** — validar código de estudiante contra un CSV/API antes de aceptar el caso
4. **Búsqueda semántica en vault** — reemplazar BM25 con pgvector embeddings para RAG más preciso
5. **Modo offline** — service worker para que el chat funcione sin conexión y sincronice cuando vuelva la red
6. **Exportar casos a PDF** — botón en vista admin para generar informe formal del caso
7. **Integración con correo institucional** — enviar acuse de recibo con radicado al email del estudiante
8. **Panel de SLA** — alertar al admin cuando un caso está a menos de 2 días de vencer su plazo legal
9. **A/B testing de prompts** — experimentar con prompts del intake para reducir preguntas necesarias de 3 a 2
10. **Modo quiosco** — versión simplificada del chat para tablets en las oficinas físicas
