export function ok<T>(data: T) {
  return { success: true as const, data, error: null };
}

export function fail(error: string) {
  return { success: false as const, data: null, error };
}
