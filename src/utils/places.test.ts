import {
  formatPredictionText,
  isOntarioPrediction,
  ontarioOnly,
} from "./places";

const p = (description: string) => ({ placeId: description, description });

describe("Ontario-only predictions", () => {
  it("accepts ', ON' and 'Ontario', rejects other provinces", () => {
    expect(isOntarioPrediction(p("123 King St W, Kitchener, ON, Canada"))).toBe(
      true,
    );
    expect(
      isOntarioPrediction(p("Algonquin Provincial Park, Ontario, Canada")),
    ).toBe(true);
    expect(isOntarioPrediction(p("Montréal, QC, Canada"))).toBe(false);
    expect(isOntarioPrediction(p("London, UK"))).toBe(false);
  });

  it("filters a list and tolerates null", () => {
    expect(ontarioOnly(null)).toEqual([]);
    expect(
      ontarioOnly([p("Toronto, ON, Canada"), p("Calgary, AB, Canada")]).map(
        (x) => x.description,
      ),
    ).toEqual(["Toronto, ON, Canada"]);
  });

  it("drops the trailing country but keeps the province", () => {
    expect(
      formatPredictionText("Fairview Park Mall, Kitchener, ON, Canada"),
    ).toBe("Fairview Park Mall, Kitchener, ON");
    expect(formatPredictionText("Toronto, ON")).toBe("Toronto, ON");
  });
});
