Verifica la conectividad de todos los modelos OpenRouter configurados en el proyecto NeuronaPQRS.

Lee el archivo `.env` para obtener los modelos configurados, luego para cada uno:
- MODEL_INTAKE
- MODEL_CLASSIFIER
- MODEL_VISION
- MODEL_RESOLVER
- MODEL_ESCALATOR

Ejecuta una prueba rápida usando el cliente de la API:
```bash
cd apps/api && uv run python -c "
import asyncio, os
from dotenv import load_dotenv
load_dotenv('../../.env')
from pae_api.services.openrouter import get_openrouter
from pae_api.config import get_settings

settings = get_settings()
models = {
    'INTAKE': settings.model_intake,
    'CLASSIFIER': settings.model_classifier,
    'VISION': settings.model_vision,
    'RESOLVER': settings.model_resolver,
    'ESCALATOR': settings.model_escalator,
}

async def test_model(name, model):
    client = get_openrouter()
    try:
        r = await client.chat(model=model, messages=[{'role':'user','content':'OK'}], max_tokens=5)
        resp = r['choices'][0]['message']['content']
        return f'✓ {name}: {model} → {resp!r}'
    except Exception as e:
        return f'✗ {name}: {model} → ERROR: {e}'
    finally:
        await client.aclose()

async def main():
    results = [await test_model(n, m) for n, m in models.items()]
    for r in results: print(r)

asyncio.run(main())
"
```

Muestra los resultados de cada modelo y señala cuáles fallaron.
