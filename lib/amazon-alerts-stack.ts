import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class AmazonAlertsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const configBucket = new s3.Bucket(this, "ConfigBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const configKey = "config.json";
    const fn = new NodejsFunction(this, "CheckerFunction", {
      entry: "src/handler.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: {
        CONFIG_BUCKET: configBucket.bucketName,
        CONFIG_KEY: configKey,
      },
    });
    configBucket.grantRead(fn, configKey);
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    const schedule = this.node.tryGetContext("schedule") ?? "rate(1 day)";
    new events.Rule(this, "Schedule", {
      schedule: events.Schedule.expression(schedule),
      targets: [new targets.LambdaFunction(fn)],
    });

    new cdk.CfnOutput(this, "ConfigBucketName", { value: configBucket.bucketName });
  }
}
