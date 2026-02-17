from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, TypeVar

T = TypeVar('T')


async def with_retry(
    fn: Callable[[], Awaitable[T]],
    max_retries: int = 2,
    base_delay: float = 0.5,
    max_delay: float = 5.0,
) -> T:
    """Execute an async callable with exponential backoff on failure.

    Args:
        fn: Async callable to execute.
        max_retries: Maximum number of retry attempts (0 = no retries).
        base_delay: Initial delay in seconds between retries.
        max_delay: Maximum delay in seconds between retries.

    Returns:
        The result of the callable.

    Raises:
        The last exception if all attempts fail.
    """
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except Exception as exc:
            last_exc = exc
            if attempt < max_retries:
                delay = min(base_delay * (2 ** attempt), max_delay)
                await asyncio.sleep(delay)
    raise last_exc  # type: ignore[misc]
