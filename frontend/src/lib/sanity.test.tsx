import { render, screen } from "@testing-library/react";

describe("sanity", () => {
  it("renders a simple element", () => {
    render(<div>Solvium Tests Ready</div>);
    expect(screen.getByText("Solvium Tests Ready")).toBeInTheDocument();
  });
});


