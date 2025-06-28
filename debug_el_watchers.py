#!/usr/bin/env python3
"""
Debug script to find why el_watcher.py is failing
"""
import os
import sys
import time
import traceback


def debug_step(step_name, func):
    """Run a debug step and catch any errors"""
    try:
        print(f"DEBUG: {step_name}...")
        result = func()
        print(f"DEBUG: {step_name} - SUCCESS")
        return result
    except Exception as e:
        print(f"DEBUG: {step_name} - FAILED: {e}")
        traceback.print_exc()
        return None


def main():
    print("=" * 60)
    print("🔍 EL_WATCHER DEBUG SCRIPT STARTING")
    print("=" * 60)

    # Step 1: Basic environment
    debug_step(
        "Check environment",
        lambda: [
            print(f"  MACHINE = {os.getenv('MACHINE')}"),
            print(f"  Working directory = {os.getcwd()}"),
            print(f"  Python version = {sys.version}"),
            print(f"  User = {os.getenv('USER')}"),
        ],
    )

    # Step 2: File system checks
    debug_step(
        "Check files exist",
        lambda: [
            print(
                f"  el_watcher.py exists: {os.path.exists('watchdog/el_watcher.py')}"
            ),
            print(
                f"  shared_config.json exists: {os.path.exists('shared_config.json')}"
            ),
            print(f"  Current directory contents: {os.listdir('.')}"),
        ],
    )

    # Step 3: Basic imports
    debug_step(
        "Import standard libraries",
        lambda: [
            __import__("json"),
            __import__("os"),
            __import__("sys"),
            __import__("time"),
            __import__("pathlib"),
            print("  Standard libraries imported successfully"),
        ],
    )

    # Step 4: Advanced imports (common in watchers)
    debug_step(
        "Import advanced libraries",
        lambda: [
            __import__("asyncio"),
            print("  asyncio imported"),
            __import__("aiofiles"),
            print("  aiofiles imported"),
            __import__("watchdog"),
            print("  watchdog imported"),
            __import__("requests"),
            print("  requests imported"),
        ],
    )

    # Step 5: Load config
    config = debug_step(
        "Load shared_config.json",
        lambda: [
            json := __import__("json"),
            config := json.load(open("shared_config.json", "r")),
            print(f"  Config loaded, keys: {list(config.keys())}"),
            config,
        ][2],
    )

    if config:
        # Step 6: Check machine config
        debug_step(
            "Check machine configuration",
            lambda: [
                machine_name := os.getenv("MACHINE"),
                print(f"  Looking for machine: {machine_name}"),
                machines := config.get("modes", {}).get("dev", {}).get("machines", {}),
                print(f"  Available machines: {list(machines.keys())}"),
                machine_config := machines.get(machine_name),
                print(f"  Machine config found: {machine_config is not None}"),
                machine_config
                and print(f"  Watch path: {machine_config.get('smb_watch_path')}"),
            ],
        )

    # Step 7: Test actual el_watcher imports
    debug_step(
        "Import from el_watcher.py",
        lambda: [
            sys.path.insert(0, "watchdog"),
            print("  Added watchdog to path"),
            # Try to import the actual el_watcher module
            spec := __import__("importlib.util").util.spec_from_file_location(
                "el_watcher", "watchdog/el_watcher.py"
            ),
            print("  Got el_watcher spec"),
            module := __import__("importlib.util").util.module_from_spec(spec),
            print("  Created module from spec"),
        ],
    )

    # Step 8: Test path access
    if config:
        debug_step(
            "Test watch path access",
            lambda: [
                machine_name := os.getenv("MACHINE"),
                machines := config.get("modes", {}).get("dev", {}).get("machines", {}),
                machine_config := machines.get(machine_name, {}),
                watch_path := machine_config.get("smb_watch_path"),
                print(f"  Testing path: {watch_path}"),
                watch_path and os.path.exists(watch_path) and print("  Path exists"),
                watch_path
                and os.listdir(watch_path)
                and print(f"  Path contents: {len(os.listdir(watch_path))} items"),
            ],
        )

    # Step 9: Try to actually run parts of el_watcher
    debug_step(
        "Simulate el_watcher startup",
        lambda: [
            print("  Would start file watching here..."),
            print("  Sleeping for 3 seconds to simulate running..."),
            time.sleep(3),
            print("  Simulated watcher completed successfully"),
        ],
    )

    print("=" * 60)
    print("✅ DEBUG SCRIPT COMPLETED")
    print("If all steps passed, the issue might be in el_watcher's main loop")
    print("=" * 60)


if __name__ == "__main__":
    main()
