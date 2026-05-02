from pydantic import BaseModel
from typing import Optional


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    # user_id eliminado del body: ahora se extrae del JWT en el servidor


class TaskResponse(BaseModel):
    id: str          # MongoDB ObjectId serializado como string
    title: str
    description: Optional[str] = None
    user_id: int


class TaskUpdate(BaseModel):
    title: str
    description: Optional[str] = None
