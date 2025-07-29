import type { IncomingMessage, ServerResponse } from "node:http";
import { URLSearchParams } from "node:url";

/**
 * Extend Node.js IncomingMessage to include parsed query and body properties.
 */
declare module "node:http" {
  interface IncomingMessage {
    /**
     * Parsed query parameters (last value wins) from the URL search string.
     */
    query?: any;

    /**
     * Parsed body parameters (last value wins) from a form-urlencoded POST.
     */
    body?: any;
  }
}

type AccessResult = string;

/**
 * Configuration options for the HTTP Parameter Pollution (HPP) middleware.
 */
export type HppOptions = {
  /**
   * Enable HPP protection for URL query parameters.
   * @default true
   */
  checkQuery?: boolean;

  /**
   * Custom function to extract the raw query string from the request.
   * @default defaultAccessor (reads req.url search part)
   */
  accessQuery?: <T extends IncomingMessage>(req: T) => AccessResult;

  /**
   * Enable HPP protection for URL-encoded request bodies.
   * @default false
   */
  checkBody?: boolean;

  /**
   * Custom function to extract the raw body string from the request.
   * @default defaultAccessor (reads req.url search part)
   */
  accessBody?: <T extends IncomingMessage>(req: T) => AccessResult;
};

/**
 * Default extractor: reads the URL search string from req.url.
 * Returns an empty string if req.url is not defined.
 *
 * @param req - IncomingMessage instance
 * @returns The raw search string, including leading '?', or empty string.
 */
function defaultAccessor(req: IncomingMessage): string {
  if (!req.url) return "";
  // Ensure URL constructor has a base if req.url is relative
  const url = new URL(req.url);
  return url.search;
}

/**
 * Determine if the Content-Type header indicates an URL-encoded form.
 * Handles optional charset suffixes like `; charset=UTF-8`.
 *
 * @param ct - The raw Content-Type header value
 * @returns True if the content type is application/x-www-form-urlencoded
 */
function isFormUrlencoded(ct?: string): boolean {
  return !!(
    ct?.split(";")?.[0]?.trim().toLowerCase() ===
    "application/x-www-form-urlencoded"
  );
}

/**
 * Create a middleware to strip HTTP Parameter Pollution (HPP) from queries and bodies.
 *
 * Collapses repeated parameters to their last occurrence by default.
 * Works with raw Node.js HTTP servers or integrated into Express, Fastify, Koa, etc.
 *
 * @param options - HPP configuration options
 * @returns A middleware function (req, res, next)
 */
export default function hpp({
  checkQuery = true,
  checkBody = false,
  accessQuery = defaultAccessor,
  accessBody = defaultAccessor,
}: HppOptions = {}) {
  /**
   * Parse a raw URL-encoded string into an object, keeping only the last value for each key.
   *
   * @param str - The URL-encoded input string
   * @returns An object mapping parameter names to their last value
   */
  function parse(str: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(str).entries());
  }

  /**
   * The actual middleware function.
   *
   * @param req - Incoming HTTP request
   * @param _res - HTTP response (unused)
   * @param next - Callback to pass control to the next handler
   */
  return function (
    req: IncomingMessage,
    _res: ServerResponse,
    next: (err?: any) => void
  ): void {
    // If both checks are disabled, skip parsing entirely
    if (!checkQuery && !checkBody) return next();

    // Query string HPP
    if (checkQuery) {
      const rawQuery = accessQuery(req);
      if (rawQuery) {
        req.query = parse(rawQuery);
      }
    }

    // Body HPP for URL-encoded POSTs
    if (
      checkBody &&
      req.method?.toLowerCase() === "post" &&
      isFormUrlencoded(req.headers["content-type"])
    ) {
      const rawBody = accessBody(req);
      if (rawBody) {
        req.body = parse(rawBody);
      }
    }

    // Pass control to next
    next();
  };
}
