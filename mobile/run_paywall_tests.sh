#!/usr/bin/env bash
set -euo pipefail

UDID="BDABDE5D-E180-438E-A5BA-EB1F508B1087"
RESULTS_DIR=".maestro/results"
mkdir -p "$RESULTS_DIR"

# Boot simulator
echo "Booting simulator..."
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator

# Start Expo server in background
echo "Starting Expo..."
npx expo start --ios --no-dev-client &
EXPO_PID=$!
trap "kill $EXPO_PID 2>/dev/null; exit" INT TERM EXIT

# Wait for Expo Go to load the app
echo "Waiting 30s for Expo to load..."
sleep 30

FLOWS=(
  ".maestro/07_paywall_messages.yaml"
  ".maestro/08_paywall_personality.yaml"
  ".maestro/09_paywall_goals.yaml"
  ".maestro/10_paywall_habits.yaml"
  ".maestro/11_paywall_review.yaml"
  ".maestro/12_paywall_monkmode.yaml"
)

PASS=0
FAIL=0
FAILED_FLOWS=()

for flow in "${FLOWS[@]}"; do
  name=$(basename "$flow" .yaml)
  echo ""
  echo "▶ $name"
  if maestro test "$flow" --format junit --output "$RESULTS_DIR/${name}.xml" 2>&1; then
    PASS=$((PASS + 1))
    echo "  ✓ PASS"
  else
    FAIL=$((FAIL + 1))
    FAILED_FLOWS+=("$name")
    echo "  ✗ FAIL"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"

if [ ${#FAILED_FLOWS[@]} -gt 0 ]; then
  echo "Failed:"
  for f in "${FAILED_FLOWS[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "Rerun a single flow:"
  echo "  maestro test .maestro/<flow>.yaml"
  exit 1
fi
