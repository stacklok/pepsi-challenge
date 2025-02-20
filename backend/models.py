from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

class ComparisonResult(Base):
    __tablename__ = 'comparison_results'

    id = Column(Integer, primary_key=True)
    github_username = Column(String, nullable=False)
    base_model_name = Column(String, nullable=False)
    finetuned_model_name = Column(String, nullable=False)
    preferred_model = Column(String, nullable=False)  # 'base' or 'finetuned'
    code_prefix = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    model_a_was_base = Column(Boolean, nullable=False)  # True if Model A was base model

# Create database and tables
engine = create_engine('sqlite:///comparisons.db')
Base.metadata.create_all(engine)

# Create session factory
Session = sessionmaker(bind=engine)