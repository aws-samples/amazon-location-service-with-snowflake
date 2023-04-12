import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  commonEnvVars,
  commonFunctionSettings,
  commonBundlingSettings,
  environment,
} from "../constants";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
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

    // Function that generates the Snowflake resources
    const generateSnowflakeResourcesFn = new NodejsFunction(
      this,
      "GenerateSnoflakeResourcesFn",
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
      }
    );
    this.functions.set(
      generateSnowflakeResourcesFnName,
      generateSnowflakeResourcesFn
    );
  }
}
