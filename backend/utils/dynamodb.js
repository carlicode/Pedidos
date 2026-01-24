import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

const docClient = DynamoDBDocumentClient.from(client);

export async function getUserByUsername(username) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: { username },
      })
    );

    return result.Item || null;
  } catch (err) {
    console.error("❌ DynamoDB getUserByUsername error:", err);
    throw err;
  }
}

