import asyncio, os, json
from playwright.async_api import async_playwright

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
        # все кнопки после первых строк: ищем пейджер
        info = await page.evaluate("""() => {
            const btns = [...document.querySelectorAll('button')];
            return btns.map((b, i) => ({ i, t: (b.innerText || '').trim().slice(0, 30), cls: (b.className || '').toString().slice(0, 40) }))
                .filter(x => /^\\d+$/.test(x.t) || x.t === '>' || x.t === '‹' || x.t === '›' || x.t.includes('Load') || x.t.includes('load'));
        }""")
        print("pager-ish buttons:", json.dumps(info))
        # network: ловим запросы при скролле
        reqs = []
        page.on("request", lambda r: reqs.append(r.url[:130]) if "members" in r.url or "api" in r.url else None)
        for _ in range(4):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1800)
        print("requests during scroll:", len(reqs))
        for u in reqs[:8]:
            print("  ", u)
        cnt = await page.evaluate("() => [...document.querySelectorAll('a')].filter(a => a.href.includes('/@')).length")
        print("links after scrolls:", cnt)
        await browser.close()

asyncio.run(main())
