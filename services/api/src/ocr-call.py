#!/usr/bin/env python3
"""百度 OCR 一次性调用脚本"""
import sys, json, requests
API_KEY = 'yb2BAkFhuYFyZbUkl63KO5uA'
SECRET_KEY = '4bBqL52gYuokaD300Bfn0ut1TIN0f6Ry'
try:
    image_b64 = sys.argv[1]
    # get token
    r = requests.post('https://aip.baidubce.com/oauth/2.0/token', data={'grant_type':'client_credentials','client_id':API_KEY,'client_secret':SECRET_KEY}, timeout=5)
    r.raise_for_status()
    token = r.json().get('access_token')
    if not token:
        print(json.dumps({'success':False,'error':'no token'})); sys.exit(1)
    # call OCR
    r = requests.post(f'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token={token}', data={'image': image_b64}, timeout=10, headers={'Content-Type':'application/x-www-form-urlencoded'})
    r.raise_for_status()
    data = r.json()
    if 'words_result' in data:
        text = '\n'.join(w['words'] for w in data['words_result'])
        print(json.dumps({'success':True,'text':text}))
    else:
        print(json.dumps({'success':False,'error':str(data)[:200]}))
except Exception as e:
    print(json.dumps({'success':False,'error':str(e)}))
    sys.exit(1)
