import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import {
  CfnApplication,
  CfnConfigurationProfile,
  CfnDeployment,
  CfnDeploymentStrategy,
  CfnEnvironment,
  CfnHostedConfigurationVersion,
} from "aws-cdk-lib/aws-appconfig";
import type { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Function } from "aws-cdk-lib/aws-lambda";
import type { AppConfigResourcesProps, AddConfigProfileInput } from "./types";

/**
 * This class contains the AppConfig resources that are used by the
 * various Lambda functions in the stack
 */
export class AppConfigResources extends Construct {
  /**
   * Reference to the AppConfig application resource deployed to the stack
   */
  public readonly application: CfnApplication;
  /**
   * Reference to the AppConfig environment resource deployed to the stack
   */
  public readonly environment: CfnEnvironment;
  /**
   * Reference to the AppConfig deployment strategy resource deployed to the stack
   */
  public readonly deploymentStrategy: CfnDeploymentStrategy;
  /**
   * Hashmap of AppConfig configuration profiles deployed to the stack
   */
  public readonly deployments: Map<string, CfnDeployment> = new Map();
  /**
   * Reference to the last AppConfig configuration profile deployed to the stack, used to enforce sequential deployments
   */
  private lastConfigProfile?: CfnDeployment;

  public constructor(
    scope: Construct,
    id: string,
    props: AppConfigResourcesProps
  ) {
    super(scope, id);

    const { applicationName, environmentName } = props;

    this.application = new CfnApplication(this, "Application", {
      name: applicationName,
    });

    this.environment = new CfnEnvironment(this, "Environment", {
      name: environmentName,
      applicationId: this.application.ref,
    });

    this.deploymentStrategy = new CfnDeploymentStrategy(
      this,
      "DeploymentStrategy",
      {
        name: "AllAtOnce",
        deploymentDurationInMinutes: 0,
        growthFactor: 100,
        replicateTo: "NONE",
        finalBakeTimeInMinutes: 0,
      }
    );
  }

  /**
   * Grant the Lambda function access to the AppConfig resources
   *
   * @param fn - Lambda function to grant access to AppConfig resources
   * @param deployment - AppConfig deployment resource
   */
  public grantRetrieveConfigToFunction(
    fn: Function | NodejsFunction,
    deployment: CfnDeployment
  ) {
    const appConfigConfigurationArn = Stack.of(this).formatArn({
      service: "appconfig",
      resource: `application/${deployment.applicationId}/environment/${deployment.environmentId}/configuration/${deployment.configurationProfileId}`,
    });
    fn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "appconfig:StartConfigurationSession",
          "appconfig:GetLatestConfiguration",
        ],
        resources: [appConfigConfigurationArn],
      })
    );
  }

  /**
   * Add a new AppConfig configuration profile
   * @param options The options for adding a configuration profile
   */
  public addConfigProfile(options: AddConfigProfileInput) {
    const { name, type, content } = options;

    const configProfile = new CfnConfigurationProfile(
      this,
      `ConfigProfile-${name}`,
      {
        name: name,
        applicationId: this.application.ref,
        locationUri: "hosted",
        type: type,
      }
    );

    const configVersion = new CfnHostedConfigurationVersion(
      this,
      `ConfigVersion-${name}`,
      {
        applicationId: this.application.ref,
        configurationProfileId: configProfile.ref,
        content: JSON.stringify(content),
        contentType: "application/json",
      }
    );

    const deployment = new CfnDeployment(this, `Deployment-${name}`, {
      applicationId: this.application.ref,
      configurationProfileId: configProfile.ref,
      configurationVersion: configVersion.ref,
      deploymentStrategyId: this.deploymentStrategy.ref,
      environmentId: this.environment.ref,
    });

    // Store the deployment so we can grant access to it later
    this.deployments.set(name, deployment);

    // Add a dependency on the previous deployment to enforce sequential deployments
    if (this.lastConfigProfile) {
      this.lastConfigProfile.node.addDependency(deployment);
    }
    this.lastConfigProfile = deployment;
  }
}
