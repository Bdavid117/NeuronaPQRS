# Backward-compat shim — use nvidia_nim directly in new code.
from .nvidia_nim import NvidiaNimClient as OpenRouterClient
from .nvidia_nim import get_nvidia_nim as get_openrouter

__all__ = ["OpenRouterClient", "get_openrouter"]
