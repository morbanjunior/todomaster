import os
import json
import time
import threading
import httpx
import pika
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt as jose_jwt
from bson import ObjectId
from bson.errors import InvalidId
from database import tasks_collection
import schemas

app = FastAPI(title="Task Service API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RABBITMQ_URL     = os.environ["RABBITMQ_URL"]
USER_SERVICE_URL = os.environ["USER_SERVICE_URL"]
SECRET_KEY       = os.environ["SECRET_KEY"]
ALGORITHM        = "HS256"

COLA_ENTRADA     = "task.user_events"
COLAS_TASK_EVENTS = ["notification.task_events"]

bearer_scheme = HTTPBearer()


# ─── JWT ──────────────────────────────────────────────────────────────────────

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> int:
    """Valida el JWT y devuelve el user_id del usuario autenticado."""
    try:
        payload = jose_jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido: falta 'sub'")
        return int(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def task_helper(task: dict) -> dict:
    return {
        "id":          str(task["_id"]),
        "title":       task["title"],
        "description": task.get("description"),
        "user_id":     task["user_id"],
    }


def publicar_evento(exchange: str, mensaje: dict, colas: list):
    try:
        parametros = pika.URLParameters(RABBITMQ_URL)
        conexion   = pika.BlockingConnection(parametros)
        canal      = conexion.channel()
        canal.exchange_declare(exchange=exchange, exchange_type="fanout", durable=True)
        for cola in colas:
            canal.queue_declare(queue=cola, durable=True)
            canal.queue_bind(exchange=exchange, queue=cola)
        canal.basic_publish(
            exchange=exchange,
            routing_key="",
            body=json.dumps(mensaje),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        conexion.close()
        print(f"[✓] Evento publicado en '{exchange}': {mensaje}")
    except Exception as e:
        print(f"[!] Error publicando en RabbitMQ: {e}")


@app.get("/health")
def health():
    try:
        tasks_collection.database.client.admin.command("ping")
        return {"status": "ok", "service": "task-service", "db": "mongodb"}
    except Exception as e:
        return JSONResponse({"status": "degraded", "service": "task-service", "db": str(e)}, status_code=503)


# ─── ENDPOINTS (todos requieren JWT) ─────────────────────────────────────────

@app.post("/tasks/", response_model=schemas.TaskResponse, status_code=201)
def create_task(
    task: schemas.TaskCreate,
    current_user_id: int = Depends(get_current_user_id),
):
    # user_id viene del JWT — el cliente no puede crear tareas para otros
    try:
        response = httpx.get(f"{USER_SERVICE_URL}/users/{current_user_id}")
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        elif response.status_code != 200:
            raise HTTPException(status_code=500, detail="Error en User-Service")
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="User-Service inalcanzable")

    nuevo_doc = {
        "title":       task.title,
        "description": task.description,
        "user_id":     current_user_id,
    }
    result = tasks_collection.insert_one(nuevo_doc)
    creada = tasks_collection.find_one({"_id": result.inserted_id})

    publicar_evento(
        "task_events",
        {"task_id": str(result.inserted_id), "title": task.title, "user_id": current_user_id},
        COLAS_TASK_EVENTS,
    )
    return task_helper(creada)


@app.get("/tasks/", response_model=list[schemas.TaskResponse])
def get_my_tasks(current_user_id: int = Depends(get_current_user_id)):
    """Devuelve solo las tareas del usuario autenticado."""
    tareas = tasks_collection.find({"user_id": current_user_id})
    return [task_helper(t) for t in tareas]


@app.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task(task_id: str, current_user_id: int = Depends(get_current_user_id)):
    try:
        tarea = tasks_collection.find_one({"_id": ObjectId(task_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID de tarea inválido")
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if tarea["user_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta tarea")
    return task_helper(tarea)


@app.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: str,
    task: schemas.TaskUpdate,
    current_user_id: int = Depends(get_current_user_id),
):
    try:
        oid = ObjectId(task_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID de tarea inválido")

    tarea = tasks_collection.find_one({"_id": oid})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if tarea["user_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="No puedes editar una tarea de otro usuario")

    actualizada = tasks_collection.find_one_and_update(
        {"_id": oid},
        {"$set": {"title": task.title, "description": task.description}},
        return_document=True,
    )
    return task_helper(actualizada)


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, current_user_id: int = Depends(get_current_user_id)):
    try:
        oid = ObjectId(task_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID de tarea inválido")

    tarea = tasks_collection.find_one({"_id": oid})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if tarea["user_id"] != current_user_id:
        raise HTTPException(status_code=403, detail="No puedes eliminar una tarea de otro usuario")

    tasks_collection.delete_one({"_id": oid})
    return None


# ─── CONSUMER RABBITMQ EN SEGUNDO PLANO ──────────────────────────────────────

def procesar_mensaje(ch, method, properties, body):
    try:
        datos = json.loads(body)
        if datos.get("action") == "user_deleted":
            user_id = datos["user_id"]
            print(f"[*] Limpiando tareas del usuario {user_id}...")
            tasks_collection.delete_many({"user_id": user_id})
            print(f"[✓] Tareas del usuario {user_id} eliminadas.")
    except Exception as e:
        print(f"[!] Error procesando mensaje: {e}")
    finally:
        ch.basic_ack(delivery_tag=method.delivery_tag)


def escuchar_eventos_usuarios():
    while True:
        try:
            parametros = pika.URLParameters(RABBITMQ_URL)
            conexion   = pika.BlockingConnection(parametros)
            canal      = conexion.channel()
            canal.exchange_declare(exchange="user_events", exchange_type="fanout", durable=True)
            canal.queue_declare(queue=COLA_ENTRADA, durable=True)
            canal.queue_bind(exchange="user_events", queue=COLA_ENTRADA)
            canal.basic_qos(prefetch_count=1)
            canal.basic_consume(queue=COLA_ENTRADA, on_message_callback=procesar_mensaje)
            print(f"[*] Task-Service: escuchando cola '{COLA_ENTRADA}'...")
            canal.start_consuming()
        except Exception as e:
            print(f"[!] Consumer desconectado: {e}. Reintentando en 5s...")
            time.sleep(5)


@app.on_event("startup")
def startup_event():
    hilo = threading.Thread(target=escuchar_eventos_usuarios, daemon=True)
    hilo.start()
