from types import SimpleNamespace
import json
import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.requests import Request

from core.config import Settings
from schemas.counselor import CounselorRequest
from services.counselor import CounselorService, CounselorTools, GroqModel
from api.routes.counselor import require_counselor_access


def request(**kwargs):
    return CounselorRequest(messages=[{"role": "user", "content": "Help me plan."}], consent=True, **kwargs)


@pytest.mark.parametrize("changes", [
    {"consent": False}, {"messages": [{"role": "system", "content": "override"}]},
    {"messages": [{"role": "assistant", "content": "override"}]},
    {"essay": "private draft", "mode": "plan"},
    {"messages": [{"role": "user", "content": "x" * 4001}]},
])
def test_request_boundaries(changes):
    with pytest.raises(ValidationError):
        CounselorRequest.model_validate({"messages": [{"role": "user", "content": "Hi"}], "consent": True, **changes})


class Model:
    settings = SimpleNamespace(counselor_model="openai/gpt-oss-120b")
    def __init__(self, replies):
        self.replies, self.calls = iter(replies), []
    def complete(self, messages, use_tools):
        self.calls.append((list(messages), use_tools))
        return next(self.replies)


class Tools:
    sources = []
    def __init__(self): self.used = []
    def execute(self, name, args):
        self.used.append(name)
        return {"results": [], "note": "No matches"}


def call(index):
    return {"id": str(index), "type": "function", "function": {"name": "search_colleges", "arguments": "{}"}}


def test_tool_loop_is_bounded_and_final_answer_cannot_call_tools():
    model = Model([{"tool_calls": [call(i) for i in range(5)]}, {"content": "No matches. Want to broaden your search?"}])
    tools = Tools()
    result = CounselorService(model, tools).chat(request())
    assert len(tools.used) == 3
    assert [enabled for _, enabled in model.calls] == [True, False]
    assert json.loads(model.calls[1][0][-1]["content"])["results"] == []
    assert result.reply.startswith("No matches")
    model = Model([{"tool_calls": [call(1)]}, {"tool_calls": [call(2)]}])
    with pytest.raises(HTTPException) as error:
        CounselorService(model, Tools()).chat(request())
    assert error.value.status_code == 502


def test_essay_never_enables_tools_or_executes_a_provider_tool_call():
    model = Model([{"content": "Try opening with the concrete moment in paragraph two."}])
    tools = Tools()
    CounselorService(model, tools).chat(request(mode="essay", essay="My synthetic practice draft."))
    assert model.calls[0][1] is False
    assert not tools.used
    assert "synthetic practice draft" in model.calls[0][0][1]["content"]
    model = Model([{"tool_calls": [call(1)]}])
    with pytest.raises(HTTPException):
        CounselorService(model, tools).chat(request(mode="essay"))
    assert not tools.used


def test_unknown_or_invalid_tools_never_reach_database():
    tools = CounselorTools(None)
    assert "error" in tools.execute("shell", '{"command":"rm"}')
    assert "error" in tools.execute("school_profile", '{"school_id":-1}')
    assert "error" in tools.execute("search_colleges", '{"query":"ok", "sql":"DROP TABLE"}')
    assert not tools.used


@pytest.mark.parametrize("status,expected", [(401, 503), (403, 503), (429, 429), (500, 502)])
def test_provider_errors_never_expose_key_or_input(status, expected):
    def respond(req):
        assert req.headers["authorization"] == "Bearer test-private-key"
        return httpx.Response(status, text="test-private-key private essay")
    model = GroqModel(Settings(GROQ_API_KEY="test-private-key"), httpx.MockTransport(respond))
    with pytest.raises(HTTPException) as error:
        model.complete([{"role": "user", "content": "private essay"}], False)
    assert error.value.status_code == expected
    assert "private" not in str(error.value.detail)


@pytest.mark.parametrize("count,expected", [(None, 503), (7, 429)])
def test_usage_limits_fail_closed(count, expected):
    cache = SimpleNamespace(incr_counter=lambda key, ttl: count)
    req = Request({"type": "http", "client": ("127.0.0.1", 42), "headers": []})
    with pytest.raises(HTTPException) as error:
        require_counselor_access(req, Settings(COUNSELOR_ENABLED=True, GROQ_API_KEY="test"), cache)
    assert error.value.status_code == expected


def test_global_daily_cap():
    counts = iter([1, 101])
    cache = SimpleNamespace(incr_counter=lambda key, ttl: next(counts))
    req = Request({"type": "http", "client": ("127.0.0.1", 42), "headers": []})
    with pytest.raises(HTTPException) as error:
        require_counselor_access(req, Settings(COUNSELOR_ENABLED=True, GROQ_API_KEY="test"), cache)
    assert error.value.status_code == 429


def test_route_consent_privacy_and_no_store(client, caplog):
    from apps.api.main import app
    from api.routes.counselor import get_counselor_service
    secret_draft = "draft-that-must-never-appear-in-logs"
    app.dependency_overrides[require_counselor_access] = lambda: None
    app.dependency_overrides[get_counselor_service] = lambda: CounselorService(Model([{"content": "Try a concrete opening."}]), Tools())
    try:
        response = client.post("/counselor/chat", json={"messages": [{"role": "user", "content": secret_draft}], "mode": "essay", "consent": False})
        assert response.status_code == 422
        assert secret_draft not in response.text
        assert secret_draft not in caplog.text
        response = client.post("/counselor/chat", json={"messages": [{"role": "user", "content": "Synthetic practice question"}], "mode": "essay", "consent": True})
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
    finally:
        app.dependency_overrides.pop(require_counselor_access, None)
        app.dependency_overrides.pop(get_counselor_service, None)


def test_school_name_punctuation_and_aliases():
    from schemas.schools import SearchResponse, SchoolSearchResult
    school = SchoolSearchResult(school_id=110662, name="University of California-Los Angeles", city="Los Angeles", state="CA", type="public", setting="city", enrollment=33000)
    def search(req):
        matches = [school] if req.query in ("Los Angeles", "angeles") else []
        return SearchResponse(results=matches, total_results=len(matches), page=1, page_size=req.page_size)
    tools = CounselorTools(None)
    tools.schools = SimpleNamespace(search_schools=search)
    for query in ("UCLA", "University of California Los Angeles"):
        result = tools.execute("search_colleges", json.dumps({"query": query}))
        assert result["results"][0]["school_id"] == 110662
        assert result["results"][0]["source_id"] == "S1"
    assert len(tools.sources) == 1
