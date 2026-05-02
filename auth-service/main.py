import os
import httpx
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from database import engine, get_db
import models
import schemas

# --- CONFIGURACIÓN DE SEGURIDAD ---
SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
USER_SERVICE_URL = os.environ["USER_SERVICE_URL"]

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="Auth Service API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "service": "auth-service", "db": "postgresql"}
    except Exception as e:
        return JSONResponse({"status": "degraded", "service": "auth-service", "db": str(e)}, status_code=503)


@app.post("/auth/register")
def register(user: schemas.UserRegister, db: Session = Depends(get_db)):
    # 1. Verificamos si ya existe en la bóveda
    if db.query(models.AuthUserDB).filter(models.AuthUserDB.email == user.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # 2. Transacción Distribuida: Pedimos al User-Service que cree el perfil
    try:
        response = httpx.post(f"{USER_SERVICE_URL}/users/", json={"name": user.name, "email": user.email})

        if response.status_code == 200:
            # Caso normal: usuario creado en user-service
            new_user_id = response.json()["id"]

        elif response.status_code == 400:
            # Registro parcial: el usuario ya existe en user_db pero no en auth_db
            # (ocurre cuando un registro anterior falló después de crear el perfil).
            # Recuperamos el ID existente para completar el registro.
            lookup = httpx.get(f"{USER_SERVICE_URL}/users/by-email/{user.email}")
            if lookup.status_code != 200:
                raise HTTPException(status_code=400, detail=f"User-Service: {response.json().get('detail', 'error desconocido')}")
            new_user_id = lookup.json()["id"]

        else:
            raise HTTPException(status_code=502, detail=f"User-Service respondió {response.status_code}")

    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="User-Service inalcanzable")

    # 3. Guardamos la credencial en nuestra bóveda usando el mismo ID
    hashed_pwd = pwd_context.hash(user.password)
    new_auth_record = models.AuthUserDB(id=new_user_id, email=user.email, hashed_password=hashed_pwd)
    db.add(new_auth_record)
    db.commit()
    
    return {"message": "Usuario registrado con éxito", "user_id": new_user_id}

@app.post("/auth/login")
def login(form_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.AuthUserDB).filter(models.AuthUserDB.email == form_data.email).first()
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Generamos el JWT
    expiracion = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user.id), "email": user.email, "exp": expiracion}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    return {"access_token": token, "token_type": "bearer", "user_id": user.id}