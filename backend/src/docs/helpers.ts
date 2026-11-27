export type Json = Record<string, unknown>;

export const ref = (name: string): Json => ({
  $ref: `#/components/schemas/${name}`,
});

const withDesc = (
  type: string,
  description?: string,
  extra: Json = {},
): Json => ({
  type,
  ...(description ? { description } : {}),
  ...extra,
});

export const str = (description?: string, extra: Json = {}) =>
  withDesc("string", description, extra);
export const int = (description?: string, extra: Json = {}) =>
  withDesc("integer", description, extra);
export const num = (description?: string, extra: Json = {}) =>
  withDesc("number", description, extra);
export const bool = (description?: string) => withDesc("boolean", description);
export const date = (description?: string) =>
  str(description, { format: "date-time" });
export const enumOf = (values: string[], description?: string) =>
  str(description, { enum: values });
export const arr = (items: Json): Json => ({ type: "array", items });
export const obj = (
  properties: Record<string, Json> = {},
  required: string[] = [],
): Json => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

export const envelope = (data?: Json): Json =>
  obj({
    status: enumOf(["success"]),
    message: str(),
    ...(data ? { data } : {}),
  });

export const pathParam = (
  name: string,
  description: string,
  extra: Json = {},
): Json => ({
  name,
  in: "path",
  required: true,
  description,
  schema: str(undefined, extra),
});

export const queryParam = (
  name: string,
  schema: Json,
  description: string,
): Json => ({
  name,
  in: "query",
  required: false,
  description,
  schema,
});

export const pageParams: Json[] = [
  { $ref: "#/components/parameters/Page" },
  { $ref: "#/components/parameters/Limit" },
];

const errorRefs: Record<number, string> = {
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  409: "Conflict",
  429: "TooManyRequests",
  502: "BadGateway",
};

export const errors = (...codes: number[]): Json =>
  Object.fromEntries(
    [...codes]
      .sort((a, b) => a - b)
      .map((c) => [
        String(c),
        { $ref: `#/components/responses/${errorRefs[c]}` },
      ]),
  );

interface OpInput {
  tag: string;
  summary: string;
  description?: string;
  auth?: "none" | "user" | "admin" | "cookie";
  parameters?: Json[];
  body?: Json;
  example?: unknown;
  success: {
    code?: number;
    description: string;
    schema?: Json;
    content?: Json;
  };
  errors?: number[];
}

export const op = (i: OpInput): Json => {
  const auth = i.auth ?? "user";
  const codes = new Set<number>(i.errors ?? []);
  if (auth === "user" || auth === "admin") codes.add(401);
  if (auth === "admin") codes.add(403);

  const security =
    auth === "none"
      ? []
      : auth === "cookie"
        ? [{ cookieAuth: [] }]
        : [{ bearerAuth: [] }];
  const description = [
    auth === "admin" ? "**Admin only.**" : "",
    i.description ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    tags: [i.tag],
    summary: i.summary,
    ...(description ? { description } : {}),
    security,
    ...(i.parameters ? { parameters: i.parameters } : {}),
    ...(i.body
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: i.body,
                ...(i.example !== undefined ? { example: i.example } : {}),
              },
            },
          },
        }
      : {}),
    responses: {
      [String(i.success.code ?? 200)]: {
        description: i.success.description,
        content: i.success.content ?? {
          "application/json": { schema: i.success.schema ?? ref("Success") },
        },
      },
      ...errors(...codes),
    },
  };
};
