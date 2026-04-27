import { Provider } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = 'S3_CLIENT';

export const S3Provider: Provider = {
  provide: S3_CLIENT,
  useFactory: () => {
    const client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-7',
      ...(process.env.S3_ENDPOINT
        ? {
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: true,
          }
        : {}),
    });
    return client;
  },
};
