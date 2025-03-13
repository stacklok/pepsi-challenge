import os
from typing import List, Optional, Dict, Any

from sqlalchemy import create_engine, Column, Integer, String, Boolean, select
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

from config import Config

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

Base = declarative_base()


class User(Base):
    """SQLAlchemy model for the users table with admin flag."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    admin = Column(Boolean, default=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', admin={self.admin})>"

    def to_dict(self) -> Dict[str, Any]:
        """Convert User object to dictionary."""
        return {"id": self.id, "username": self.username, "admin": self.admin}


# Create database and tables
engine = create_engine(f"sqlite://{Config.USER_DB_LOCATION}")
Base.metadata.create_all(engine)

# Create session factory
Session = sessionmaker(bind=engine)
