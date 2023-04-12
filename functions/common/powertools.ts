import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';

const awsLambdaPowertoolsVersion = '1.7.0';

const defaultValues = {
  awsAccountId: process.env.AWS_ACCOUNT_ID || 'N/A',
  environment: process.env.ENVIRONMENT || 'N/A',
};

const logger = new Logger({
  persistentLogAttributes: {
    ...defaultValues,
    logger: {
      name: '@aws-lambda-powertools/logger',
      version: awsLambdaPowertoolsVersion,
    },
  },
});

const metrics = new Metrics({
  defaultDimensions: {
    ...defaultValues,
    appName: 'amazon-location-service-with-snowflake',
    awsRegion: process.env.AWS_REGION || 'N/A',
    appVersion: 'v0.0.1',
    runtime: process.env.AWS_EXECUTION_ENV || 'N/A',
  },
});

export {
  logger,
  metrics,
};