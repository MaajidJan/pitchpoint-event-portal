import cv2
import os
import json

detector = cv2.FaceDetectorYN.create('scripts/yunet.onnx', '', (320, 320), 0.35, 0.3, 5000)

folder = 'scripts/downloaded_photos'
results = {}

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
    face_list = []
    if faces is not None:
        for item in faces:
            box = [int(v) for v in item[:4]]
            score = round(float(item[-1]), 3)
            # Filter tiny noise
            if box[2] >= 15 and box[3] >= 15 and score >= 0.4:
                face_list.append({
                    'box': box,
                    'score': score,
                    'cx_pct': round((box[0] + box[2]/2) / w, 3),
                    'cy_pct': round((box[1] + box[3]/2) / h, 3),
                    'w_pct': round(box[2] / w, 3),
                    'h_pct': round(box[3] / h, 3)
                })
    results[f] = {
        'width': w,
        'height': h,
        'faces_count': len(face_list),
        'faces': face_list
    }
    print(f"{f}: ({w}x{h}) => {len(face_list)} real faces detected")

with open('scripts/real_detected_faces.json', 'w') as out:
    json.dump(results, out, indent=2)
print("Saved scripts/real_detected_faces.json")
