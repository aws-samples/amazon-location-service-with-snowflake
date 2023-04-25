import { Stack, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  commonEnvVars,
  commonFunctionSettings,
  commonBundlingSettings,
  environment,
} from "../constants";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { FunctionResourcesProps } from "./types";

/**
 * This class contains the AWS Lambda functions that are used by this service
 */
export class FunctionResources extends Construct {
  /**
   * Hashmap that contains the AWS Lambda functions that are used by this service
   */
  public readonly functions: Map<string, NodejsFunction> = new Map();

  public constructor(
    scope: Construct,
    id: string,
    props: FunctionResourcesProps
  ) {
    super(scope, id);

    const { generateSnowflakeResourcesFnName } = props;

    const localEnvVars = {
      ...commonEnvVars,
      AWS_ACCOUNT_ID: Stack.of(this).account,
    };

    const functionLogGroup = new LogGroup(
      this,
      "GenerateSnowflakeResourcesLogGroup",
      {
        retention: RetentionDays.FIVE_DAYS,
        logGroupName: `/aws/lambda/${generateSnowflakeResourcesFnName}-${environment}`,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );
    const functionRole = new Role(this, "GenerateSnowflakeResourcesRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        "allow-xray": new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
              // This is needed to allow the Lambda function to send traces to X-Ray,
              // the service does not support resource-level permissions.
              resources: ["*"],
            }),
          ],
        }),
        "allow-logs": new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
              resources: [functionLogGroup.logGroupArn],
            }),
          ],
        }),
      },
    });

    // Function that generates the Snowflake resources
    const generateSnowflakeResourcesFn = new NodejsFunction(
      this,
      "GenerateSnowflakeResourcesFn",
      {
        ...commonFunctionSettings,
        entry: "../functions/generateSnowflakeResources.ts",
        functionName: `${generateSnowflakeResourcesFnName}-${environment}`,
        environment: {
          ...localEnvVars,
        },
        bundling: {
          ...commonBundlingSettings,
          sourceMap: false, // This is always disabled due to this issue in the Snowflake SDK https://github.com/snowflakedb/snowflake-connector-nodejs/issues/407#issuecomment-1404888043
        },
        role: functionRole,
      }
    );
    this.functions.set(
      generateSnowflakeResourcesFnName,
      generateSnowflakeResourcesFn
    );
  }
}
