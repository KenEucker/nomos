import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

export type SignedUpload = {
  token: string;
  key: string;
  contentType: string;
  sizeBytes: number;
  expiresAt: number;
};

export type SignedUploadResponse = {
  uploadUrl: string;
  key: string;
  headersToInclude?: Record<string, string>;
};

export class LocalStorageProvider {
  private baseDir: string;
  private signedUploads = new Map<string, SignedUpload>();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  signPut(payload: { key: string; contentType: string; sizeBytes: number }): SignedUploadResponse {
    const token = nanoid();
    const expiresAt = Date.now() + 1000 * 60 * 10;
    this.signedUploads.set(token, { token, expiresAt, ...payload });
    return {
      uploadUrl: `/api/uploads/${encodeURIComponent(payload.key)}?token=${token}`,
      key: payload.key,
      headersToInclude: { "content-type": payload.contentType }
    };
  }

  verifyPut(token: string, key: string) {
    const entry = this.signedUploads.get(token);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.signedUploads.delete(token);
      return null;
    }
    if (entry.key !== key) return null;
    return entry;
  }

  finalize(token: string) {
    this.signedUploads.delete(token);
  }

  async writeFile(key: string, data: Buffer) {
    const target = path.join(this.baseDir, key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, data);
  }

  async readFile(key: string) {
    const target = path.join(this.baseDir, key);
    return fs.promises.readFile(target);
  }

  async delete(key: string) {
    const target = path.join(this.baseDir, key);
    await fs.promises.rm(target, { force: true });
  }

  exists(key: string) {
    return fs.existsSync(path.join(this.baseDir, key));
  }
}
