# react-render-server

[![Build Status](https://travis-ci.org/Khan/react-render-server.svg?branch=master)](https://travis-ci.org/Khan/react-render-server)

react-render-server is a node.js server for server-side rendering implemented to
support server-side rendering at Khan Academy. It allows you to do server-side
rendering of front-end components when your main user-facing server is not
written in JavaScript.

To do so, your user-facing server written in whatever language it is (ours is
written in Python), will make requests to this node.js server. These requests
will be HTTP POST requests to the `/render` endpoint with a JSON encoded payload
that looks like so:

    {
        "urls": [
            "http://kastatic.org/genfiles/javascript/en/1.js",
            "http://kastatic.org/genfiles/javascript/en/2.js",
            "http://kastatic.org/genfiles/javascript/en/3.js",
            "http://kastatic.org/genfiles/javascript/en/entrypoint.js",
        ],
        "globals": {
            "location": "http://khanacademy.org/science/physics",
            "KA": {
                "language": "en"
            }
        },
        "props": {
            "href": "http://www.google.com",
            "children": "Google"
        },
        "secret": "...."
    }

The response will look however the client generates it.

In the request:

- `urls` is an list of URLs that point to JavaScript files containing the source
  of the React component to render and all of their transitive dependencies. The
  files listed will be executed in order. The last item in the list is
  responsible for invoking the render process.
- `globals` is a map of global variables to their values. These values will be
  set in the JavaScript VM context before the `urls` scripts are loaded.
- `props` will be passed verbatim as props to the component.
- `secret` is a shared secret that will be pulled from disk on server bootup in
  order to discourage arbitrary code execution attempts against the server.

## Graceful Degradation

On our user facing Python server, we have a 1 second timeout that aborts the
request to the react-render-server. Failures such as these are okay, because we
can fall back to doing client-side rendering. This isn't part of this
repository, but this server was designed with that graceful degradation
behaviour in mind.

## Development

To get the server running locally, clone this repository and run:

    npm install
    npm run serve_local

And you should see this:

    > react-render-server@0.1.0 serve_local /Users/jlfwong/khan/react-render-server
    > nodemon src/main.js -- --dev

    [nodemon] 1.8.1
    [nodemon] to restart at any time, enter `rs`
    [nodemon] watching: *.*
    [nodemon] starting `node src/main.js --dev`
    info: react-render-server running at http://:::8060

## How to deploy

Go to https://jenkins.khanacademy.org/job/deploy/job/deploy-react-render-server/build
and click on `Build`.

Using `set_default.sh` is not currently recommended if deploying to
Appengine Flex -- it's fine on Appengine Standard -- since the version
tends to get overwhelmed with traffic and return a bunch of 502 errors
rather than scaling smoothly. The current recommended deployment
process for Flex is to deploy a new version and then manually switch
traffic to it slowly using the "split traffic" feature and slowly
ramping traffic up. Keep an eye on 502s. Once they die down, you can
increase the amount of traffic to the version. I start with sending 1%
of traffic to the new version, wait a few minutes then up it to 2%,
then continue to double the percentage every 5 minutes or so. The
important part is to make sure the the rate of 502s stays relatively
low. 502s can be seen in the version logs as well as the "summary"
view of the app engine "instances" screen.

Versions screen where you can split traffic:
https://console.cloud.google.com/appengine/versions?project=khan-academy&serviceId=react-render

Instances screen:
https://console.cloud.google.com/appengine/instances?project=khan-academy&serviceId=react-render

Logs:
https://console.cloud.google.com/logs/viewer?authuser=0&project=khan-academy&minLogLevel=0&expandAll=false&resource=gae_app%2Fmodule_id%2Freact-render&advancedFilter=&logName=projects%2Fkhan-academy%2Flogs%2Fappengine.googleapis.com%252Fnginx.request

When looking for 502 on both the "instances" screen and in the logs, make sure
to select the version that you just deployed.

We may automate this process in the future.

[react-dom]: https://www.npmjs.com/package/react-dom
[aphrodite]: https://github.com/Khan/aphrodite
[renderStatic]: https://github.com/Khan/aphrodite#server-side-rendering
[vm]: https://nodejs.org/api/vm.html
