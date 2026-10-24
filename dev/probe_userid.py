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
        js = """() => {
            const data = JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
            const props = data.props.pageProps;
            const self = props.self || {};
            const u = (props.users || [])[0] || {};
            return {
                selfKeys: Object.keys(self),
                selfIdLike: Object.entries(self).filter(([k, v]) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v)),
                user0: JSON.parse(JSON.stringify(u)),
            };
        }"""
        info = await page.evaluate(js)
        print("selfIdLike:", info["selfIdLike"])
        print("user0 keys:", list(info["user0"].keys()))
        print("user0 id:", info["user0"].get("id"), "| name:", info["user0"].get("name"))
        print("user0 metadata keys:", list((info["user0"].get("metadata") or {}).keys()))
        print("user0 FULL:", json.dumps(info["user0"], ensure_ascii=False)[:1500])
        await browser.close()

asyncio.run(main())
