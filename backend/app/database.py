"""SQLAlchemy engine, session and declarative base."""
from sqlalchemy import create_engine
from sqlalchemy import inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.is_sqlite else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def ensure_schema() -> None:
    """Add columns introduced after the first create_all without a migration tool."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    statements: list[str] = []
    if "questions" in tables:
        cols = {c["name"] for c in inspector.get_columns("questions")}
        if "course" not in cols:
            statements.append("ALTER TABLE questions ADD COLUMN course VARCHAR(255)")
        if "difficulty" not in cols:
            statements.append("ALTER TABLE questions ADD COLUMN difficulty VARCHAR(20) DEFAULT 'medium'")
    if "submissions" in tables:
        cols = {c["name"] for c in inspector.get_columns("submissions")}
        if "student_id" not in cols:
            statements.append("ALTER TABLE submissions ADD COLUMN student_id VARCHAR(64)")
        if "student_name" not in cols:
            statements.append("ALTER TABLE submissions ADD COLUMN student_name VARCHAR(255)")
    if "users" in tables:
        cols = {c["name"] for c in inspector.get_columns("users")}
        if "roll_number" not in cols:
            statements.append("ALTER TABLE users ADD COLUMN roll_number VARCHAR(64)")
    with engine.begin() as conn:
        for sql in statements:
            conn.execute(text(sql))
        if "users" in tables:
            conn.execute(text("UPDATE users SET role = 'student' WHERE role = 'viewer'"))
            conn.execute(text("UPDATE users SET role = 'teacher' WHERE role = 'analyst'"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
