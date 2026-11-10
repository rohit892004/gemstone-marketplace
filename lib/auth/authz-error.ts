/** Access-control error codes and the error class. Kept free of framework imports so services can use it in tests. */
export type AuthzCode =
  | "UNAUTHENTICATED"
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_SUSPENDED"
  | "SELLER_SUSPENDED"
  | "SELLER_NOT_APPROVED"
  | "FORBIDDEN";

export class AuthzError extends Error {
  constructor(readonly code: AuthzCode) {
    super(code);
    this.name = "AuthzError";
  }
}
