import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import type { LocationServiceProps } from "./types";

import { LocationResources } from "./location-resources";
import { FunctionResources } from "./function-resources";

/**
 * The Location Service creates the resources related to Amazon Location Service.
 * These include the Place Indexes and the Lambda function that handles the requests.
 * The function is granted access to the Place Indexes.
 */
export class LocationService extends Construct {
  /**
   * Reference to the function service that contains the Lambda functions
   */
  public readonly functionService: FunctionResources;
  /**
   * Reference to the function service that contains the Location Service resources
   */
  public readonly locationService: LocationResources;

  public constructor(
    scope: Construct,
    id: string,
    props: LocationServiceProps
  ) {
    super(scope, id);

    const { handleSnowflakeFunctionRequestsFnName } = props;

    // Create the Functions resources
    this.functionService = new FunctionResources(
      this,
      `${id}-FunctionResources`,
      {
        handleSnowflakeFunctionRequestsFnName,
      }
    );

    // Create the Location Service resources
    this.locationService = new LocationResources(this, "LocationResources", {});
    // Grant the Lambda function access to the Location Service resources
    this.locationService.grantSearchActions(
      this.functionService.functions.get(handleSnowflakeFunctionRequestsFnName)!
    );

    // Add Nag suppressions
    LocationService.addNagSuppressions(Stack.of(this));
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
      "LocationServiceWithSnowflakeStack/LocationService/LocationService-FunctionResources/HandleSnowflakeFunctionRequestsFn/ServiceRole/Resource",
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Intentionally using the managed policy for Lambda execution.",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "The wildcard permission applies only to CloudWatch/X-Ray.",
        },
      ],
      true
    );
  }
}
