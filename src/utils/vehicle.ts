/**
 * Input rules for the driver's vehicle and licence details. The app serves
 * Ontario, so the formats are Ontario's:
 *
 *   Plate    — 2 to 8 letters/digits. Standard passenger plates are
 *              "ABCD 123" (since 2008) or "ABC 123"; vanity plates are free
 *              form. Stored upper-case with a single space between the letter
 *              and digit groups when the plate has that shape.
 *   Licence  — 1 letter + 14 digits, shown as A1234-56789-01234. The letter is
 *              the first letter of the driver's last name. Stored with the two
 *              dashes so it matches the card.
 *
 * Everything here is pure so it can be unit-tested and reused by the admin
 * review screens later.
 */

const PLATE_RE = /^[A-Z0-9]{2,8}$/;
const LICENCE_RE = /^[A-Z]\d{14}$/;
const NAME_RE = /^[A-Z0-9][A-Z0-9 .'&-]{0,29}$/i;
const COLOUR_RE = /^[A-Z][A-Z -]{1,19}$/i;

/** Upper-case, keep letters and digits only. Length is checked by isValidPlate. */
export const normalizePlate = (raw: string): string =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** "ABCD123" → "ABCD 123"; anything else is left as typed (upper-cased). */
export const formatPlate = (raw: string): string => {
  const p = normalizePlate(raw).slice(0, 8);
  const m = /^([A-Z]{2,4})(\d{3,4})$/.exec(p);
  return m ? `${m[1]} ${m[2]}` : p;
};

export const isValidPlate = (raw: string): boolean =>
  PLATE_RE.test(normalizePlate(raw));

/** Upper-case letter + digits only, capped at the 15 characters of a licence. */
export const normalizeLicence = (raw: string): string => {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return "";
  const letter = /^[A-Z]/.test(s) ? s[0] : "";
  const digits = (letter ? s.slice(1) : s).replace(/\D/g, "").slice(0, 14);
  return `${letter}${digits}`;
};

/** "A123456789012 34" → "A1234-56789-01234" (dashes appear as the driver types). */
export const formatLicence = (raw: string): string => {
  const s = normalizeLicence(raw);
  const parts = [s.slice(0, 5), s.slice(5, 10), s.slice(10, 15)].filter(
    Boolean,
  );
  return parts.join("-");
};

export const isValidLicence = (raw: string): boolean =>
  LICENCE_RE.test(normalizeLicence(raw));

export const isValidVehicleName = (raw: string): boolean =>
  NAME_RE.test(raw.trim());
export const isValidColour = (raw: string): boolean =>
  COLOUR_RE.test(raw.trim());

/** Title-case a free-text field for storage: "toyota camry" → "Toyota Camry". */
export const titleCase = (raw: string): string =>
  raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());

export interface VehicleFormErrors {
  make?: string;
  model?: string;
  color?: string;
  plateNumber?: string;
  licenseNumber?: string;
}

/** Error copy per field for the values as typed; empty object when all valid. */
export const validateVehicleForm = (v: {
  make: string;
  model: string;
  color: string;
  plateNumber: string;
  licenseNumber: string;
}): VehicleFormErrors => {
  const e: VehicleFormErrors = {};
  if (!isValidVehicleName(v.make)) e.make = "Enter the make, e.g. Toyota.";
  if (!isValidVehicleName(v.model)) e.model = "Enter the model, e.g. Camry.";
  if (!isValidColour(v.color)) e.color = "Enter the colour, e.g. Black.";
  if (!isValidPlate(v.plateNumber))
    e.plateNumber = "Plates are 2 to 8 letters and digits, e.g. ABCD 123.";
  if (!isValidLicence(v.licenseNumber))
    e.licenseNumber =
      "Ontario licence numbers are one letter and 14 digits, e.g. A1234-56789-01234.";
  return e;
};
