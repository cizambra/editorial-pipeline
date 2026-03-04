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

profiles = resp.json()
print(f"\nFound {len(profiles)} connected profiles:\n")
for p in profiles:
    print(f"  Platform : {p.get('service', 'unknown')}")
    print(f"  Username : {p.get('formatted_username', '')}")
    print(f"  ID       : {p.get('id', '')}")
    print()

print("Copy the IDs into your .env file.")
