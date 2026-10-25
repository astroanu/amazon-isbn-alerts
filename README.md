# amazon-alerts

Periodic AWS Lambda (Node 22, TypeScript, CDK) that checks Amazon product pages by ISBN and emails you when they are in stock.

## Deploy
```
npm install
npx cdk bootstrap   # once
npx cdk deploy [-c schedule="rate(30 minutes)"]
```
Default schedule: `rate(1 hour)`.

## Config
Upload `config.json` to the bucket printed as `ConfigBucketName`:
```json
{
  "market": "amazon.nl",
  "isbns": ["9780140328721"],
  "email": "you@example.com",
  "senderEmail": "you@example.com",
  "sesRegion": "eu-west-1"
}
```
Sender and recipient must be verified in Amazon SES (sandbox mode). Amazon may block automated requests (HTTP 503/captcha); such failures are logged.
