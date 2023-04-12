import { Construct } from "constructs";
import { powertoolsServiceName, environment } from "../constants";
import type { ConfigServiceProps } from "./types";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { ISecret } from "aws-cdk-lib/aws-secretsmanager";

import { AppConfigResources } from "./appconfig-resources";

/**
 * The Config Service holds the AppConfig and Secrets Manager resources.
 * These are used to store configuration data and secrets that are used
 * by the various Lambda functions in the stack.
 */
export class ConfigService extends Construct {
  /**
   * Reference to the AppConfig resources deployed to the stack
   */
  public readonly appconfig: AppConfigResources;
  /**
   * Reference to the Secrets Manager secret that contains the Snowflake account, user, and password
   */
  public readonly secret: ISecret;

  public constructor(scope: Construct, id: string, props: ConfigServiceProps) {
    super(scope, id);

    const { accountUserPassSecretName } = props;

    // Create the AppConfig resources
    this.appconfig = new AppConfigResources(this, "AppConfigResources", {
      applicationName: `${powertoolsServiceName}-${environment}`, // This allows us to deploy multiple environments of the same service
      environmentName: environment,
    });

    // Import the Secrets Manager secret that contains the Snowflake account, user, and password
    this.secret = Secret.fromSecretNameV2(
      this,
      "AccountUserPass-Secret",
      accountUserPassSecretName
    );
  }
}
