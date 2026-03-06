# -*- coding: utf-8 -*-

"""
get_buffer_profiles.py — Run this once to find your Buffer profile IDs.
Usage: python get_buffer_profiles.py
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("BUFFER_ACCESS_TOKEN", "")
if not TOKEN:
    print("Error: BUFFER_ACCESS_TOKEN not set in .env")
    exit(1)

resp = requests.get(
    "https://api.bufferapp.com/1/profiles.json",
    params={"access_token": TOKEN}
)
resp.raise_for_status()

data = resp.json()
if not isinstance(data, list):
    print("Error: unexpected response from Buffer API:")
    print(data)
    exit(1)

profiles = data
print("\nFound {} connected profiles:\n".format(len(profiles)))
for p in profiles:
    print("  Platform : {}".format(p.get("service", "unknown")))
    print("  Username : {}".format(p.get("formatted_username", "")))
    print("  ID       : {}".format(p.get("id", "")))
    print("")

print("Copy the IDs into your .env file.")
