import asyncio
from typing import Type, TypeVar

from langchain_groq import ChatGroq
from pydantic import BaseModel

from .config import GROQ_API_KEY, MODEL_REASONING

T = TypeVar("T", bound=BaseModel)


def get_llm(model: str | None = None, temperature: float = 0.1) -> ChatGroq:
    return ChatGroq(model=model or MODEL_REASONING, temperature=temperature, api_key=GROQ_API_KEY, max_retries=1)


async def run_structured(schema: Type[T], system: str, human: str, model: str | None = None) -> T:
    """Call Groq and get a validated Pydantic object back.

    Retries on rate limits (429) and the occasional malformed tool call.
    """
    llm = get_llm(model).with_structured_output(schema)
    messages = [("system", system), ("human", human)]
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            return await llm.ainvoke(messages)
        except Exception as e:  # noqa: BLE001
            last_err = e
            text = str(e).lower()
            if "401" in text or "invalid api key" in text:
                raise RuntimeError("Groq rejected the API key. Check GROQ_API_KEY in backend/.env") from e
            wait = 4 * (attempt + 1) if ("429" in text or "rate" in text) else 1.5
            await asyncio.sleep(wait)
    raise RuntimeError(f"LLM call failed after retries: {last_err}")


async def run_text(system: str, messages: list[tuple[str, str]], model: str | None = None) -> str:
    llm = get_llm(model, temperature=0.2)
    out = await llm.ainvoke([("system", system), *messages])
    return str(out.content)
