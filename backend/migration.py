from venv import logger
from sqlalchemy import inspect, MetaData, Table, Column, Integer, String, DateTime, create_engine, text
from datetime import datetime

def migrate_database():
    
    """Runtime migration to add experiment_id column if it doesn't exist"""
    logger.info("Starting database migration...")
    engine = create_engine('sqlite:///comparisons.db')
    
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        try:
            if 'experiments' not in inspector.get_table_names():
                logger.info("Creating experiments table")
                metadata = MetaData()
                experiments = Table(
                    'experiments', 
                    metadata,
                    Column('id', Integer, primary_key=True),
                    Column('experiment_id', String, nullable=False),
                    Column('created_at', DateTime, default=datetime.utcnow)
                )
                metadata.create_all(engine)
                logger.info("Created experiments table successfully")
            
            columns = [column['name'] for column in inspector.get_columns('comparison_results')]
            
            if 'experiment_id' not in columns:
                logger.info("Adding experiment_id column to comparison_results table")
                conn.execute(text("PRAGMA foreign_keys=off"))
                conn.execute(text("ALTER TABLE comparison_results ADD COLUMN experiment_id INTEGER REFERENCES experiments(id)"))
                conn.execute(text("PRAGMA foreign_keys=on"))
                conn.commit()
                logger.info("Added experiment_id column successfully")
            else:
                logger.info("experiment_id column already exists")
                
        except Exception as e:
            logger.error(f"Error during migration: {str(e)}")