import type { IncomingMessage, ServerResponse } from "node:http";
import { URLSearchParams } from "node:url";
// import { parse as parseQuery } from "node:querystring";

// type PollutedParam = Record<string, string | string[] | undefined>;

declare module "node:http" {
  interface IncomingMessage {
    query?: any;
    // queryPolluted?: PollutedParam;
    body?: any;
    // bodyPolluted?: PollutedParam;
  }
}

type AccessResult = string;

export type HppOptions = {
  checkQuery?: boolean;
  // includeQueryPolluted?: boolean;
  accessQuery?: <T extends IncomingMessage>(req: T) => AccessResult;

  checkBody?: boolean;
  // includeBodyPolluted?: boolean;
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
  // includeQueryPolluted = false,
  checkBody = false,
  // includeBodyPolluted = false,
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
      // if (includeQueryPolluted) {
      //   req.queryPolluted = parseQuery(query);
      // }
    }

    if (
      checkBody &&
      req.method?.toLowerCase() === "post" &&
      isFormUrlencoded(req.headers["content-type"])
    ) {
      const body = accessBody(req);
      if (!body) return next();

      req.body = parse(body);
      // if (includeBodyPolluted) {
      //   req.bodyPolluted = parseQuery(body);
      // }
    }

    next();
  };
}
