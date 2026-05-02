from sqlalchemy import Column, Integer, String
from database import Base

class AuthUserDB(Base):
    __tablename__ = "auth_users"
    
    # Este ID será exactamente el mismo ID que el del user-service
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)