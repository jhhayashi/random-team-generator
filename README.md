# Random Team Generator

A web stack that helps generate random teams from BambooHR or slack channels

## Installation

In order to enable the BambooHR integration, you'll need to set the `BAMBOOHR_KEY`
and `BAMBOOHR_SUBDOMAIN` environment variables to a BambooHR API key and its associated
subdomain. You can generate one by following [these steps](https://documentation.bamboohr.com/docs#section-authentication).

You can run the service using Docker or by cloning and building the repo.

Running via Docker:

```bash
docker run -p 8080:8080 -e BAMBOOHR_KEY=<key> -e BAMBOOHR_SUBDOMAIN=<subdomain> jhhayashi/random-team-generator
# visit http://localhost:8080
```

Running by building the repo::

```bash
git clone https://github.com/jhhayashi/random-team-generator.git
cd random-team-generator
npm install
npm run build
BAMBOO_KEY=<key> BAMBOOHR_SUBDOMAIN=<subdomain> npm start
# visit http://localhost:8080
```
