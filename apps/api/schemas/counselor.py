from typing import Literal

from pydantic import ConfigDict, Field, model_validator
from schemas.base import ApiModel


class ChatMessage(ApiModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class CounselorRequest(ApiModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[ChatMessage] = Field(min_length=1, max_length=10)
    mode: Literal["plan", "essay", "visits"] = "plan"
    essay: str = Field(default="", max_length=8000)
    consent: Literal[True]

    @model_validator(mode="after")
    def bound_conversation(self):
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the student.")
        if any(m.role != ("user" if i % 2 == 0 else "assistant") for i, m in enumerate(self.messages)):
            raise ValueError("Messages must alternate, starting with the student.")
        if sum(len(m.content) for m in self.messages) > 12000:
            raise ValueError("Start a new chat to continue.")
        if self.mode != "essay" and self.essay:
            raise ValueError("Drafts may only be sent in essay mode.")
        return self


class CounselorSource(ApiModel):
    id: str
    title: str
    url: str
    detail: str


class CounselorResponse(ApiModel):
    reply: str
    sources: list[CounselorSource]
    tools_used: list[str]
    model: str


class CounselorStatus(ApiModel):
    available: bool
    model: str
    provider: str = "Groq"
    source_url: str = "https://github.com/NishuKrish/College-Explorer"
