import type { StackProps } from "aws-cdk-lib";

interface SnowflakeResourcesServiceProps extends StackProps {
  /**
   * The name of the function that will be created to generate Snowflake resources
   */
  generateSnowflakeResourcesFnName: string;
  /**
   * The name of the integration that will be created in Snowflake
   */
  apiIntegrationName: string;
  /**
   * The ARN of the role that will be used to access the AWS API Gateway
   */
  apiAwsRoleArn: string;
  /**
   * The base URL of the AWS API Gateway
   */
  apiBaseUrl: string;
}

interface FunctionResourcesProps
  extends Pick<
    SnowflakeResourcesServiceProps,
    "generateSnowflakeResourcesFnName"
  > {}

export { FunctionResourcesProps, SnowflakeResourcesServiceProps };
