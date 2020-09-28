export interface UUID {
  type: "UUID";
  readonly value: string;
}

export function uuid(value: string): UUID {
  return { type: "UUID", value };
}
