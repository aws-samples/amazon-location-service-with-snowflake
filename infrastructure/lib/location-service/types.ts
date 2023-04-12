import type { StackProps } from "aws-cdk-lib";
import type { CfnPlaceIndex } from "aws-cdk-lib/aws-location";

interface LocationServiceProps extends StackProps {
  handleSnowflakeFunctionRequestsFnName: string;
}

interface LocationResourcesProps extends StackProps {}

type LocationResourcesPlaceIndexes = { [key: string]: CfnPlaceIndex };

type LocationResourcesPlaceIndexesMap = { [key: string]: string };

interface FunctionResourcesProps extends StackProps {
  handleSnowflakeFunctionRequestsFnName: string;
}

export {
  LocationServiceProps,
  FunctionResourcesProps,
  LocationResourcesProps,
  LocationResourcesPlaceIndexes,
  LocationResourcesPlaceIndexesMap,
};
