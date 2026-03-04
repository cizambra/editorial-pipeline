# Editorial Pipeline

One-button tool: upload your reflection → get companion, translations, and repurposed social content.

## Setup (5 minutes)

### 1. Install dependencies
```bash
python3 -m pip install -r requirements.txt
```

### 2. Configure environment
```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```
Then edit `.env` with your keys (open it in Notepad or any text editor):

- **ANTHROPIC_API_KEY** — get at [console.anthropic.com](https://console.anthropic.com)
- **BUFFER_ACCESS_TOKEN** — get at [buffer.com/developers/apps](https://buffer.com/developers/apps)

### 3. Get your Buffer profile IDs
```bash
python3 get_buffer_profiles.py
```
Copy the IDs for LinkedIn, Instagram, and Threads into your `.env`.

### 4. Add your companion template
Put your companion template in `templates/companion_template.md`,
or upload it via the Settings panel in the UI.

### 5. Run
```bash
python3 main.py
```
Then open [http://localhost:8000](http://localhost:8000).

---

## What it does

1. **Related articles** — Scans your Substack RSS feed, finds the 3 most thematically related past articles
2. **Paid companion** — Generates the companion piece following your template
3. **Translations** — Both pieces translated to neutral Spanish
4. **Repurposed content** — LinkedIn, Instagram, Threads, and Substack Note for each piece (EN + ES)
5. **Buffer scheduling** — Optionally pushes LinkedIn, Instagram, and Threads posts to Buffer on your publishing schedule
6. **Substack Notes** — Displayed for manual copy-paste (no Substack API available)

## Publishing schedule

Configured in `.env`:
- `REFLECTION_DAY=2` + `REFLECTION_TIME=07:00` → Wednesday 7am
- `COMPANION_DAY=3` + `COMPANION_TIME=08:00` → Thursday 8am

Days: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday

## Refresh article index

The first run fetches your Substack RSS and caches it in `articles_cache.json`.
Click **Refresh index** in Settings after publishing new articles.
