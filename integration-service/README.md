<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project Manager + Linear API

This service now includes a generic `project-manager` module with provider routing.
Current provider implemented: `linear`.

- Base prefix: `/integration/project-manager/:provider`
- Linear GraphQL URL: `https://api.linear.app/graphql` (override with `LINEAR_API_URL`)
- Auth header uses `LINEAR_API_KEY`

### Required env

Use `integration-service/.env.example` as reference:

```bash
LINEAR_API_KEY=lin_api_xxx
LINEAR_API_URL=https://api.linear.app/graphql
```

### Available endpoints

- `GET /integration/project-manager/:provider/health`
- `GET /integration/project-manager/:provider/viewer`
- `GET /integration/project-manager/:provider/teams?first=50`
- `GET /integration/project-manager/:provider/users?first=50&query=asim`
- `GET /integration/project-manager/:provider/projects?first=50&teamId=<teamId>&query=<name>`
- `GET /integration/project-manager/:provider/projects/:projectId`
- `POST /integration/project-manager/:provider/projects`
- `PATCH /integration/project-manager/:provider/projects/:projectId`
- `GET /integration/project-manager/:provider/issues?first=50&teamId=<teamId>&projectId=<projectId>&stateName=In%20Progress&query=<title>`
- `GET /integration/project-manager/:provider/issues/:issueId`
- `POST /integration/project-manager/:provider/issues`
- `PATCH /integration/project-manager/:provider/issues/:issueId`
- `POST /integration/project-manager/:provider/issues/:issueId/comments`
- `GET /integration/project-manager/:provider/teams/:teamId/cycles?first=20`
- `POST /integration/project-manager/:provider/query` (raw GraphQL passthrough)

Use `provider=linear` right now.

### Example payloads

Create issue:

```json
{
  "input": {
    "teamId": "team_uuid",
    "title": "Implement Linear integration",
    "description": "End-to-end Linear service setup"
  }
}
```

Update issue:

```json
{
  "input": {
    "stateId": "workflow_state_uuid",
    "assigneeId": "user_uuid"
  }
}
```

Create comment:

```json
{
  "body": "Integration is now live in integration-service."
}
```

Raw GraphQL:

```json
{
  "query": "query { viewer { id name email } }",
  "variables": {}
}
```

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
