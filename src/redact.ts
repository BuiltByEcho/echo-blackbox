const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /(?:api[_-]?key|auth|authorization|cookie|password|passwd|private[_-]?key|secret|session|token)/i;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${REDACTED}`],
  [/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, REDACTED],
  [/\bsk-[A-Za-z0-9_-]{8,}\b/g, REDACTED],
  [/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, REDACTED],
  [
    /\b(api[_-]?key|authorization|password|secret|token)=([^\s"'`]+)/gi,
    `$1=${REDACTED}`,
  ],
];

function redactText(value: string): string {
  return SECRET_PATTERNS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value
  );
}

export function redactValue(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ])
    );
  }

  return value;
}
