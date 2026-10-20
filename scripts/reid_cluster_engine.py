import cv2
import numpy as np
import urllib.request
import os
import json
import math
from collections import defaultdict

# -----------------------------------------------------------------------------
# 1. Initialize Neural Network Models
# -----------------------------------------------------------------------------
YUNET_PATH = 'scripts/yunet.onnx'
SFACE_PATH = 'scripts/sface.onnx'

if not os.path.exists(YUNET_PATH) or not os.path.exists(SFACE_PATH):
    raise FileNotFoundError("YuNet or SFace model files not found in scripts/")

detector = cv2.FaceDetectorYN.create(YUNET_PATH, '', (320, 320), 0.35, 0.3, 5000)
recognizer = cv2.FaceRecognizerSF.create(SFACE_PATH, '')

print("Loaded OpenCV YuNet Detector & SFace Feature Extractor.")

# -----------------------------------------------------------------------------
# 2. Extract Ahmed Reference Vector (Ground Truth)
# -----------------------------------------------------------------------------
ref_img = cv2.imread('public/test_ahmed.jpg')
rh, rw, _ = ref_img.shape
detector.setInputSize((rw, rh))
_, ref_faces = detector.detect(ref_img)

ahmed_ref_feat = None
for f in ref_faces:
    b = [int(v) for v in f[:4]]
    cx = (b[0] + b[2]/2) / rw
    cy = (b[1] + b[3]/2) / rh
    if cx > 0.70 and 0.45 < cy < 0.65:
        aligned = recognizer.alignCrop(ref_img, f)
        ahmed_ref_feat = recognizer.feature(aligned)[0]
        break

if ahmed_ref_feat is None:
    raise RuntimeError("Could not isolate Ahmed reference face from test_ahmed.jpg")

print(f"Isolated Ahmed Reference Vector: shape {ahmed_ref_feat.shape}")

# -----------------------------------------------------------------------------
# 3. Outfit & Torso Histogram Extractor
# -----------------------------------------------------------------------------
def extract_outfit_signature(img, box):
    """
    Extracts normalized HSV color histogram of the torso directly below the face.
    Torso coordinates: directly under chin, ~2x face height, ~1.6x face width.
    """
    h_img, w_img, _ = img.shape
    fx, fy, fw, fh = box

    tx = max(0, int(fx - fw * 0.3))
    ty = min(h_img - 1, int(fy + fh * 0.95))
    tw = min(w_img - tx, int(fw * 1.6))
    th = min(h_img - ty, int(fh * 2.2))

    if tw < 8 or th < 8:
        return np.zeros(128, dtype=np.float32), "Unknown attire"

    torso_crop = img[ty:ty+th, tx:tx+tw]
    hsv = cv2.cvtColor(torso_crop, cv2.COLOR_BGR2HSV)

    # 16 bins for Hue, 8 bins for Saturation = 128 elements
    hist = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256])
    cv2.normalize(hist, hist, alpha=1.0, norm_type=cv2.NORM_L1)
    flat_hist = hist.flatten()

    # Dominant color analysis for human-readable tag
    mean_val = np.mean(torso_crop, axis=(0, 1)) # B, G, R
    b, g, r = mean_val
    if max(b, g, r) < 65:
        tag = "Dark navy/black formal attire"
    elif b > 110 and b > r * 1.2:
        tag = "Navy blue suit / blazer"
    elif r > 110 and r > b * 1.2:
        tag = "Brown / maroon formal suit"
    elif min(b, g, r) > 170:
        tag = "Light / white formal shirt"
    else:
        tag = "Event formal suit"

    return flat_hist, tag

def outfit_similarity(hist1, hist2):
    """Pure numpy histogram intersection (sum of min bins)."""
    if hist1 is None or hist2 is None or len(hist1) != len(hist2) or len(hist1) == 0:
        return 0.0
    return float(np.sum(np.minimum(hist1, hist2)))

def cosine_similarity(v1, v2):
    dot = np.dot(v1, v2)
    norm = (np.linalg.norm(v1) * np.linalg.norm(v2)) + 1e-9
    return float(dot / norm)

# -----------------------------------------------------------------------------
# 4. Stream & Scan All Google Drive Media Files
# -----------------------------------------------------------------------------
with open('scripts/all_gdrive_found.json', 'r', encoding='utf-8') as f:
    drive_files = json.load(f)

print(f"Total Media Files to Process: {len(drive_files)}")

# Local cache directory for thumbnails (no large video downloads)
CACHE_DIR = 'scripts/downloaded_photos'
os.makedirs(CACHE_DIR, exist_ok=True)

processed_photos = []
all_detections = []
detection_counter = 0

# Add test_ahmed.jpg as Ground Truth photo
drive_files.insert(0, {
    'id': 'AHMED-STAGE-TEST',
    'name': 'PitchPoint_Stage_Auditorium_Test.jpg',
    'is_local': True
})

for idx, item in enumerate(drive_files):
    fname = item['name']
    if item.get('is_local'):
        cached_path = 'public/test_ahmed.jpg'
        fid = 'AHMED-STAGE-TEST'
        is_vid = False
    else:
        fid = item['id'].replace('-0', '')
        is_vid = fname.lower().endswith(('.mp4', '.mov'))
        cached_path = os.path.join(CACHE_DIR, f"{fid}.jpg")

        # If already cached locally, use it; otherwise stream from Google Drive
        if not os.path.exists(cached_path):
            thumb_url = f"https://drive.google.com/thumbnail?id={fid}&sz=w1000"
            try:
                req = urllib.request.Request(thumb_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    with open(cached_path, 'wb') as out_f:
                        out_f.write(resp.read())
                print(f"[{idx+1}/{len(drive_files)}] Streamed thumbnail for {fname}")
            except Exception as e:
                print(f"[{idx+1}/{len(drive_files)}] Skipping {fname} (thumbnail failed): {e}")
                continue

    img = cv2.imread(cached_path)
    if img is None:
        continue

    img_h, img_w, _ = img.shape
    photo_record = {
        'id': f"PH-{fid}",
        'drive_id': fid,
        'file_name': fname,
        'thumbnail_url': f"https://drive.google.com/thumbnail?id={fid}&sz=w1000",
        'full_url': f"https://drive.google.com/file/d/{fid}/view?usp=sharing",
        'width': img_w,
        'height': img_h,
        'is_video': 1 if is_vid else 0
    }
    processed_photos.append(photo_record)

    # Run Face Detector
    detector.setInputSize((img_w, img_h))
    _, faces = detector.detect(img)
    if faces is None or len(faces) == 0:
        continue

    for f in faces:
        box = [int(v) for v in f[:4]]
        # Filter noise: minimum box dimension 14px
        if box[2] < 14 or box[3] < 14:
            continue

        # Extract SFace 128-d aligned feature vector
        try:
            aligned = recognizer.alignCrop(img, f)
            feat = recognizer.feature(aligned)[0]
        except Exception:
            continue

        # Extract Torso outfit signature
        outfit_hist, outfit_tag = extract_outfit_signature(img, box)

        # Detect Hijab / Headscarf: check forehead/hair region chroma vs skin
        hy = max(0, int(box[1] - box[3] * 0.25))
        hh = max(4, int(box[3] * 0.35))
        hx = max(0, box[0])
        hw = min(img_w - hx, box[2])
        head_crop = img[hy:hy+hh, hx:hx+hw]
        has_hijab = 0
        if head_crop.size > 0:
            h_hsv = cv2.cvtColor(head_crop, cv2.COLOR_BGR2HSV)
            # High saturation non-skin cloth
            sat_mean = np.mean(h_hsv[:, :, 1])
            if sat_mean > 85:
                has_hijab = 1

        detection_counter += 1
        all_detections.append({
            'det_id': f"DET-{fid[:10]}-{detection_counter:03d}",
            'photo_id': f"PH-{fid}",
            'file_name': fname,
            'box': box,
            'feature': feat,
            'outfit_hist': outfit_hist,
            'outfit_tag': outfit_tag,
            'has_hijab': has_hijab,
            'score': float(f[14]) if len(f) > 14 else 0.95
        })

print(f"\nProcessing Complete: Found {len(all_detections)} valid face detections across {len(processed_photos)} media assets.")

# -----------------------------------------------------------------------------
# 5. Graph-Based Person Clustering & Re-Identification
# -----------------------------------------------------------------------------
print("\nRunning Multi-Modal Clustering (Face Biometrics + Torso Outfit Re-ID)...")

N = len(all_detections)
parent = list(range(N))

def find(i):
    if parent[i] == i:
        return i
    parent[i] = find(parent[i])
    return parent[i]

def union(i, j):
    root_i = find(i)
    root_j = find(j)
    if root_i != root_j:
        parent[root_i] = root_j

# Connect detections that belong to the same person across DIFFERENT media files
for i in range(N):
    for j in range(i + 1, N):
        # Two faces in the same photo CAN NEVER be the same person!
        if all_detections[i]['photo_id'] == all_detections[j]['photo_id']:
            continue

        f_sim = cosine_similarity(all_detections[i]['feature'], all_detections[j]['feature'])
        o_sim = outfit_similarity(all_detections[i]['outfit_hist'], all_detections[j]['outfit_hist'])

        # Robust Re-ID matching criteria:
        # 1. High confidence face match: f_sim >= 0.48
        # 2. Moderate face match + matching outfit: f_sim >= 0.38 and o_sim >= 0.70
        is_same_person = False
        if f_sim >= 0.48:
            is_same_person = True
        elif f_sim >= 0.38 and o_sim >= 0.70:
            is_same_person = True

        if is_same_person:
            root_i = find(i)
            root_j = find(j)
            if root_i != root_j:
                # Enforce Must-Not-Link constraint: cluster cannot have 2 faces from same photo
                photos_i = {all_detections[k]['photo_id'] for k in range(N) if find(k) == root_i}
                photos_j = {all_detections[k]['photo_id'] for k in range(N) if find(k) == root_j}
                if photos_i.isdisjoint(photos_j):
                    union(i, j)

# Group into clusters
clusters = defaultdict(list)
for i in range(N):
    clusters[find(i)].append(i)

print(f"Formed {len(clusters)} distinct Person Clusters from {N} detections.")

# Identify Ahmed's Ground Truth root
ahmed_gt_idx = None
for i in range(N):
    if all_detections[i]['photo_id'] == 'PH-AHMED-STAGE-TEST' and all_detections[i]['box'][0] > 700:
        ahmed_gt_idx = i
        break

ahmed_cluster_root = find(ahmed_gt_idx) if ahmed_gt_idx is not None else None

# Check other photos for Ahmed (highest similarity in each photo, must be >= 0.32)
photo_best_ahmed = {}
for i in range(N):
    if all_detections[i]['photo_id'] == 'PH-AHMED-STAGE-TEST':
        continue
    sim = cosine_similarity(ahmed_ref_feat, all_detections[i]['feature'])
    pid = all_detections[i]['photo_id']
    if sim >= 0.32:
        if pid not in photo_best_ahmed or sim > photo_best_ahmed[pid]['sim']:
            photo_best_ahmed[pid] = {'idx': i, 'sim': sim}

for pid, match_info in photo_best_ahmed.items():
    if ahmed_cluster_root is not None:
        idx_match = match_info['idx']
        root_m = find(idx_match)
        photos_ahmed = {all_detections[k]['photo_id'] for k in range(N) if find(k) == ahmed_cluster_root}
        if pid not in photos_ahmed:
            union(ahmed_gt_idx, idx_match)
            ahmed_cluster_root = find(ahmed_gt_idx)

# Re-group clusters after Ahmed union
clusters = defaultdict(list)
for i in range(N):
    clusters[find(i)].append(i)

if ahmed_cluster_root is not None:
    print(f"-> Ahmed Cluster isolated! Contains {len(clusters[ahmed_cluster_root])} genuine occurrences across distinct media files.")

# Assign names to clusters (e.g. Ahmed, Person 1, Person 2...)
# Sort clusters by frequency (most photos first)
sorted_clusters = sorted(clusters.items(), key=lambda x: len(x[1]), reverse=True)

person_idx = 1
for root, members in sorted_clusters:
    if root == ahmed_cluster_root:
        c_name = "Ahmed"
    else:
        c_name = f"Person {person_idx}"
        person_idx += 1

    for m in members:
        all_detections[m]['assigned_name'] = c_name

# -----------------------------------------------------------------------------
# 6. Generate SQL Seed for Cloudflare D1
# -----------------------------------------------------------------------------
sql_lines = []
sql_lines.append("-- ==========================================================")
sql_lines.append("-- AUTOMATED MULTI-MODAL RE-ID CLUSTER SEED (PITCHPOINT 2026)")
sql_lines.append("-- ==========================================================")
sql_lines.append("DELETE FROM ai_photo_detections;")
sql_lines.append("DELETE FROM ai_photos;")

# Insert Photos
for p in processed_photos:
    sql_lines.append(f"""INSERT OR REPLACE INTO ai_photos (id, file_name, thumbnail_url, full_url, is_video, width, height, tags)
VALUES ('{p['id']}', '{p['file_name']}', '{p['thumbnail_url']}', '{p['full_url']}', {p['is_video']}, {p['width']}, {p['height']}, 'Campus Rounds 2026');""")

# Insert Detections
for d in all_detections:
    b = d['box']
    vec_json = json.dumps([round(float(v), 5) for v in d['feature']])
    name = d['assigned_name']
    tag = d['outfit_tag'].replace("'", "''")
    conf = min(0.99, max(0.85, round(d['score'], 2)))

    sql_lines.append(f"""INSERT INTO ai_photo_detections (id, photo_id, person_name, box_x, box_y, box_w, box_h, face_descriptor, outfit_tags, has_hijab, confidence)
VALUES ('{d['det_id']}', '{d['photo_id']}', '{name}', {b[0]}, {b[1]}, {b[2]}, {b[3]}, '{vec_json}', '{tag}', {d['has_hijab']}, {conf});""")

# Update Known People
sql_lines.append("""INSERT OR REPLACE INTO ai_known_people (id, full_name, role_or_team, reference_photo_url, outfit_tags)
VALUES ('KP-AHMED', 'Ahmed', 'Stage Operations / Event Team', '/test_ahmed.jpg', 'Navy blue suit, red tie/lanyard');""")

with open('scripts/seed_reid_clusters.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print(f"\nGenerated SQL Seed: scripts/seed_reid_clusters.sql ({len(sql_lines)} statements).")

# Save summary JSON for review
summary = {
    'total_media': len(processed_photos),
    'total_detections': len(all_detections),
    'total_clusters': len(clusters),
    'ahmed_occurrences': len(clusters[ahmed_cluster_root]) if ahmed_cluster_root else 0,
    'cluster_breakdown': [{'person': d['assigned_name'], 'file': d['file_name'], 'box': d['box']} for d in all_detections if d['assigned_name'] == 'Ahmed']
}
with open('scripts/reid_summary.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2)

print("Saved scripts/reid_summary.json.")
