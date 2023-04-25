import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import { CfnPlaceIndex } from "aws-cdk-lib/aws-location";
import { environment } from "../constants";
import type { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Function } from "aws-cdk-lib/aws-lambda";
import type {
  LocationResourcesProps,
  LocationResourcesPlaceIndexes,
  LocationResourcesPlaceIndexesMap,
} from "./types";

/**
 * This class contains the AWS Location Service resources that are used by this the stack.
 */
export class LocationResources extends Construct {
  /**
   * Object that contains references to the AWS Location Service Place Indexes that are used by this stack
   */
  public readonly placeIndexes: LocationResourcesPlaceIndexes = {};
  /**
   * Object that contains the names and providers of the AWS Location Service Place Indexes
   */
  public readonly placeIndexesMap: LocationResourcesPlaceIndexesMap = {};

  public constructor(
    scope: Construct,
    id: string,
    _props: LocationResourcesProps
  ) {
    super(scope, id);

    // Create Place Indexes for each data provider currently Generally Available in the
    // AWS Region where the stack is deployed. Currently the `Grab` data provider is only
    // available in the `ap-southeast-1` region,
    // see https://docs.aws.amazon.com/location/latest/developerguide/grab.html#grab-coverage-area
    const dataProviders = ["Esri", "Here"];
    if (Stack.of(this).region === "ap-southeast-1") {
      dataProviders.push("Grab");
    }

    dataProviders.forEach((dataProviderName) => {
      const placeIndex = new CfnPlaceIndex(
        this,
        `PlaceIndex${dataProviderName}`,
        {
          indexName: `place-index-${dataProviderName.toLowerCase()}-${environment}`,
          dataSource: dataProviderName,
          dataSourceConfiguration: {
            intendedUse: "Storage",
          },
        }
      );
      this.placeIndexes[dataProviderName] = placeIndex;
      this.placeIndexesMap[dataProviderName] = placeIndex.indexName;
    });
  }

  /**
   * Add permissions to the Lambda function to access the Place Indexes
   *
   * @see https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonlocation.html#amazonlocation-actions-as-permissions
   * @param fn - The Lambda function to grant permissions to
   */
  public grantSearchActions(fn: NodejsFunction | Function) {
    fn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "geo:SearchPlaceIndexForPosition",
          "geo:SearchPlaceIndexForText",
          "geo:SearchPlaceIndexForSuggestions",
        ],
        resources: Object.values(this.placeIndexes).map(
          (placeIndex) => placeIndex.attrArn
        ),
      })
    );
  }
}
