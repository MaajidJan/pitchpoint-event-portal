import json
import urllib.request
import os

with open('scripts/extracted_gdrive_files.json', encoding='utf-8') as f:
    files = json.load(f)

print('Total files in list:', len(files))
os.makedirs('scripts/downloaded_photos', exist_ok=True)

downloaded = 0
for item in files[:20]:
    raw_id = item['id'].replace('-0', '')
    if item.get('is_video'):
        continue
    url = f'https://drive.google.com/thumbnail?id={raw_id}&sz=w1000'
    out_path = f'scripts/downloaded_photos/{raw_id}.jpg'
    if not os.path.exists(out_path):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as r:
                data = r.read()
                if len(data) > 1000:
                    with open(out_path, 'wb') as out_f:
                        out_f.write(data)
                    downloaded += 1
                    print(f"Downloaded {item['name']} ({raw_id}) size: {len(data)}")
        except Exception as e:
            print(f"Failed {raw_id}: {e}")

print('Total downloaded batch:', downloaded)
