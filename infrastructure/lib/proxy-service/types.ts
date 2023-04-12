import type { StackProps } from 'aws-cdk-lib';
import type { MethodOptions, EndpointType } from 'aws-cdk-lib/aws-apigateway';
import type { Function } from 'aws-cdk-lib/aws-lambda';

type AddMethodWithIntegrationOptions = {
  /**
   * The HTTP method to add to the resource.
   */
  method: string;
  /**
   * The Lambda function to integrate with.
   */
  function: Function;
  /**
   * Options for the method (optional)
   */
  methodOptions?: MethodOptions;
};

interface ProxyServiceProps extends StackProps {
  /**
   * The endpoint type of the API Gateway. Default is REGIONAL.
   */
  endpointType?: EndpointType;
  /**
   * Name of the IAM role assumed by Snowflake to access the API Gateway.
   */
  snowflakeRoleName?: string;
};

export {
  AddMethodWithIntegrationOptions,
  ProxyServiceProps,
}