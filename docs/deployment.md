# Guía de despliegue en producción

## Requisitos de infraestructura

| Componente | Mínimo recomendado |
|---|---|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disco | 20 GB SSD |
| OS | Ubuntu 22.04 LTS |
| PostgreSQL | 17 + pgvector |
| Python | 3.14 |
| Node | 25 |
| pnpm | latest |

---

## Variables de entorno de producción

Copiar `.env.example` a `.env` y completar todos los valores:

```env
# LLM — OpenRouter
OPENROUTER_API_KEY=sk-or-tu-key-real-aqui
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
MODEL_INTAKE=anthropic/claude-sonnet-4-5
MODEL_CLASSIFIER=anthropic/claude-haiku-4-5
MODEL_VISION=anthropic/claude-sonnet-4-5
MODEL_RESOLVER=anthropic/claude-sonnet-4-5
MODEL_ESCALATOR=anthropic/claude-haiku-4-5
MODEL_EMBEDDINGS=openai/text-embedding-3-small

# Base de datos
DATABASE_URL=postgresql+asyncpg://pae:CONTRASEÑA_FUERTE@localhost:5432/pae_pqrs
DATABASE_URL_SYNC=postgresql+psycopg2://pae:CONTRASEÑA_FUERTE@localhost:5432/pae_pqrs

# Vault Obsidian
VAULT_ROOT=/var/app/Neurona

# Aplicación
APP_ENV=production
SECRET_KEY=genera-una-clave-aleatoria-de-32-chars-minimo
ALLOWED_ORIGINS=https://tudominio.edu.co
UPLOAD_DIR=/var/app/uploads
MAX_UPLOAD_SIZE_MB=10
APP_URL=https://tudominio.edu.co

# Frontend
NEXT_PUBLIC_API_URL=https://api.tudominio.edu.co
```

> Nunca subas `.env` a git. Usa secretos del servidor (GitHub Secrets, Vault, etc.).

---

## Pasos de despliegue

### 1. Base de datos

```bash
# Instalar PostgreSQL 17 + pgvector
sudo apt install -y postgresql-17
sudo apt install -y postgresql-17-pgvector

# Crear usuario y base de datos
sudo -u postgres psql <<'SQL'
  CREATE USER pae WITH PASSWORD 'CONTRASEÑA_FUERTE';
  CREATE DATABASE pae_pqrs OWNER pae;
  GRANT ALL PRIVILEGES ON DATABASE pae_pqrs TO pae;
SQL

# Habilitar extensión pgvector
sudo -u postgres psql -d pae_pqrs -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Vault Obsidian

```bash
# Copiar el vault al servidor
scp -r ./Neurona usuario@servidor:/var/app/Neurona

# O clonar desde git si está versionado
git clone git@turepositorio/Neurona.git /var/app/Neurona
```

Asegurarse de que el proceso del backend tenga permisos de escritura en `/var/app/Neurona/20-Casos/` y `/var/app/Neurona/90-Sistema/`.

### 3. Backend FastAPI

```bash
cd /var/app/apps/api

# Instalar dependencias
/usr/local/bin/uv sync --no-dev

# Aplicar migraciones
uv run alembic upgrade head

# Crear directorio de uploads
mkdir -p /var/app/uploads && chmod 755 /var/app/uploads
```

**Systemd service** (`/etc/systemd/system/pae-api.service`):

```ini
[Unit]
Description=NeuronaPQRS — FastAPI backend
After=network.target postgresql.service

[Service]
User=pae
WorkingDirectory=/var/app/apps/api
EnvironmentFile=/var/app/.env
ExecStart=/usr/local/bin/uv run uvicorn pae_api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 2
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pae-api
sudo systemctl status pae-api
```

### 4. Frontend Next.js

```bash
cd /var/app/apps/web

# Instalar dependencias y compilar
pnpm install --frozen-lockfile
pnpm build
```

**Systemd service** (`/etc/systemd/system/pae-web.service`):

```ini
[Unit]
Description=NeuronaPQRS — Next.js frontend
After=network.target

[Service]
User=pae
WorkingDirectory=/var/app/apps/web
Environment=NODE_ENV=production
Environment=NEXT_PUBLIC_API_URL=https://api.tudominio.edu.co
ExecStart=/opt/homebrew/bin/node server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pae-web
```

### 5. Reverse proxy — Nginx

```nginx
# /etc/nginx/sites-available/pae

# Frontend (puerto 3000)
server {
    listen 443 ssl;
    server_name tudominio.edu.co;

    ssl_certificate     /etc/letsencrypt/live/tudominio.edu.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.edu.co/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API (puerto 8000)
server {
    listen 443 ssl;
    server_name api.tudominio.edu.co;

    ssl_certificate     /etc/letsencrypt/live/api.tudominio.edu.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tudominio.edu.co/privkey.pem;

    # SSE requiere buffering desactivado
    location /chat {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Redirección HTTP → HTTPS
server {
    listen 80;
    server_name tudominio.edu.co api.tudominio.edu.co;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pae /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. TLS con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.edu.co -d api.tudominio.edu.co
```

---

## Actualizaciones

```bash
# Detener servicios
sudo systemctl stop pae-api pae-web

# Actualizar código
cd /var/app
git pull

# Backend: actualizar dependencias y aplicar migraciones
cd apps/api
uv sync --no-dev
uv run alembic upgrade head

# Frontend: recompilar
cd ../web
pnpm install --frozen-lockfile
pnpm build

# Reiniciar servicios
sudo systemctl start pae-api pae-web
```

---

## Backups

### Base de datos

```bash
# Backup diario (crontab)
0 2 * * * pg_dump -U pae pae_pqrs | gzip > /backups/pae_pqrs_$(date +\%Y\%m\%d).sql.gz

# Retención de 30 días
find /backups -name "*.sql.gz" -mtime +30 -delete
```

### Vault Obsidian

```bash
# Sincronizar con almacenamiento externo o git
0 3 * * * cd /var/app/Neurona && git add -A && git commit -m "auto-backup $(date)" && git push
```

### Uploads

```bash
# Sincronizar con S3 o almacenamiento similar
0 4 * * * aws s3 sync /var/app/uploads s3://tu-bucket/uploads
```

---

## Monitoreo

### Health check

```bash
# API
curl https://api.tudominio.edu.co/healthz
# → {"status": "ok"}

# Frontend
curl -o /dev/null -w "%{http_code}" https://tudominio.edu.co
# → 200
```

### Logs

```bash
# Backend
sudo journalctl -u pae-api -f

# Frontend
sudo journalctl -u pae-web -f

# Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Variables de modelos por entorno

Para reducir costos en staging, se pueden usar modelos más económicos:

```env
# staging/.env
MODEL_INTAKE=anthropic/claude-haiku-4-5
MODEL_CLASSIFIER=anthropic/claude-haiku-4-5
MODEL_VISION=anthropic/claude-haiku-4-5
MODEL_RESOLVER=anthropic/claude-haiku-4-5
MODEL_ESCALATOR=anthropic/claude-haiku-4-5
```

En producción usar la configuración por defecto (Sonnet para generación, Haiku para clasificación).

---

## Checklist de lanzamiento

- [ ] Variables de entorno completas en el servidor
- [ ] `SECRET_KEY` generada con `openssl rand -hex 32`
- [ ] Contraseña de PostgreSQL cambiada del default
- [ ] `ALLOWED_ORIGINS` apunta al dominio real (no `localhost`)
- [ ] TLS configurado y certificado válido
- [ ] `proxy_buffering off` en Nginx para SSE
- [ ] `pg_dump` programado en crontab
- [ ] Vault Obsidian copiado y con permisos de escritura en `20-Casos/` y `90-Sistema/`
- [ ] Directorio `uploads/` creado con permisos correctos
- [ ] Migraciones Alembic aplicadas (`alembic upgrade head`)
- [ ] Health check respondiendo en ambos servicios
