#!/usr/bin/env python3
import os, sys, json, requests
from datetime import datetime

repo = os.environ.get('GITHUB_REPOSITORY')
event_path = os.environ.get('GITHUB_EVENT_PATH')
if not repo:
    print('GITHUB_REPOSITORY not set')
    sys.exit(1)

with open(event_path,'r') as f:
    ev = json.load(f)

# find PR number robustly
pr_number = None
if 'pull_request' in ev:
    pr_number = ev['pull_request'].get('number')
elif ev.get('review') and ev.get('review').get('pull_request_url'):
    pr_number = int(ev['review']['pull_request_url'].split('/')[-1])
else:
    # fallback to github ref
    ref = os.environ.get('GITHUB_REF','')
    if ref.startswith('refs/pull/'):
        pr_number = int(ref.split('/')[2])

if not pr_number:
    print('Could not determine PR number from event')
    sys.exit(0)

owner, name = repo.split('/')
headers = { 'Authorization': f"token {os.environ.get('GITHUB_TOKEN','')}", 'Accept':'application/vnd.github+json' }

# fetch PR info
pr = requests.get(f'https://api.github.com/repos/{owner}/{name}/pulls/{pr_number}', headers=headers).json()
# fetch review comments and review summaries
reviews = requests.get(f'https://api.github.com/repos/{owner}/{name}/pulls/{pr_number}/reviews', headers=headers).json()
comments = requests.get(f'https://api.github.com/repos/{owner}/{name}/issues/{pr_number}/comments', headers=headers).json()

# Aggregate textual items (review bodies + issue comments)
texts = []
for r in reviews:
    body = r.get('body')
    if body:
        texts.append({'type':'review','user': r.get('user',{}).get('login'), 'body': body})
for c in comments:
    body = c.get('body')
    if body:
        texts.append({'type':'comment','user': c.get('user',{}).get('login'), 'body': body})

# If DeepSeek key present, call DeepSeek to summarize, else fallback to heuristic
DEEPSEEK_KEY = os.environ.get('DEEPSEEK_API_KEY')
summary_bullets = []
if DEEPSEEK_KEY and texts:
    # build prompt
    joined = "\n\n".join([f"[{t['type']}/{t['user']}]: {t['body']}" for t in texts])
    prompt = (
        "You are a concise reviewer-synthesis assistant. Given a list of reviewer comments, produce:\n"
        "1) Three concise bullet learnings (each 1 sentence).\n"
        "2) Up to two short action items.\n\n"
        "Comments:\n" + joined
    )
    try:
        ds_headers = {'Authorization': f'Bearer {DEEPSEEK_KEY}', 'Content-Type':'application/json'}
        model_name = os.environ.get('DEEPSEEK_MODEL', 'deepseek-chat')
        payload = {
            'model': model_name,
            'input':[{'role':'user','content': prompt}],
            'max_tokens': 400
        }
        r = requests.post('https://api.deepseek.com/v1/responses', headers=ds_headers, json=payload, timeout=20)
        if r.status_code==200:
            resp = r.json()
            # deepseek response shape may vary — try to extract text
            text = ''
            if isinstance(resp, dict):
                # look for items -> output_text or similar
                if 'output' in resp and isinstance(resp['output'], str):
                    text = resp['output']
                elif 'result' in resp and isinstance(resp['result'], dict):
                    text = resp['result'].get('output_text','') or resp['result'].get('content','')
                else:
                    # generic search
                    for v in resp.values():
                        if isinstance(v,str):
                            text = v; break
            if not text and isinstance(resp, dict):
                # attempt to find nested output
                for k in ('output_text','content','text'):
                    try:
                        text = resp.get(k,'')
                        if text: break
                    except:
                        pass
            if text:
                # split into lines and use as bullets
                for line in text.splitlines():
                    ln=line.strip()
                    if ln:
                        summary_bullets.append('- ' + ln)
    except Exception as e:
        print('DeepSeek summarize failed, falling back to heuristic', e)

if not summary_bullets:
    # Simple heuristic summarizer: collect lines with 'nit'/'typo'/'please'/'todo'/'consider' and top sentences
    bullets = []
    for t in texts:
        lines = t['body'].splitlines()
        picked = []
        for ln in lines:
            l = ln.strip().lower()
            if not l: continue
            if any(k in l for k in ('nit', 'typo', 'please', 'consider', 'todo', 'suggest', 'nitpick')):
                picked.append(ln.strip())
        if not picked:
            # fallback: first sentence
            sent = t['body'].split('\n')[0].split('. ')[0].strip()
            if sent:
                picked.append(sent)
        for p in picked[:2]:
            bullets.append(f"- ({t['type']}/{t['user']}) {p}")

    if not bullets:
        bullets = ['- No actionable reviewer notes captured.']
    summary_bullets = bullets

# Build doc
out_dir = os.path.join(os.getcwd(),'docs','pr-learnings')
os.makedirs(out_dir, exist_ok=True)
fn = os.path.join(out_dir, f'PR-{pr_number}.md')
with open(fn, 'w') as f:
    f.write(f"# PR {pr_number}: {pr.get('title','')}\n\n")
    f.write(f"**URL:** {pr.get('html_url')}\n\n")
    f.write('## Distilled reviewer learnings\n\n')
    for b in summary_bullets[:10]:
        f.write(b + '\n')
    f.write('\n---\n')
    f.write(f"_Captured: {datetime.utcnow().isoformat()}Z_\n")

print('Wrote', fn)
