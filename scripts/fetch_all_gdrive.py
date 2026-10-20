import urllib.request
import re
import json

url = 'https://drive.google.com/drive/folders/1lDH2kgH5Kp2YpLjHm_u1SjFriR6d3026'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

try:
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    print('HTML length:', len(html))
    
    # Extract file patterns
    # In Google Drive initial state, files are in window._DRIVE_data or JSON arrays
    # Look for [\"FILE_ID\",\"FILENAME\"
    pattern = re.compile(r'\[\"([a-zA-Z0-9_-]{28,35})\",\[\"([^\"]+\.(?:jpg|jpeg|png|mp4|mov))\"', re.I)
    matches = pattern.findall(html)
    print('Pattern 1 matches:', len(matches))
    
    # Alternative pattern: aria-label="FILENAME ... ssk='...:FILE_ID'
    pattern2 = re.compile(r'aria-label="([^"]+\.(?:jpg|jpeg|png|mp4|mov))[^"]*"[^>]*ssk=\'[^\']*?:([a-zA-Z0-9_-]{28,35})[^\']*\'', re.I)
    matches2 = pattern2.findall(html)
    print('Pattern 2 matches:', len(matches2))
    
    files_map = {}
    for fid, fname in matches:
        files_map[fid] = fname
    for fname, fid in matches2:
        files_map[fid.replace('-0', '')] = fname
        
    print('Total unique files found in initial payload:', len(files_map))
    
    # Save to json
    items = [{'id': fid, 'name': fname} for fid, fname in files_map.items()]
    with open('scripts/all_gdrive_found.json', 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2)
    print('Saved scripts/all_gdrive_found.json')
    
except Exception as e:
    print('Error:', e)
