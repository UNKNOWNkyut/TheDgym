"""
CLI Hardware Simulator & Bridge Utility for The DGym Smart Keycard Tap Endpoint.

Usage examples:
  python scripts/simulate_rfid_tap.py --uid 04A1B2C30001
  python scripts/simulate_rfid_tap.py --uid 04DEAD990003
  python scripts/simulate_rfid_tap.py --uid 04FF99887766
"""
import argparse
import json
import urllib.error
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate a hardware RFID/NFC keycard tap against FastAPI.")
    parser.add_argument("--url", default="http://127.0.0.1:8000/api/access/tap", help="Tap verification endpoint URL")
    parser.add_argument(
        "--api-key",
        default="dgym_scan_dev_frontdesk_terminal_key",
        help="X-Scanner-API-Key header value",
    )
    parser.add_argument("--uid", default="04A1B2C30001", help="Raw RFID/NFC Card UID to tap")
    args = parser.parse_args()

    body = json.dumps({"card_uid": args.uid}).encode("utf-8")
    req = urllib.request.Request(
        args.url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-Scanner-API-Key": args.api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            status_tag = "GRANTED" if result.get("granted") else "DENIED"
            print(f"[{status_tag}] decision={result.get('decision')} ({result.get('latency_ms')}ms)")
            print(json.dumps(result, indent=2))
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8", errors="replace")
        print(f"[HTTP {err.code}] {err_body}")


if __name__ == "__main__":
    main()
