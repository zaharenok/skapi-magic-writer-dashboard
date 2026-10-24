import asyncio, os, json
from playwright.async_api import async_playwright

async def main():
    slug = os.getenv("PAID_COMMUNITY_SLUG")
    jwt = os.getenv("COMMUNITY_SYNC_JWT")
    owner = "04b02f5028534735ae60bf414465b766"
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context()
        await ctx.add_cookies([{"name": "auth_token", "value": jwt, "domain": ".skool.com", "path": "/", "secure": True}])
        page = await ctx.new_page()
        await page.goto(f"https://www.skool.com/{slug}/-/members", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        js = """(owner) => {
            const props = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
            const users = props.users || [];
            const ownerEntry = users.find(u => JSON.stringify(u).includes(owner));
            // все 32-hex значения в первом юзере с путями
            const hexPaths = [];
            const walk = (v, path, depth) => {
                if (depth > 4 || hexPaths.length > 20) return;
                if (v && typeof v === 'object') {
                    for (const [k, x] of Object.entries(v)) {
                        if (typeof x === 'string' && /^[0-9a-f]{32}$/.test(x)) hexPaths.push(path + '.' + k + ' = ' + x);
                        else walk(x, path + '.' + k, depth + 1);
                    }
                }
            };
            walk(users[0], 'u', 0);
            // пагинация в DOM
            const pagLinks = [...document.querySelectorAll('a')].filter(a => /members/.test(a.href) && /page|\\//.test(a.href)).map(a => a.href).slice(0, 8);
            const btns = [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(t => t && t.length < 20).slice(0, 25);
            return {
                ownerFound: ownerEntry ? { username: ownerEntry.name, member: ownerEntry.member ? ownerEntry.member.id : null, selfMatch: (ownerEntry.member || {}).id === owner } : null,
                hexPaths,
                pagLinks,
                btns,
            };
        }"""
        info = await page.evaluate(js, owner)
        print("owner entry:", json.dumps(info["ownerFound"], ensure_ascii=False))
        print("hex paths in user0:")
        for p in info["hexPaths"]:
            print("  ", p)
        print("pagLinks:", info["pagLinks"])
        print("buttons:", info["btns"])
        await browser.close()

asyncio.run(main())
