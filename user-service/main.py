import os
import json
import pika
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt as jose_jwt
from database import engine, get_db
import models
import schemas

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="User Service API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RABBITMQ_URL = os.environ["RABBITMQ_URL"]
SECRET_KEY   = os.environ["SECRET_KEY"]
ALGORITHM    = "HS256"

COLAS_USER_EVENTS = ["task.user_events", "notification.user_events"]

bearer_scheme = HTTPBearer()


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
        print(f"[!] RabbitMQ no disponible: {e}")


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "service": "user-service", "db": "postgresql"}
    except Exception as e:
        return JSONResponse({"status": "degraded", "service": "user-service", "db": str(e)}, status_code=503)


# ─── ENDPOINTS SIN AUTH (llamadas internas entre servicios) ──────────────────

@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Llamado por auth-service al registrar. No requiere JWT."""
    if db.query(models.UserDB).filter(models.UserDB.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    new_user = models.UserDB(name=user.name, email=user.email)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.get("/users/by-email/{email}", response_model=schemas.UserResponse)
def get_user_by_email(email: str, db: Session = Depends(get_db)):
    """Llamado por auth-service para recuperar ID en registro parcial. Sin JWT."""
    db_user = db.query(models.UserDB).filter(models.UserDB.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user


@app.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Llamado por task-service para validar que el usuario existe. Sin JWT."""
    db_user = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return db_user


# ─── ENDPOINTS PROTEGIDOS (requieren JWT) ────────────────────────────────────

@app.get("/users/", response_model=list[schemas.UserResponse])
def get_my_profile(
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Devuelve solo el perfil del usuario autenticado."""
    db_user = db.query(models.UserDB).filter(models.UserDB.id == current_user_id).first()
    return [db_user] if db_user else []


@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user: schemas.UserUpdate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Solo el propio usuario puede editar su perfil."""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="No puedes modificar el perfil de otro usuario")
    db_user = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db_user.name  = user.name
    db_user.email = user.email
    db.commit()
    db.refresh(db_user)
    return db_user


@app.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Solo el propio usuario puede eliminar su cuenta."""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="No puedes eliminar la cuenta de otro usuario")
    db_user = db.query(models.UserDB).filter(models.UserDB.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(db_user)
    db.commit()
    publicar_evento("user_events", {"action": "user_deleted", "user_id": user_id}, COLAS_USER_EVENTS)
    return None
