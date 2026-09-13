import json
import re
import sys

def main():
    print("=== Verifying Venture Capital Observatory Files ===")

    # 1. Verify ventures.json
    with open('data/ventures.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    metadata = data.get('metadata', {})
    investments = data.get('investments', [])
    sectors = data.get('sectors', [])

    print(f"ventures.json loaded successfully:")
    print(f"  - Title: {metadata.get('title')}")
    print(f"  - Last Updated: {metadata.get('last_updated')}")
    print(f"  - Investments count: {len(investments)}")
    print(f"  - Sectors count: {len(sectors)}")

    # Check for required fields in each investment
    required_fields = ['id', 'investor_company', 'startup_name', 'sector', 'investment_year', 'startup_lat', 'startup_lon']
    missing_fields_count = 0
    for idx, inv in enumerate(investments):
        for field in required_fields:
            if field not in inv or inv[field] is None:
                print(f"  Warning: investment {inv.get('id', idx)} missing field '{field}'")
                missing_fields_count += 1
    
    if missing_fields_count == 0:
        print("  - All investments have required fields!")

    # 2. Check IDs between venture.html and ventureApp.js
    with open('venture.html', 'r', encoding='utf-8') as f:
        html = f.read()

    with open('js/ventureApp.js', 'r', encoding='utf-8') as f:
        js = f.read()

    html_ids = set(re.findall(r'id=["\']([a-zA-Z0-9_-]+)["\']', html))
    js_ids = set(re.findall(r'getElementById\(["\']([a-zA-Z0-9_-]+)["\']\)', js))

    missing_in_html = js_ids - html_ids
    print(f"DOM IDs checked: {len(js_ids)} accessed in JS, {len(html_ids)} declared in HTML.")
    if missing_in_html:
        print(f"  Warning: IDs in JS but missing in HTML: {missing_in_html}")
    else:
        print("  - 100% ID parity! All JS accessed elements exist in HTML.")

    # 3. Check cross links
    with open('index.html', 'r', encoding='utf-8') as f:
        index_html = f.read()

    has_link_to_venture = 'venture.html' in index_html
    has_link_to_index = 'index.html' in html

    print(f"Cross-links check:")
    print(f"  - index.html -> venture.html: {'OK' if has_link_to_venture else 'MISSING'}")
    print(f"  - venture.html -> index.html: {'OK' if has_link_to_index else 'MISSING'}")

    # 4. Check sitemap
    with open('sitemap.xml', 'r', encoding='utf-8') as f:
        sitemap = f.read()
    has_sitemap_venture = 'venture.html' in sitemap
    print(f"Sitemap check:")
    print(f"  - sitemap.xml contains venture.html: {'OK' if has_sitemap_venture else 'MISSING'}")

    print("=== Verification Complete ===")

if __name__ == '__main__':
    main()
