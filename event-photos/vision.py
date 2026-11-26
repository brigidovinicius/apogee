import hashlib
import io
import os
from pathlib import Path
from urllib.request import urlopen

import cv2
import numpy as np
from PIL import Image, ImageOps

REVISION = "48b10fa505aeb51fbd127fc60a5c660040e823b7"
FILES = (
    ("face_detection_yunet", "face_detection_yunet_2023mar.onnx",
     "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"),
    ("face_recognition_sface", "face_recognition_sface_2021dec.onnx",
     "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79"),
)
LICENSES = (
    ("face_detection_yunet", "YuNet-LICENSE.txt",
     "c83b8120c50ccbd4c4f96edf53141bdd566ebb8f8e9227e415326aa1b1aba958"),
    ("face_recognition_sface", "SFace-LICENSE.txt",
     "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"),
)
MAX_SELFIE = 8 * 1024**2
MAX_ORIGINAL = 48 * 1024**2
MAX_PIXELS = 40_000_000
ANALYSIS_EDGE = int(os.getenv("ALBUM_ANALYSIS_EDGE", "1600"))
THRESHOLD = float(os.getenv("ALBUM_THRESHOLD", "0.45"))
if not 640 <= ANALYSIS_EDGE <= 2400 or not 0.30 <= THRESHOLD <= 1.0:
    raise ValueError("ALBUM_ANALYSIS_EDGE ou ALBUM_THRESHOLD fora do intervalo")
MODEL = f"yunet-2023mar+sface-2021dec/{REVISION}/cv{cv2.__version__}/edge{ANALYSIS_EDGE}/v2"
cv2.setNumThreads(1)


class InvalidImage(Exception):
    pass


def verified_file(target, sha256, url=None):
    if url and not target.exists():
        with urlopen(url, timeout=45) as response:
            data = response.read(40 * 1024**2)
        if hashlib.sha256(data).hexdigest() != sha256:
            raise ValueError(f"Hash inválido: {target.name}")
        temporary = target.with_suffix(".download")
        temporary.write_bytes(data)
        temporary.replace(target)
    with target.open("rb") as file:
        if hashlib.file_digest(file, "sha256").hexdigest() != sha256:
            raise ValueError(f"Hash inválido: {target.name}")


def models(download=False):
    path = Path(os.getenv("ALBUM_MODELS", "models"))
    if download:
        path.mkdir(parents=True, exist_ok=True)
        for directory, name, sha256 in LICENSES:
            url = f"https://raw.githubusercontent.com/opencv/opencv_zoo/{REVISION}/models/{directory}/LICENSE"
            verified_file(path / name, sha256, url)
    for directory, name, sha256 in FILES:
        url = f"https://media.githubusercontent.com/media/opencv/opencv_zoo/{REVISION}/models/{directory}/{name}"
        verified_file(path / name, sha256, url if download else None)
    return [str(path / name) for _, name, _ in FILES]


def decode(data, formats, max_pixels=MAX_PIXELS):
    try:
        with Image.open(io.BytesIO(data), formats=formats) as image:
            if (min(image.size) < 32 or image.width * image.height > max_pixels
                    or getattr(image, "n_frames", 1) != 1):
                raise InvalidImage("invalid_image")
            if image.format == "JPEG" and max(image.size) > ANALYSIS_EDGE:
                scale = ANALYSIS_EDGE / max(image.size)
                image.draft("RGB", tuple(max(1, round(axis * scale)) for axis in image.size))
            oriented = ImageOps.exif_transpose(image)
            oriented.thumbnail((ANALYSIS_EDGE, ANALYSIS_EDGE), Image.Resampling.LANCZOS)
            return oriented.convert("RGB")
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError) as error:
        raise InvalidImage("invalid_image") from error


class Vision:
    def __init__(self):
        detector, recognizer = models()
        self.detector = cv2.FaceDetectorYN.create(detector, "", (320, 320), 0.84, 0.3, 500)
        self.recognizer = cv2.FaceRecognizerSF.create(recognizer, "")

    def features(self, image, selfie=False):
        bgr = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
        self.detector.setInputSize(image.size)
        _, faces = self.detector.detect(bgr)
        if faces is None:
            return []
        if selfie and len(faces) != 1:
            raise InvalidImage("multiple_faces")
        if len(faces) > 100:
            raise InvalidImage("too_many_faces")
        vectors = []
        for face in faces:
            aligned = self.recognizer.alignCrop(bgr, face)
            vector = self.recognizer.feature(aligned).reshape(-1)
            norm = np.linalg.norm(vector)
            if vector.size != 128 or not np.isfinite(norm) or norm <= 0:
                raise InvalidImage("invalid_feature")
            vectors.append((vector / norm).astype("<f4"))
        return vectors
