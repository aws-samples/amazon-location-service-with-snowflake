import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import { CustomResource } from "aws-cdk-lib";
import { Provider } from "aws-cdk-lib/custom-resources";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Reference } from "aws-cdk-lib";
import type { SnowflakeResourcesServiceProps } from "./types";

import { FunctionResources } from "./function-resources";

/**
 * The Snowflake Resources Service creates the resources needed to connect to Snowflake and
 * initialize an API Integration as well as some External Functions that will allow you to
 * interact with Amazon Location Service from your Snowflake warehouse
 */
export class SnowflakeResourcesService extends Construct {
  /**
   * Reference to the function service that contains the Lambda functions
   */
  public readonly functionService: FunctionResources;
  /**
   * The AWS IAM user ARN that Snowflake will use to access the AWS API Gateway
   */
  public readonly apiAwsIamUserArn: Reference;
  /**
   * The AWS external ID created by Snowflake to use in the IAM role trust policy
   */
  public readonly apiAwsExternalId: Reference;

  public constructor(
    scope: Construct,
    id: string,
    props: SnowflakeResourcesServiceProps
  ) {
    super(scope, id);

    const {
      generateSnowflakeResourcesFnName,
      apiIntegrationName,
      apiAwsRoleArn,
      apiBaseUrl,
    } = props;

    // Create the Functions resources
    this.functionService = new FunctionResources(
      this,
      `${id}-FunctionResources`,
      {
        generateSnowflakeResourcesFnName,
      }
    );

    // Create the Custom Resource that will create the Snowflake resources
    const provider = new Provider(this, "Snowflake-Resource-Provider", {
      onEventHandler: this.functionService.functions.get(
        generateSnowflakeResourcesFnName
      )!,
      logRetention: RetentionDays.FIVE_DAYS,
    });

    const customResource = new CustomResource(
      this,
      "Custom-Snowflake-API-Integration",
      {
        serviceToken: provider.serviceToken,
        resourceType: "Custom::Snowflake-API-Integration",
        properties: {
          integrationName: apiIntegrationName,
          apiAwsRoleArn,
          apiBaseUrl,
        },
      }
    );

    this.apiAwsIamUserArn = customResource.getAtt("API_AWS_IAM_USER_ARN");
    this.apiAwsExternalId = customResource.getAtt("API_AWS_EXTERNAL_ID");

    // Add Nag suppressions
    SnowflakeResourcesService.addNagSuppressions(Stack.of(this));
  }

  /**
   * Adds environment variables to the Lambda function
   * @param functionName The name of the Lambda function
   * @param environmentVariables The environment variables to add to the Lambda function
   */
  public addToFunctionEnvironmentVariables(
    functionName: string,
    environmentVariables: Record<string, string>
  ) {
    for (const [key, value] of Object.entries(environmentVariables)) {
      this.functionService.functions
        .get(functionName)!
        .addEnvironment(key, value);
    }
  }

  /**
   * Adds Nag suppressions to the stack, these are justifications for the rules that are being suppressed
   * intentionally and are not a security risk and/or are not applicable to the solution
   * @param stack The stack to add the Nag suppressions to
   */
  private static addNagSuppressions(stack: Stack) {
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      "LocationServiceWithSnowflakeStack/SnowflakeResourcesService/SnowflakeResourcesService-FunctionResources/GenerateSnowflakeResourcesRole/Resource",
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "The wildcard permission applies only to CloudWatch/X-Ray.",
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      [
        "LocationServiceWithSnowflakeStack/SnowflakeResourcesService/Snowflake-Resource-Provider/framework-onEvent/ServiceRole/DefaultPolicy/Resource",
        "LocationServiceWithSnowflakeStack/SnowflakeResourcesService/Snowflake-Resource-Provider/framework-onEvent/ServiceRole/Resource",
        "LocationServiceWithSnowflakeStack/SnowflakeResourcesService/Snowflake-Resource-Provider/framework-onEvent/ServiceRole/DefaultPolicy/Resource",
        "LocationServiceWithSnowflakeStack/SnowflakeResourcesService/Snowflake-Resource-Provider/framework-onEvent/Resource",
        "LocationServiceWithSnowflakeStack/SnowflakeResourcesService/SnowflakeResourcesService-FunctionResources/GenerateSnowflakeResourcesFn/Resource",
      ],
      [
        {
          id: "AwsSolutions-L1",
          reason:
            "This resource is created and managed by CDK and is used only at deployment time.",
        },
        {
          id: "AwsSolutions-IAM4",
          reason:
            "This resource is created and managed by CDK and is used only at deployment time.",
        },
        {
          id: "AwsSolutions-IAM5",
          reason:
            "This resource is created and managed by CDK and is used only at deployment time.",
        },
      ]
    );
  }
}
