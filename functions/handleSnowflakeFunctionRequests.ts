import type { APIGatewayProxyEvent } from "aws-lambda";
import { injectLambdaContext } from "@aws-lambda-powertools/logger";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer";
import { logger, tracer } from "./common/powertools";
import {
  getRowsFromBody,
  getSnowflakeFunctionNameFromHeaders,
} from "./common/helpers";
import {
  getOperationTypeFromFunctionName,
  getPlaceIndexFromFunctionName,
  geocodeRows,
  reverseGeocodeRows,
} from "./common/location-helpers";
import middy from "@middy/core";

/**
 * The main handler for the Lambda function.
 *
 * It receives a request from Snowflake via API Gateway. The request contains
 * a list of rows to geocode or reverse geocode, and the name of the Snowflake
 * function that is calling the Lambda function.
 *
 * The function name that is passed in the request headers is used to determine
 * the operation type (geocode or reverse geocode) and the data provider (HERE,
 * Esri, or Grab).
 *
 * The function then calls the appropriate geocoding or reverse geocoding function
 * with the list of rows and the data provider selected.
 *
 * The function uses the @middy/core library to wrap the handler with middleware
 * that inject the Lambda context into the logger and creates X-Ray segments.
 *
 * Learn more about the @middy/core library [here](https://middy.js.org),
 * and about Powertools [here](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/).
 *
 * @param event The API Gateway event
 */
export const handler = middy(async (event: APIGatewayProxyEvent) => {
  const { rows, _error: bodyError } = getRowsFromBody(event.body);
  if (bodyError) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: bodyError,
      }),
    };
  }
  const { functionName: snowflakeFunctionName, _error: headersError } =
    getSnowflakeFunctionNameFromHeaders(event.headers);
  if (headersError) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: "missing required Snowflake header: sf-external-function-name",
      }),
    };
  }

  try {
    const operation = getOperationTypeFromFunctionName(snowflakeFunctionName);
    const dataProvider = await getPlaceIndexFromFunctionName(
      snowflakeFunctionName
    );
    const data =
      operation === "reverseGeocode"
        ? await reverseGeocodeRows(rows, dataProvider)
        : await geocodeRows(rows, dataProvider);

    return {
      statusCode: 200,
      body: JSON.stringify({ data }),
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "An internal error occurred, please try again later.";
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: message,
      }),
    };
  }
})
  .use(
    captureLambdaHandler(tracer, {
      captureResponse: false, // The response might contain PII or be too large, so we don't capture it in the X-Ray segments
    })
  )
  .use(
    injectLambdaContext(logger, {
      logEvent: process.env.ENVIRONMENT !== "prod",
    })
  );
