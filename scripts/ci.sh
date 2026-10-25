# Runs the two GitHub Actions jobs locally. build-and-test and trivy run in parallel, as they do on GitHub.
# Keep these commands in step with .github/workflows/ci.yml.
TRIVY_VERSION=0.76.1

build_and_test() {
  npm ci &&
    npm run typecheck &&
    npm run lint &&
    npm run build &&
    sh scripts/with-keychain-secret.sh npm run test:ci
}

trivy_scan() {
  if ! command -v trivy >/dev/null 2>&1; then
    echo "trivy is not installed. Install version $TRIVY_VERSION: brew install trivy" >&2
    return 1
  fi
  if ! trivy --version | grep -qx "Version: $TRIVY_VERSION"; then
    echo "Need trivy $TRIVY_VERSION, found: $(trivy --version | head -n 1)" >&2
    return 1
  fi
  TRIVY_INCLUDE_DEV_DEPS=true trivy fs --scanners vuln --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 --skip-dirs node_modules .
}

build_and_test &
build_pid=$!
trivy_scan &
trivy_pid=$!

status=0
wait "$build_pid" || status=1
wait "$trivy_pid" || status=1
exit "$status"
