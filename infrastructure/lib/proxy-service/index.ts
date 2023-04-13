import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  ArnPrincipal,
  PolicyDocument,
  Effect,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import {
  RestApi,
  EndpointType,
  AuthorizationType,
  LambdaIntegration,
  MethodLoggingLevel,
} from "aws-cdk-lib/aws-apigateway";
import { environment } from "../constants";
import type {
  AddMethodWithIntegrationOptions,
  ProxyServiceProps,
} from "./types";
import { NagSuppressions } from "cdk-nag";

/**
 * The Proxy Service is an API Gateway that is used to proxy requests from Snowflake to AWS Lambda functions
 */
export class ProxyService extends Construct {
  /**
   * Reference to the API Gateway
   */
  public readonly api: RestApi;

  public constructor(scope: Construct, id: string, props: ProxyServiceProps) {
    super(scope, id);

    const { endpointType = EndpointType.REGIONAL, snowflakeRoleName } = props;

    // Create the API Gateway
    this.api = new RestApi(this, "ProxyServiceApi", {
      restApiName: `Snowflake-ProxyServiceApi-${environment}`,
      endpointTypes: [endpointType],
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["execute-api:Invoke"],
            principals: [
              new ArnPrincipal(
                `arn:aws:iam::${
                  Stack.of(this).account
                }:assumed-role/${snowflakeRoleName}/snowflake`
              ),
            ],
            resources: ["execute-api:/*"],
          }),
        ],
      }),
    });

    // Add Nag suppressions
    ProxyService.addNagSuppressions(Stack.of(this));
  }

  /**
   * Add a method to the API Gateway with a Lambda integration at the root path
   * @param options Integration options
   */
  public addMethodWithLambdaIntegration(
    options: AddMethodWithIntegrationOptions
  ) {
    this.api.root.addMethod(
      options.method,
      new LambdaIntegration(options.function),
      {
        authorizationType: AuthorizationType.IAM,
        ...options.methodOptions,
      }
    );

    NagSuppressions.addResourceSuppressionsByPath(
      Stack.of(this),
      "LocationServiceWithSnowflakeStack/ProxyService/ProxyServiceApi/Default/POST/Resource",
      [
        {
          id: "AwsSolutions-APIG4",
          reason: "The API implements IAM authorization.",
        },
        {
          id: "AwsSolutions-COG4",
          reason: "The API implements IAM authorization.",
        },
      ]
    );
  }

  /**
   * Adds Nag suppressions to the stack, these are justifications for the rules that are being suppressed
   * intentionally and are not a security risk and/or are not applicable to the solution
   * @param stack The stack to add the Nag suppressions to
   */
  private static addNagSuppressions(stack: Stack) {
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      "LocationServiceWithSnowflakeStack/ProxyService/ProxyServiceApi/Resource",
      [
        {
          id: "AwsSolutions-APIG2",
          reason:
            "Request validation is done in the Lambda function, this is because we use one Lambda function for multiple Snowflake functions",
        },
      ]
    );

    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      "LocationServiceWithSnowflakeStack/ProxyService/ProxyServiceApi/DeploymentStage.prod/Resource",
      [
        {
          id: "AwsSolutions-APIG3",
          reason:
            "Usage of a WAF has intentionally been omitted for this solution",
        },
        {
          id: "AwsSolutions-APIG6",
          reason:
            "Logging disabled intentionally to leave it up to the user given that there can only be one AWS::ApiGateway::Account per AWS account",
        },
        {
          id: "AwsSolutions-APIG1",
          reason:
            "Logging disabled intentionally to leave it up to the user given that there can only be one AWS::ApiGateway::Account per AWS account",
        },
      ]
    );
  }
}
