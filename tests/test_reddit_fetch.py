from __future__ import annotations

import asyncio
import unittest

import httpx

from app.api.routes import media


class RedditFetchTests(unittest.TestCase):
    def test_extract_reddit_titles_filters_stickied_removed_and_duplicates(self) -> None:
        payload = {
            "data": {
                "children": [
                    {"data": {"title": "Build consistency", "stickied": False}},
                    {"data": {"title": "Build consistency", "stickied": False}},
                    {"data": {"title": "[removed]", "stickied": False}},
                    {"data": {"title": "Moderator post", "stickied": True}},
                    {"data": {"title": "Stop doomscrolling", "removed_by_category": "moderator"}},
                    {"data": {"title": "Get back on track", "stickied": False}},
                ]
            }
        }

        self.assertEqual(
            media._extract_reddit_titles(payload),
            ["Build consistency", "Get back on track"],
        )

    def test_fetch_subreddit_titles_falls_back_to_old_reddit_after_403(self) -> None:
        async def run_test() -> None:
            calls = []

            def handler(request: httpx.Request) -> httpx.Response:
                calls.append(str(request.url))
                if request.url.host == "www.reddit.com":
                    return httpx.Response(403, json={"message": "blocked"})
                return httpx.Response(
                    200,
                    json={
                        "data": {
                            "children": [
                                {"data": {"title": "One", "stickied": False}},
                                {"data": {"title": "Two", "stickied": False}},
                            ]
                        }
                    },
                )

            transport = httpx.MockTransport(handler)
            async with httpx.AsyncClient(transport=transport, headers=media._REDDIT_BASE_HEADERS) as client:
                titles = await media._fetch_subreddit_titles(client, "getdisciplined")

            self.assertEqual(titles, ["One", "Two"])
            self.assertEqual(len(calls), 2)
            self.assertIn("www.reddit.com", calls[0])
            self.assertIn("old.reddit.com", calls[1])

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
