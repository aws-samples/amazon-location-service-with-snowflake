import {
  LocationClient,
  SearchPlaceIndexForPositionCommand,
  SearchPlaceIndexForTextCommand,
} from "@aws-sdk/client-location";
import { getPlaceIndexes } from "./helpers";
import type { PlaceIndexes } from "./helpers";
import { logger } from "./powertools";

const locationClient = new LocationClient({});

/**
 * Extract the name of data provider from the function name and then
 * match it to the name of the place index available in AppConfig
 * @param functionName The name of the Snowflake function
 * @returns The name of the place index
 */
const getPlaceIndexFromFunctionName = async (
  functionName: string
): Promise<string> => {
  const functionNameNormalized = functionName.toLowerCase();
  const placeIndexes = await getPlaceIndexes();
  if (functionNameNormalized.endsWith("here")) {
    return placeIndexes.Here;
  } else if (functionNameNormalized.endsWith("esri")) {
    return placeIndexes.Esri;
  } else if (functionNameNormalized.endsWith("grab")) {
    // If the function name includes Grab, then the place index must be defined
    // because the function is deployed based on the availability of the place index
    return placeIndexes.Grab!;
  } else {
    logger.error("no provider found, invalid function name", { functionName });
    throw new Error("no provider found, invalid function name");
  }
};

/**
 * The operation type (geocode or reverse geocode)
 */
type OperationType = "geocode" | "reverseGeocode";

/**
 * Extract the operation type from the function name
 * @param functionName The name of the Snowflake function
 * @returns The operation type (geocode or reverse geocode)
 */
const getOperationTypeFromFunctionName = (
  functionName: string
): OperationType => {
  const functionNameNormalized = functionName.toLowerCase();
  if (functionNameNormalized.startsWith("geocode")) {
    return "geocode";
  } else if (functionNameNormalized.startsWith("reverse")) {
    return "reverseGeocode";
  } else {
    logger.error("no operation type found, invalid function name", {
      functionName,
    });
    throw new Error("no operation type found, invalid function name");
  }
};

/**
 * Geocode the rows using Amazon Location Service
 * @param rows The rows to geocode (id, address)
 * @param placeIndex The name of the place index
 * @returns The geocoded rows (id, latitude, longitude)
 */
const geocodeRows = async (rows: any[], placeIndex: string): Promise<any[]> => {
  try {
    const resultRows: unknown[] = [];
    for (const row of rows) {
      const [id, address] = row;
      const res = await locationClient.send(
        new SearchPlaceIndexForTextCommand({
          IndexName: placeIndex,
          Text: address,
        })
      );
      resultRows.push([
        id,
        res.Results?.[0].Place?.Geometry?.Point?.[0] || -1,
        res.Results?.[0].Place?.Geometry?.Point?.[1] || -1,
      ]);
    }
    return resultRows;
  } catch (err) {
    logger.error("unable to geocode rows", { err });
    throw err;
  }
};

/**
 * Reverse geocode the rows using Amazon Location Service
 * @param rows The rows to reverse geocode (id, latitude, longitude)
 * @param placeIndex The name of the place index
 * @returns The reverse geocoded rows (id, address)
 */
const reverseGeocodeRows = async (
  rows: any[],
  placeIndex: string
): Promise<any[]> => {
  try {
    const resultRows: unknown[] = [];
    for (const row of rows) {
      const [id, longitude, latitude] = row;
      const res = await locationClient.send(
        new SearchPlaceIndexForPositionCommand({
          IndexName: placeIndex,
          Position: [longitude, latitude],
        })
      );
      resultRows.push([id, res.Results?.[0].Place?.Label || "N/A"]);
    }
    return resultRows;
  } catch (err) {
    logger.error("unable to reverse geocode rows", { err });
    throw err;
  }
};

export {
  getPlaceIndexFromFunctionName,
  getOperationTypeFromFunctionName,
  geocodeRows,
  reverseGeocodeRows,
};
