import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let cachedSecret = null;

export async function getJwtSecret() {
  if (cachedSecret) return cachedSecret;

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION,
  });

  const command = new GetSecretValueCommand({
    SecretId: process.env.AWS_SECRET_NAME,
  });

  const response = await client.send(command);

  const secretObject = JSON.parse(response.SecretString);

  cachedSecret = secretObject.JWT_SECRET;

  return cachedSecret;
}
