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
        await page.wait_for_timeout(4000)
        js = """() => {
            const props = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
            const u = (props.users || [])[0] || {};
            return { member: u.member, total: props.total, totalPages: props.totalPages, page: props.page, selfName: props.self && props.self.name };
        }"""
        info = await page.evaluate(js)
        print("member:", json.dumps(info["member"], ensure_ascii=False)[:600])
        print("total:", info["total"], "| totalPages:", info["totalPages"], "| page:", info["page"])

        # страница 2: тот же __NEXT_DATA__ путь?
        await page.goto(f"https://www.skool.com/{slug}/-/members?page=2", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        js2 = """() => {
            const props = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
            const users = props.users || [];
            return { page: props.page, count: users.length, first: users[0] ? { id: users[0].id, member: users[0].member, name: users[0].name, firstName: users[0].firstName } : null };
        }"""
        info2 = await page.evaluate(js2)
        print("page2:", info2["page"], "count:", info2["count"])
        print("page2 first:", json.dumps(info2["first"], ensure_ascii=False)[:500])
        await browser.close()

asyncio.run(main())
