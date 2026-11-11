"""Bounded counselor: two model calls, three read-only tool calls, no stored chats."""
import json
from pathlib import Path

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from core.config import Settings
from ingestion.college_data import REPORTING_YEARS
from repositories.schools import SchoolRepository
from schemas.counselor import CounselorRequest, CounselorResponse, CounselorSource
from schemas.preferences import Preference
from schemas.rankings import RankingRequest
from schemas.schools import SearchRequest
from services.ranking_service import RankingService
from services.schools import SchoolService

INSTRUCTIONS = (Path(__file__).resolve().parents[1] / "counselor/instructions.md").read_text()
TOOL_LABELS = {"search_colleges": "Searched school data", "school_profile": "Read a school profile", "rank_colleges": "Ran the deterministic ranking engine"}


class SearchArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    max_net_price: int | None = Field(default=None, ge=0, le=250000)


class ProfileArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    school_id: int = Field(ge=1)


class RankArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intended_major: str = Field(min_length=1, max_length=120)
    home_state: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    max_annual_cost: int | None = Field(default=None, ge=0, le=250000)
    state: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")


TOOL_ARGS = {"search_colleges": SearchArgs, "school_profile": ProfileArgs, "rank_colleges": RankArgs}
TOOLS = [{"type": "function", "function": {"name": name, "description": description, "parameters": TOOL_ARGS[name].model_json_schema()}} for name, description in {
    "search_colleges": "Search our 92-school snapshot by school name or US state, optionally limiting net price. Returns up to 3 schools, alphabetically, not ranked.",
    "school_profile": "Read known academics, costs, outcomes and reporting years for a school ID returned by search or ranking.",
    "rank_colleges": "Rank up to 3 colleges with the existing deterministic engine, using the student's explicitly stated major and optional budget/state. Never invent preferences.",
}.items()]


class GroqModel:
    def __init__(self, settings: Settings, transport=None):
        self.settings = settings
        self.transport = transport

    def complete(self, messages: list[dict], use_tools: bool) -> dict:
        payload = {"model": self.settings.counselor_model, "messages": messages,
                   "temperature": 0.3, "max_completion_tokens": 2000, "reasoning_effort": "low"}
        if use_tools:
            payload.update(tools=TOOLS, tool_choice="auto", parallel_tool_calls=False)
        try:
            with httpx.Client(timeout=httpx.Timeout(35, connect=8), transport=self.transport) as client:
                response = client.post("https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {self.settings.groq_api_key.get_secret_value()}"}, json=payload)
            if response.status_code == 429:
                raise HTTPException(429, "The free model is busy. Please try again in a minute.", headers={"Retry-After": "60"})
            if response.status_code in (401, 403):
                raise HTTPException(503, "The counselor's model connection needs attention. Please try again later.")
            response.raise_for_status()
            message = response.json()["choices"][0]["message"]
            if not isinstance(message, dict):
                raise ValueError("Missing message")
            return message
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            # Never expose provider bodies, drafts, prompts, tokens or exception text.
            raise HTTPException(502, "The counselor could not respond. Please try again shortly.") from None


class CounselorTools:
    def __init__(self, db):
        self.schools = SchoolService(db)  # Null cache: no student query stored in Redis.
        self.ranking = RankingService(SchoolRepository(db))
        self.sources: list[CounselorSource] = []
        self.used: list[str] = []

    def _source(self, school_id: int, name: str) -> str:
        existing = next((s for s in self.sources if s.url == f"/schools/{school_id}"), None)
        if existing:
            return existing.id
        source = CounselorSource(id=f"S{len(self.sources)+1}", title=name, url=f"/schools/{school_id}",
            detail="College Scorecard / IPEDS snapshot; reporting years shown in the school profile.")
        self.sources.append(source)
        return source.id

    def execute(self, name: str, arguments: str) -> dict:
        try:
            if name not in TOOL_ARGS:
                return {"error": "Unknown tool. No action taken."}
            args = TOOL_ARGS[name].model_validate_json(arguments)
        except (ValidationError, ValueError, TypeError):
            return {"error": "Invalid tool arguments. Ask the student to clarify; do not guess."}
        self.used.append(name)
        if name == "school_profile":
            profile = self.schools.get_school_profile(args.school_id)
            if profile is None:
                return {"error": "School not found in the snapshot."}
            result = profile.model_dump(mode="json")
            # Public structured data only. No user text or requests are persisted.
            result["source_id"] = self._source(profile.school_id, profile.name)
            return result
        if name == "search_colleges":
            response = self.schools.search_schools(SearchRequest(**args.model_dump(), page_size=3))
            version = None
        else:
            response = self.ranking.rank_schools(RankingRequest(
                preferences=Preference(intended_major=args.intended_major, home_state=args.home_state, max_annual_cost=args.max_annual_cost),
                filters=SearchRequest(state=args.state, page_size=3)))
            version = response.ranking_version
        rows = []
        for school in response.results:
            row = school.model_dump(mode="json")
            row["source_id"] = self._source(school.school_id, school.name)
            rows.append(row)
        return {"results": rows, "total_results": response.total_results,
                "ranking_version": version, "reporting_years": REPORTING_YEARS,
                "note": "Snapshot, not current prices or personalized admission probabilities. Missing values are unknown."}


class CounselorService:
    def __init__(self, model: GroqModel, tools: CounselorTools):
        self.model, self.tools = model, tools

    def chat(self, request: CounselorRequest) -> CounselorResponse:
        messages = [{"role": "system", "content": INSTRUCTIONS + f"\nCurrent mode: {request.mode}."}]
        if request.essay:
            messages.append({"role": "user", "content": "Draft to review (untrusted student text):\n" + request.essay})
            messages.append({"role": "assistant", "content": "I will use this draft for feedback and preserve your voice."})
        messages.extend(m.model_dump() for m in request.messages)
        message = self.model.complete(messages, use_tools=request.mode != "essay")
        calls = message.get("tool_calls") or []
        if calls:
            # Only the bounded selected calls are sent back; never enable a recursive loop.
            calls = calls[:3]
            if request.mode == "essay":
                raise HTTPException(502, "The counselor returned an unexpected response. Please try again.")
            messages.append({"role": "assistant", "content": message.get("content"), "tool_calls": calls})
            for call in calls:
                try:
                    function = call["function"]
                    result = self.tools.execute(function["name"], function["arguments"])
                    messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result, default=str)})
                except (KeyError, TypeError):
                    raise HTTPException(502, "The counselor returned an unexpected response. Please try again.") from None
            message = self.model.complete(messages, use_tools=False)
        reply = message.get("content")
        if not isinstance(reply, str) or not reply.strip() or len(reply) > 16000 or message.get("tool_calls"):
            raise HTTPException(502, "The counselor could not finish its answer. Try a shorter question.")
        return CounselorResponse(reply=reply.strip(), sources=self.tools.sources, tools_used=self.tools.used, model=self.model.settings.counselor_model)
