// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "../form-field";
import { OtpInput } from "../otp-input";
import { PasswordField } from "../password-field";
import { PhoneField } from "../phone-field";
import { UploadZone } from "../upload-zone";

describe("FormField", () => {
  it("ties the label, hint and error to the control", () => {
    render(
      <FormField label="Name" hint="As on your ID" error="Enter your name" required>
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAccessibleDescription("As on your ID Enter your name");
  });

  it("has no invalid state or description when everything is fine", () => {
    render(
      <FormField label="Name">
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("uses an id you give it, and works with a select", () => {
    render(
      <FormField label="Bedrooms" id="bedrooms">
        <NativeSelect>
          <option>1</option>
        </NativeSelect>
      </FormField>,
    );
    expect(screen.getByLabelText("Bedrooms")).toHaveAttribute("id", "bedrooms");
  });

  it("keeps a description the control already had", () => {
    render(
      <FormField label="Name" hint="Hint text">
        <Input aria-describedby="extra" />
      </FormField>,
    );
    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toMatch(
      /^extra .+-hint$/,
    );
  });
});

describe("PasswordField", () => {
  it("shows and hides the password with a toggle that keeps its focus", async () => {
    render(
      <FormField label="Password">
        <PasswordField showLabel="Show password" hideLabel="Hide password" />
      </FormField>,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(hide);
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("PhoneField", () => {
  it("is a telephone field with a +91 prefix and the right autofill hints", () => {
    render(
      <FormField label="Mobile number">
        <PhoneField />
      </FormField>,
    );
    const input = screen.getByLabelText("Mobile number");
    expect(input).toHaveAttribute("type", "tel");
    expect(input).toHaveAttribute("inputmode", "tel");
    expect(input).toHaveAttribute("autocomplete", "tel-national");
    expect(screen.getByText("+91")).toBeInTheDocument();
  });
});

describe("OtpInput", () => {
  it("is one labelled field with the right autofill hints and hidden cells", () => {
    const { container } = render(
      <FormField label="Code">
        <OtpInput />
      </FormField>,
    );
    const input = screen.getByLabelText("Code");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("maxlength", "6");
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6);
  });

  it("keeps digits only, fills the cells, and calls onComplete once at the sixth digit", async () => {
    const onComplete = vi.fn();
    const { container } = render(<OtpInput aria-label="Code" onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText("Code"), "12a345");
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Code")).toHaveValue("12345");
    await userEvent.type(screen.getByLabelText("Code"), "6");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("1");
  });

  it("fills every cell when a whole code is pasted", async () => {
    const onComplete = vi.fn();
    render(<OtpInput aria-label="Code" onComplete={onComplete} />);
    await userEvent.click(screen.getByLabelText("Code"));
    await userEvent.paste("987 654");
    expect(screen.getByLabelText("Code")).toHaveValue("987654");
    expect(onComplete).toHaveBeenCalledWith("987654");
  });

  it("can be controlled", async () => {
    function Example() {
      const [value, setValue] = useState("");
      return <OtpInput aria-label="Code" value={value} onValueChange={setValue} />;
    }
    render(<Example />);
    await userEvent.type(screen.getByLabelText("Code"), "42");
    expect(screen.getByLabelText("Code")).toHaveValue("42");
  });

  it("does not accept input when disabled", async () => {
    render(<OtpInput aria-label="Code" disabled />);
    await userEvent.type(screen.getByLabelText("Code"), "1");
    expect(screen.getByLabelText("Code")).toHaveValue("");
  });
});

describe("UploadZone", () => {
  const labels = {
    title: "Add photos",
    hint: "JPG or PNG, up to 10 MB",
    cover: "Cover",
    remove: (name: string) => `Remove ${name}`,
  };

  it("passes chosen files to onFiles", async () => {
    const onFiles = vi.fn();
    render(<UploadZone files={[]} onFiles={onFiles} onRemove={vi.fn()} labels={labels} />);
    const file = new File(["x"], "kitchen.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText(/Add photos/), file);
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it("lists files with progress, errors, the cover tag and named remove buttons", async () => {
    const onRemove = vi.fn();
    render(
      <UploadZone
        files={[
          { id: "a", name: "hall.jpg", progress: 40 },
          { id: "b", name: "bad.pdf", error: "This file type is not allowed" },
          { id: "c", name: "front.jpg", progress: 100, cover: true },
        ]}
        onFiles={vi.fn()}
        onRemove={onRemove}
        labels={labels}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "hall.jpg" })).toHaveAttribute("value", "40");
    expect(screen.getByText("This file type is not allowed")).toBeInTheDocument();
    expect(screen.getByText("Cover")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove bad.pdf" }));
    expect(onRemove).toHaveBeenCalledWith("b");
  });
});
