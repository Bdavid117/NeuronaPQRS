from __future__ import annotations

import logging
import sys
from typing import Any


# ANSI colors for terminal
_RESET = "\033[0m"
_COLORS = {
    "DEBUG": "\033[36m",    # cyan
    "INFO": "\033[32m",     # green
    "WARNING": "\033[33m",  # yellow
    "ERROR": "\033[31m",    # red
    "CRITICAL": "\033[35m", # magenta
}
_AGENT_COLOR = "\033[34m"   # blue for agent events
_SSE_COLOR = "\033[90m"     # grey for SSE payloads


class _ColorFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        color = _COLORS.get(record.levelname, _RESET)
        record.levelname = f"{color}{record.levelname:<8}{_RESET}"
        record.name = f"\033[90m{record.name}{_RESET}"
        return super().format(record)


def setup_logging(level: str = "DEBUG") -> None:
    root = logging.getLogger()
    if root.handlers:
        return  # already configured

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        _ColorFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s — %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.DEBUG))

    # Quiet down noisy third-party loggers
    for noisy in ("httpx", "httpcore", "uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"pae.{name}")
