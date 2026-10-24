from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


def _now():
    return datetime.now(timezone.utc)


class Investigation(Base):
    """One saved RCA investigation.

    Searchable header columns are denormalised from the form; the full form
    (5 Whys, fishbone, root causes, evidence gaps, CAPA) lives in `data` (JSON).
    `ai_snapshot` keeps the untouched AI output so reviewers can diff what the
    human changed before saving.
    """

    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, index=True)
    deviation_number = Column(String(64), index=True, default="")
    title = Column(String(300), default="")
    product_name = Column(String(200), default="")
    batch_number = Column(String(100), default="")
    classification = Column(String(20), default="")
    status = Column(String(40), default="Draft")  # Draft | Submitted for QA review
    reviewed_by = Column(String(200), default="")
    source_text = Column(Text, default="")
    ai_snapshot = Column(JSON, nullable=True)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
