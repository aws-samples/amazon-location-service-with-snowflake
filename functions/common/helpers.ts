import type {
  APIGatewayProxyEventHeaders,
  CloudFormationCustomResourceEvent,
} from "aws-lambda";
import { logger } from "./powertools";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getAppConfig } from "@aws-lambda-powertools/parameters/appconfig";

/**
 * Checks if the data has all of the properties specified.
 * @param data The data to check
 * @param properties The properties to check for
 * @returns `true` if the data has all of the properties, `false` otherwise
 */
const checkData = (
  data: Record<string, unknown> | undefined,
  properties: string[]
): boolean => {
  if (!data) {
    return false;
  }
  for (const property of Object.keys(properties)) {
    if (!Object(data).hasOwnProperty(property)) {
      return false;
    }
  }
  return true;
};

/**
 * Gets the value of an environment variable, throwing an error if it is not set
 * @param name The name of the environment variable
 * @returns The value of the environment variable
 */
const getEnvironmentVariableStringValue = (name: string): string => {
  const value = process.env[name];
  if (!value || value === "") {
    logger.error(`missing environment variable: ${name}`);
    throw new Error(`missing environment variable: ${name}`);
  }
  return value;
};

type ResourceProperties = {
  /**
   * The name of the Snowflake integration
   */
  integrationName: string;
  /**
   * The ARN of the AWS IAM role that Snowflake will use to access the AWS API Gateway
   */
  apiAwsRoleArn: string;
  /**
   * The base URL of the AWS API Gateway
   */
  apiBaseUrl: string;
};

/**
 * Gets the resource properties from the CloudFormation event, throwing an error if they are not set
 * @param event The CloudFormation event
 * @returns The resource properties
 */
const getValuesFromEventProperties = (
  event: CloudFormationCustomResourceEvent
): ResourceProperties => {
  const properties = event.ResourceProperties;

  if (
    checkData(properties, ["integrationName", "apiAwsRoleArn", "apiBaseUrl"])
  ) {
    logger.error("missing properties in CloudFormation event", { event });
    throw new Error("missing properties in CloudFormation event");
  }

  return {
    integrationName: properties.integrationName,
    apiAwsRoleArn: properties.apiAwsRoleArn,
    apiBaseUrl: properties.apiBaseUrl,
  };
};

/**
 * The information required to connect to Snowflake
 */
type SnowflakeAccountInfo = {
  /**
   * The name of the Snowflake account
   */
  account: string;
  /**
   * The username of the Snowflake user
   */
  username: string;
  /**
   * The password of the Snowflake user
   */
  password: string;
};

/**
 * Gets the information required to connect to Snowflake from Secrets Manager using AWS Lambda Powertools
 * @returns The information required to connect to Snowflake
 */
const getSnowflakeAccountInfo = async (): Promise<SnowflakeAccountInfo> => {
  logger.debug("getting Secrets Manager secret");
  try {
    const accountInfo = (await getSecret(
      getEnvironmentVariableStringValue("SECRET_NAME"),
      { transform: "json" }
    )) as Record<string, unknown> | undefined;
    if (checkData(accountInfo, ["account", "username", "password"])) {
      logger.error("missing account info in Secrets Manager secret", {
        details: accountInfo
          ? Object.keys(accountInfo)
          : "no account info returned",
      });
      throw new Error("missing account info in Secrets Manager secret");
    }

    logger.debug("got Secrets Manager secret");

    return accountInfo as SnowflakeAccountInfo;
  } catch (err) {
    logger.error("error getting Secrets Manager secret", { err });
    throw err;
  }
};

/**
 * The warehouse configuration for Snowflake
 */
type SnowflakeWarehouseConfig = {
  /**
   * The name of the warehouse to use
   */
  warehouse: string;
  /**
   * The name of the database to use
   */
  database: string;
};

/**
 * Gets the warehouse configuration for Snowflake from AppConfig using AWS Lambda Powertools
 * @returns The warehouse configuration for Snowflake
 */
const getSnowflakeWarehouseConfig =
  async (): Promise<SnowflakeWarehouseConfig> => {
    try {
      const application = getEnvironmentVariableStringValue(
        "APPCONFIG_APPLICATION_ID"
      );
      const environment = getEnvironmentVariableStringValue(
        "APPCONFIG_ENVIRONMENT_ID"
      );
      const appConfigProfileName = getEnvironmentVariableStringValue(
        "APPCONFIG_CONFIGURATION_PROFILE_ID"
      );
      const databaseInfo = (await getAppConfig(appConfigProfileName, {
        application,
        environment,
        transform: "json",
      })) as Record<string, unknown> | undefined;

      if (checkData(databaseInfo, ["warehouse", "database"])) {
        logger.error("missing database info in AppConfig", {
          details: databaseInfo
            ? Object.keys(databaseInfo)
            : "no database info returned",
        });
        throw new Error("Missing database info in AppConfig");
      }

      logger.debug("got appConfig configuration");

      return databaseInfo as SnowflakeWarehouseConfig;
    } catch (err) {
      logger.error("error getting AppConfig configuration", { err });
      throw err;
    }
  };

/**
 * The place indexes for the application
 */
export type PlaceIndexes = {
  /**
   * The name of the Esri place index
   */
  Esri: string;
  /**
   * The name of the Here place index
   */
  Here: string;
  /**
   * The name of the Grab place index
   */
  Grab?: string;
};

/**
 * Get the place indexes from AppConfig using AWS Lambda Powertools
 * @returns The place indexes for the application
 */
const getPlaceIndexes = async (): Promise<PlaceIndexes> => {
  try {
    const application = getEnvironmentVariableStringValue(
      "APPCONFIG_APPLICATION_ID"
    );
    const environment = getEnvironmentVariableStringValue(
      "APPCONFIG_ENVIRONMENT_ID"
    );
    const appConfigProfileName = getEnvironmentVariableStringValue(
      "APPCONFIG_CONFIGURATION_PROFILE_ID"
    );
    const placeIndexes = (await getAppConfig(appConfigProfileName, {
      application,
      environment,
      transform: "json",
      maxAge: 900,
    })) as Record<string, unknown> | undefined;

    if (checkData(placeIndexes, ["Esri", "Here"])) {
      logger.error("missing place indexes in AppConfig", {
        details: placeIndexes,
      });
      throw new Error("missing place indexes in AppConfig");
    }

    logger.debug("got appConfig configuration");

    return placeIndexes as PlaceIndexes;
  } catch (err) {
    logger.error("error getting PlaceIndex configuration from AppConfig", {
      err,
    });
    throw err;
  }
};

type GenericRequestOutputWithOptionalError = {
  _error?: string;
} & Record<string, any>;

/**
 * Parses the request body and returns an array of rows. If the body is invalid, returns an error.
 * @param body The request body (JSON string)
 * @returns An array of rows
 */
const getRowsFromBody = (
  body: string | null | undefined
): GenericRequestOutputWithOptionalError => {
  try {
    const parsedBody = JSON.parse(body || "{}");
    if (typeof parsedBody !== "object") {
      return { _error: "invalid body" };
    }
    if (!parsedBody || !parsedBody.data) {
      return { _error: "invalid body" };
    }

    return {
      rows: parsedBody.data,
    };
  } catch (err) {
    return { _error: "invalid body" };
  }
};

/**
 * Gets the name of the Snowflake function to call from the request headers.
 * If the headers are invalid, returns an error.
 * @param headers The request headers
 * @returns The name of the Snowflake function to call, or an error
 */
const getSnowflakeFunctionNameFromHeaders = (
  headers: APIGatewayProxyEventHeaders
): GenericRequestOutputWithOptionalError => {
  try {
    const functionName = headers["sf-external-function-name"];
    if (!functionName) {
      return { _error: "missing function name" };
    }

    return {
      functionName,
    };
  } catch (err) {
    return { _error: "invalid headers" };
  }
};

export {
  getEnvironmentVariableStringValue,
  getValuesFromEventProperties,
  getSnowflakeAccountInfo,
  getSnowflakeWarehouseConfig,
  getPlaceIndexes,
  getRowsFromBody,
  getSnowflakeFunctionNameFromHeaders,
};
