import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let cachedSecrets = null;

/**
 * Obtiene todos los secretos desde AWS Secrets Manager
 * Los secretos se cachean para evitar múltiples llamadas
 */
export async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;

  // Soportar nombres de variables con y sin prefijo AWS_
  const region = process.env.SECRETS_REGION || process.env.AWS_REGION || 'us-east-1';
  const secretName = process.env.SECRET_NAME || process.env.AWS_SECRET_NAME || 'pedidos/prod/all-secrets';

  const client = new SecretsManagerClient({
    region: region,
  });

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);
    const secretObject = JSON.parse(response.SecretString);

    cachedSecrets = secretObject;
    return cachedSecrets;
  } catch (error) {
    console.error('❌ Error obteniendo secretos de AWS:', error.message);
    throw error;
  }
}

/**
 * Obtiene el JWT Secret (compatibilidad con código existente)
 */
export async function getJwtSecret() {
  const secrets = await getSecrets();
  return secrets.JWT_SECRET;
}

/**
 * Obtiene la API Key de Google Maps
 */
export async function getGoogleMapsApiKey() {
  const secrets = await getSecrets();
  return secrets.GOOGLE_MAPS_API_KEY;
}

/**
 * Obtiene las credenciales de Google Service Account como JSON string
 */
export async function getGoogleServiceAccountJson() {
  const secrets = await getSecrets();
  return secrets.GOOGLE_SERVICE_ACCOUNT_JSON;
}

/**
 * Obtiene las credenciales de Google Service Account como objeto
 */
export async function getGoogleServiceAccount() {
  const json = await getGoogleServiceAccountJson();
  return JSON.parse(json);
}

/**
 * Obtiene un secreto específico por nombre
 */
export async function getSecret(name) {
  const secrets = await getSecrets();
  return secrets[name];
}

/**
 * Limpia el caché (útil para testing)
 */
export function clearCache() {
  cachedSecrets = null;
}
