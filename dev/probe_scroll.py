import asyncio, os, json
from playwright.async_api import async_playwright

EXTRACT = """() => {
    const seen = new Map();
    for (const a of document.querySelectorAll('a[href*="/@"]')) {
        const card = a.closest('div');
        let holder = a;
        for (let i = 0; i < 5 && holder; i++) {
            if (holder.querySelector('img')) break;
            holder = holder.parentElement;
        }
        const img = holder ? holder.querySelector('img') : null;
        const href = (a.href || '').split('?')[0].replace(/\\/$/, '');
        if (!href.includes('/@') || seen.has(href)) continue;
        const m = img && img.src ? img.src.match('/f/([0-9a-f]{32})/') : null;
        const name = (img && img.alt) || (a.querySelector('span[title]') && a.querySelector('span[title]').title) || '';
        seen.set(href, {
            skool_user_id: m ? m[1] : '',
            username: href.split('/@')[1] || '',
            name: name,
            avatar_url: img ? img.src : '',
            profile_url: href,
        });
    }
    return [...seen.values()];
}"""

async def main():
    slug = os.getenv("PAID_COMMUNITY_SLUG")
    jwt = os.getenv("COMMUNITY_SYNC_JWT")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context()
        await ctx.add_cookies([{"name": "auth_token", "value": jwt, "domain": ".skool.com", "path": "/", "secure": True}])
        page = await ctx.new_page()
        await page.goto(f"https://www.skool.com/{slug}/-/members", wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)
        seen = {}
        stale = 0
        for i in range(60):
            batch = await page.evaluate(EXTRACT)
            for m in batch:
                seen[m["profile_url"]] = m
            before = len(seen)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2200)
            if len(seen) == before:
                stale += 1
                if stale >= 3:
                    break
            else:
                stale = 0
        print("scrolls:", i + 1, "| unique:", len(seen))
        with_ids = sum(1 for m in seen.values() if m["skool_user_id"])
        with_names = sum(1 for m in seen.values() if m["name"])
        print("with id:", with_ids, "| with name:", with_names)
        sample = list(seen.values())[:3]
        print("sample:", json.dumps(sample, ensure_ascii=False)[:700])
        owner = [m for m in seen.values() if m["skool_user_id"] == "04b02f5028534735ae60bf414465b766"]
        print("owner:", json.dumps(owner, ensure_ascii=False)[:300])
        await browser.close()

asyncio.run(main())
