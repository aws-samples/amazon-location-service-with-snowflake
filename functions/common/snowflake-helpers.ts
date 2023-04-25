import { logger } from "./powertools";
import { snowflakeClient } from "./snowflake";
import { getEnvironmentVariableStringValue } from "./helpers";

type CreateOrUpdateApiIntegration = {
  /**
   * The name of the API integration
   */
  integrationName: string;
  /**
   * The AWS role ARN that Snowflake will use to access the AWS API Gateway
   */
  apiAwsRoleArn: string;
  /**
   * The AWS API Gateway prefix that Snowflake will use to access the AWS API Gateway
   */
  apiAllowedPrefix: string;
  /**
   * The Resource ID
   */
  physicalResourceId: string;
};

/**
 * Creates an API integration in Snowflake
 * @param options The options to create the API integration
 */
const createApiIntegration = async (
  options: Omit<CreateOrUpdateApiIntegration, "physicalResourceId">
): Promise<void> => {
  const { integrationName, apiAwsRoleArn, apiAllowedPrefix } = options;
  logger.info("creating api integration");
  try {
    await snowflakeClient.executeStatement(
      `CREATE OR REPLACE API INTEGRATION ${integrationName}
    api_provider = aws_api_gateway
    api_aws_role_arn = '${apiAwsRoleArn}'
    api_allowed_prefixes = ('${apiAllowedPrefix}')
    enabled = true`,
      false
    );
    logger.info("api integration created");
  } catch (err) {
    logger.error("error creating api integration", { err });
    throw err;
  }
};

/**
 * Deletes an API integration in Snowflake
 * @param integrationName The name of the API integration to delete
 */
const deleteApiIntegration = async (integrationName: string): Promise<any> => {
  logger.info("deleting api integration", { details: integrationName });
  try {
    await snowflakeClient.executeStatement(
      `DROP API INTEGRATION ${integrationName}`,
      false
    );
    logger.info("api integration deleted", { details: integrationName });
  } catch (err) {
    logger.error("error deleting api integration", {
      err,
      details: integrationName,
    });
    throw err;
  }
};

/**
 * Updates an API integration in Snowflake
 * @param options The options to update the API integration
 */
const updateApiIntegration = async (
  options: CreateOrUpdateApiIntegration
): Promise<void> => {
  const { integrationName, physicalResourceId } = options;
  logger.info("updating api integration", { details: integrationName });
  try {
    // If the integration name has changed, delete the old integration and create a new one
    if (physicalResourceId !== integrationName) {
      logger.info("integration name has changed, deleting old integration", {
        details: physicalResourceId,
      });
      await deleteApiIntegration(physicalResourceId);
      logger.info("creating new integration", { details: integrationName });
      await createApiIntegration(options);
      logger.info("api integration updated");
      return;
    }
  } catch (err) {
    logger.error("error updating api integration", { err });
    throw err;
  }
};

/**
 * Outputs from describing an API integration
 */
interface DescribeApiIntegrationOutput {
  /**
   * The AWS IAM user ARN that Snowflake will use to access the AWS API Gateway
   */
  apiAwsIamUserArn: string;
  /**
   * The AWS external ID that Snowflake will use to access the AWS API Gateway
   */
  apiAwsExternalId: string;
}

/**
 * Describes an API integration in Snowflake
 * @param integrationName The name of the API integration to describe
 * @returns The AWS IAM user ARN and AWS external ID that Snowflake will use to access the AWS API Gateway
 */
const describeApiIntegration = async (
  integrationName: string
): Promise<DescribeApiIntegrationOutput> => {
  logger.info("describing api integration", { details: integrationName });

  try {
    const res = await snowflakeClient.executeStatement(
      `DESCRIBE INTEGRATION ${integrationName};`,
      false
    );
    if (res && res.length) {
      const apiAwsIamUserArn = res.find(
        (r: any) => r.property === "API_AWS_IAM_USER_ARN"
      )?.property_value;
      const apiAwsExternalId = res.find(
        (r: any) => r.property === "API_AWS_EXTERNAL_ID"
      )?.property_value;

      if (!apiAwsIamUserArn || !apiAwsExternalId) {
        logger.error("unable to find API Integration info", {
          details: integrationName,
          res,
        });
        throw new Error(
          "API_AWS_IAM_USER_ARN or API_AWS_EXTERNAL_ID not found in response from Snowflake - check logs"
        );
      }
      logger.info("api integration described");

      return {
        apiAwsIamUserArn,
        apiAwsExternalId,
      };
    } else {
      logger.error("unable to find API Integration info", {
        details: integrationName,
        res,
      });
      throw new Error(
        "No response from Snowflake - check logs for more details"
      );
    }
  } catch (err) {
    logger.error("error describing api integration", { err });
    throw err;
  }
};

type CreateOrUpdateExternalFunctionsOptions = {
  /**
   * The name of the API integration
   */
  integrationName: string;
  /**
   * The base URL of the AWS API Gateway
   */
  apiBaseUrl: string;
};

const getInterpolatedStatements = (
  options: CreateOrUpdateExternalFunctionsOptions
): string[] => {
  const awsRegion = getEnvironmentVariableStringValue("AWS_REGION");

  const statements = [
    `CREATE EXTERNAL FUNCTION reverse_geocode_amazon_location_service_provider_here(lng FLOAT, lat FLOAT)
      RETURNS VARIANT
      API_INTEGRATION = ${options.integrationName}
      AS '${options.apiBaseUrl}';`,
    `CREATE EXTERNAL FUNCTION reverse_geocode_amazon_location_service_provider_esri(lng FLOAT, lat FLOAT)
      RETURNS VARIANT
      API_INTEGRATION = ${options.integrationName}
      AS '${options.apiBaseUrl}';`,
    `CREATE EXTERNAL FUNCTION geocode_amazon_location_service_provider_here(address VARCHAR)
      RETURNS VARIANT
      API_INTEGRATION = ${options.integrationName}
      AS '${options.apiBaseUrl}';`,
    `CREATE EXTERNAL FUNCTION geocode_amazon_location_service_provider_esri(address VARCHAR)
      RETURNS VARIANT
      API_INTEGRATION = ${options.integrationName}
      AS '${options.apiBaseUrl}';`,
  ];
  // The Amazon Location Service provider for Grab is only available in ap-southeast-1
  if (awsRegion === "ap-southeast-1") {
    statements.push(
      `CREATE EXTERNAL FUNCTION reverse_geocode_amazon_location_service_provider_grab(lng FLOAT, lat FLOAT)
      RETURNS VARIANT
      API_INTEGRATION = ${options.integrationName}
      AS '${options.apiBaseUrl}';`
    );
    statements.push(
      `CREATE EXTERNAL FUNCTION geocode_amazon_location_service_provider_grab(address VARCHAR)
      RETURNS VARIANT
      API_INTEGRATION = ${options.integrationName}
      AS '${options.apiBaseUrl}';`
    );
  }

  return statements;
};

/**
 * Creates a set of external functions in Snowflake.
 * These functions are used to call Amazon Location Service and return the results to the client.
 */
const createExternalFunctions = async (
  options: CreateOrUpdateExternalFunctionsOptions
): Promise<void> => {
  const externalFunctionStatements = getInterpolatedStatements(options);
  logger.info("creating external functions");
  try {
    for (const statement of externalFunctionStatements) {
      await snowflakeClient.executeStatement(statement, false);
    }
    logger.info("external functions created");
  } catch (err) {
    logger.error("error creating external functions", { err });
    throw err;
  }
};

/**
 * Updates the external functions in Snowflake by deleting and recreating them.
 */
const updateExternalFunctions = async (
  options: CreateOrUpdateExternalFunctionsOptions
): Promise<void> => {
  logger.info("updating external functions");
  try {
    await deleteExternalFunctions();
    await createExternalFunctions(options);
    logger.info("external functions updated");
  } catch (err) {
    logger.error("error updating external functions", { err });
    throw err;
  }
};

/**
 * Deletes the external functions from Snowflake.
 */
const deleteExternalFunctions = async (): Promise<void> => {
  const externalFunctionStatements = [
    `DROP FUNCTION IF EXISTS reverse_geocode_amazon_location_service_provider_here(FLOAT, FLOAT);`,
    `DROP FUNCTION IF EXISTS reverse_geocode_amazon_location_service_provider_esri(FLOAT, FLOAT);`,
    `DROP FUNCTION IF EXISTS geocode_amazon_location_service_provider_here(VARCHAR);`,
    `DROP FUNCTION IF EXISTS geocode_amazon_location_service_provider_esri(VARCHAR);`,
  ];
  const awsRegion = getEnvironmentVariableStringValue("AWS_REGION");
  if (awsRegion === "ap-southeast-1") {
    externalFunctionStatements.push(
      `DROP FUNCTION IF EXISTS reverse_geocode_amazon_location_service_provider_grab(FLOAT, FLOAT);`
    );
    externalFunctionStatements.push(
      `DROP FUNCTION IF EXISTS geocode_amazon_location_service_provider_grab(VARCHAR);`
    );
  }

  logger.info("deleting external functions");
  try {
    for (const statement of externalFunctionStatements) {
      await snowflakeClient.executeStatement(statement, false);
    }
    logger.info("external functions deleted");
  } catch (err) {
    logger.error("error deleting external functions", { err });
    throw err;
  }
};

export {
  createApiIntegration,
  deleteApiIntegration,
  updateApiIntegration,
  describeApiIntegration,
  createExternalFunctions,
  updateExternalFunctions,
  deleteExternalFunctions,
};
