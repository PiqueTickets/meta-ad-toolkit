import { z } from "zod";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { MetaApi, MetaApiError, MetaApiResult } from "../meta-api.js";

const fileInputSchema = z.object({ file_path: z.string().min(1) });
type FileInput = z.infer<typeof fileInputSchema>;

interface VideoUploadResponse {
  id: string;
}

interface ImageUploadResponse {
  images: Record<string, { hash: string }>;
}

function fileNotFoundError(path: string): MetaApiError {
  return {
    ok: false,
    error: {
      message: `File not found: ${path}`,
      code: -1,
      type: "FileNotFound",
      retryable: false,
    },
  };
}

function fileReadError(path: string, cause: string): MetaApiError {
  return {
    ok: false,
    error: {
      message: `Failed to read file ${path}: ${cause}`,
      code: -2,
      type: "FileReadError",
      retryable: false,
    },
  };
}

async function readFileSafely(
  path: string,
): Promise<{ ok: true; bytes: Buffer; name: string } | MetaApiError> {
  try {
    const bytes = await readFile(path);
    return { ok: true, bytes, name: basename(path) };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return fileNotFoundError(path);
    return fileReadError(path, e.message ?? String(err));
  }
}

export const uploadVideoTool = {
  name: "upload_video",
  description: "Upload a local video file to Meta and return its video_id.",
  inputSchema: fileInputSchema,

  async handler(
    input: FileInput,
    api: MetaApi,
  ): Promise<MetaApiResult<VideoUploadResponse>> {
    const read = await readFileSafely(input.file_path);
    if (!read.ok) return read;

    const form = new FormData();
    // node Buffer is a valid BlobPart at runtime
    const blob = new Blob([read.bytes as unknown as BlobPart]);
    form.set("source", blob, read.name);
    return api.postMultipart<VideoUploadResponse>(
      `/${api.accountPath}/advideos`,
      form,
    );
  },
};

export const uploadImageTool = {
  name: "upload_image",
  description: "Upload a local image file to Meta and return its image hash.",
  inputSchema: fileInputSchema,

  async handler(
    input: FileInput,
    api: MetaApi,
  ): Promise<MetaApiResult<ImageUploadResponse>> {
    const read = await readFileSafely(input.file_path);
    if (!read.ok) return read;

    const form = new FormData();
    // node Buffer is a valid BlobPart at runtime
    const blob = new Blob([read.bytes as unknown as BlobPart]);
    form.set("filename", blob, read.name);
    return api.postMultipart<ImageUploadResponse>(
      `/${api.accountPath}/adimages`,
      form,
    );
  },
};
