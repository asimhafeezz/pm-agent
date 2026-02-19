from __future__ import annotations

import io
from typing import Optional

from minio import Minio

from app.config import get_settings


class MinioClient:
    """Wrapper around MinIO for file download/upload."""

    def __init__(
        self,
        endpoint: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket: str | None = None,
        secure: bool | None = None,
    ) -> None:
        settings = get_settings()
        self.bucket = bucket or settings.minio_bucket
        ep = endpoint or f'{settings.minio_endpoint}:{settings.minio_port}'
        self._client = Minio(
            ep,
            access_key=access_key or settings.minio_access_key,
            secret_key=secret_key or settings.minio_secret_key,
            secure=secure if secure is not None else settings.minio_use_ssl,
        )

    def download(self, key: str) -> bytes:
        """Download a file from MinIO and return its bytes."""
        response = self._client.get_object(self.bucket, key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def upload(self, key: str, data: bytes, content_type: str = 'application/octet-stream') -> None:
        """Upload bytes to MinIO."""
        self._client.put_object(
            self.bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
