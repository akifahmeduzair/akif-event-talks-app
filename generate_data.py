import time
import json
import requests
import feedparser
from bs4 import BeautifulSoup

def fetch_and_parse_feed():
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(
            'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml',
            headers=headers,
            timeout=15
        )
        response.raise_for_status()

        feed = feedparser.parse(response.text)
        updates = []
        global_index = 0

        for entry in feed.entries:
            entry_id = entry.get('id', f"bq_release_{global_index}")
            date_str = entry.get('title', 'Unknown Date')
            updated_str = entry.get('updated', '')
            link = entry.get('link', '')

            content_val = ''
            if hasattr(entry, 'content') and len(entry.content) > 0:
                content_val = entry.content[0].value
            elif hasattr(entry, 'summary'):
                content_val = entry.summary

            if not content_val:
                continue

            soup = BeautifulSoup(content_val, 'html.parser')
            current_type = 'Update'
            current_elements = []
            entry_updates = []

            for child in soup.contents:
                if child.name == 'h3':
                    if current_elements or current_type != 'Update':
                        entry_updates.append({
                            'type': current_type,
                            'html': ''.join(str(e) for e in current_elements),
                            'text': ''.join(
                                e.get_text() if hasattr(e, 'get_text') else str(e)
                                for e in current_elements
                            ).strip()
                        })
                        current_elements = []
                    current_type = child.get_text().strip()
                else:
                    current_elements.append(child)

            if current_elements or current_type != 'Update':
                entry_updates.append({
                    'type': current_type,
                    'html': ''.join(str(e) for e in current_elements),
                    'text': ''.join(
                        e.get_text() if hasattr(e, 'get_text') else str(e)
                        for e in current_elements
                    ).strip()
                })

            for idx, update in enumerate(entry_updates):
                text_clean = " ".join(update['text'].split())
                updates.append({
                    'id': f"{entry_id}_{idx}".replace(':', '_').replace('/', '_').replace('#', '_'),
                    'date': date_str,
                    'updated': updated_str,
                    'link': link,
                    'type': update['type'],
                    'html': update['html'],
                    'text': text_clean
                })
                global_index += 1

        return {
            'status': 'success',
            'last_fetched': time.time(),
            'updates': updates
        }

    except Exception as e:
        return {
            'status': 'error',
            'message': str(e),
            'last_fetched': 0,
            'updates': []
        }


if __name__ == '__main__':
    print("Fetching BigQuery release notes...")
    data = fetch_and_parse_feed()

    if data['status'] == 'success':
        print(f"Fetched {len(data['updates'])} updates.")
    else:
        print(f"Error: {data['message']}")

    with open('release-notes.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Saved to release-notes.json")
