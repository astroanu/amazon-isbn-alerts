import * as cdk from "aws-cdk-lib";
import { AmazonAlertsStack } from "../lib/amazon-alerts-stack";

const app = new cdk.App();
new AmazonAlertsStack(app, "AmazonAlertsStack");
