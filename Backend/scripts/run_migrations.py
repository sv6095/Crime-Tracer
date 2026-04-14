#!/usr/bin/env python
"""
Script to run Alembic migrations.

Usage:
    python scripts/run_migrations.py upgrade head
    python scripts/run_migrations.py downgrade -1
    python scripts/run_migrations.py revision --autogenerate -m "description"
"""

import sys
import os
from pathlib import Path

# Add the Backend directory to the path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Import Alembic's command-line interface
from alembic.config import Config
from alembic import command

def main():
    """Run Alembic commands."""
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    
    # Get command from command line arguments
    if len(sys.argv) < 2:
        print("Usage: python run_migrations.py <command> [args...]")
        print("\nCommon commands:")
        print("  upgrade head          - Apply all migrations")
        print("  downgrade -1          - Rollback one migration")
        print("  revision --autogenerate -m 'message' - Create new migration")
        print("  current               - Show current revision")
        print("  history               - Show migration history")
        sys.exit(1)
    
    cmd = sys.argv[1]
    args = sys.argv[2:]
    
    if cmd == "upgrade":
        revision = args[0] if args else "head"
        command.upgrade(alembic_cfg, revision)
    elif cmd == "downgrade":
        revision = args[0] if args else "-1"
        command.downgrade(alembic_cfg, revision)
    elif cmd == "revision":
        # Handle revision command with options
        autogenerate = "--autogenerate" in args
        message = None
        if "-m" in args:
            idx = args.index("-m")
            if idx + 1 < len(args):
                message = args[idx + 1]
        
        command.revision(alembic_cfg, message=message, autogenerate=autogenerate)
    elif cmd == "current":
        command.current(alembic_cfg)
    elif cmd == "history":
        command.history(alembic_cfg)
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)

if __name__ == "__main__":
    main()
