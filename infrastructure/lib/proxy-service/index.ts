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
} from "aws-cdk-lib/aws-apigateway";
import { environment } from "../constants";
import type {
  AddMethodWithIntegrationOptions,
  ProxyServiceProps,
} from "./types";

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
  }
}
