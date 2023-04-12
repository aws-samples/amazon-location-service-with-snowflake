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

    const { handleSnowflakeFunctionRequestsFnName } = props;

    const localEnvVars = {
      ...commonEnvVars,
      AWS_ACCOUNT_ID: Stack.of(this).account,
    };

    // Function that handles requests from Snowflake and calls Amazon Location Service
    const handleSnowflakeFunctionRequestsFn = new NodejsFunction(
      this,
      "HandleSnowflakeFunctionRequestsFn",
      {
        ...commonFunctionSettings,
        entry: "../functions/handleSnowflakeFunctionRequests.ts",
        functionName: `${handleSnowflakeFunctionRequestsFnName}-${environment}`,
        environment: {
          ...localEnvVars,
        },
        bundling: {
          ...commonBundlingSettings,
        },
      }
    );
    this.functions.set(
      handleSnowflakeFunctionRequestsFnName,
      handleSnowflakeFunctionRequestsFn
    );
  }
}
