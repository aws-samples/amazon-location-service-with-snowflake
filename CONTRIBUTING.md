# Contributing Guidelines

Thank you for your interest in contributing to our project. Whether it's a bug report, new feature, correction, or additional documentation, we greatly value feedback and contributions from our community.

Please read through this document before submitting any issues or pull requests to ensure we have all the necessary
information to effectively respond to your bug report or contribution.

## Code of Conduct

This project has adopted the [Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct).
For more information see the [Code of Conduct FAQ](https://aws.github.io/code-of-conduct-faq) or contact
opensource-codeofconduct@amazon.com with any additional questions or comments.

## Reporting Bugs/Feature Requests

We welcome you to use the GitHub issue tracker to report bugs or suggest features.

When filing an issue, please check existing open, or recently closed, issues to make sure somebody else hasn't already
reported the issue. Please try to include as much information as you can. Details like these are incredibly useful:

- A reproducible test case or series of steps
- The version of our code being used
- Any modifications you've made relevant to the bug
- Anything unusual about your environment or deployment

## Contributing via Pull Requests

Contributions via pull requests are much appreciated. Before sending us a pull request, please ensure that:

1. You are working against the latest source on the _main_ branch.
2. You check existing open, and recently merged, pull requests to make sure someone else hasn't addressed the problem already.
3. You open an issue to discuss any significant work - we would hate for your time to be wasted.

> **Warning**
> Please avoid opening a PR before having discussed your change, and having reached an agreement on it, with a maintainer. PRs that don't have an issue or that were not agreed upon will not be reviewed.

To send us a pull request, please:

1. Fork the repository.
2. Modify the source; please focus on the specific change you are contributing. If you also reformat all the code, it will be hard for us to focus on your change.
3. Ensure local tests pass.
4. Commit to your fork using clear commit messages.
5. Send us a pull request, answering any default questions in the pull request interface.
6. Pay attention to any automated CI failures reported in the pull request, and stay involved in the conversation.

GitHub provides additional document on [forking a repository](https://help.github.com/articles/fork-a-repo/) and
[creating a pull request](https://help.github.com/articles/creating-a-pull-request/).

## Finding contributions to work on

Looking at the existing issues is a great way to find something to contribute on. As our projects, by default, use the default GitHub issue labels (enhancement/bug/duplicate/help wanted/invalid/question/wontfix), looking at any 'help wanted' issues is a great place to start.

## Setup

### Prerequisites

In order to contribute to this project you will need Node.js 16.x or later - install [here](https://nodejs.org/en/download/) or via [nvm]([http](https://github.com/nvm-sh/nvm))/[fnm](https://github.com/Schniz/fnm)

Clone the repository and install dependencies:

TODO: fill in the repo url

```bash
git clone
cd
npm install
```

### Deploying

Once installed, follow the instructions in the main README to prepare your Snowflake and AWS accounts. Once you have created the AWS resources, you can create an `.env` file in the root of the project with the following contents:

> **Note**
> Replace the values in the below example with the values from your AWS account wrapping the values in double quotes.

```json
{
  "AccountUserPassSecretNameParam": <SECRET_NAME>,
  "ApiIntegrationNameParam": <INTEGRATION_NAME>,
  "SnowflakeWarehouseParam": <WAREHOUSE_NAME>,
  "SnowflakeDatabaseParam": <DATABASE_NAME>,
  "SnowflakeSchemaParam": <SCHEMA_NAME>
}
```

Then run the following command to deploy the application:

> **Warning**
> This is a development-only command that requires the `jq` utility and should not be used in production as it bypasses the approval steps and leverages hot-swapping when possible. For all other cases use the method described in the main README.

```bash
npm run deploy
```
