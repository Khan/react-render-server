# Create conf files for nginx and pm2. This is done using a multi-stage build so
# that we don't need to have any dependencies used to generate the conf files
# (in this case python) in the container.
FROM python:3 as config
WORKDIR /usr/src/app
COPY . .

# Generate config files passing the number of node servers we want to run on
# each instance.
RUN python generate_config_files.py 4

# Dockerfile extending the generic Node image with application files for a
# single application.
FROM gcr.io/google_appengine/nodejs
# Check to see if the the version included in the base runtime satisfies
# '^8.3.0', if not then do an npm install of the latest available
# version that satisfies it.
RUN /usr/local/bin/install_node '^8.3.0'
COPY . /app/
# You have to specify "--unsafe-perm" with npm install
# when running as root.  Failing to do this can cause
# install to appear to succeed even if a preinstall
# script fails, and may have other adverse consequences
# as well.
# This command will also cat the npm-debug.log file after the
# build, if it exists.
RUN npm install --unsafe-perm || \
  ((if [ -f npm-debug.log ]; then \
      cat npm-debug.log; \
    fi) && false)

# Install pm2
RUN npm install --unsafe-perm pm2@latest -g

# Set up the nginx reverse proxy. We need a more recent version of nginx than is
# available from the regular sources.
COPY nginx.list /etc/apt/sources.list.d/nginx.list
RUN curl http://nginx.org/keys/nginx_signing.key | apt-key add -
RUN apt-get update && \
    apt-get install -y -q --no-install-recommends nginx && \
    apt-get clean && \
    rm -r /var/lib/apt/lists/*

# Copy conf files from build stage
COPY --from=config /usr/src/app/nginx.conf /etc/nginx/nginx.conf
COPY --from=config /usr/src/app/processes.json /app/

# Start ngnix, node
CMD ["pm2-docker", "processes.json"]
