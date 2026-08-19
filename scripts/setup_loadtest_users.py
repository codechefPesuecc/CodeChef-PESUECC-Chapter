#!/usr/bin/env python3
"""
Simple setup script to create test users for load testing.
Does NOT import Locust (avoids gevent/SSL issues).

Usage:
    python scripts/setup_loadtest_users.py
"""

import requests
import sys

API_HOST = "http://localhost:3000"
TEST_USER_COUNT = 5
TEST_USER_PREFIX = "loadtest"
TEST_PASSWORD = "LoadTest@123"

TEST_USERS = [
    {
        "username": f"{TEST_USER_PREFIX}{i}",
        "password": TEST_PASSWORD,
        "email": f"{TEST_USER_PREFIX}{i}@load.test",
        "name": f"Load Test User {i}",
        "prn": f"PRN{1000000 + i}",
    }
    for i in range(1, TEST_USER_COUNT + 1)
]


def setup_test_users():
    """Create test users before load testing."""
    print("\n" + "=" * 60)
    print("Setting up test users for load test...")
    print("=" * 60)

    created = 0
    skipped = 0
    failed = 0

    for user in TEST_USERS:
        try:
            resp = requests.post(
                f"{API_HOST}/api/auth/register",
                json={
                    "username": user["username"],
                    "name": user["name"],
                    "email": user["email"],
                    "password": user["password"],
                    "prn": user["prn"],
                },
                timeout=5,
            )
            if resp.status_code == 201:
                print(f"✓ Created user: {user['username']}")
                created += 1
            elif resp.status_code == 409:
                print(f"⊘ User already exists: {user['username']}")
                skipped += 1
            else:
                print(
                    f"✗ Failed to create {user['username']}: {resp.status_code} {resp.text}"
                )
                failed += 1
        except requests.ConnectionError:
            print(
                f"✗ Cannot connect to {API_HOST}. Is the dev server running (npm run dev)?"
            )
            return False
        except Exception as e:
            print(f"✗ Error creating {user['username']}: {e}")
            failed += 1

    print("=" * 60)
    print(f"Setup complete: {created} created, {skipped} existed, {failed} failed")
    print("=" * 60)

    if created + skipped >= TEST_USER_COUNT:
        print("\n✓ Test users ready!")
        print(f"  Login with any: {TEST_USER_PREFIX}1 / {TEST_PASSWORD}")
        return True
    else:
        print("\n✗ Some users failed. Check the dev server is running.")
        return False


if __name__ == "__main__":
    success = setup_test_users()
    sys.exit(0 if success else 1)
