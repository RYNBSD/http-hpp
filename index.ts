import type { IncomingMessage, ServerResponse } from "node:http";
import { URLSearchParams } from "node:url";

declare module "node:http" {
  interface IncomingMessage {
    query?: any;
    body?: any;
  }
}

type AccessResult = string;

export type HppOptions = {
  checkQuery?: boolean;
  accessQuery?: <T extends IncomingMessage>(req: T) => AccessResult;

  checkBody?: boolean;
  accessBody?: <T extends IncomingMessage>(req: T) => AccessResult;
};

function defaultAccessor(req: IncomingMessage) {
  if (!req.url) return "";
  const url = new URL(req.url);
  return url.search;
}

function isFormUrlencoded(ct?: string): boolean {
  return !!(
    ct?.split(";")?.[0]?.trim().toLowerCase() ===
    "application/x-www-form-urlencoded"
  );
}

export default function hpp({
  checkQuery = true,
  checkBody = false,
  accessQuery = defaultAccessor,
  accessBody = defaultAccessor,
}: HppOptions = {}) {
  function parse(str: string) {
    return Object.fromEntries(new URLSearchParams(str).entries());
  }

  return function hppMiddleware(
    req: IncomingMessage,
    _res: ServerResponse,
    next: (err?: any) => void
  ) {
    if (!checkQuery && !checkBody) return next();

    if (checkQuery) {
      const query = accessQuery(req);
      if (!query) return next();

      req.query = parse(query);
    }

    if (
      checkBody &&
      req.method?.toLowerCase() === "post" &&
      isFormUrlencoded(req.headers["content-type"])
    ) {
      const body = accessBody(req);
      if (!body) return next();

      req.body = parse(body);
    }

    next();
  };
}
