---
name: Face Recognition & Computer Vision
description: Guidelines for implementing face detection, recognition, and visual tracking features.
---

# Face Recognition Workflow

## Tooling & Models
1. **Libraries**: Utilize robust libraries such as OpenCV, dlib, or MediaPipe for rapid implementation of face detection and landmark tracking.
2. **Deep Learning**: For strict recognition (identity verification), leverage pre-trained models (e.g., FaceNet, DeepFace).
3. **Performance**: For real-time video feeds, downscale frames before processing and execute heavy models on dedicated background threads or Web Workers.

## Security & Privacy
1. **Data Handling**: Never store raw images of faces unless explicitly required. Store embedding vectors (feature hashes) instead.
2. **Liveness Detection**: When applicable, implement liveness checks (blinking, head movement) to prevent spoofing with photos.
