Ejecuta una prueba de flujo completo del sistema PQRS NeuronaPQRS.

Pasos:
1. Verifica que la API esté corriendo en http://localhost:8000 con `curl -s http://localhost:8000/health`
2. Si no está corriendo, muéstrale al usuario el comando para iniciarla: `cd apps/api && uv run uvicorn pae_api.main:app --reload --port 8000`
3. Si está corriendo, simula un caso de prueba enviando un POST a `/api/v1/conversation` con un mensaje de inicio de PQRS (ej. "Quiero presentar un reclamo sobre mi nota del parcial de Cálculo")
4. Muestra la respuesta del agente y verifica que el flujo Intake → Classifier funcione
5. Lista las notas recientes en `Neurona/20-Casos/` usando la herramienta `obsidian_list_notes` con folder="20-Casos"
6. Reporta: estado de la API, respuesta del agente, casos en vault
