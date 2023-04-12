import type { CloudFormationCustomResourceEvent } from "aws-lambda";
import { logger } from "./common/powertools";
import { getValuesFromEventProperties } from "./common/helpers";
import {
  createApiIntegration,
  updateApiIntegration,
  deleteApiIntegration,
  describeApiIntegration,
  createExternalFunctions,
  updateExternalFunctions,
  deleteExternalFunctions,
} from "./common/snowflake-helpers";

/**
 * The main handler for the Lambda function.
 *
 * It receives a request from CloudFormation to create, update, or delete the
 * Snowflake resources. It then calls the appropriate Snowflake helper function
 * to create, update, or delete the resources.
 *
 * The function returns the API integration details to CloudFormation. These
 * details are used by the Snowflake external functions to authenticate with
 * the API.
 *
 * @param event The CloudFormation event
 * @returns The API integration details
 */
export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<any> => {
  if (event.RequestType === "Create") {
    const { integrationName, apiAwsRoleArn, apiBaseUrl } =
      getValuesFromEventProperties(event);

    // Create the API integration
    await createApiIntegration({
      integrationName,
      apiAwsRoleArn,
      apiAllowedPrefix: apiBaseUrl,
    });

    // Get the API integration details (which also confirms it was created)
    const { apiAwsIamUserArn, apiAwsExternalId } = await describeApiIntegration(
      integrationName
    );

    // Create the external functions
    await createExternalFunctions({
      integrationName,
      apiBaseUrl,
    });

    // Return the API integration details to CloudFormation
    return {
      PhysicalResourceId: integrationName,
      Data: {
        API_AWS_IAM_USER_ARN: apiAwsIamUserArn,
        API_AWS_EXTERNAL_ID: apiAwsExternalId,
      },
    };
  } else if (event.RequestType === "Update") {
    const { integrationName, apiAwsRoleArn, apiBaseUrl } =
      getValuesFromEventProperties(event);

    // Update the API integration
    await updateApiIntegration({
      integrationName,
      apiAwsRoleArn,
      apiAllowedPrefix: apiBaseUrl,
      physicalResourceId: event.PhysicalResourceId,
    });

    // Get the API integration details (which also confirms it was updated)
    const { apiAwsIamUserArn, apiAwsExternalId } = await describeApiIntegration(
      integrationName
    );

    // Update the external functions
    await updateExternalFunctions({
      integrationName,
      apiBaseUrl,
    });

    // Return the API integration details to CloudFormation
    return {
      PhysicalResourceId: integrationName,
      Data: {
        API_AWS_IAM_USER_ARN: apiAwsIamUserArn,
        API_AWS_EXTERNAL_ID: apiAwsExternalId,
      },
    };
  } else if (event.RequestType === "Delete") {
    await deleteApiIntegration(event.PhysicalResourceId);
    await deleteExternalFunctions();
    return {};
  } else {
    logger.error("Unexpected event.RequestType", { event });
    throw new Error(`Unexpected event.RequestType - see logs for details`);
  }
};
