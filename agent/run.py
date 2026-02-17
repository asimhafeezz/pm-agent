from __future__ import annotations

import uvicorn

from app.config import get_settings

if __name__ == '__main__':
    settings = get_settings()
    uvicorn.run(
        'main:app',
        host=settings.agent_host,
        port=settings.agent_port,
        log_level=settings.log_level,
        reload=True,
    )
