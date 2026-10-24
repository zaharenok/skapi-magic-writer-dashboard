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
        build_id = await page.evaluate("() => JSON.parse(document.getElementById('__NEXT_DATA__').textContent).buildId")
        print("buildId:", build_id)

        # официальный data-роут Next.js
        for url in [
            f"https://www.skool.com/_next/data/{build_id}/{slug}/-/members.json?page=2",
            f"https://www.skool.com/_next/data/{build_id}/{slug}/-/members.json",
        ]:
            try:
                status, body = await page.evaluate("""async (url) => {
                    const r = await fetch(url, { headers: { 'x-nextjs-data': '1' } });
                    const t = await r.text();
                    return [r.status, t];
                }""", url)
                print("URL:", url.rsplit('/', 1)[-1], "page=2" if "page=2" in url else "nopage", "→", status, "len:", len(body))
                if status == 200:
                    d = json.loads(body)
                    props = (d.get("pageProps") or {})
                    users = props.get("users") or []
                    print("  page:", props.get("page"), "| users:", len(users), "| first:", users[0]["name"] if users else None,
                          "| member.userId:", (users[0].get("member") or {}).get("userId") if users else None)
                    break
            except Exception as e:
                print("URL:", url, "→ ERR", str(e)[:100])
        await browser.close()

asyncio.run(main())
