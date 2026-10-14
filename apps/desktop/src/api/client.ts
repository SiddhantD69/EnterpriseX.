export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorResponse = {
  error?: string | {
    code?: unknown;
    message?: unknown;
  };
  message?: unknown;
};

const getErrorDetails = (
  payload: unknown,
): {
  code: string | null;
  message: string;
} => {
  if (
    typeof payload !== "object" ||
    payload === null
  ) {
    return {
      code: null,
      message: "EnterpriseX request failed.",
    };
  }

  const candidate =
    payload as ApiErrorResponse;

  if (typeof candidate.error === "string") {
    return {
      code: candidate.error,
      message:
        typeof candidate.message === "string"
          ? candidate.message
          : "EnterpriseX request failed.",
    };
  }

  const code =
    typeof candidate.error?.code === "string"
      ? candidate.error.code
      : null;

  const message =
    typeof candidate.error?.message === "string"
      ? candidate.error.message
      : "EnterpriseX request failed.";

  return {
    code,
    message,
  };
};

export const apiRequest = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body
        ? {
            "Content-Type":
              "application/json",
          }
        : {}),
      ...options.headers,
    },
  });

  let payload: unknown = null;

  const contentType =
    response.headers.get("content-type");

  if (
    contentType?.includes(
      "application/json",
    )
  ) {
    payload = await response.json();
  }

  if (!response.ok) {
    const details =
      getErrorDetails(payload);

    throw new ApiError(
      details.message,
      response.status,
      details.code,
    );
  }

  return payload as T;
};