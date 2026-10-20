import {
  formatLicence,
  formatPlate,
  isValidLicence,
  isValidPlate,
  normalizeLicence,
  titleCase,
  validateVehicleForm,
} from "./vehicle";

describe("plates", () => {
  it("accepts Ontario passenger and vanity plates", () => {
    expect(isValidPlate("abcd 123")).toBe(true);
    expect(isValidPlate("ABC-123")).toBe(true);
    expect(isValidPlate("GOLEAFS")).toBe(true);
    expect(isValidPlate("A")).toBe(false);
    expect(isValidPlate("TOOLONGPLATE")).toBe(false);
    expect(isValidPlate("")).toBe(false);
  });

  it("formats the standard shape and leaves vanity plates alone", () => {
    expect(formatPlate("abcd123")).toBe("ABCD 123");
    expect(formatPlate("abc-123")).toBe("ABC 123");
    expect(formatPlate("go leafs")).toBe("GOLEAFS");
  });
});

describe("licences", () => {
  it("normalizes and formats as the driver types", () => {
    expect(normalizeLicence("a1234")).toBe("A1234");
    expect(formatLicence("a1234")).toBe("A1234");
    expect(formatLicence("a123456789")).toBe("A1234-56789");
    expect(formatLicence("a1234 56789 01234")).toBe("A1234-56789-01234");
    expect(formatLicence("A1234-56789-012345678")).toBe("A1234-56789-01234");
  });

  it("validates one letter plus fourteen digits", () => {
    expect(isValidLicence("A1234-56789-01234")).toBe(true);
    expect(isValidLicence("a123456789012 34")).toBe(true);
    expect(isValidLicence("A1234-56789-0123")).toBe(false);
    expect(isValidLicence("12345-67890-12345")).toBe(false);
    expect(isValidLicence("")).toBe(false);
  });
});

describe("validateVehicleForm", () => {
  it("returns no errors for a sane sandbox vehicle", () => {
    expect(
      validateVehicleForm({
        make: "toyota",
        model: "camry",
        color: "black",
        plateNumber: "abcd 123",
        licenseNumber: "D1234-56789-01234",
      }),
    ).toEqual({});
  });

  it("names every invalid field", () => {
    const e = validateVehicleForm({
      make: "",
      model: "!",
      color: "9",
      plateNumber: "A",
      licenseNumber: "123",
    });
    expect(Object.keys(e).sort()).toEqual([
      "color",
      "licenseNumber",
      "make",
      "model",
      "plateNumber",
    ]);
  });

  it("title-cases free text for storage", () => {
    expect(titleCase("  toyota   camry ")).toBe("Toyota Camry");
    expect(titleCase("BLACK")).toBe("BLACK");
  });
});
