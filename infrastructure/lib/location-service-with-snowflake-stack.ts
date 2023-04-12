import { Stack, StackProps, CfnParameter } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EndpointType } from "aws-cdk-lib/aws-apigateway";
import { environment } from "./constants";
import { Role, AnyPrincipal } from "aws-cdk-lib/aws-iam";
import {
  AwsCustomResource,
  PhysicalResourceId,
  AwsCustomResourcePolicy,
} from "aws-cdk-lib/custom-resources";

import { ConfigService } from "./config-service";
import { SnowflakeResourcesService } from "./snowflake-resources-service";
import { ProxyService } from "./proxy-service";
import { LocationService } from "./location-service";

/**
 * This is the main construct and entry point for the stack.
 *
 * The stack deploys a number of services that group resources by logical functions.
 */
export class LocationServiceWithSnowflakeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Parameters that are used by the stack
    const accountUserPassSecretName = new CfnParameter(
      this,
      "AccountUserPassSecretNameParam",
      {
        type: "String",
        description:
          "The name of the Secrets Manager secret that contains the Snowflake account, user, and password",
      }
    );
    const apiIntegrationName = new CfnParameter(
      this,
      "ApiIntegrationNameParam",
      {
        type: "String",
        description:
          "The name of the Snowflake API integration that will be created",
      }
    );
    const snowflakeWarehouse = new CfnParameter(
      this,
      "SnowflakeWarehouseParam",
      {
        type: "String",
        description: "The Snowflake warehouse name",
      }
    );
    const snowflakeDatabase = new CfnParameter(this, "SnowflakeDatabaseParam", {
      type: "String",
      description: "The Snowflake database name",
    });
    const snowflakeSchema = new CfnParameter(this, "SnowflakeSchemaParam", {
      type: "String",
      description: "The Snowflake schema name",
    });

    // Create the Config service
    const configService = new ConfigService(this, "ConfigService", {
      accountUserPassSecretName: accountUserPassSecretName.valueAsString,
    });
    const snowflakeDbInfoConfigProfileName = "snowflake-db-info";
    configService.appconfig.addConfigProfile({
      name: snowflakeDbInfoConfigProfileName,
      type: "AWS.Freeform",
      content: {
        warehouse: snowflakeWarehouse.valueAsString,
        database: snowflakeDatabase.valueAsString,
        schema: snowflakeSchema.valueAsString,
      },
    });

    // Create an IAM Role with a trust relationship to this account which will be assumed by the Snowflake API integration
    const snowflakeRole = new Role(this, "SnowflakeRole", {
      roleName: `Snowflake-Role-${environment}`,
      assumedBy: new AnyPrincipal(), // This is overridden by the PrincipalWithConditions below
    });

    // Create the Proxy Service, this service contains the AWS API Gateway that will be used to proxy requests from Snowflake
    // to Amazon Location Service
    const proxyService = new ProxyService(this, "ProxyService", {
      endpointType: EndpointType.REGIONAL,
      snowflakeRoleName: snowflakeRole.roleName,
    });

    // Create the Location Service, this service contains the Lambda function that will be used to handle requests from the
    // AWS API Gateway and will interact with Amazon Location Service
    const handleSnowflakeFunctionRequestsFnName =
      "handle-snowflake-function-requests-fn";
    const locationService = new LocationService(this, "LocationService", {
      handleSnowflakeFunctionRequestsFnName,
    });
    const placeIndexesConfigProfileName = "place-indexes";
    configService.appconfig.addConfigProfile({
      name: placeIndexesConfigProfileName,
      type: "AWS.Freeform",
      content: locationService.locationService.placeIndexesMap,
    });
    // Grant the function permission to retrieve the AppConfig configuration that contains the Location Service place indexes
    configService.appconfig.grantRetrieveConfigToFunction(
      locationService.functionService.functions.get(
        handleSnowflakeFunctionRequestsFnName
      )!,
      configService.appconfig.deployments.get(placeIndexesConfigProfileName)!
    );
    // Add the AppConfig configuration profile info and the secret's name to the function's environment variables
    locationService.addToFunctionEnvironmentVariables(
      handleSnowflakeFunctionRequestsFnName,
      {
        APPCONFIG_APPLICATION_ID: configService.appconfig.deployments.get(
          placeIndexesConfigProfileName
        )!.applicationId,
        APPCONFIG_ENVIRONMENT_ID: configService.appconfig.deployments.get(
          placeIndexesConfigProfileName
        )!.environmentId,
        APPCONFIG_CONFIGURATION_PROFILE_ID:
          configService.appconfig.deployments.get(
            placeIndexesConfigProfileName
          )!.configurationProfileId,
      }
    );

    // Add the Lambda function to the AWS API Gateway
    proxyService.addMethodWithLambdaIntegration({
      method: "POST",
      function: locationService.functionService.functions.get(
        handleSnowflakeFunctionRequestsFnName
      )!,
    });

    // Create the SnowflakeResourcesService, this service contains the Lambda function that creates the Snowflake resources
    // as well as the necessary CDK constructs to create a Lambda-based custom resource
    const generateSnowflakeResourcesFnName = "generate-snowflake-resources-fn";
    const snowflakeResourcesService = new SnowflakeResourcesService(
      this,
      "SnowflakeResourcesService",
      {
        generateSnowflakeResourcesFnName,
        apiIntegrationName: apiIntegrationName.valueAsString,
        apiAwsRoleArn: snowflakeRole.roleArn,
        apiBaseUrl: proxyService.api.url,
      }
    );

    // Grant the function permission to retrieve the AppConfig configuration that contains the Snowflake warehouse info
    configService.appconfig.grantRetrieveConfigToFunction(
      snowflakeResourcesService.functionService.functions.get(
        generateSnowflakeResourcesFnName
      )!,
      configService.appconfig.deployments.get(snowflakeDbInfoConfigProfileName)!
    );
    // Grant the function permission to retrieve the Secrets Manager secret
    configService.secret.grantRead(
      snowflakeResourcesService.functionService.functions.get(
        generateSnowflakeResourcesFnName
      )!
    );
    // Add the AppConfig configuration profile info and the secret's name to the function's environment variables
    snowflakeResourcesService.addToFunctionEnvironmentVariables(
      generateSnowflakeResourcesFnName,
      {
        APPCONFIG_APPLICATION_ID: configService.appconfig.deployments.get(
          snowflakeDbInfoConfigProfileName
        )!.applicationId,
        APPCONFIG_ENVIRONMENT_ID: configService.appconfig.deployments.get(
          snowflakeDbInfoConfigProfileName
        )!.environmentId,
        APPCONFIG_CONFIGURATION_PROFILE_ID:
          configService.appconfig.deployments.get(
            snowflakeDbInfoConfigProfileName
          )!.configurationProfileId,
        SECRET_NAME: configService.secret.secretName,
      }
    );

    // Grant the IAM Principal provided by Snowflake, and associated with the API integration, permission to assume the
    // IAM Role created above. This also includes a condition that the ExternalId provided by Snowflake matches the
    // ExternalId created during the creation of the API Integration
    new AwsCustomResource(this, "GrantSnowflakeRoleAssumePermission", {
      onCreate: {
        service: "IAM",
        action: "updateAssumeRolePolicy",
        physicalResourceId: PhysicalResourceId.of(
          "GrantSnowflakeRoleAssumePermission"
        ),
        parameters: {
          RoleName: snowflakeRole.roleName,
          PolicyDocument: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  AWS: snowflakeResourcesService.apiAwsIamUserArn.toString(),
                },
                Action: "sts:AssumeRole",
                Condition: {
                  StringEquals: {
                    "sts:ExternalId":
                      snowflakeResourcesService.apiAwsExternalId.toString(),
                  },
                },
              },
            ],
          }),
        },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [snowflakeRole.roleArn],
      }),
    });
  }
}
