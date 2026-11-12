from fastapi import HTTPException, UploadFile

from app.core.config import settings

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
    "application/octet-stream",
}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


async def read_validated_image_upload(file: UploadFile) -> bytes:
    """Read and validate size/type of uploaded crop or packaging images."""
    max_bytes = max(1, settings.MAX_UPLOAD_MB) * 1024 * 1024
    filename = (file.filename or "").lower()
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1]
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file extension '{ext}'. Upload JPG, PNG, WEBP, or BMP images.",
            )

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type and content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported MIME type '{content_type}'. Upload a valid image file.",
        )

    data = await file.read(max_bytes + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file exceeds maximum allowed size of {settings.MAX_UPLOAD_MB} MB.",
        )
    return data
