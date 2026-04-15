"""
LLM integration layer supporting Ollama (local) and Groq (cloud).

Provides four public functions:
- generate_interview_question()  - craft a question (avoids repeats)
- evaluate_answer()              - structured feedback dict
- generate_followup_question()   - contextual follow-up based on the response
- generate_session_feedback()    - holistic session-level analysis

All public functions use automatic retry with exponential back-off.
"""

import asyncio
import json
import logging
import re
from functools import wraps
from typing import Any, Callable, Coroutine, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Conditional imports based on the configured provider
if settings.AI_PROVIDER == "groq":
    try:
        from groq import AsyncGroq
    except ImportError:
        raise ImportError("Install the groq package: pip install groq")
else:
    try:
        import ollama
    except ImportError:
        logger.warning(
            "ollama package not installed - install it for local inference: pip install ollama"
        )
        ollama = None  # type: ignore[assignment]

# --- Retry decorator ---

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # seconds


def with_retry(
    max_retries: int = MAX_RETRIES,
    base_delay: float = RETRY_BASE_DELAY,
):
    """Decorator: retries an async function with exponential back-off on transient errors."""

    def decorator(
        fn: Callable[..., Coroutine[Any, Any, Any]],
    ) -> Callable[..., Coroutine[Any, Any, Any]]:
        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exc: Exception | None = None
            for attempt in range(1, max_retries + 1):
                try:
                    return await fn(*args, **kwargs)
                except (ConnectionError, TimeoutError, OSError) as exc:
                    last_exc = exc
                    if attempt < max_retries:
                        delay = base_delay * (2 ** (attempt - 1))
                        logger.warning(
                            "%s attempt %d/%d failed (%s). Retrying in %.1fs",
                            fn.__name__, attempt, max_retries, exc, delay,
                        )
                        await asyncio.sleep(delay)
                except Exception as exc:
                    exc_name = type(exc).__name__
                    if "ResponseError" in exc_name or "AuthenticationError" in exc_name:
                        raise RuntimeError(f"AI provider error: {exc}") from exc
                    last_exc = exc
                    if attempt < max_retries:
                        delay = base_delay * (2 ** (attempt - 1))
                        logger.warning(
                            "%s attempt %d/%d failed (%s). Retrying in %.1fs",
                            fn.__name__, attempt, max_retries, exc, delay,
                        )
                        await asyncio.sleep(delay)
            raise last_exc  # type: ignore[misc]

        return wrapper

    return decorator


# --- Prompt templates (one per interview type) ---

INTERVIEW_PROMPTS: dict[str, str] = {
    "coding": (
        "You are a senior software engineer conducting a {difficulty} level "
        "technical coding interview.\nTopic: {topic}\n"
        "{language_context}"
        "\n{previous_context}"
        "Generate exactly ONE clear and concise coding interview question.\n"
        "Requirements:\n"
        "- Appropriate for {difficulty} difficulty\n"
        "- Focus on practical coding and problem-solving\n"
        "{language_requirements}"
        "- Include a brief problem statement with example input/output if applicable\n"
        "- Solvable within 15-20 minutes\n\n"
        "Return ONLY the question text. No answer, hints, or preamble."
    ),
    "behavioral": (
        "You are an experienced hiring manager conducting a {difficulty} level "
        "behavioral interview.\nTopic: {topic}\n\n"
        "{previous_context}"
        "Generate exactly ONE behavioral interview question.\n"
        "Requirements:\n"
        "- Follow the STAR method (Situation, Task, Action, Result)\n"
        "- Appropriate for {difficulty} difficulty\n"
        "- Assess real-world experience and soft skills\n\n"
        "Return ONLY the question text. No expected answer or preamble."
    ),
    "system_design": (
        "You are a principal engineer conducting a {difficulty} level "
        "system design interview.\nTopic: {topic}\n\n"
        "{previous_context}"
        "Generate exactly ONE system design interview question.\n"
        "Requirements:\n"
        "- Appropriate for {difficulty} difficulty\n"
        "- Present a real-world system to design or improve\n"
        "- Mention specific scale expectations or constraints\n"
        "- Open-ended enough to explore multiple trade-offs\n\n"
        "Return ONLY the question text. No solution or preamble."
    ),
}

SYSTEM_PROMPT = (
    "You are a professional technical interviewer. "
    "Always respond with a single, well-crafted interview question. "
    "Never include answers, hints, or extra commentary."
)


# --- Internal helpers ---

def _build_previous_context(previous_questions: list[str] | None) -> str:
    """Build a prompt fragment telling the LLM to avoid previously asked questions."""
    if not previous_questions:
        return ""
    numbered = "\n".join(
        f"  {i}. {q}" for i, q in enumerate(previous_questions, 1)
    )
    return (
        "The following questions have already been asked in this session - "
        "do NOT repeat or rephrase any of them:\n"
        f"{numbered}\n\n"
    )


def _extract_json(text: str) -> dict:
    """Best-effort extraction of a JSON object from LLM output.

    Handles markdown code fences and prose surrounding the JSON block.
    """
    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = cleaned.strip().rstrip("`")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find the first { ... } block
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from LLM output: {text[:200]}")


async def _chat(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.7,
    num_predict: int = 512,
    top_p: float | None = None,
) -> str:
    """Route to the configured AI provider (Ollama or Groq)."""
    if settings.AI_PROVIDER == "groq":
        return await _chat_groq(messages, temperature=temperature,
                                max_tokens=num_predict, top_p=top_p)
    return await _chat_ollama(messages, temperature=temperature,
                              num_predict=num_predict, top_p=top_p)


async def _chat_groq(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.7,
    max_tokens: int = 512,
    top_p: float | None = None,
) -> str:
    """Call the Groq cloud API (OpenAI-compatible interface)."""
    kwargs: dict[str, Any] = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if top_p is not None:
        kwargs["top_p"] = top_p

    try:
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(**kwargs)
        text: str = response.choices[0].message.content.strip()
        if not text:
            raise RuntimeError("Groq returned an empty response")
        return text
    except Exception as exc:
        msg = str(exc).lower()
        if "authentication" in msg or "api_key" in msg:
            raise RuntimeError(
                "Groq authentication failed. Check your GROQ_API_KEY."
            ) from exc
        if "rate" in msg and "limit" in msg:
            raise ConnectionError(
                "Groq rate limit hit. Wait a moment and retry."
            ) from exc
        raise


async def _chat_ollama(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.7,
    num_predict: int = 512,
    top_p: float | None = None,
) -> str:
    """Call local Ollama instance."""
    options: dict[str, Any] = {
        "temperature": temperature,
        "num_predict": num_predict,
    }
    if top_p is not None:
        options["top_p"] = top_p

    try:
        client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
        response = await client.chat(
            model=settings.OLLAMA_MODEL,
            messages=messages,
            options=options,
        )
        text: str = response["message"]["content"].strip()
        if not text:
            raise RuntimeError("Ollama returned an empty response")
        return text
    except ollama.ResponseError:
        raise  # let the retry decorator decide
    except Exception as exc:
        msg = str(exc).lower()
        if "connect" in msg or "refused" in msg:
            raise ConnectionError(
                f"Cannot connect to Ollama at {settings.OLLAMA_BASE_URL}. "
                "Make sure Ollama is running and the model is pulled "
                f"(ollama pull {settings.OLLAMA_MODEL})."
            ) from exc
        raise


# --- Public API ---

@with_retry()
async def generate_interview_question(
    interview_type: str,
    difficulty: str,
    topic: str,
    previous_questions: list[str] | None = None,
    programming_language: str | None = None,
) -> str:
    """Generate one interview question, avoiding *previous_questions*."""

    template = INTERVIEW_PROMPTS.get(interview_type)
    if template is None:
        raise ValueError(
            f"Unknown interview type '{interview_type}'. "
            f"Choose from: {', '.join(INTERVIEW_PROMPTS)}"
        )

    # Build language-specific context for coding questions
    language_context = ""
    language_requirements = ""
    if programming_language and interview_type == "coding":
        language_context = f"Programming Language: {programming_language}\n"
        language_requirements = (
            f"- The question MUST be specific to {programming_language}\n"
            f"- Use {programming_language} syntax, idioms, and standard library in examples\n"
            f"- Test knowledge of {programming_language}-specific features and best practices\n"
        )

    prompt = template.format(
        difficulty=difficulty,
        topic=topic,
        previous_context=_build_previous_context(previous_questions),
        language_context=language_context,
        language_requirements=language_requirements,
    )

    model_name = settings.GROQ_MODEL if settings.AI_PROVIDER == "groq" else settings.OLLAMA_MODEL
    logger.info(
        "Generating %s question | difficulty=%s | topic=%s | lang=%s | model=%s | prev=%d",
        interview_type, difficulty, topic, programming_language or "any", model_name,
        len(previous_questions or []),
    )

    text = await _chat(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        top_p=0.9,
        num_predict=512,
    )
    logger.info("Question generated (%d chars)", len(text))
    return text


@with_retry()
async def evaluate_answer(
    question: str,
    user_answer: str,
    interview_type: str,
    difficulty: str,
    programming_language: str | None = None,
) -> dict:
    """Evaluate a candidate's answer and return structured feedback as a dict.

    When *programming_language* is provided, evaluation criteria include
    language-specific correctness, idiomatic usage, and best practices.
    """

    lang_context = ""
    if programming_language and interview_type == "coding":
        lang_context = (
            f"\nThe candidate is expected to answer in {programming_language}.\n"
            f"Evaluate their use of {programming_language}-specific syntax, "
            f"standard library, idioms, and best practices.\n"
            f"If their code is not in {programming_language}, flag this as an issue.\n"
        )

    prompt = (
        f"You are evaluating a candidate's answer in a {difficulty} level "
        f"{interview_type} interview.\n"
        f"{lang_context}\n"
        f"Question:\n{question}\n\n"
        f"Candidate's Answer:\n{user_answer}\n\n"
        "Respond with ONLY valid JSON in this format:\n"
        "{\n"
        '  "score": <1-10>,\n'
        '  "feedback": "<2-3 sentence overall feedback>",\n'
        '  "strengths": ["<strength 1>", "<strength 2>"],\n'
        '  "improvements": ["<area 1>", "<area 2>"]\n'
        "}"
    )

    try:
        raw = await _chat(
            messages=[
                {
                    "role": "system",
                    "content": "You are a fair technical interviewer. "
                               "Respond ONLY with valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            num_predict=512,
        )
        return _extract_json(raw)
    except Exception as exc:
        logger.error("Answer evaluation failed: %s", exc)
        return {
            "score": None,
            "feedback": "Evaluation temporarily unavailable.",
            "strengths": [],
            "improvements": [],
        }


@with_retry()
async def generate_followup_question(
    original_question: str,
    candidate_answer: str,
    interview_type: str,
    difficulty: str,
    topic: str,
    programming_language: str | None = None,
) -> str:
    """Generate a follow-up question based on the candidate's last answer.

    When *programming_language* is provided, the follow-up stays within
    the context of that specific language.
    """

    lang_context = ""
    if programming_language and interview_type == "coding":
        lang_context = (
            f"\nThis interview is specific to {programming_language}. "
            f"The follow-up question must stay within {programming_language} - "
            f"test deeper knowledge of its syntax, standard library, "
            f"language-specific features, or idiomatic patterns.\n"
        )

    prompt = (
        f"You are conducting a {difficulty} level {interview_type} interview "
        f"on {topic}.\n"
        f"{lang_context}\n"
        f"Previous Question:\n{original_question}\n\n"
        f"Candidate's Answer:\n{candidate_answer}\n\n"
        "Based on the candidate's answer, generate exactly ONE follow-up "
        "question that digs deeper into their understanding or explores an "
        "area they may have missed.\n\n"
        "Return ONLY the follow-up question text. No preamble or commentary."
    )

    text = await _chat(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.6,
        num_predict=512,
    )
    logger.info("Follow-up question generated (%d chars)", len(text))
    return text


@with_retry()
async def generate_session_feedback(
    interview_type: str,
    difficulty: str,
    topic: str,
    qa_pairs: list[dict[str, str]],
    programming_language: str | None = None,
) -> dict:
    """Generate holistic feedback for an entire interview session.

    Parameters
    ----------
    qa_pairs : list of dicts
        Each dict has keys ``question``, ``answer``, and optionally ``score``.
    programming_language : str, optional
        When provided, feedback includes language-specific assessment.

    Returns
    -------
    dict with keys: overall_score, summary, key_strengths,
    areas_for_improvement, recommendations.
    """
    qa_block = "\n\n".join(
        f"Q{i}: {pair['question']}\n"
        f"A{i}: {pair['answer']}"
        + (f"\n(Individual score: {pair['score']}/10)" if pair.get("score") else "")
        for i, pair in enumerate(qa_pairs, 1)
    )

    lang_context = ""
    if programming_language and interview_type == "coding":
        lang_context = (
            f"\nThis was a {programming_language}-specific coding interview. "
            f"Include assessment of the candidate's proficiency with "
            f"{programming_language} syntax, standard library, idiomatic patterns, "
            f"and language-specific best practices in your feedback.\n"
        )

    prompt = (
        f"You are reviewing a complete {difficulty} level {interview_type} "
        f"interview session on {topic}.\n"
        f"{lang_context}\n"
        f"Questions & Answers:\n{qa_block}\n\n"
        "Provide a holistic assessment. Respond with ONLY valid JSON:\n"
        "{\n"
        '  "overall_score": <1-10>,\n'
        '  "summary": "<3-4 sentence overall assessment>",\n'
        '  "key_strengths": ["<strength 1>", "<strength 2>"],\n'
        '  "areas_for_improvement": ["<area 1>", "<area 2>"],\n'
        '  "recommendations": ["<recommendation 1>", "<recommendation 2>"]\n'
        "}"
    )

    try:
        raw = await _chat(
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior technical interviewer writing a "
                               "post-interview debrief. Respond ONLY with valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            num_predict=1024,
        )
        return _extract_json(raw)
    except Exception as exc:
        logger.error("Session feedback generation failed: %s", exc)
        return {
            "overall_score": None,
            "summary": "Session feedback temporarily unavailable.",
            "key_strengths": [],
            "areas_for_improvement": [],
            "recommendations": [],
        }
