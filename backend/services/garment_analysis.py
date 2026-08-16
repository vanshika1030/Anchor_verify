"""Layer 0 garment segmentation and pose-grounded silhouette analysis.

The verification worker must be useful on a lean local setup, so every deep
dependency is optional at import time.  When the two Layer 0 models are
available, the path is deliberately ordered:

    SegFormer-B2 garment mask -> MediaPipe Pose landmarks -> hem classification

`rembg` remains a compatibility fallback for the existing ``/segment`` route,
but it is never promoted to a pose-grounded silhouette measurement.  That
prevents a generic foreground cut-out from being mistaken for garment evidence.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn.functional as torch_f
    from transformers import AutoImageProcessor, SegformerForSemanticSegmentation

    SEGFORMER_RUNTIME_OK = True
except ImportError:
    torch = None
    torch_f = None
    AutoImageProcessor = None
    SegformerForSemanticSegmentation = None
    SEGFORMER_RUNTIME_OK = False

try:
    import mediapipe as mp

    MEDIAPIPE_OK = True
except ImportError:
    mp = None
    MEDIAPIPE_OK = False

try:
    from rembg import remove as rembg_remove

    REMBG_OK = True
except ImportError:
    rembg_remove = None
    REMBG_OK = False


DEFAULT_SEGFORMER_MODEL = "mattmdjaga/segformer_b2_clothes"
GARMENT_LABELS = {"upper clothes", "skirt", "pants", "dress"}
LANDMARK_INDICES = {
    "shoulder": (11, 12),
    "hip": (23, 24),
    "knee": (25, 26),
    "ankle": (27, 28),
}


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalise_label(label: Any) -> str:
    return str(label).strip().lower().replace("-", " ").replace("_", " ")


@dataclass
class SegmentationResult:
    success: bool
    mask: Optional[np.ndarray] = None
    cutout: Optional[Image.Image] = None
    confidence: float = 0.0
    source: str = "unavailable"
    labels: Optional[list[str]] = None
    error: Optional[str] = None


class GarmentVisionStack:
    """Owns the optional SegFormer-B2 and MediaPipe Pose model instances."""

    def __init__(self) -> None:
        self.segmenter = None
        self.processor = None
        self.segmenter_device = None
        self.garment_label_ids: list[int] = []
        self.pose_landmarker = None
        self.segformer_error: Optional[str] = None
        self.pose_error: Optional[str] = None
        self.model_id = os.getenv("ANCHOR_SEGFORMER_MODEL", DEFAULT_SEGFORMER_MODEL)
        # Existing deep channels are fetched explicitly with scripts/fetch_models.py.
        # Preserve that behaviour: the worker uses locally cached weights by default
        # and never blocks its first boot on a surprise 109 MB model download.
        self.local_files_only = _env_bool("ANCHOR_SEGFORMER_LOCAL_ONLY", True)
        default_pose_path = Path(__file__).with_name("models") / "pose_landmarker_lite.task"
        self.pose_model_path = Path(os.getenv("ANCHOR_POSE_MODEL_PATH", str(default_pose_path))).expanduser()
        self.min_pose_confidence = float(os.getenv("ANCHOR_POSE_MIN_CONFIDENCE", "0.55"))

    def load(self) -> None:
        self._load_segformer()
        self._load_pose()

    def close(self) -> None:
        if self.pose_landmarker is not None:
            try:
                self.pose_landmarker.close()
            except Exception:
                pass
        self.pose_landmarker = None

    def capabilities(self) -> Dict[str, Any]:
        return {
            "segformer_b2": self.segmenter is not None,
            "segformer_model": self.model_id if self.segmenter is not None else None,
            "segmentation": self.segmenter is not None or REMBG_OK,
            "segmentation_fallback": "rembg" if REMBG_OK else None,
            "mediapipe_pose": self.pose_landmarker is not None,
            "silhouette": self.segmenter is not None and self.pose_landmarker is not None,
            "segformer_error": self.segformer_error,
            "pose_error": self.pose_error,
        }

    def _load_segformer(self) -> None:
        if not SEGFORMER_RUNTIME_OK:
            self.segformer_error = "transformers and torch are not installed"
            return
        try:
            print(f"[AI-SERVER] Loading Layer 0 SegFormer-B2 garment model: {self.model_id}")
            self.processor = AutoImageProcessor.from_pretrained(
                self.model_id,
                local_files_only=self.local_files_only,
            )
            self.segmenter = SegformerForSemanticSegmentation.from_pretrained(
                self.model_id,
                local_files_only=self.local_files_only,
            )
            self.segmenter_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.segmenter.to(self.segmenter_device)
            self.segmenter.eval()
            self.garment_label_ids = [
                int(index)
                for index, label in self.segmenter.config.id2label.items()
                if _normalise_label(label) in GARMENT_LABELS
            ]
            if not self.garment_label_ids:
                raise RuntimeError("the configured SegFormer checkpoint exposes no garment labels")
            print(
                "[AI-SERVER] OK: SegFormer-B2 garment segmentation loaded "
                f"({len(self.garment_label_ids)} garment classes)"
            )
        except Exception as error:
            self.segmenter = None
            self.processor = None
            self.segmenter_device = None
            self.garment_label_ids = []
            self.segformer_error = str(error)
            mode = "local cache only" if self.local_files_only else "model download enabled"
            print(f"[AI-SERVER] SegFormer-B2 unavailable ({mode}): {error}")

    def _load_pose(self) -> None:
        if not MEDIAPIPE_OK:
            self.pose_error = "mediapipe is not installed"
            return
        if not self.pose_model_path.exists():
            self.pose_error = f"pose model missing: {self.pose_model_path}"
            return
        try:
            options = mp.tasks.vision.PoseLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(self.pose_model_path)),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_poses=1,
                min_pose_detection_confidence=self.min_pose_confidence,
                min_pose_presence_confidence=self.min_pose_confidence,
            )
            self.pose_landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(options)
            print("[AI-SERVER] OK: MediaPipe Pose Landmarker loaded for silhouette analysis")
        except Exception as error:
            self.pose_landmarker = None
            self.pose_error = str(error)
            print(f"[AI-SERVER] MediaPipe Pose unavailable: {error}")

    def segment(self, image: Image.Image) -> SegmentationResult:
        """Return a garment-only mask, preferring SegFormer-B2 over rembg."""
        if self.segmenter is not None and self.processor is not None:
            result = self._segment_with_segformer(image)
            if result.success:
                return result

        if REMBG_OK:
            return self._segment_with_rembg(image)

        return SegmentationResult(
            success=False,
            source="unavailable",
            error=self.segformer_error or "No garment segmentation runtime is installed",
        )

    def _segment_with_segformer(self, image: Image.Image) -> SegmentationResult:
        try:
            rgb_image = image.convert("RGB")
            inputs = self.processor(images=rgb_image, return_tensors="pt")
            inputs = {key: value.to(self.segmenter_device) for key, value in inputs.items()}
            with torch.inference_mode():
                outputs = self.segmenter(**inputs)
            logits = torch_f.interpolate(
                outputs.logits,
                size=(rgb_image.height, rgb_image.width),
                mode="bilinear",
                align_corners=False,
            )
            probabilities = torch.softmax(logits, dim=1)[0]
            labels = probabilities.argmax(dim=0)
            garment_selector = torch.zeros_like(labels, dtype=torch.bool)
            for label_id in self.garment_label_ids:
                garment_selector |= labels == label_id
            if not bool(garment_selector.any()):
                return SegmentationResult(
                    success=False,
                    source="segformer-b2",
                    error="SegFormer-B2 found no garment pixels",
                )

            garment_probability = probabilities[self.garment_label_ids].sum(dim=0)
            mask = garment_selector.detach().cpu().numpy()
            confidence = float(garment_probability[garment_selector].mean().item())
            coverage = float(mask.mean())
            # A tiny island is almost always a wrong class fragment, not an item
            # that can support a hemline conclusion.
            if coverage < 0.003:
                return SegmentationResult(
                    success=False,
                    source="segformer-b2",
                    error="SegFormer-B2 garment mask is too small for a reliable measurement",
                )

            cutout = rgb_image.convert("RGBA")
            cutout.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
            labels_used = [
                str(self.segmenter.config.id2label[label_id])
                for label_id in self.garment_label_ids
            ]
            return SegmentationResult(
                success=True,
                mask=mask,
                cutout=cutout,
                confidence=confidence,
                source="segformer-b2-clothes",
                labels=labels_used,
            )
        except Exception as error:
            return SegmentationResult(success=False, source="segformer-b2", error=str(error))

    def _segment_with_rembg(self, image: Image.Image) -> SegmentationResult:
        try:
            cutout = rembg_remove(image.convert("RGBA"))
            alpha = np.asarray(cutout.getchannel("A")) > 128
            if not alpha.any():
                return SegmentationResult(success=False, source="rembg-fallback", error="No foreground detected")
            coverage = float(alpha.mean())
            confidence = min(1.0, 0.5 + coverage) if 0.10 <= coverage <= 0.85 else coverage * 0.5
            return SegmentationResult(
                success=True,
                mask=alpha,
                cutout=cutout,
                confidence=confidence,
                source="rembg-fallback",
                labels=["generic foreground"],
            )
        except Exception as error:
            return SegmentationResult(success=False, source="rembg-fallback", error=str(error))

    def analyse_silhouette(self, image: Image.Image) -> Dict[str, Any]:
        """Classify a garment hem only when Layer 0 has both required signals."""
        if self.segmenter is None:
            return self._unavailable("SegFormer-B2 garment segmentation is unavailable", "segformer-b2")
        if self.pose_landmarker is None:
            return self._unavailable("MediaPipe Pose Landmarker is unavailable", "mediapipe-pose")

        segmentation = self._segment_with_segformer(image)
        if not segmentation.success or segmentation.mask is None:
            return self._unavailable(segmentation.error or "Garment could not be segmented", segmentation.source)

        landmarks = self._detect_landmarks(image)
        if landmarks is None:
            return self._unavailable("No sufficiently visible body landmarks were detected", "mediapipe-pose")

        hem_pixels = np.where(segmentation.mask)[0]
        hem_y = float(hem_pixels.max() / max(1, image.height - 1))
        category = classify_hemline(hem_y, landmarks)
        if category is None:
            return self._unavailable("Pose landmarks cannot support a stable hem classification", "mediapipe-pose")

        return {
            "success": True,
            "status": "measured",
            "length_category": category,
            "hem_y": round(hem_y, 4),
            "landmarks": {name: round(value, 4) for name, value in landmarks.items()},
            "segmentation": {
                "source": segmentation.source,
                "confidence": round(segmentation.confidence, 4),
                "labels": segmentation.labels,
            },
            "method": "SegFormer-B2 garment mask + MediaPipe Pose landmarks",
        }

    def _detect_landmarks(self, image: Image.Image) -> Optional[Dict[str, float]]:
        try:
            image_data = np.asarray(image.convert("RGB"))
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_data)
            result = self.pose_landmarker.detect(mp_image)
            if not result.pose_landmarks:
                return None
            pose = result.pose_landmarks[0]
            averages: Dict[str, float] = {}
            for name, (left, right) in LANDMARK_INDICES.items():
                points = [pose[left], pose[right]]
                if any(float(point.visibility) < self.min_pose_confidence for point in points):
                    return None
                averages[name] = float((points[0].y + points[1].y) / 2)
            if not (averages["shoulder"] < averages["hip"] < averages["knee"] < averages["ankle"]):
                return None
            return averages
        except Exception:
            return None

    @staticmethod
    def _unavailable(reason: str, source: str) -> Dict[str, Any]:
        return {"success": False, "status": "unavailable", "source": source, "error": reason}


def classify_hemline(hem_y: float, landmarks: Dict[str, float]) -> Optional[str]:
    """Classify a normalized hem against visible, normalized body landmarks.

    This is intentionally a coarse label.  A single image cannot establish a
    real-world centimetre length, so callers receive a clear image-relative
    category and must treat any disagreement as review evidence.
    """
    shoulder = landmarks.get("shoulder")
    hip = landmarks.get("hip")
    knee = landmarks.get("knee")
    ankle = landmarks.get("ankle")
    if any(value is None for value in (shoulder, hip, knee, ankle)):
        return None
    if not (shoulder < hip < knee < ankle):
        return None

    torso = hip - shoulder
    thigh = knee - hip
    shin = ankle - knee
    if min(torso, thigh, shin) <= 0.03:
        return None
    if hem_y < hip - 0.20 * torso:
        return "crop_length"
    if hem_y < hip + 0.20 * thigh:
        return "hip_length"
    if hem_y < knee - 0.15 * thigh:
        return "above_knee"
    if hem_y <= knee + 0.15 * thigh:
        return "knee_length"
    if hem_y < ankle - 0.20 * shin:
        return "below_knee"
    return "ankle_length"
