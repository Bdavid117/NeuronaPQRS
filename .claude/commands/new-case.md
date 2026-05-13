Crea un caso PQRS de prueba en el vault Obsidian usando el MCP mcp-obsidian.

Pide al usuario (si no lo proporcionó como argumento):
- Tipo de PQRS: peticion / queja / reclamo / sugerencia / denuncia
- Descripción breve del caso

Luego usa `obsidian_create_case` con:
- `case_id`: genera uno con formato `PQRS-YYYYMMDD-XXXXXX` (fecha de hoy + 6 chars hex aleatorios)
- `metadata`: incluye tipo, categoria (elige la más apropiada del catálogo), area, urgencia (baja/media/alta), plazo_respuesta (15 días por defecto)
- `body`: descripción del caso en markdown con sección ## Descripción y ## Solicitante (datos ficticios de prueba)

Después de crear el caso:
1. Lee la nota creada con `obsidian_read_note` para confirmar que se guardó correctamente
2. Muestra el radicado asignado y la ruta en el vault
3. Indica los próximos pasos del flujo (clasificación → resolución → respuesta)
