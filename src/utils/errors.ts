/**
 * Error handling utilities for MCP tool responses.
 * All tools return consistent JSON via formatToolResponse / formatToolError.
 */

export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "PAYMENT_REQUIRED"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export class ToolError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly recovery?: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export function formatToolResponse(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function formatToolError(
  error: unknown,
): { content: Array<{ type: "text"; text: string }>; isError: true } {
  if (error instanceof ToolError) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: {
                code: error.code,
                message: error.message,
                ...(error.recovery ? { recovery: error.recovery } : {}),
              },
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: {
              code: "INTERNAL_ERROR",
              message,
              recovery: "Try again or contact support at hello@revolutionai.io",
            },
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}
