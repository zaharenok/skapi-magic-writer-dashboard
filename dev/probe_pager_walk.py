import asyncio, os, json
from playwright.async_api import async_playwright

PARSE = """() => {
    try {
        const el = document.getElementById('__NEXT_DATA__');
        if (!el) return null;
        const props = JSON.parse(el.textContent).props.pageProps;
        const users = props.users || [];
        const pager = [...document.querySelectorAll('button')]
            .map(b => (b.innerText || '').trim())
            .filter(t => /^\\d+$/.test(t))
            .map(Number);
        return {
            total: props.total || 0,
            page: props.page || 1,
            pager,
            users: users.map(u => ({
                id: u.id || (u.member && u.member.userId) || '',
                username: u.name || '',
                first: u.firstName || '',
                last: u.lastName || '',
                avatar: (u.metadata && (u.metadata.pictureBubble || u.metadata.pictureProfile)) || '',
            })),
        };
    } catch (e) { return null; }
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
        visited = set()
        to_visit = [1]
        total = 0
        while to_visit and len(visited) < 40:
            num = to_visit.pop(0)
            if num in visited:
                continue
            visited.add(num)
            data = await page.evaluate(PARSE)
            if data is None:
                print("FATAL: no __NEXT_DATA__ on page", num)
                return
            total = data.get("total") or total
            for u in data["users"]:
                if u["id"]:
                    seen[u["id"]] = u
            for p in data.get("pager", []):
                if p not in visited and p not in to_visit:
                    to_visit.append(p)
            if not to_visit:
                break
            nxt = to_visit[0]
            clicked = await page.evaluate(
                """(num) => {
                    const btn = [...document.querySelectorAll('button')]
                        .find(b => (b.innerText || '').trim() === String(num));
                    if (!btn) return false;
                    btn.click();
                    return true;
                }""",
                nxt,
            )
            if not clicked:
                print("pager button not found:", nxt)
                break
            await page.wait_for_timeout(3000)

        print("pages visited:", sorted(visited), "| unique ids:", len(seen), "| site total:", total)
        with_name = [u for u in seen.values() if (u["first"] + " " + u["last"]).strip()]
        print("with real name:", len(with_name))
        sample = list(seen.values())[:2]
        print("sample:", json.dumps(sample, ensure_ascii=False)[:400])
        owner = seen.get("04b02f5028534735ae60bf414465b766")
        print("owner:", json.dumps(owner, ensure_ascii=False)[:250] if owner else "NOT FOUND")
        await browser.close()

asyncio.run(main())
