"""
setup_social.py — Verify social media credentials and print the IDs you need.

Run: python3 setup_social.py

For each configured platform it will:
  - Check the access token is valid
  - Print your user ID / person URN
  - Tell you exactly what to paste into your .env
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

SEP = "-" * 55


def check_linkedin():
    token = os.getenv("LINKEDIN_ACCESS_TOKEN", "")
    urn = os.getenv("LINKEDIN_PERSON_URN", "")
    print("\n{}".format(SEP))
    print("LINKEDIN")
    print(SEP)
    if not token:
        print("  LINKEDIN_ACCESS_TOKEN not set — skipping.")
        print("  Get one at: https://www.linkedin.com/developers/tools/oauth")
        print("  Required scopes: openid, profile, w_member_social")
        return
    try:
        import requests
        resp = requests.get(
            "https://api.linkedin.com/v2/me",
            headers={"Authorization": "Bearer {}".format(token)},
        )
        resp.raise_for_status()
        data = resp.json()
        person_id = data.get("id", "")
        person_urn = "urn:li:person:{}".format(person_id)
        print("  Token valid.")
        print("  Name: {} {}".format(data.get("localizedFirstName", ""), data.get("localizedLastName", "")))
        print("  ID  : {}".format(person_id))
        print()
        if urn:
            print("  LINKEDIN_PERSON_URN is already set: {}".format(urn))
        else:
            print("  Add to your .env:")
            print("    LINKEDIN_PERSON_URN={}".format(person_urn))
    except Exception as e:
        print("  Error: {}".format(e))
        if hasattr(e, "response") and e.response is not None:
            print("  Response: {}".format(e.response.text[:300]))


def check_threads():
    token = os.getenv("THREADS_ACCESS_TOKEN", "")
    user_id = os.getenv("THREADS_USER_ID", "")
    print("\n{}".format(SEP))
    print("THREADS")
    print(SEP)
    if not token:
        print("  THREADS_ACCESS_TOKEN not set — skipping.")
        print("  Get one at: https://developers.facebook.com/ (create a Threads-type app)")
        print("  Required scopes: threads_basic, threads_content_publish")
        return
    try:
        import requests
        resp = requests.get(
            "https://graph.threads.net/v1.0/me",
            params={
                "access_token": token,
                "fields": "id,username",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        uid = data.get("id", "")
        print("  Token valid.")
        print("  Username: @{}".format(data.get("username", "")))
        print("  ID      : {}".format(uid))
        print()
        if user_id:
            print("  THREADS_USER_ID is already set: {}".format(user_id))
        else:
            print("  Add to your .env:")
            print("    THREADS_USER_ID={}".format(uid))
    except Exception as e:
        print("  Error: {}".format(e))
        if hasattr(e, "response") and e.response is not None:
            print("  Response: {}".format(e.response.text[:300]))


def check_instagram():
    token = os.getenv("META_ACCESS_TOKEN", "")
    user_id = os.getenv("INSTAGRAM_USER_ID", "")
    print("\n{}".format(SEP))
    print("INSTAGRAM")
    print(SEP)
    if not token:
        print("  META_ACCESS_TOKEN not set — skipping.")
        print("  Requires: Instagram Business/Creator account + Facebook Page + Meta App")
        print("  Required permission: instagram_content_publish, instagram_basic")
        print("  Note: text-only posts are NOT supported — you need an image URL.")
        return
    try:
        import requests
        resp = requests.get(
            "https://graph.facebook.com/v21.0/me",
            params={"access_token": token, "fields": "id,username,name"},
        )
        resp.raise_for_status()
        data = resp.json()
        uid = data.get("id", "")
        print("  Token valid.")
        print("  Username: {}".format(data.get("username") or data.get("name", "")))
        print("  ID      : {}".format(uid))
        print()
        if user_id:
            print("  INSTAGRAM_USER_ID is already set: {}".format(user_id))
        else:
            print("  Add to your .env:")
            print("    INSTAGRAM_USER_ID={}".format(uid))
        print()
        print("  Reminder: Instagram posts via API require a public image_url.")
    except Exception as e:
        print("  Error: {}".format(e))
        if hasattr(e, "response") and e.response is not None:
            print("  Response: {}".format(e.response.text[:300]))


if __name__ == "__main__":
    print("Social Media Credential Check")
    check_linkedin()
    check_threads()
    check_instagram()
    print("\n{}".format(SEP))
    print("Done. Copy any missing IDs into your .env file.")
    print(SEP)
