from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from enum import Enum

Base = declarative_base()

class ComparisonResult(Base):
    __tablename__ = 'comparison_results'

    id = Column(Integer, primary_key=True)
    github_username = Column(String, nullable=False)
    base_model_name = Column(String, nullable=False)
    finetuned_model_name = Column(String, nullable=False)
    preferred_model = Column(String, nullable=False)  # 'base' or 'finetuned'
    code_prefix = Column(Text, nullable=False)
    base_completion = Column(Text, nullable=False)
    finetuned_completion = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    @classmethod
    def get_preference_stats(cls, session):
        """Get statistics about model preferences"""
        base_count = session.query(cls).filter(
            cls.preferred_model == 'base'
        ).count()
        
        finetuned_count = session.query(cls).filter(
            cls.preferred_model == 'finetuned'
        ).count()
        
        total = base_count + finetuned_count
        
        return {
            "total": total,
            "base_count": base_count,
            "finetuned_count": finetuned_count,
            "base_percentage": (base_count / total * 100) if total > 0 else 0,
            "finetuned_percentage": (finetuned_count / total * 100) if total > 0 else 0
        }

# Create database and tables
engine = create_engine('sqlite:///comparisons.db')
Base.metadata.create_all(engine)

# Create session factory
Session = sessionmaker(bind=engine)

class Mode(str, Enum):
    fim = "fim"
    chat = "chat"