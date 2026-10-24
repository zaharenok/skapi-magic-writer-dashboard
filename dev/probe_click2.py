import asyncio, os
from playwright.async_api import async_playwright

async def main():
    slug = os.getenv("PAID_COMMUNITY_SLUG")
    jwt = os.getenv("COMMUNITY_SYNC_JWT")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context()
        await ctx.add_cookies([{"name": "auth_token", "value": jwt, "domain": ".skool.com", "path": "/", "secure": True}])
        page = await ctx.new_page()
        reqs = []
        page.on("request", lambda r: reqs.append((r.method, r.url[:150])) if "skool.com" in r.url and not r.url.startswith("https://www.skool.com/_next/static") else None)
        await page.goto(f"https://www.skool.com/{slug}/-/members", wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)
        reqs.clear()
        clicked = await page.evaluate("""() => {
            const btn = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === '2');
            if (!btn) return false;
            btn.click();
            return true;
        }""")
        print("clicked 2:", clicked)
        await page.wait_for_timeout(4000)
        print("URL after click:", page.url)
        for m, u in reqs[:10]:
            print("  ", m, u)
        first_name = await page.evaluate("""() => {
            const el = document.getElementById('__NEXT_DATA__');
            if (el) { const u = (JSON.parse(el.textContent).props.pageProps.users || [])[0]; return 'nd: ' + (u ? u.name : 'none'); }
            return 'no __NEXT_DATA__';
        }""")
        print(first_name)
        # а что в DOM?
        dom_first = await page.evaluate("() => { const a = [...document.querySelectorAll('a[href*=\"/@\"]')].find(x => x.querySelector('img')); return a ? (a.querySelector('img').alt || a.href) : 'none'; }")
        print("DOM first:", dom_first)
        await browser.close()

asyncio.run(main())
