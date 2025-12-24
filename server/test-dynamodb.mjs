import dotenv from 'dotenv';
dotenv.config();
import { getUserByUsername } from './utils/dynamodb.js';

getUserByUsername('hogarvitaminas')
  .then(u => {
    console.log('✅ Usuario desde DynamoDB:');
    console.log(JSON.stringify(u, null, 2));
  })
  .catch(err => {
    console.error('💥 Error probando DynamoDB:', err.message);
  });
