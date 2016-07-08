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

curl -s -I "${HEALTHCHECK_URL}" | head -n1 | grep -q -w '200' \
    || die "Server at ${NON_DEFAULT_HOSTNAME} not healthy"

# TODO(jlfwong): Prime the new version of the servers before we set default. We
# want them to load their caches with the most frequently used JS packages from
# khanacademy.org.

gcloud -q --verbosity info preview app services set-traffic \
    --project "$PROJECT" --splits "$VERSION"=1 "$MODULE"

# Ensure that the version flipped
DEFAULT_HOSTNAME="https://${MODULE}-dot-${PROJECT}.appspot.com/_api/version"

# Wait for the new version to become accessible, waiting up a minute(ish).
for i in `seq 10`; do
    LIVE_VERSION=`curl -s ${DEFAULT_HOSTNAME}`
    [ "${LIVE_VERSION}" = "${VERSION}" ] && break
    [ $i -eq 10 ] && die "Expected live version to be ${VERSION}, but saw ${LIVE_VERSION}."
    sleep "$i"
done

# TODO(csilvers): git tag the release.

echo "Default set, now deleting old versions."

# TODO(csilvers): make this more sophisticated, a la audit_gae_versions.py:
# 1) support 'good' and 'bad' versions via git tag.
# 2) prefer to keep versions that have a long uptime.
# 3) always keep the most recent deploys.

# This lists the module-name, version, and traffic-split.  First we
# grep to remove versions that are getting traffic (so the candidates
# to delete will include only versions getting no traffic).  Then we
# grep again to extract out the version-names.
VERSIONS=`gcloud preview app versions list --project "$PROJECT" --service react-render | fgrep -w 0.00 | grep -o '[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]-[0-9a-fA-F]*'`
# This keeps the most recent 5 versions (that are not getting any traffic).
VERSIONS_TO_DELETE=`echo "$VERSIONS" | sort -r | tail -n+6`
if [ -n "$VERSIONS_TO_DELETE" ]; then
    echo "Deleting old versions: $VERSIONS_TO_DELETE"
    gcloud -q --verbosity info preview app versions delete \
        --project "$PROJECT" --service react-render $VERSIONS_TO_DELETE
fi

# And we'll stop the recent versions that are not getting any traffic,
# so we're not charged for them.
VERSIONS_TO_STOP=`echo "$VERSIONS" | sort -r | tail -n+2 | head -n4`
if [ -n "$VERSIONS_TO_STOP" ]; then
    echo "Stopping old versions: $VERSIONS_TO_STOP"
    gcloud -q --verbosity info preview app versions stop \
        --project "$PROJECT" --service react-render $VERSIONS_TO_STOP
fi

echo "DONE"
