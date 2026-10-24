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
            const props = (data.props || {}).pageProps || {};
            const out = { pagePropsKeys: Object.keys(props) };
            // ищем массивы объектов с числовым id
            const found = [];
            const walk = (v, path, depth) => {
                if (depth > 4 || found.length >= 5) return;
                if (Array.isArray(v)) {
                    if (v.length && v[0] && typeof v[0] === 'object' && v[0].id !== undefined) {
                        found.push({ path, len: v.length, sample: { ...v[0], id: String(v[0].id) } });
                    }
                    v.forEach((x, i) => walk(x, path + '[' + i + ']', depth + 1));
                } else if (v && typeof v === 'object') {
                    Object.entries(v).forEach(([k, x]) => walk(x, path + '.' + k, depth + 1));
                }
            };
            walk(props, 'props', 0);
            out.arrays = found;
            return out;
        }"""
        info = await page.evaluate(js)
        print("pageProps keys:", info["pagePropsKeys"])
        for a in info["arrays"]:
            print("ARRAY", a["path"], "len:", a["len"])
            print("  sample:", json.dumps(a["sample"], ensure_ascii=False)[:400])
        await browser.close()

asyncio.run(main())
