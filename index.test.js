import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import hpp from "./dist/esm/index.js";

const safeQuery = "param0=PhD&param1=Alice&param2=40";
const safeUrl = `http://localhost:3000/?${safeQuery}`;

const unsafeQuery = `param0=PhD&param1=John&param1=Alice&param2=40&param3=${encodeURIComponent(
  ["John", "Alice"]
)}&param4=${encodeURIComponent("['John', 'Alice']")}&param5=`;
const unsafeUrl = `http://localhost:3000/?${unsafeQuery}`;

let req = {};

describe("HPP Middleware", () => {
  beforeEach(() => {
    req = {};
  });

  it("none", () => {
    hpp({ checkBody: false, checkQuery: false })(req, {}, () => {});
    assert.deepEqual(req, {});
  });

  it("query no risks", () => {
    req.url = safeUrl;

    hpp({ checkBody: false })(req, {}, () => {});
    delete req.url;

    assert.deepEqual(req, {
      query: {
        param0: "PhD",
        param1: "Alice",
        param2: "40",
      },
    });
  });

  it("query all risks", () => {
    req.url = unsafeUrl;

    hpp({ checkBody: false })(req, {}, () => {});
    delete req.url;

    assert.deepEqual(req, {
      query: {
        param5: "",
        param0: "PhD",
        param1: "Alice",
        param3: "John,Alice",
        param2: "40",
        param4: "['John', 'Alice']",
      },
    });
  });

  it("percent-encoding and '+' handling", () => {
    const q = "foo=bar%20baz&foo=qux+quux";
    req.url = `http://localhost:3000/?${q}`;

    hpp({ checkBody: false })(req, {}, () => {});
    delete req.url;

    assert.deepEqual(req.query, { foo: "qux quux" });
  });

  it("empty values and missing equals", () => {
    const q = "param6&param7=";
    req.url = `http://localhost:3000/?${q}`;

    hpp({ checkBody: false })(req, {}, () => {});
    delete req.url;
    
    assert.deepEqual(req.query, { param6: "", param7: "" });
  });

  it("malformed query strings", () => {
    const q = "&&&=value&foo=bar&=baz";
    req.url = `http://localhost:3000/?${q}`;

    hpp({ checkBody: false })(req, {}, () => {});
    delete req.url;
    
    assert.deepEqual(req.query, { foo: "bar", "": "baz" });
  });

  it("parameter re-injection attempts", () => {
    const q = "username=admin&role=admin&username=guest";
    req.url = `http://localhost:3000/?${q}`;

    hpp({ checkBody: false })(req, {}, () => {});
    delete req.url;

    assert.deepEqual(req.query, { role: "admin", username: "guest" });
  });

  it("body no risks", () => {
    req.url = safeUrl;
    req.body = Buffer.from(safeQuery);
    req.headers = {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    };
    req.method = "PosT";

    hpp({
      checkQuery: false,
      checkBody: true,
      accessBody: (req) => req.body.toString(),
    })(req, {}, () => {});
    delete req.url;
    delete req.headers;
    delete req.method;

    assert.deepEqual(req, {
      body: { param0: "PhD", param1: "Alice", param2: "40" },
    });
  });

  it("body all risks", () => {
    req.url = unsafeUrl;
    req.body = Buffer.from(unsafeQuery);
    req.headers = {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
    };
    req.method = "POST";

    hpp({
      checkQuery: false,
      checkBody: true,
      accessBody: (req) => req.body.toString(),
    })(req, {}, () => {});
    delete req.url;
    delete req.headers;
    delete req.method;

    assert.deepEqual(req, {
      body: {
        param5: "",
        param0: "PhD",
        param1: "Alice",
        param3: "John,Alice",
        param4: "['John', 'Alice']",
        param2: "40",
      },
    });
  });

  it("query/body performance (all risks)", () => {
    req.url = unsafeUrl;
    req.body = Buffer.from(unsafeQuery);
    req.headers = { "content-type": "application/x-www-form-urlencoded" };
    req.method = "POST";

    const hppMiddleware = hpp({
      checkBody: true,
      accessBody: (req) => req.body?.toString(),
    });
    const res = {};
    const next = () => {};

    const allDurationsMs = []; // number[]
    const startTest = process.hrtime();

    for (let i = 0; i < 1_000_000; i++) {
      const startTime = process.hrtime();

      hppMiddleware(req, res, next);

      const endTime = process.hrtime(startTime);
      const durationMs = endTime[0] * 1000 + endTime[1] / 1000000;

      allDurationsMs.push(durationMs);
    }

    const endTest = process.hrtime(startTest);
    const totalDurationMs = endTest[0] * 1000 + endTest[1] / 1000000;
    console.log(`Total performance test duration (query/body): ${totalDurationMs} ms`);

    const minDurationMs = allDurationsMs.reduce(
      (min, duration) => Math.min(min, duration),
      Infinity
    );
    const maxDurationMs = allDurationsMs.reduce(
      (max, duration) => Math.max(max, duration),
      -Infinity
    );
    const sumDurationMs = allDurationsMs.reduce((a, b) => a + b, 0);
    const averageDurationMs = sumDurationMs / allDurationsMs.length;

    console.log(
      `Min Performance, test completed (query/body) in ${minDurationMs} ms`
    );
    console.log(
      `Avg Performance, test completed (query/body) in ${averageDurationMs} ms`
    );
    console.log(
      `Max Performance, test completed (query/body) in ${maxDurationMs} ms`
    );
  });

  it("query performance (all risks)", () => {
    req.url = unsafeUrl;

    const hppMiddleware = hpp();
    const res = {};
    const next = () => {};

    const allDurationsMs = []; // number[]
    const startTest = process.hrtime();

    for (let i = 0; i < 1_000_000; i++) {
      const startTime = process.hrtime();

      hppMiddleware(req, res, next);

      const endTime = process.hrtime(startTime);
      const durationMs = endTime[0] * 1000 + endTime[1] / 1000000;

      allDurationsMs.push(durationMs);
    }

    const endTest = process.hrtime(startTest);
    const totalDurationMs = endTest[0] * 1000 + endTest[1] / 1000000;
    console.log(`Total performance test duration (query): ${totalDurationMs} ms`);

    const minDurationMs = allDurationsMs.reduce(
      (min, duration) => Math.min(min, duration),
      Infinity
    );
    const maxDurationMs = allDurationsMs.reduce(
      (max, duration) => Math.max(max, duration),
      -Infinity
    );
    const sumDurationMs = allDurationsMs.reduce((a, b) => a + b, 0);
    const averageDurationMs = sumDurationMs / allDurationsMs.length;

    console.log(
      `Min Performance, test completed (query) in ${minDurationMs} ms`
    );
    console.log(
      `Avg Performance, test completed (query) in ${averageDurationMs} ms`
    );
    console.log(
      `Max Performance, test completed (query) in ${maxDurationMs} ms`
    );
  });

  it("body performance (all risks)", () => {
    req.url = unsafeUrl;
    req.body = Buffer.from(unsafeQuery);

    const hppMiddleware = hpp({
      checkQuery: false,
      checkBody: true,
      accessBody: (req) => req.body?.toSting(),
    });
    const res = {};
    const next = () => {};

    const allDurationsMs = []; // number[]
    const startTest = process.hrtime();

    for (let i = 0; i < 1_000_000; i++) {
      const startTime = process.hrtime();

      hppMiddleware(req, res, next);

      const endTime = process.hrtime(startTime);
      const durationMs = endTime[0] * 1000 + endTime[1] / 1000000;

      allDurationsMs.push(durationMs);
    }

    const endTest = process.hrtime(startTest);
    const totalDurationMs = endTest[0] * 1000 + endTest[1] / 1000000;
    console.log(`Total performance test duration (body): ${totalDurationMs} ms`);

    const minDurationMs = allDurationsMs.reduce(
      (min, duration) => Math.min(min, duration),
      Infinity
    );
    const maxDurationMs = allDurationsMs.reduce(
      (max, duration) => Math.max(max, duration),
      -Infinity
    );
    const sumDurationMs = allDurationsMs.reduce((a, b) => a + b, 0);
    const averageDurationMs = sumDurationMs / allDurationsMs.length;

    console.log(
      `Min Performance, test completed (body) in ${minDurationMs} ms`
    );
    console.log(
      `Avg Performance, test completed (body) in ${averageDurationMs} ms`
    );
    console.log(
      `Max Performance, test completed (body) in ${maxDurationMs} ms`
    );
  });
});
