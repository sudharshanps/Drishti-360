import base64
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np

from app.core.config import CROP_UPLOAD_DIR, MODELS_DIR

# Optional ONNX CNN/ViT classifier session if user places crop_classifier.onnx in backend/models/
_ONNX_SESSION = None
_ONNX_CHECKED = False


def _get_onnx_session():
    global _ONNX_SESSION, _ONNX_CHECKED
    if not _ONNX_CHECKED:
        _ONNX_CHECKED = True
        model_path = MODELS_DIR / "crop_classifier.onnx"
        if model_path.exists():
            try:
                import onnxruntime as ort
                _ONNX_SESSION = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
            except Exception:
                _ONNX_SESSION = None
    return _ONNX_SESSION


def decode_base64_image(data_str: Optional[str]) -> Optional[bytes]:
    if not data_str or not data_str.strip():
        return None
    raw = data_str.strip()
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        return base64.b64decode(raw, validate=False)
    except Exception:
        return None


def compress_and_save_image(
    image_bytes: bytes,
    dest_dir: Path,
    prefix: str,
    max_dim: int = 800,
    jpeg_quality: int = 82,
) -> Tuple[str, str, float, float, np.ndarray]:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Uploaded file could not be decoded as a valid image.")

    orig_kb = round(len(image_bytes) / 1024.0, 2)
    h, w = img.shape[:2]
    scale = min(1.0, float(max_dim) / max(h, w))
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    ok, encoded = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
    if not ok:
        raise ValueError("Image compression failed.")

    filename = f"{prefix}_{uuid.uuid4().hex[:10]}.jpg"
    out_path = dest_dir / filename
    out_bytes = encoded.tobytes()
    out_path.write_bytes(out_bytes)
    comp_kb = round(len(out_bytes) / 1024.0, 2)
    return str(out_path), filename, orig_kb, comp_kb, img


def _crop_color_profile(crop_type: str) -> Tuple[Tuple[int, int], str]:
    c = (crop_type or "").lower()
    if "turmeric" in c or "mango" in c:
        return (10, 38), "golden/amber-yellow"
    if "tomato" in c:
        return (0, 18), "ripe crimson-red"
    if "chilli" in c or "spinach" in c:
        return (30, 88), "fresh emerald-green"
    if "onion" in c:
        return (125, 179), "deep magenta-red"
    return (12, 95), "natural grain/produce tone"


def analyze_crop_image(
    image_bytes: Optional[bytes],
    crop_type: str,
    variety: str,
    location: str,
    original_filename: str = "crop_sample.jpg",
) -> Dict[str, Any]:
    t0 = time.perf_counter()

    if not image_bytes:
        # Honest fallback only when an API caller invokes JSON starter endpoint without image bytes
        inference_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return {
            "saved_filename": original_filename,
            "image_url": None,
            "original_kb": 0.0,
            "compressed_kb": 0.0,
            "estimated_grade": "B",
            "ai_grade": "B",
            "quality_score": 76.0,
            "defect_percent": 7.5,
            "discoloration_percent": 6.0,
            "uniformity_score": 79.0,
            "damage_level": "Low-Moderate",
            "detected_defects": [
                "No image pixels provided (JSON-only invocation) — upload a crop photo for live OpenCV pixel inspection."
            ],
            "observations": (
                f"Metadata-only fallback screening for {crop_type} ({variety}) at {location}: "
                f"Conservative Grade B baseline assigned because no crop image file was uploaded."
            ),
            "analysis_mode": "metadata_fallback (no image pixels supplied; not an ML prediction)",
            "inference_time_ms": inference_ms,
        }

    _, saved_filename, orig_kb, comp_kb, img = compress_and_save_image(
        image_bytes=image_bytes,
        dest_dir=CROP_UPLOAD_DIR,
        prefix="crop",
        max_dim=800,
        jpeg_quality=82,
    )

    # Crop-specific expected hue range in OpenCV HSV (Hue 0..179)
    (h_low, h_high), expected_tone = _crop_color_profile(crop_type)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Ignore near-white neutral background pixels when estimating produce pixels
    fg_mask = (hsv[:, :, 1] > 28) | (hsv[:, :, 2] < 235)
    fg_count = int(np.count_nonzero(fg_mask))
    if fg_count < 100:
        fg_mask = np.ones(gray.shape, dtype=bool)
        fg_count = gray.size

    h_vals = hsv[:, :, 0][fg_mask]
    s_vals = hsv[:, :, 1][fg_mask]
    v_vals = hsv[:, :, 2][fg_mask]

    # 1. Discoloration analysis: out-of-profile hue + very dark spots + dull low-saturation patches
    if h_low <= h_high:
        in_profile = (h_vals >= h_low) & (h_vals <= h_high)
    else:
        in_profile = (h_vals >= h_low) | (h_vals <= h_high)
    dark_spots = (v_vals < 58)
    washed_out = (s_vals < 28) & (v_vals > 180)
    discolored_ratio = float(np.mean((~in_profile) | washed_out))
    discoloration_percent = round(min(65.0, discolored_ratio * 100.0 * 0.45), 2)

    # 2. Visible defect / bruise / spot segmentation using dark spots + adaptive local contrast anomalies
    blur = cv2.GaussianBlur(gray, (9, 9), 0)
    diff = cv2.absdiff(gray, blur)
    spot_mask = ((diff > 26) | (hsv[:, :, 2] < 52)) & fg_mask
    defect_percent = round(min(55.0, float(np.count_nonzero(spot_mask) / fg_count) * 100.0 * 1.15), 2)

    # 3. Color & surface uniformity via 4x4 grid block LAB standard deviation
    h_img, w_img = lab.shape[:2]
    grid_means = []
    for r in range(4):
        for c_idx in range(4):
            patch = lab[r * h_img // 4 : (r + 1) * h_img // 4, c_idx * w_img // 4 : (c_idx + 1) * w_img // 4]
            if patch.size:
                grid_means.append(np.mean(patch[:, :, 0]))
    block_std = float(np.std(grid_means)) if grid_means else 12.0
    uniformity_score = round(max(35.0, min(98.5, 100.0 - block_std * 1.35)), 2)

    # 4. Crispness / texture score (Laplacian variance)
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    sharpness_bonus = min(6.0, lap_var / 140.0)

    # Check optional trained ONNX CNN/ViT model if present
    onnx_sess = _get_onnx_session()
    analysis_mode = "opencv_cv_pipeline (color/texture/contour CV heuristics; no trained CNN/ViT weights loaded)"
    if onnx_sess is not None:
        try:
            inp_name = onnx_sess.get_inputs()[0].name
            resized = cv2.resize(img, (224, 224)).astype(np.float32) / 255.0
            tensor = np.transpose(resized, (2, 0, 1))[None, ...]
            logits = onnx_sess.run(None, {inp_name: tensor})[0][0]
            best_idx = int(np.argmax(logits))
            grade_map = {0: "A", 1: "B", 2: "C"}
            est_grade = grade_map.get(best_idx, "B")
            quality_score = round(float(max(45.0, min(97.0, 92.0 - defect_percent * 1.1))), 2)
            analysis_mode = f"onnx_cnn_vit_model ({onnx_sess.get_providers()[0]}) + OpenCV metrics"
        except Exception:
            onnx_sess = None

    if onnx_sess is None:
        # Compute calibrated quality score from real image CV metrics
        mean_sat = float(np.mean(s_vals))
        vibrancy_bonus = min(8.0, (mean_sat / 255.0) * 10.0)
        raw_score = 92.0 - (defect_percent * 1.45) - (discoloration_percent * 0.85) + (uniformity_score - 78.0) * 0.25 + sharpness_bonus + vibrancy_bonus - 5.0
        quality_score = round(max(32.0, min(96.8, raw_score)), 2)
        if quality_score >= 81.0 and defect_percent <= 9.0:
            est_grade = "A"
        elif quality_score >= 64.0:
            est_grade = "B"
        else:
            est_grade = "C"

    if defect_percent <= 5.5 and discoloration_percent <= 8.0:
        damage_level = "Low"
    elif defect_percent <= 13.0 and discoloration_percent <= 18.0:
        damage_level = "Moderate"
    else:
        damage_level = "Elevated"

    detected_defects: List[str] = []
    if defect_percent > 6.5:
        detected_defects.append(f"Surface blemish / dark spot contours ({defect_percent:.1f}% foreground area)")
    if discoloration_percent > 10.0:
        detected_defects.append(f"Off-hue discoloration relative to {expected_tone} profile ({discoloration_percent:.1f}%)")
    if uniformity_score < 74.0:
        detected_defects.append(f"Uneven lot brightness / surface uniformity ({uniformity_score:.1f}/100)")
    if lap_var < 60.0:
        detected_defects.append("Soft image focus / low surface texture sharpness")
    if not detected_defects:
        detected_defects.append(f"Minimal visible surface defects ({defect_percent:.1f}%) with consistent {expected_tone} coloration")

    observations = (
        f"OpenCV visual screening for {crop_type} ({variety}) from {location}: "
        f"Overall quality score {quality_score:.1f}/100 -> Grade {est_grade}. "
        f"Color uniformity {uniformity_score:.1f}/100, surface blemishes {defect_percent:.1f}%, "
        f"discoloration {discoloration_percent:.1f}%, damage assessment: {damage_level}. "
        f"Image compressed {orig_kb:.1f} KB -> {comp_kb:.1f} KB."
    )

    inference_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "saved_filename": saved_filename,
        "image_url": f"/uploads/crops/{saved_filename}",
        "original_kb": orig_kb,
        "compressed_kb": comp_kb,
        "estimated_grade": est_grade,
        "ai_grade": est_grade,
        "quality_score": quality_score,
        "defect_percent": defect_percent,
        "discoloration_percent": discoloration_percent,
        "uniformity_score": uniformity_score,
        "damage_level": damage_level,
        "detected_defects": detected_defects,
        "observations": observations,
        "analysis_mode": analysis_mode,
        "inference_time_ms": inference_ms,
    }
