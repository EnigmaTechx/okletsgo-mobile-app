/** Ten digits → "(519) 555-0123" while typing. */
export const formatPhone = (digits: string): string => {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length > 0) return `(${d}`;
  return "";
};

/** "+15195550123" → "5195550123". */
export const tenDigits = (phone: string): string => {
  const raw = phone.replace(/\D/g, "");
  return raw.length > 10 ? raw.slice(-10) : raw;
};
