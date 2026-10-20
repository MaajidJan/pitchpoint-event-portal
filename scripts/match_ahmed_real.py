import cv2
import os
import json
import numpy as np

# Load YuNet and SFace
detector = cv2.FaceDetectorYN.create('scripts/yunet.onnx', '', (320, 320), 0.35, 0.3, 5000)
recognizer = cv2.FaceRecognizerSF.create('scripts/sface.onnx', '')

# 1. Extract Ahmed reference face from test_ahmed.jpg
img_ahmed = cv2.imread('public/test_ahmed.jpg')
h_a, w_a, _ = img_ahmed.shape
detector.setInputSize((w_a, h_a))
_, faces_a = detector.detect(img_ahmed)

# Find Ahmed (box around x > 720, y around 300)
ahmed_face = None
for f in faces_a:
    box = [int(v) for v in f[:4]]
    cx = (box[0] + box[2]/2) / w_a
    cy = (box[1] + box[3]/2) / h_a
    if cx > 0.70 and cy > 0.45 and cy < 0.65:
        ahmed_face = f
        break

if ahmed_face is None:
    print("Could not find Ahmed in test_ahmed.jpg")
    exit(1)

print("Found Ahmed in test_ahmed.jpg:", [int(v) for v in ahmed_face[:4]])

# Align and extract feature vector for Ahmed
aligned_ahmed = recognizer.alignCrop(img_ahmed, ahmed_face)
feature_ahmed = recognizer.feature(aligned_ahmed)
print("Ahmed feature vector shape:", feature_ahmed.shape)

# 2. Match across all downloaded photos
folder = 'scripts/downloaded_photos'
matched_results = []

# Add test_ahmed itself first as Ground Truth
matched_results.append({
    'file': 'PitchPoint_Stage_Auditorium_Test.jpg',
    'photo_id': 'PH-AHMED-STAGE-TEST',
    'width': w_a,
    'height': h_a,
    'box': [int(v) for v in ahmed_face[:4]],
    'score': 1.0,
    'person_name': 'Ahmed',
    'outfit_tags': 'Navy blue suit, red tie/lanyard, standing beside BU flag'
})

for f in sorted(os.listdir(folder)):
    if not f.endswith('.jpg'):
        continue
    p = os.path.join(folder, f)
    img = cv2.imread(p)
    if img is None:
        continue
    h, w, _ = img.shape
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)
    if faces is None:
        continue

    best_match_for_photo = None
    best_score = -1.0

    for face_item in faces:
        box = [int(v) for v in face_item[:4]]
        if box[2] < 15 or box[3] < 15:
            continue
        try:
            aligned = recognizer.alignCrop(img, face_item)
            feature = recognizer.feature(aligned)
            sim = recognizer.match(feature_ahmed, feature, cv2.FaceRecognizerSF_FR_COSINE)
            if sim > best_score:
                best_score = sim
                best_match_for_photo = {
                    'box': box,
                    'score': round(float(sim), 3)
                }
        except Exception as e:
            continue

    raw_id = f.replace('.jpg', '')
    photo_id = f'PH-{raw_id}'
    print(f"{f}: best cosine similarity to Ahmed = {best_score}")

    # If similarity is positive and decent, or top candidates
    if best_score > 0.25 and best_match_for_photo:
        matched_results.append({
            'file': f,
            'photo_id': photo_id,
            'width': w,
            'height': h,
            'box': best_match_for_photo['box'],
            'score': best_score,
            'person_name': 'Ahmed',
            'outfit_tags': 'Auditorium stage operations, navy blue suit'
        })

print(f"\nTotal real matches found for Ahmed: {len(matched_results)}")
for m in matched_results:
    print(" ", m['file'], "Box:", m['box'], "Score:", m['score'])

with open('scripts/real_ahmed_matches.json', 'w') as out:
    json.dump(matched_results, out, indent=2)
