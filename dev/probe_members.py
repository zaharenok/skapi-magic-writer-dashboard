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
        await page.goto(f"https://www.skool.com/{slug}/-/members", wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)
        js = """() => {
            const nd = document.getElementById('__NEXT_DATA__');
            const links = [...document.querySelectorAll('a[href*="/@"]')];
            const first = links[0];
            let row = first;
            for (let i = 0; i < 4 && row && row.parentElement; i++) {
                const p = row.parentElement;
                if (p.querySelector('img')) { row = p; break; }
                row = p;
            }
            const html = document.documentElement.outerHTML;
            const idMatches = [...html.matchAll(/"id":\\s*"?(\d{10,})"?/g)].slice(0, 5).map(m => m[1]);
            return {
                hasNextData: !!nd,
                nextFChunks: (window.__next_f || []).length,
                linkCount: links.length,
                rowHtml: row ? row.outerHTML.slice(0, 1500) : null,
                firstLinkText: first ? first.innerText : null,
                imgAlt: first && first.querySelector('img') ? first.querySelector('img').alt : null,
                bigIdSample: idMatches,
            };
        }"""
        info = await page.evaluate(js)
        print("hasNextData:", info["hasNextData"], "| nextF:", info["nextFChunks"], "| links:", info["linkCount"])
        print("firstLinkText:", repr(info["firstLinkText"]))
        print("imgAlt:", repr(info["imgAlt"]))
        print("bigIdSample:", info["bigIdSample"])
        print("ROW:", info["rowHtml"])
        await browser.close()

asyncio.run(main())
