import urllib.request, json
BASE='http://127.0.0.1:5000'

print('GET /api/projects')
with urllib.request.urlopen(BASE+'/api/projects') as r:
    print(r.status, r.read().decode()[:200])

# POST project
print('POST /api/projects')
req = urllib.request.Request(BASE+'/api/projects', data=json.dumps({'title':'CLI Test','url':'https://example.com','description':'via test'}).encode(), headers={'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(req) as r:
        print('POST status', r.status)
        print(r.read().decode())
except Exception as e:
    print('POST failed', e)

# GET applications
print('GET /api/applications')
with urllib.request.urlopen(BASE+'/api/applications') as r:
    print(r.status, r.read().decode()[:200])

# POST application
print('POST /api/applications')
req = urllib.request.Request(BASE+'/api/applications', data=json.dumps({'internship':{'job_title':'CLI Job'},'applicant':{'name':'CLI'},'attachedProjects':[]}).encode(), headers={'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(req) as r:
        print('POST status', r.status)
        print(r.read().decode())
except Exception as e:
    print('POST failed', e)
