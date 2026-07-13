#!/usr/bin/env bash
# Run Maestro e2e tests with Metro kept alive for the full test run.
#
# Usage:
#   MONK_TEST_EMAIL=you@example.com MONK_TEST_PASSWORD=secret bash run-e2e.sh
#   bash run-e2e.sh e2e/02_tabs_navigation.yaml   # run single flow
#
# Requires:
#   - App already built & installed on simulator via `npx expo run:ios`
#   - MONK_TEST_EMAIL + MONK_TEST_PASSWORD env vars for flows that sign in
#   - 01_onboarding.yaml requires a test account with onboarding_done=false in DB

set -euo pipefail

DEVICE_UDID="${MAESTRO_DEVICE:-F360BD69-A7EA-4C77-AFB1-4B8398527D22}"  # iPhone 17 Pro Max
APP_ID="com.monk.ai"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLOW_PATH="${1:-$SCRIPT_DIR/e2e}"

export JAVA_HOME="/opt/homebrew/opt/openjdk"
export PATH="$JAVA_HOME/bin:/Users/hafee/.maestro/bin:$PATH"

# ── Boot simulator if needed ────────────────────────────────────────────────
STATE=$(xcrun simctl list devices | grep "$DEVICE_UDID" | grep -oE 'Booted|Shutdown' | head -1 || echo "Shutdown")
if [[ "$STATE" != "Booted" ]]; then
  echo "▶ Booting simulator $DEVICE_UDID..."
  xcrun simctl boot "$DEVICE_UDID"
  sleep 6
fi

# ── Kill any stale Metro ────────────────────────────────────────────────────
pkill -f "react-native/scripts/packager" 2>/dev/null || true
pkill -f "metro[/ ]" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
sleep 1

# ── Start Metro ────────────────────────────────────────────────────────────
echo "▶ Starting Metro dev server..."
cd "$SCRIPT_DIR"
npx expo start --non-interactive > /tmp/metro-monk.log 2>&1 &
METRO_PID=$!
trap 'echo ""; echo "▶ Stopping Metro (PID $METRO_PID)..."; kill "$METRO_PID" 2>/dev/null; wait "$METRO_PID" 2>/dev/null; echo "▶ Done."' EXIT

# Wait up to 60 s for Metro to be ready
echo -n "▶ Waiting for Metro"
READY=0
for i in $(seq 1 30); do
  if curl -s http://localhost:8081/status > /dev/null 2>&1; then
    READY=1
    break
  fi
  echo -n "."
  sleep 2
done
echo ""
if [[ $READY -eq 0 ]]; then
  echo "✗ Metro did not start in 60 s. Check /tmp/metro-monk.log"
  exit 1
fi
echo "✓ Metro ready."

# ── Launch app ─────────────────────────────────────────────────────────────
echo "▶ Launching $APP_ID on $DEVICE_UDID..."
xcrun simctl launch "$DEVICE_UDID" "$APP_ID" 2>/dev/null || true
sleep 4

# ── Build Maestro env args ─────────────────────────────────────────────────
MAESTRO_ARGS=()
if [[ -n "${MONK_TEST_EMAIL:-}" ]]; then
  MAESTRO_ARGS+=(--env "MONK_TEST_EMAIL=$MONK_TEST_EMAIL")
else
  echo "⚠  MONK_TEST_EMAIL not set — login flows will fail. Set it to run authenticated tests."
fi
if [[ -n "${MONK_TEST_PASSWORD:-}" ]]; then
  MAESTRO_ARGS+=(--env "MONK_TEST_PASSWORD=$MONK_TEST_PASSWORD")
fi

# ── Run tests ──────────────────────────────────────────────────────────────
echo "▶ Running Maestro e2e tests: $FLOW_PATH"
echo ""
maestro test ${MAESTRO_ARGS[@]+"${MAESTRO_ARGS[@]}"} "$FLOW_PATH"
