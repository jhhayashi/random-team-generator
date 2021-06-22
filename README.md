# Random Team Generator

A web stack that helps generate random teams from BambooHR or slack channels

## Installation

In order to enable the BambooHR integration, you'll need to set the `BAMBOOHR_KEY`
and `BAMBOOHR_SUBDOMAIN` environment variables to a BambooHR API key and its associated
subdomain. You can generate one by following [these steps](https://documentation.bamboohr.com/docs#section-authentication).

In order to enable the Slack integration, you'll need to set the `SLACK_KEY` environment
variable. The key requires the `channels:read`, `users.profile:read`, and `users:read`
scopes.

You can run the service using Docker or by cloning and building the repo.

Running via Docker:

```bash
docker run -p 8080:8080 -e BAMBOOHR_KEY=<key> -e BAMBOOHR_SUBDOMAIN=<subdomain> -e SLACK_KEY=<key> jhhayashi/random-team-generator
# visit http://localhost:8080
```

Running by building the repo:

```bash
git clone https://github.com/jhhayashi/random-team-generator.git
cd random-team-generator
npm install
npm run build
BAMBOO_KEY=<key> BAMBOOHR_SUBDOMAIN=<subdomain> SLACK_KEY=<key> npm start
# visit http://localhost:8080
```

### Configuration

The following environment variables are used to configure the app:

| Name | Description | Default |
| ---- | ----------- | ------- |
| PORT | The port on which the app should listen | 8080 |
| METRICS_PORT | The port on which the app should serve metrics at /metrics | - |
| BAMBOOHR_KEY | A BambooHR key that can be used to make API requests to BambooHR | - |
| BAMBOOHR_SUBDOMAIN | The BambooHR subdomain to use | - |
| SLACK_KEY | A Slack key that can be used to make API requests to Slack. Requires the `channels:read`, `users.profile:read`, and `users:read` scopes | - |
| HEALTHCHECK_ENDPOINT | An API endpoint that will be created to respond to healthchecks | - |
| DEBUG | Enables any debugging endpoints | - |
