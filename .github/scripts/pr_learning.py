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

# Build doc
out_dir = os.path.join(os.getcwd(),'docs','pr-learnings')
os.makedirs(out_dir, exist_ok=True)
fn = os.path.join(out_dir, f'PR-{pr_number}.md')
with open(fn, 'w') as f:
    f.write(f"# PR {pr_number}: {pr.get('title','')}\n\n")
    f.write(f"**URL:** {pr.get('html_url')}\n\n")
    f.write('## Distilled reviewer learnings\n\n')
    for b in bullets:
        f.write(b + '\n')
    f.write('\n---\n')
    f.write(f"_Captured: {datetime.utcnow().isoformat()}Z_\n")

print('Wrote', fn)
