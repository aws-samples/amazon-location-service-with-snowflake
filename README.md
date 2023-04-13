# Amazon Location Service with Snowflake

This repository contains a reference CDK stack that demonstrates how to create an integration between [Amazon Location Service](https://aws.amazon.com/location/) and [Snowflake](https://www.snowflake.com/). The integration is implemented using a set of custom [Snowflake external functions](https://docs.snowflake.com/en/sql-reference/external-functions-introduction.html) that call the [Amazon Location Service API](https://docs.aws.amazon.com/location/latest/developerguide/what-is.html) via a [Snowflake API integration](https://docs.snowflake.com/en/user-guide/api-integration-intro.html) proxied through [AWS API Gateway](https://aws.amazon.com/api-gateway/).

## Architecture

![Architecture Diagram](./assets/architecture.png)

The architecture is composed of the following components:
- A Snowflake database and warehouse
- An Amazon API Gateway endpoint that proxies request to your AWS account
- A set of Amazon Location Service place indexes to geocode and reverse geocode addresses
- A set of AWS AppConfig configurations to store the Amazon Location Service place indexes and the Snowflake database and warehouse names
- An AWS Secrets Manager secret to store the Snowflake credentials

> **Note**
> This architecture will create resources that will incur costs. Please refer to the [AWS Pricing](https://aws.amazon.com/pricing/) page for details and ensure you understand the costs before deploying this stack. Additionally, be aware that a trusted relationship is created between the Snowflake account and the AWS account. This means that any user in the Snowflake account will be able to access the AWS account. Please refer to the [Snowflake documentation](https://docs.snowflake.com/en/sql-reference/external-functions-creating-aws-planning) for more information and consider consulting your security team before deploying this stack.

## Geocoding and Reverse Geocoding with Amazon Location Service

TODO: Add description of geocoding and reverse geocoding (**Note to reviewer** - If you are not familiar with these concepts, please refer to the [Amazon Location Service documentation - How it works](https://docs.aws.amazon.com/location/latest/developerguide/how-it-works.html))
TODO: Explain what functions are available and how to use them (**Note to reviewer** - You can check the `functions/commons/snowflake-helpers.ts` file for the list of functions available)

## Getting Started

### Prerequisites

In order to deploy this stack, you will need the following:
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) installed and configured
- A [Snowflake](https://www.snowflake.com/) account (sign up for a free trial [here](https://signup.snowflake.com/))
- An AWS account (create one [here](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/))
- Node.js 16.x or later install [here](https://nodejs.org/en/download/) or via [nvm]([http](https://github.com/nvm-sh/nvm))/[fnm](https://github.com/Schniz/fnm)

### Prepare the Snowflake environment

In this section, you will create a new Snowflake warehouse and database to host the external functions and API integration. If you already have a Snowflake account, you can skip this section and use an existing database and warehouse.

1. Create a data warehouse

```sql
CREATE WAREHOUSE MY_WAREHOUSE
  WITH WAREHOUSE_SIZE = 'XSMALL'
  WAREHOUSE_TYPE = 'STANDARD'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  MIN_CLUSTER_COUNT = 1
  MAX_CLUSTER_COUNT = 3
  SCALING_POLICY = 'ECONOMY'
  INITIALLY_SUSPENDED = TRUE;
```

2. Create a database and schema

```sql
USE WAREHOUSE MY_WAREHOUSE;
CREATE DATABASE IF NOT EXISTS MY_DATABASE;
CREATE SCHEMA IF NOT EXISTS MY_DATABASE.MY_SCHEMA;
```

Write down the name of the database and warehouse you created. You will need these names later.

### Prepare the AWS environment

> **Note**
> This section assumes that you already have an AWS account and that you have enough permissions to create and manage AWS Secrets Manager secrets. To create a secret, you need the permissions granted by the `SecretsManagerReadWrite` [AWS managed policies](https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_available-policies.html).

1. Create an AWS Secrets Manager secret

In this section, you will create a new AWS Secrets Manager secret to store the Snowflake credentials. These credentials will be used by the stack to create the Snowflake API integration and external functions in the next section.

Follow the instructions [here](https://docs.aws.amazon.com/secretsmanager/latest/userguide/manage_create-basic-secret.html) to create a new AWS Secrets Manager secret.

The secret should contain the following key-value pairs:
- `account`: The name of your Snowflake account (more info [here](https://docs.snowflake.com/en/user-guide/admin-account-identifier))
- `username`: The username of a Snowflake user with the `CREATE EXTERNAL FUNCTION` and `CREATE INTEGRATION` [privileges](https://docs.snowflake.com/en/sql-reference/sql/create-external-function.html#privileges)
- `password`: The password of the Snowflake user

![AWS Secrets Manager secret](./assets/create-secret.png)

When creating the secret, make sure to select the `Other type of secrets` option and note the secret name. You will need this name in the next section.

2. Review Amazon Location Service quotas

The stack will create one place index for each provider available in the region you deploy the stack to. These place indexes will be used by the external functions to perform geocoding and reverse geocoding. 

The default [Amazon Location Service quotas](https://docs.aws.amazon.com/location/latest/developerguide/location-quotas.html) implement rate limits for the operations performed by the external functions. The default quotas allow 50 requests per second for both the `SearchPlaceIndexForPosition` and `SearchPlaceIndexForText` operations. Depending on the size of your queries, you might need to increase these limits, you can request a quota increase by following the instructions [here](https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html).

If you simply follow the instructions in this guide, you should not exceed the default quotas. However, if you plan to use the external functions in a production environment, you should review the default quotas and request a quota increase if necessary.

### Deployment

1. Clone this repository

```bash
git clone git@github.com:aws-samples/amazon-location-service-with-snowflake.git
```

2. Install dependencies

```bash
cd amazon-location-service-with-snowflake
npm ci
```

3. Deploy the stack 

In this step, you will deploy the CDK stack to your AWS account. In order to do so, you will need to provide the following parameters:
- `AccountUserPassSecretNameParam` - The name of the AWS Secrets Manager secret that you created in the previous section
- `ApiIntegrationNameParam` - The name of the Snowflake API integration that will be created by the stack
- `SnowflakeWarehouseParam` - The name of the Snowflake warehouse that you created in the previous section
- `SnowflakeDatabaseParam` - The name of the Snowflake database that you created in the previous section

```bash
cd infrastructure
npx cdk deploy --parameters AccountUserPassSecretNameParam=<SECRET_NAME> --parameters ApiIntegrationNameParam=<INTEGRATION_NAME> --parameters SnowflakeWarehouseParam=<WAREHOUSE_NAME> --parameters SnowflakeDatabaseParam=<DATABASE_NAME> --parameters SnowflakeSchemaParam=<SCHEMA_NAME>
```

> **Note**
> The stack will take under 10 minutes to deploy. During this time, please do not close the terminal window. If the deployment fails, check the CloudFormation console for more information.

### Use the external functions

1. Confirm that the API integration and external functions were created successfully

```sql
USE WAREHOUSE MY_WAREHOUSE;
USE DATABASE MY_DATABASE;
SHOW API INTEGRATIONS;
```

and

```sql
USE WAREHOUSE MY_WAREHOUSE;
USE DATABASE MY_DATABASE;
SHOW EXTERNAL FUNCTIONS;
```

1. Create a sample table

```sql
USE WAREHOUSE MY_WAREHOUSE;
USE DATABASE MY_DATABASE;
CREATE OR REPLACE TABLE MY_SCHEMA.COORDINATES (
  ID INTEGER,
  LONGITUDE FLOAT,
  LATITUDE FLOAT,
  ADDRESS VARCHAR(255),
  CONTROL VARCHAR(255)
);
```

1. Insert some sample data

```sql
INSERT INTO MY_SCHEMA.COORDINATES (ID, LONGITUDE, LATITUDE, CONTROL)
VALUES (1, 13.404954, 52.520008, 'Berlin'),
       (2, 2.352222, 48.856614, 'Paris'),
       (3, -74.005973, 40.712775, 'New York'),
       (4, -0.127758, 51.507351, 'London'),
       (5, 12.496366, 41.902782, 'Rome'),
       (6, -99.133209, 19.432608, 'Mexico City'),
       (7, 139.691706, 35.689487, 'Tokyo'),
       (8, 126.977969, 37.566535, 'Seoul'),
       (9, 116.407395, 39.904211, 'Beijing'),
       (10, 31.235712, 30.044420, 'Cairo');
```

4. Use the external functions

```sql
SELECT reverse_geocode_amazon_location_service_provider_here(LONGITUDE, LATITUDE) AS ADDRESS, LONGITUDE, LATITUDE FROM MY_SCHEMA.COORDINATES;
```

![Snowflake Dashboard](./assets/query-results.png)

### Cleanup

To avoid incurring unnecessary charges, you should delete the stack as well as the AWS Secrets Manager secret and Snowflake warehouse and database that you created in the previous sections.

To delete the stack and all of its resources, run the following command and confirm the deletion when prompted:

```bash
cd infrastructure
npx cdk destroy
```

To delete the AWS Secrets Manager secret, follow the instructions [here](https://docs.aws.amazon.com/secretsmanager/latest/userguide/manage_delete-secret.html). Alternatively, you can permanently delete the secret by running the following command:

```bash
aws secretsmanager delete-secret --secret-id <SECRET_NAME> --force-delete-without-recovery
```

To delete the Snowflake warehouse and database, follow the instructions [here](https://docs.snowflake.com/en/sql-reference/sql/drop-warehouse.html) and [here](https://docs.snowflake.com/en/sql-reference/sql/drop-database.html), respectively.

### License

This library is licensed under the MIT-0 License. See the [LICENSE](./LICENSE) file.
