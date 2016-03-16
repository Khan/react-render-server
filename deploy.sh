#!/bin/sh -e

# Deploy the latest commit to AppEngine

: ${PROJECT:=khan-academy}
: ${VERBOSITY:=info}
: ${DOCKER:=}

die() {
    echo "FATAL ERROR: $@"
    exit 1
}

# Calculate the version name for the latest commit
# Format is: YYMMDD-HHMM-RRRRRRRRRRRR
#
# Keep this in sync with VERSION in set_default.sh
VERSION=`git log -n1 --format="format:%H %ct" | perl -ne '$ENV{TZ} = "US/Pacific"; ($rev, $t) = split; @lt = localtime($t); printf "%02d%02d%02d-%02d%02d-%.12s\n", $lt[5] % 100, $lt[4] + 1, $lt[3], $lt[2], $lt[1], $rev'`

# Ensure the 'secret' file exists (so we can verify /render requests)
[ -s "secret" ] \
    || die "You must create a file called 'secret' with the secret from\n   https://phabricator.khanacademy.org/K121"

# Ensure the hostedgraphite key exists, so we can send events to graphite
[ -s 'hostedgraphite.api_key' ] \
    || die "You must create a file called 'hostedgraphite.api_key' with\n    hostedgraphite_api_key from webapp's secrets.py"

# Ensure the repository isn't dirty
[ `git status -u -s | wc -c` -eq 0 ] \
    || die "You must commit your changes before deploying."

# Ensure we're deploying from latest master
git fetch origin
[ `git rev-parse HEAD` = `git rev-parse origin/master` ] \
    || die "You must deploy from latest origin/master."

# Don't deploy if tests fail
npm test

# Use the default value for use_appengine_api. This is configuration set by
# deployment of webapp.
gcloud config set "app/use_appengine_api" "True"

# Yay we're good to go!
if [ -n "$DOCKER" ]; then
    echo "Building docker image..."
    docker build -f Dockerfile.prod -t react-render-server .
    docker tag react-render-server "us.gcr.io/khan-academy/react-render-server-$VERSION"

    echo "Pushing docker image..."
    gcloud docker push "us.gcr.io/khan-academy/react-render-server-$VERSION"

    echo "Deploying ${VERSION} via docker..."

    gcloud -q --verbosity "${VERBOSITY}" preview app deploy app.yaml \
        --project "$PROJECT" --version "$VERSION" --no-promote \
        --image-url=us.gcr.io/khan-academy/react-render-server-$VERSION
else
    echo "Deploying ${VERSION}..."

    gcloud -q --verbosity "${VERBOSITY}" preview app deploy app.yaml \
        --project "$PROJECT" --version "$VERSION" --no-promote
fi

echo "DONE"
