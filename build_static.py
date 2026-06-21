"""
Assembles the static site in _site/ for GitHub Pages deployment.
Run this after generate_data.py has created release-notes.json.
"""
import os
import shutil

OUT = '_site'
os.makedirs(f'{OUT}/static', exist_ok=True)

# Fix index.html: Flask uses /static/..., GitHub Pages needs static/...
with open('templates/index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = html.replace('href="/static/style.css"', 'href="static/style.css"')
with open(f'{OUT}/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# Copy stylesheet
shutil.copy('static/style.css', f'{OUT}/static/style.css')

# Patch app.js: replace Flask API call with static JSON fetch
with open('static/app.js', 'r', encoding='utf-8') as f:
    js = f.read()
js = js.replace(
    "const url = `/api/release-notes${force ? '?force=true' : ''}`;",
    "const url = `release-notes.json?t=${Date.now()}`;"
)
with open(f'{OUT}/static/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

# Copy pre-generated data
shutil.copy('release-notes.json', f'{OUT}/release-notes.json')

print(f"Static site built in {OUT}/")
