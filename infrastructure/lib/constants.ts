import { Duration } from "aws-cdk-lib";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Runtime, Tracing, FunctionProps } from "aws-cdk-lib/aws-lambda";
import { BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";

export const environment =
  process.env.NODE_ENV === "production" ? "prod" : "dev";

export const powertoolsServiceName = `amazon-location-service-with-snowflake`;
export const powertoolsLoggerLogLevel =
  process.env.NODE_ENV === "production" ? "INFO" : "DEBUG";
export const powertoolsLoggerSampleRate =
  process.env.NODE_ENV === "production" ? "0.1" : "1";
export const powertoolsMetricsNamespace = "AnyCompany"; // Dummy company name

export const commonFunctionSettings: Partial<FunctionProps> = {
  runtime: Runtime.NODEJS_18_X,
  tracing: Tracing.ACTIVE,
  logRetention: RetentionDays.FIVE_DAYS,
  timeout: Duration.seconds(900),
  handler: "handler",
  memorySize: 1024,
};

export const commonBundlingSettings: Partial<BundlingOptions> = {
  minify: process.env.NODE_ENV === "production",
  sourceMap: process.env.NODE_ENV !== "production",
  externalModules: [],
};

export const commonEnvVars = {
  ENVIRONMENT: environment,
  // Powertools environment variables
  POWERTOOLS_SERVICE_NAME: powertoolsServiceName,
  POWERTOOLS_LOGGER_LOG_LEVEL: powertoolsLoggerLogLevel,
  POWERTOOLS_LOGGER_SAMPLE_RATE: powertoolsLoggerSampleRate,
  POWERTOOLS_LOGGER_LOG_EVENT: "TRUE",
  POWERTOOLS_METRICS_NAMESPACE: powertoolsMetricsNamespace,
  NODE_OPTIONS:
    process.env.NODE_ENV === "production" ? "" : "--enable-source-maps",
};
