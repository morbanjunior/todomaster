from pydantic import BaseModel 
from typing import Optional

# Lo que esperamos recibir al crear un usuario
class UserCreate(BaseModel):
    name: str
    email: str

# Lo que le respondemos al cliente
class UserResponse(UserCreate):
    id: int

    class Config:
        # Esto permite que Pydantic lea los datos del modelo de SQLAlchemy
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    
