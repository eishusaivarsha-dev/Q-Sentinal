#!/usr/bin/env bash
# Creates the GitHub repo, pushes this code, invites teammates, and creates labels and starter issues.
# Needs the GitHub CLI: https://cli.github.com  then:  gh auth login
#
# Usage (Git Bash on Windows, or any bash):
#   scripts/github_setup.sh q-sentinel teammate1 teammate2 teammate3 ...
#   VISIBILITY=public scripts/github_setup.sh q-sentinel ...     # default: private
set -euo pipefail

REPO="${1:?usage: $0 <repo-name> <github-username>...}"
shift
VISIBILITY="${VISIBILITY:-private}"

gh auth status >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }
OWNER="$(gh api user -q .login)"

# 1. Repo + first push
if [ ! -d .git ]; then
  git init -b main
  git add -A
  git commit -m "Initial Q-SENTINEL skeleton"
fi
gh repo create "$OWNER/$REPO" "--$VISIBILITY" --source . --remote origin --push
echo "Repo: https://github.com/$OWNER/$REPO"

# 2. Invite collaborators (each gets an email + https://github.com/$OWNER/$REPO/invitations)
for user in "$@"; do
  gh api -X PUT "repos/$OWNER/$REPO/collaborators/$user" -f permission=push >/dev/null \
    && echo "Invited $user"
done

# 3. Labels (one per area)
for l in quantum:5319e7 detection:1d76db security:d93f0b blockchain:0e8a16 frontend:fbca04 \
         backend-devops:c5def5 docs-pitch:bfd4f2 task:ededed; do
  gh label create "${l%%:*}" --color "${l##*:}" --repo "$OWNER/$REPO" --force >/dev/null
done

# 4. Starter issues (from docs/roles.md)
issue() { gh issue create --repo "$OWNER/$REPO" --title "$1" --label "$2,task" --body "$3" >/dev/null && echo "Issue: $1"; }
issue "Measure-on-receipt verification mode" quantum "No-quantum-memory variant. See qsentinel/qds/keys.py TODO and docs/protocol.md s.7."
issue "Record one real IBM teleportation run for the pitch" quantum "Open plan ~10 QPU min/month - batch circuits, save raw results in notebooks/hardware_runs/."
issue "Per-basis QBER fingerprint (attack attribution, no ML)" detection "Likelihood-ratio test in D4 separating single-basis intercept from depolarising noise."
issue "Calibration notebook: empirical vs Chernoff bounds (1e5 trials)" detection "Deliverable D5: empirical FAR within +-10% of analytic bound."
issue "Implement entangle_and_measure attack" security "qsentinel/attacks/library.py stub + channel model in StimBackend."
issue "Detection-rate vs adversary-strength sweep" security "All attacks, strength 0..1, for the D7 security report."
issue "Commit-reveal symmetrisation + repudiation attack" blockchain "Transferability: verifiers exchange committed outcome subsets via the ledger."
issue "Merkle-batch anchoring + NonceRegistry rebuilt from ledger" blockchain "See qsentinel/ledger/hashchain.py TODOs."
issue "Ledger page + proof-certificate download" frontend "GET /ledger, /ledger/verify; JSON/PDF + QR certificate from VerdictCard."
issue "Calibration trade-off chart (n vs noise tolerance)" frontend "Chart from GET /calibration."
issue "Fill CODEOWNERS + protect main" backend-devops "Uncomment .github/CODEOWNERS with real usernames; require PR + CI on main."
issue "6-minute demo script + backup video" docs-pitch "honest -> forgery -> intercept slider -> replay -> ledger check."

echo
echo "Done. Share this with the team: https://github.com/$OWNER/$REPO"
echo "Pending invites: https://github.com/$OWNER/$REPO/settings/access"
