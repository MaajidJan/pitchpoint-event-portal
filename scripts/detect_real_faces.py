import cv2
import mediapipe as mp
import os
import json

mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.2)

def detect_image(img_path):
    img = cv2.imread(img_path)
    if img is None:
        return []
    h, w, _ = img.shape
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = face_detection.process(rgb)
    faces = []
    if results.detections:
        for idx, det in enumerate(results.detections):
            score = det.score[0]
            bb = det.location_data.relative_bounding_box
            x = int(bb.xmin * w)
            y = int(bb.ymin * h)
            width = int(bb.width * w)
            height = int(bb.height * h)
            # Clip bounds
            x = max(0, x)
            y = max(0, y)
            width = min(w - x, width)
            height = min(h - y, height)
            faces.append({
                'index': idx,
                'score': round(float(score), 3),
                'box': [x, y, width, height],
                'rel_box': [round(bb.xmin, 4), round(bb.ymin, 4), round(bb.width, 4), round(bb.height, 4)],
                'center_x': round(bb.xmin + bb.width / 2, 4),
                'center_y': round(bb.ymin + bb.height / 2, 4)
            })
    return faces

print('Testing test_ahmed.jpg:')
ahmed_faces = detect_image('public/test_ahmed.jpg')
print(f'Found {len(ahmed_faces)} faces in test_ahmed.jpg:')
for f in ahmed_faces:
    print(' ', f)
