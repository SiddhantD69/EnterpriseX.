export class MasterDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterDataValidationError";
  }
}

export class MasterDataNotFoundError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MasterDataNotFoundError";
    this.code = code;
  }
}