#!/usr/bin/env node
import "source-map-support/register";
import { App, Aspects } from "aws-cdk-lib";
import { LocationServiceWithSnowflakeStack } from "../lib/location-service-with-snowflake-stack";
import { powertoolsServiceName, environment } from "../lib/constants";
import { AwsSolutionsChecks } from "cdk-nag";

const app = new App();
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
new LocationServiceWithSnowflakeStack(
  app,
  "LocationServiceWithSnowflakeStack",
  {
    tags: {
      Service: powertoolsServiceName,
      Environment: environment,
      ManagedBy: "CDK",
      GithubRepo: "aws-samples/amazon-location-service-with-snowflake",
      Owner: "AWS",
      AwsRegion: process.env.CDK_DEFAULT_REGION || "N/A",
      AwsAccountId: process.env.CDK_DEFAULT_ACCOUNT || "N/A",
    },
  }
);
