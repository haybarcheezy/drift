"""CLI: pull live baseball data from external APIs (live APIs).

Examples:

  # Current-season single day (pitches from Baseball Savant)
  python -m app.ingest pitches --start 2026-07-01 --end 2026-07-01

  # Rosters from official MLB Stats API
  python -m app.ingest players --season 2026

  # Both: players for season + pitches for date window
  python -m app.ingest sync --start 2026-07-01 --end 2026-07-02 --season 2026

  # Blow away local pitch table then load only live Savant data
  python -m app.ingest pitches --start 2026-07-01 --end 2026-07-01 --wipe
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date

from app import create_app
from app.ingest.load import (
    replace_pitches_for_dates,
    upsert_players,
    wipe_all_pitches,
    wipe_all_players,
)
from app.ingest.mlb_stats import fetch_player_rows
from app.ingest.savant import fetch_statcast_range, iter_daily, parse_iso_date


def _cmd_players(args: argparse.Namespace) -> int:
    print(f"Fetching MLB Stats API rosters for season {args.season}…")
    rows = fetch_player_rows(season=args.season)
    print(f"  mapped {len(rows)} players")
    if args.wipe:
        n = wipe_all_players()
        print(f"  wiped {n} existing player rows")
    stats = upsert_players(rows)
    print(f"  upsert complete: {stats}")
    return 0


def _cmd_pitches(args: argparse.Namespace) -> int:
    start = parse_iso_date(args.start)
    end = parse_iso_date(args.end)
    if end < start:
        print("error: --end must be >= --start", file=sys.stderr)
        return 2

    if args.wipe:
        n = wipe_all_pitches()
        print(f"Wiped {n} existing pitch rows")

    game_types = args.game_types
    total_inserted = 0
    total_deleted = 0
    days = list(iter_daily(start, end))
    print(
        f"Pulling Baseball Savant Statcast for {start} → {end} "
        f"({len(days)} day chunk(s), game_types={game_types!r})…"
    )

    for i, (d0, d1) in enumerate(days, 1):
        print(f"  [{i}/{len(days)}] {d0.isoformat()} …", end=" ", flush=True)
        try:
            rows = fetch_statcast_range(
                d0,
                d1,
                game_types=game_types,
                season=args.season,
            )
        except Exception as exc:  # noqa: BLE001 - CLI surface
            print(f"FAILED: {exc}")
            if args.strict:
                return 1
            continue
        stats = replace_pitches_for_dates(rows, d0, d1)
        total_inserted += stats["inserted"]
        total_deleted += stats["deleted"]
        print(f"{stats['inserted']} pitches (replaced {stats['deleted']})")
        if i < len(days) and args.delay > 0:
            time.sleep(args.delay)

    print(f"Done. inserted={total_inserted} deleted_windows={total_deleted}")
    return 0


def _cmd_sync(args: argparse.Namespace) -> int:
    code = _cmd_players(args)
    if code != 0:
        return code
    return _cmd_pitches(args)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m app.ingest",
        description="Ingest live MLB data from Baseball Savant + MLB Stats API",
    )
    sub = p.add_subparsers(dest="command", required=True)

    sp_players = sub.add_parser("players", help="Sync players from MLB Stats API")
    sp_players.add_argument("--season", type=int, default=date.today().year)
    sp_players.add_argument(
        "--wipe",
        action="store_true",
        help="Delete ALL local players before upsert",
    )
    sp_players.set_defaults(func=_cmd_players)

    sp_pitches = sub.add_parser("pitches", help="Pull pitches from Baseball Savant")
    sp_pitches.add_argument("--start", required=True, help="YYYY-MM-DD")
    sp_pitches.add_argument("--end", required=True, help="YYYY-MM-DD")
    sp_pitches.add_argument(
        "--season",
        type=int,
        default=None,
        help="Season year filter for Savant (default: year of --start)",
    )
    sp_pitches.add_argument(
        "--game-types",
        default="R|",
        help="Savant game type filter (default R| regular season)",
    )
    sp_pitches.add_argument(
        "--delay",
        type=float,
        default=1.5,
        help="Seconds between day requests (be polite to Savant)",
    )
    sp_pitches.add_argument(
        "--wipe",
        action="store_true",
        help="Delete ALL local pitches before loading",
    )
    sp_pitches.add_argument(
        "--strict",
        action="store_true",
        help="Abort on first failed day download",
    )
    sp_pitches.set_defaults(func=_cmd_pitches)

    sp_sync = sub.add_parser("sync", help="Players + pitches")
    sp_sync.add_argument("--season", type=int, default=date.today().year)
    sp_sync.add_argument("--start", required=True, help="YYYY-MM-DD")
    sp_sync.add_argument("--end", required=True, help="YYYY-MM-DD")
    sp_sync.add_argument("--game-types", default="R|")
    sp_sync.add_argument("--delay", type=float, default=1.5)
    sp_sync.add_argument(
        "--wipe",
        action="store_true",
        help="Wipe local players and pitches before loading",
    )
    sp_sync.add_argument("--strict", action="store_true")
    sp_sync.set_defaults(func=_cmd_sync)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    app = create_app()
    with app.app_context():
        return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
