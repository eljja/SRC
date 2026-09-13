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
    required_fields = [
        'id', 'investor_company', 'startup_name', 'sector', 'investment_year',
        'startup_lat', 'startup_lon', 'startup_tagline', 'startup_tech_tag', 'syndicate_partners'
    ]
    missing_fields_count = 0
    for idx, inv in enumerate(investments):
        for field in required_fields:
            if field not in inv or inv[field] is None:
                print(f"  Warning: investment {inv.get('id', idx)} missing field '{field}'")
                missing_fields_count += 1
    
    if missing_fields_count == 0:
        print(f"  - All {len(investments)} investments have 100% complete required fields (including tagline, tech tag, syndicate partners)!")

    # 2. Check IDs between venture.html, ventureApp.js, and ventureNetwork.js
    with open('venture.html', 'r', encoding='utf-8') as f:
        html = f.read()

    with open('js/ventureApp.js', 'r', encoding='utf-8') as f:
        js_app = f.read()

    with open('js/ventureNetwork.js', 'r', encoding='utf-8') as f:
        js_net = f.read()

    js = js_app + "\n" + js_net

    html_ids = set(re.findall(r'id=["\']([a-zA-Z0-9_-]+)["\']', html))
    dynamic_ids = set(re.findall(r'id=["\']([a-zA-Z0-9_-]+)["\']', js))
    all_declared_ids = html_ids | dynamic_ids
    js_ids = set(re.findall(r'getElementById\(["\']([a-zA-Z0-9_-]+)["\']\)', js))

    missing = js_ids - all_declared_ids
    print(f"DOM IDs checked: {len(js_ids)} accessed in JS, {len(all_declared_ids)} declared across HTML/templates ({len(html_ids)} HTML + {len(dynamic_ids)} dynamic).")
    if missing:
        print(f"  Warning: IDs accessed in JS but missing: {missing}")
    else:
        print("  - 100% ID parity! All JS accessed elements exist.")

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
