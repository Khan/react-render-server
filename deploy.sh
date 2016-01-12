#!/bin/sh -e

# Deploy the last commit to AppEngine

: ${PROJECT:=khan-academy}

die() {
    echo "FATAL ERROR: $@"
    exit 1
}

# Calculate the version name for the latest commit
# Format is: YYMMDD-HHMM-RRRRRRRRRRRR
VERSION=`git log -n1 --format="format:%H %ct" | perl -ne '$ENV{TZ} = "US/Pacific"; ($rev, $t) = split; @lt = localtime($t); printf "%02d%02d%02d-%02d%02d-%.12s\n", $lt[5] % 100, $lt[4] + 1, $lt[3], $lt[2], $lt[1], $rev'`

# Ensure the 'secret' file exists (so we can verify /render requests)
[ -s "secret" ] \
    || die "You must create a file called 'secret' with the secret from\n   https://phabricator.khanacademy.org/K121"

# Ensure the repository isn't dirty
[ `git status -u -s | wc -c` -eq 0 ] \
    || die "You must commit your changes before deploying."

# Ensure we're deploying from latest master
git fetch origin
git branch | grep -q '* master' \
    || die "You must deploy from master."
[ `git rev-parse HEAD` = `git rev-parse origin/master` ] \
    || die "You must pull to deploy from latest master."

# Yay we're good to go!
echo "Deploying ${VERSION}..."
gcloud -q --verbosity info preview app deploy app.yaml --project "$PROJECT" --version "$VERSION"
