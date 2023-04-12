import type { StackProps } from "aws-cdk-lib";

interface ConfigServiceProps extends StackProps {
  /**
   * The name of the Secrets Manager secret that contains the Snowflake account, user, and password
   */
  accountUserPassSecretName: string;
}

interface AppConfigResourcesProps extends StackProps {
  /**
   * The name of the AppConfig application
   */
  applicationName: string;
  /**
   * The name of the AppConfig environment
   */
  environmentName: string;
}

interface AddConfigProfileInput {
  /**
   * The name of the AppConfig configuration profile
   */
  name: string;
  /**
   * The type of AppConfig configuration profile
   */
  type: "AWS.Freeform" | "AWS.AppConfig.FeatureFlags";
  /**
   * The content of the AppConfig configuration profile
   */
  content: Record<string, unknown>;
}

export { ConfigServiceProps, AppConfigResourcesProps, AddConfigProfileInput };
