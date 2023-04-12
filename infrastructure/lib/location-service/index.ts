import { Construct } from "constructs";
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
}
