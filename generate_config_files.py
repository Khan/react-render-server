"""Generate nginx and pm2 config files.

This is done by script since the two config files need to be in sync in terms
of how many child node processes are running and on which ports.

This script is run in a build stage rather than in the final docker image.
"""
import argparse
import json

STARTING_PORT = 8060
NGINX_TEMPLATE = 'nginx.conf.template'
NGINX_FILE = 'nginx.conf'
PM2_TEMPLATE = 'processes.json.template'
PM2_FILE = 'processes.json'


def gen_nginx_conf(ports):
    with open(NGINX_TEMPLATE) as f:
        s = f.read()
    server_template = '        server localhost:{:d} max_conns=1;'
    servers = '\n'.join([server_template.format(port) for port in ports])
    with open(NGINX_FILE, 'w') as f:
        f.write(s.replace('        $SERVERS', servers))


def gen_pm2_conf(ports):
    with open(PM2_TEMPLATE) as f:
        d = json.load(f)
    for port in ports:
        d['apps'].append({'script': 'src/main.js',
                          'args': '-p {:d}'.format(port)})
    with open(PM2_FILE, 'w') as f:
        json.dump(d, f, indent=4)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate conf files')
    parser.add_argument('servers', type=int, help='Number of node servers')
    n = parser.parse_args().servers
    ports = range(STARTING_PORT, STARTING_PORT + n)
    gen_pm2_conf(ports)
    gen_nginx_conf(ports)
