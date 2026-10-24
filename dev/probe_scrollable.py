import asyncio, os, json
from playwright.async_api import async_playwright

FIND_SCROLLABLES = """() => {
    const out = [];
    for (const el of document.querySelectorAll('div, section, main')) {
        if (el.scrollHeight - el.clientHeight > 300 && el.clientHeight > 300) {
            out.push({ cls: (el.className || '').toString().slice(0, 60), sh: el.scrollHeight, ch: el.clientHeight });
        }
    }
    return { bodySH: document.body.scrollHeight, bodyCH: window.innerHeight, candidates: out.slice(0, 6) };
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
        info = await page.evaluate(FIND_SCROLLABLES)
        print(json.dumps(info, indent=1)[:800])
        await browser.close()

asyncio.run(main())
