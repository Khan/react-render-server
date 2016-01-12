#!/bin/sh -e

# Set the deploy corresponding to the latest commit as default

: ${PROJECT:=khan-academy}

die() {
    echo "FATAL ERROR: $@"
    exit 1
}

# Calculate the version name for the latest commit
# Format is: YYMMDD-HHMM-RRRRRRRRRRRR
#
# Keep this in sync with VERSION in deploy.sh
VERSION=`git log -n1 --format="format:%H %ct" | perl -ne '$ENV{TZ} = "US/Pacific"; ($rev, $t) = split; @lt = localtime($t); printf "%02d%02d%02d-%02d%02d-%.12s\n", $lt[5] % 100, $lt[4] + 1, $lt[3], $lt[2], $lt[1], $rev'`

MODULE=`sed -ne 's/module: //p' app.yaml`

echo "Setting ${VERSION} as default on module ${MODULE}..."

NON_DEFAULT_HOSTNAME="https://${VERSION}-dot-${MODULE}-dot-${PROJECT}.appspot.com"
HEALTHCHECK_URL="${NON_DEFAULT_HOSTNAME}/_ah/health"

[ `curl -s "${HEALTHCHECK_URL}"` = "ok!" ] \
    || die "Server at ${NON_DEFAULT_HOSTNAME} not healthy"

# TODO(jlfwong): Prime the new version of the servers before we set default. We
# want them to load their caches with the most frequently used JS packages from
# khanacademy.org.

gcloud -q --verbosity info preview app modules set-default "$MODULE" \
    --version "$VERSION"

# Ensure that the version flipped
DEFAULT_HOSTNAME="https://${MODULE}-dot-${PROJECT}.appspot.com/_api/version"

LIVE_VERSION=`curl -s ${DEFAULT_HOSTNAME}`

[ "${LIVE_VERSION}" = "${VERSION}" ] \
    || die "Expected live version to be ${VERSION}, but saw ${LIVE_VERSION}."
