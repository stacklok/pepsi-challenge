from venv import logger
from sqlalchemy import inspect, MetaData, Table, Column, Integer, String, DateTime, create_engine, text
from datetime import datetime

def migrate_database():
    
    """Runtime migration to add experiment_id column if it doesn't exist, ensure FIM_LEGACY_CODEGATE entry exists,
    and associate all existing comparison results with this experiment"""
    logger.info("Starting database migration...")
    engine = create_engine('sqlite:///comparisons.db')
    
    inspector = inspect(engine)
    fim_legacy_id = None
    
    with engine.connect() as conn:
        try:
            # Create experiments table if it doesn't exist
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
            
            # Check if the FIM_LEGACY_CODEGATE entry exists in experiments table
            result = conn.execute(text("SELECT id FROM experiments WHERE experiment_id = 'FIM_LEGACY_CODEGATE'")).fetchone()
            
            # If FIM_LEGACY_CODEGATE entry doesn't exist, create it
            if not result:
                logger.info("Adding FIM_LEGACY_CODEGATE entry to experiments table")
                result = conn.execute(
                    text("INSERT INTO experiments (experiment_id, created_at) VALUES ('FIM_LEGACY_CODEGATE', :created_at) RETURNING id"),
                    {"created_at": datetime.utcnow()}
                ).fetchone()
                conn.commit()
                fim_legacy_id = result[0]
                logger.info(f"Added FIM_LEGACY_CODEGATE entry successfully with id: {fim_legacy_id}")
            else:
                fim_legacy_id = result[0]
                logger.info(f"FIM_LEGACY_CODEGATE entry already exists with id: {fim_legacy_id}")
            
            # Add experiment_id column to comparison_results if it doesn't exist
            columns = [column['name'] for column in inspector.get_columns('comparison_results')]
            
            if 'experiment_id' not in columns:
                logger.info("Adding experiment_id column to comparison_results table")
                conn.execute(text("PRAGMA foreign_keys=off"))
                conn.execute(text("ALTER TABLE comparison_results ADD COLUMN experiment_id INTEGER REFERENCES experiments(id)"))
                
                # Update all existing records to use the FIM_LEGACY_CODEGATE experiment
                logger.info(f"Updating all existing comparison results to use FIM_LEGACY_CODEGATE (id: {fim_legacy_id})")
                conn.execute(
                    text(f"UPDATE comparison_results SET experiment_id = {fim_legacy_id} WHERE experiment_id IS NULL")
                )
                
                conn.execute(text("PRAGMA foreign_keys=on"))
                conn.commit()
                logger.info("Added experiment_id column and updated all records successfully")
            else:
                # If column already exists, still make sure all records are associated with FIM_LEGACY_CODEGATE
                logger.info(f"experiment_id column already exists, updating any NULL values to FIM_LEGACY_CODEGATE (id: {fim_legacy_id})")
                conn.execute(
                    text(f"UPDATE comparison_results SET experiment_id = {fim_legacy_id} WHERE experiment_id IS NULL")
                )
                conn.commit()
                logger.info("Updated all NULL experiment_id records successfully")
                
        except Exception as e:
            logger.error(f"Error during migration: {str(e)}")
            raise
