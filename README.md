# TodoMaster — Microservices Task Management App

Aplicación de gestión de tareas construida con arquitectura de microservicios. Incluye autenticación JWT, mensajería asíncrona con RabbitMQ, múltiples bases de datos, nginx como API Gateway y un frontend en Next.js.

---

## Arquitectura

```
┌─────────────┐     ┌───────────────────────────────────────────┐
│   Browser   │────▶│  Frontend  (Next.js  :3001)               │
└─────────────┘     │  BFF — Next.js API Routes                 │
                    └────────────────┬──────────────────────────┘
                                     │ HTTP interno
                    ┌────────────────▼──────────────────────────┐
                    │  nginx API Gateway  (:8080)               │
                    │  Rate limiting · CORS · Health rewrites   │
                    └──────┬─────────────┬───────────────┬──────┘
                           │             │               │
               ┌───────────▼──┐  ┌───────▼───┐  ┌───────▼───┐
               │ auth-service │  │user-service│  │task-service│
               │   :8003      │  │   :8001    │  │   :8002    │
               │  PostgreSQL  │  │ PostgreSQL │  │  MongoDB   │
               └──────────────┘  └─────┬─────┘  └─────┬──────┘
                                        │               │
                                   ┌────▼───────────────▼────┐
                                   │  RabbitMQ  (:5672)      │
                                   │  notification-worker     │
                                   └─────────────────────────┘
```

| Servicio              | Tecnología              | Puerto |
|-----------------------|-------------------------|--------|
| frontend              | Next.js 15 + Tailwind   | 3001   |
| nginx (API Gateway)   | nginx:alpine            | 8080   |
| auth-service          | FastAPI + PostgreSQL     | 8003   |
| user-service          | FastAPI + PostgreSQL     | 8001   |
| task-service          | FastAPI + MongoDB        | 8002   |
| notification-worker   | Python + RabbitMQ/pika  | —      |
| RabbitMQ              | rabbitmq:management     | 15672  |

---

## Requisitos previos

### 1. Docker Desktop

Descarga e instala Docker Desktop según tu sistema operativo:

- **Windows:** https://docs.docker.com/desktop/install/windows-install/
- **macOS:** https://docs.docker.com/desktop/install/mac-install/
- **Linux:** https://docs.docker.com/desktop/install/linux-install/

> Después de instalar, abre Docker Desktop y espera a que el ícono de la ballena aparezca en verde antes de continuar.

Verifica que Docker esté funcionando:

```bash
docker --version
docker compose version
```

### 2. Git

- **Windows / macOS:** https://git-scm.com/downloads
- **Linux:** `sudo apt install git` o `sudo dnf install git`

### 3. VS Code (opcional, para explorar el código)

- Descarga en: https://code.visualstudio.com/

---

## Instalación y ejecución

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/morbanjunior/todomaster.git
cd todomaster
```

### Paso 2 — Crear el archivo de variables de entorno

Copia el archivo de ejemplo y edita los valores:

```bash
# Linux / macOS
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Abre `.env` y reemplaza los valores:

```env
SECRET_KEY=pon_aqui_una_clave_larga_y_aleatoria
POSTGRES_USER=admin
POSTGRES_PASSWORD=tu_contraseña_segura
MONGO_USER=admin
MONGO_PASSWORD=tu_contraseña_segura
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=tu_contraseña_segura
```

> El archivo `.env` está en `.gitignore` y nunca se sube al repositorio.

### Paso 3 — Levantar todos los servicios

```bash
docker compose up --build
```

La primera vez tarda unos minutos mientras Docker descarga las imágenes y construye los contenedores. Verás logs de todos los servicios en la terminal.

Cuando veas mensajes como `Application startup complete` en los tres servicios, la app está lista.

### Paso 4 — Abrir la aplicación

Abre tu navegador en:

```
http://localhost:3001
```

---

## URLs útiles

| URL                               | Descripción                        |
|-----------------------------------|------------------------------------|
| http://localhost:3001             | Aplicación frontend                |
| http://localhost:8080/health/auth | Health check — auth-service        |
| http://localhost:8080/health/users| Health check — user-service        |
| http://localhost:8080/health/tasks| Health check — task-service        |
| http://localhost:15672            | RabbitMQ Management UI             |
| http://localhost:8080/docs/auth   | Swagger — auth-service             |
| http://localhost:8080/docs/users  | Swagger — user-service             |
| http://localhost:8080/docs/tasks  | Swagger — task-service             |

Credenciales de RabbitMQ Management: las que configuraste en `.env` (`RABBITMQ_USER` / `RABBITMQ_PASSWORD`).

---

## Explorar el código con VS Code

### Opción A — Abrir desde la terminal

```bash
# Estando dentro de la carpeta todomaster
code .
```

### Opción B — Desde VS Code

1. Abre VS Code
2. `File` → `Open Folder...`
3. Selecciona la carpeta `todomaster`

### Extensiones recomendadas

Instálalas desde el panel de extensiones (`Ctrl+Shift+X`):

| Extensión                  | ID                              | Para qué sirve                     |
|----------------------------|---------------------------------|------------------------------------|
| Python                     | `ms-python.python`              | Soporte Python / FastAPI           |
| Pylance                    | `ms-python.vscode-pylance`      | IntelliSense para Python           |
| ES7+ React/Redux Snippets  | `dsznajder.es7-react-js-snippets` | Snippets Next.js / TypeScript    |
| Docker                     | `ms-azuretools.vscode-docker`   | Ver y gestionar contenedores       |
| MongoDB for VS Code        | `mongodb.mongodb-vscode`        | Explorar la base de datos MongoDB  |
| YAML                       | `redhat.vscode-yaml`            | Validación docker-compose.yml      |
| Tailwind CSS IntelliSense  | `bradlc.vscode-tailwindcss`     | Autocompletado de clases Tailwind  |

---

## Estructura del proyecto

```
todomaster/
├── auth-service/          # FastAPI — JWT, login, registro
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── requirements.txt
│   └── Dockerfile
├── user-service/          # FastAPI — gestión de usuarios
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── requirements.txt
│   └── Dockerfile
├── task-service/          # FastAPI — gestión de tareas (MongoDB)
│   ├── main.py
│   ├── database.py
│   ├── schemas.py
│   ├── requirements.txt
│   └── Dockerfile
├── notification-worker/   # Worker RabbitMQ — notificaciones
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/              # Next.js 15 — UI + BFF (API Routes)
│   ├── app/
│   │   ├── page.tsx               # Login / Registro
│   │   ├── dashboard/
│   │   │   ├── page.tsx           # Server component (auth guard)
│   │   │   └── DashboardClient.tsx
│   │   └── api/                   # BFF — proxies hacia nginx
│   │       ├── auth/
│   │       ├── users/
│   │       ├── tasks/
│   │       └── health/
│   ├── middleware.ts       # Protección de rutas con cookies
│   └── Dockerfile
├── nginx/
│   └── nginx.conf          # API Gateway — routing + rate limit + CORS
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Comandos útiles

```bash
# Levantar en segundo plano
docker compose up --build -d

# Ver logs de un servicio específico
docker compose logs -f auth-service
docker compose logs -f task-service

# Detener todos los servicios
docker compose down

# Detener y eliminar volúmenes (borra las bases de datos)
docker compose down -v

# Reconstruir un servicio sin tocar los demás
docker compose up --build auth-service

# Ver el estado de los contenedores
docker compose ps
```

---

## Patrones de diseño implementados

- **Database per Service** — cada microservicio tiene su propia base de datos
- **API Gateway** — nginx como único punto de entrada con rate limiting y CORS centralizado
- **BFF (Backend for Frontend)** — Next.js API Routes actúan como proxy, leyendo cookies HttpOnly server-side
- **Event-Driven** — user-service y task-service publican eventos en RabbitMQ; notification-worker los consume
- **HttpOnly Cookies** — JWT nunca expuesto a JavaScript; almacenado solo en cookie segura
- **Independent Service Resilience** — el frontend carga usuarios y tareas de forma independiente; si un servicio cae, el otro sigue funcionando

---

## Licencia

MIT
