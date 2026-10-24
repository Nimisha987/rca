import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL_REASONING = os.getenv("GROQ_MODEL_REASONING", "llama-3.3-70b-versatile")
MODEL_EXTRACT = os.getenv("GROQ_MODEL_EXTRACT", "llama-3.3-70b-versatile")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://rca:rca@localhost:5432/rca")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Keep prompts inside Groq's free-tier token limits.
MAX_SOURCE_CHARS = 14000
SAMPLE_DIR = BASE_DIR / "sample_docs"
