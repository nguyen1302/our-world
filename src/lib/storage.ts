import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getConfig } from "./config";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
};

export function extForContentType(contentType: string): string {
  return EXT_BY_MIME[contentType.toLowerCase()] ?? "bin";
}

export function originalKey(spaceId: string, id: string, contentType: string): string {
  return `originals/${spaceId}/${id}.${extForContentType(contentType)}`;
}

export function thumbKey(spaceId: string, id: string): string {
  return `thumbs/${spaceId}/${id}.webp`;
}

export function audioKey(spaceId: string, id: string, contentType: string): string {
  return `audio/${spaceId}/${id}.${extForContentType(contentType)}`;
}

export interface StorageProvider {
  presignPut(key: string, contentType: string): Promise<string>;
  presignGet(key: string, expiresSeconds?: number): Promise<string>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
}

class S3Provider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const cfg = getConfig().s3;
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
          : undefined,
    });
  }

  async presignPut(key: string, contentType: string): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, cmd, { expiresIn: 900 });
  }

  async presignGet(key: string, expiresSeconds = 3600): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
}

let _storage: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!_storage) _storage = new S3Provider();
  return _storage;
}
