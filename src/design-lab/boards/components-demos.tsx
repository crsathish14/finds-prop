"use client";

import { ArrowRight, Heart, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/patterns/combobox";
import { FormField } from "@/components/patterns/form-field";
import { OtpInput } from "@/components/patterns/otp-input";
import { PasswordField } from "@/components/patterns/password-field";
import { PhoneField } from "@/components/patterns/phone-field";
import { PriceDisplay } from "@/components/patterns/price-display";
import { PropertyMeta } from "@/components/patterns/property-meta";
import { ShowMore } from "@/components/patterns/show-more";
import { SortableList, SortableRow } from "@/components/patterns/sortable-list";
import { SpecTile } from "@/components/patterns/spec-tile";
import { StatTile } from "@/components/patterns/stat-tile";
import { StatusBadge } from "@/components/patterns/status-badge";
import { UploadZone, type UploadFile } from "@/components/patterns/upload-zone";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RemovableChip } from "@/components/ui/removable-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Column, Row, Specimen, Stage } from "../frame";

const BUTTON_VARIANTS = [
  "accent",
  "primary",
  "secondary",
  "ghost",
  "danger",
  "danger-outline",
] as const;

export function ButtonsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Stage>
        <div className="flex flex-col gap-5">
          {BUTTON_VARIANTS.map((variant) => (
            <Row key={variant} className="items-center">
              <Specimen label={`${variant}`}>
                <Button variant={variant}>Search homes</Button>
              </Specimen>
              <Specimen label="disabled">
                <Button variant={variant} disabled>
                  Search homes
                </Button>
              </Specimen>
              <Specimen label="loading (label kept, width held)">
                <Button variant={variant} loading>
                  Search homes
                </Button>
              </Specimen>
            </Row>
          ))}
        </div>
      </Stage>
      <Row className="items-end">
        <Specimen label='size="sm" (40)'>
          <Button size="sm">Save</Button>
        </Specimen>
        <Specimen label='size="md" (48)'>
          <Button size="md">Save</Button>
        </Specimen>
        <Specimen label='size="lg" (54)'>
          <Button size="lg">Save</Button>
        </Specimen>
        <Specimen label="pill">
          <Button pill variant="secondary">
            Post property
          </Button>
        </Specimen>
        <Specimen label="icon start and end">
          <Button iconStart={<Icon icon={Search} />} iconEnd={<Icon icon={ArrowRight} />}>
            Search
          </Button>
        </Specimen>
        <Specimen label="asChild: a link with the button look">
          <Button asChild variant="secondary">
            <a href="#buttons">Browse homes</a>
          </Button>
        </Specimen>
      </Row>
      <Specimen
        label="Long label: cut with an ellipsis on a narrow screen, never wider than the page"
        className="max-w-full"
      >
        <Button variant="secondary">Send my enquiry to the owner and the builder together</Button>
      </Specimen>
    </div>
  );
}

export function IconButtonsDemo() {
  const [saved, setSaved] = useState(false);
  return (
    <Row className="items-center">
      <Specimen label="default">
        <IconButton aria-label="Share">
          <Icon icon={MapPin} />
        </IconButton>
      </Specimen>
      <Specimen label="toggle (aria-pressed)">
        <IconButton
          aria-label="Save this home"
          pressed={saved}
          onClick={() => setSaved((value) => !value)}
        >
          <Icon icon={Heart} />
        </IconButton>
      </Specimen>
      <Specimen label="disabled">
        <IconButton aria-label="Delete" disabled>
          <Icon icon={Trash2} />
        </IconButton>
      </Specimen>
      <Specimen label='tone="on-dark"'>
        <Stage tone="dark" className="p-2">
          <IconButton aria-label="Close" tone="on-dark">
            <Icon icon={Plus} />
          </IconButton>
        </Stage>
      </Specimen>
    </Row>
  );
}

export function LinksDemo() {
  return (
    <Row className="items-center">
      <Specimen label="default">
        <Link href="#links">Read the buying guide</Link>
      </Specimen>
      <Specimen label="arrow">
        <Link href="#links" variant="arrow">
          See all homes
        </Link>
      </Specimen>
      <Specimen label="nav, current page">
        <Link href="#links" variant="nav" current>
          Projects
        </Link>
      </Specimen>
      <Specimen label="external (new tab, notice for screen readers)">
        <Link href="https://example.com" external newTabLabel="(opens in a new tab)">
          Partner site
        </Link>
      </Specimen>
      <Specimen label="sponsored (https only)">
        <Link href="https://sponsor.example" sponsored>
          Sponsored offer
        </Link>
      </Specimen>
      <Specimen label="sponsored, not https: shown as text">
        <Link href="http://sponsor.example" sponsored>
          Unsafe offer
        </Link>
      </Specimen>
      <Specimen label="on a dark surface">
        <Stage tone="dark" className="p-3">
          <Link href="#links" variant="on-dark">
            Builder sign in
          </Link>
        </Stage>
      </Specimen>
    </Row>
  );
}

export function FieldsDemo() {
  const [message, setMessage] = useState("");
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Column>
        <Specimen label="Input states" className="w-full">
          <div className="flex w-full flex-col gap-4">
            <Input aria-label="Default" placeholder="Default" />
            <Input aria-label="Filled" defaultValue="Velachery" />
            <Input aria-label="Invalid" defaultValue="12" invalid />
            <Input aria-label="Disabled" defaultValue="Disabled" disabled />
            <Input aria-label="Read only" defaultValue="Read only" readOnly />
            <Input
              aria-label="With icons"
              placeholder="Leading icon and a clear button"
              leading={<Icon icon={Search} />}
              trailing={
                <IconButton aria-label="Clear">
                  <Icon icon={Trash2} />
                </IconButton>
              }
            />
          </div>
        </Specimen>
        <Specimen label="Textarea (auto-grow, counter)" className="w-full">
          <Textarea
            aria-label="Message"
            autoGrow
            placeholder="Tell the owner what you need"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            counter={`${message.length} / 500`}
          />
        </Specimen>
        <Specimen label="NativeSelect" className="w-full">
          <NativeSelect aria-label="Bedrooms" defaultValue="2">
            <option value="1">1 BHK</option>
            <option value="2">2 BHK</option>
            <option value="3">3 BHK</option>
          </NativeSelect>
        </Specimen>
        <Specimen label="NativeSelect, invalid and disabled" className="w-full">
          <div className="flex w-full flex-col gap-4">
            <NativeSelect aria-label="Type, invalid" invalid>
              <option>Apartment</option>
            </NativeSelect>
            <NativeSelect aria-label="Type, disabled" disabled>
              <option>Apartment</option>
            </NativeSelect>
          </div>
        </Specimen>
      </Column>
      <Column>
        <Specimen label="Checkbox: unchecked, checked, mixed, disabled, invalid">
          <div className="flex flex-col gap-3">
            {[
              ["Parking", {}],
              ["Lift", { defaultChecked: true }],
              ["All amenities", { checked: "indeterminate" as const }],
              ["Gym (disabled)", { disabled: true }],
              ["I agree (required)", { "aria-invalid": true }],
            ].map(([label, props]) => (
              <div key={String(label)} className="flex items-center gap-3">
                <Checkbox id={`check-${String(label)}`} {...(props as object)} />
                <Label htmlFor={`check-${String(label)}`}>{String(label)}</Label>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen label="RadioGroup">
          <RadioGroup defaultValue="sale" aria-label="Sale or rent">
            <div className="flex items-center gap-3">
              <RadioGroupItem value="sale" id="radio-sale" />
              <Label htmlFor="radio-sale">For sale</Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="rent" id="radio-rent" />
              <Label htmlFor="radio-rent">For rent</Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="lease" id="radio-lease" disabled />
              <Label htmlFor="radio-lease">Lease (disabled)</Label>
            </div>
          </RadioGroup>
        </Specimen>
        <Specimen label="Switch: off, on, disabled">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Switch id="switch-off" />
              <Label htmlFor="switch-off">Show on map</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="switch-on" defaultChecked />
              <Label htmlFor="switch-on">Email me new enquiries</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="switch-disabled" disabled />
              <Label htmlFor="switch-disabled">Locked by admin</Label>
            </div>
          </div>
        </Specimen>
        <Specimen label="Label: required and optional" className="w-full">
          <div className="flex w-full flex-col gap-2">
            <Label htmlFor="label-name" required>
              Name
            </Label>
            <Input id="label-name" />
            <Label htmlFor="label-note" optionalLabel="(optional)">
              Note
            </Label>
            <Input id="label-note" />
          </div>
        </Specimen>
      </Column>
    </div>
  );
}

export function SpecialFieldsDemo() {
  const [code, setCode] = useState("");
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Column>
        <FormField label="Name" hint="As on your ID" required>
          <Input />
        </FormField>
        <FormField label="Name" error="Enter your name" required>
          <Input defaultValue="" />
        </FormField>
        <FormField label="Mobile number" hint="We send a 6-digit code to this +91 number">
          <PhoneField placeholder="98765 43210" />
        </FormField>
        <FormField
          label="Mobile number"
          error="We can only send codes to Indian (+91) mobile numbers right now."
        >
          <PhoneField defaultValue="41555 52671" />
        </FormField>
        <FormField label="Password">
          <PasswordField
            showLabel="Show password"
            hideLabel="Hide password"
            autoComplete="current-password"
          />
        </FormField>
      </Column>
      <Column>
        <FormField label="Enter the 6-digit code" hint={`Typed so far: ${code || "nothing"}`}>
          <OtpInput value={code} onValueChange={setCode} />
        </FormField>
        <Specimen label="OtpInput, invalid" className="w-full">
          <FormField label="Wrong code" error="That code is not right. Try again.">
            <OtpInput value="123" onValueChange={() => {}} invalid />
          </FormField>
        </Specimen>
        <Specimen label="OtpInput, disabled" className="w-full">
          <FormField label="Verifying">
            <OtpInput disabled />
          </FormField>
        </Specimen>
      </Column>
    </div>
  );
}

const LOCALITIES = [
  "Velachery",
  "Velappanchavadi",
  "Mylapore",
  "Adyar",
  "Anna Nagar",
  "T Nagar",
  "Tambaram",
  "Thoraipakkam",
];

export function ComboboxDemo() {
  const [value, setValue] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState("nothing yet");

  function search(query: string) {
    setLoading(true);
    // A pretend server: answers after a moment, like the real suggestions will.
    setTimeout(() => {
      setOptions(
        LOCALITIES.filter((name) => name.toLowerCase().includes(query.toLowerCase())).map(
          (name) => ({
            value: name.toLowerCase().replaceAll(" ", "-"),
            label: name,
            hint: "Chennai",
          }),
        ),
      );
      setLoading(false);
    }, 400);
  }

  return (
    <Column>
      <Combobox
        aria-label="Locality"
        placeholder="Type 3 letters, e.g. vel"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          if (next.trim().length < 3) setOptions([]);
        }}
        onQueryChange={search}
        onSelect={(option) => setPicked(option.label)}
        options={options}
        loading={loading}
        labels={{
          clear: "Clear locality",
          loading: "Looking for localities",
          noResults: "No localities found",
          resultCount: (count) => `${count} localities found`,
        }}
      />
      <Text variant="small" tone="muted">
        Picked: {picked}
      </Text>
    </Column>
  );
}

export function UploadDemo() {
  const [files, setFiles] = useState<UploadFile[]>([
    { id: "1", name: "front-view.jpg", progress: 100, cover: true },
    { id: "2", name: "kitchen.jpg", progress: 45 },
    { id: "3", name: "floor-plan.pdf", error: "This file type is not allowed here" },
  ]);
  return (
    <UploadZone
      files={files}
      accept="image/*"
      onFiles={(chosen) =>
        setFiles((current) => [
          ...current,
          ...chosen.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            name: file.name,
            progress: 10,
          })),
        ])
      }
      onRemove={(id) => setFiles((current) => current.filter((file) => file.id !== id))}
      labels={{
        title: "Add photos",
        hint: "JPG or PNG, up to 10 MB each. Drag them here or choose files.",
        cover: "Cover",
        remove: (name) => `Remove ${name}`,
      }}
    />
  );
}

export function ChipsDemo() {
  const [picked, setPicked] = useState(["3 BHK"]);
  const [filters, setFilters] = useState(["3 BHK", "Under ₹1 Cr", "Velachery"]);
  const [listing, setListing] = useState("buy");
  return (
    <div className="flex flex-col gap-6">
      <Row className="items-center">
        {["2 BHK", "3 BHK", "4 BHK"].map((label) => (
          <Chip
            key={label}
            selected={picked.includes(label)}
            onClick={() =>
              setPicked((current) =>
                current.includes(label)
                  ? current.filter((item) => item !== label)
                  : [...current, label],
              )
            }
          >
            {label}
          </Chip>
        ))}
        <Chip soft>Soft</Chip>
        <Chip size="sm">Small</Chip>
        <Chip disabled>Disabled</Chip>
        <Chip asChild>
          <a href="#chips">A link chip</a>
        </Chip>
      </Row>
      <Row className="items-center">
        {filters.map((filter) => (
          <RemovableChip
            key={filter}
            removeLabel={`Remove filter: ${filter}`}
            onRemove={() => setFilters((current) => current.filter((item) => item !== filter))}
          >
            {filter}
          </RemovableChip>
        ))}
      </Row>
      <Row className="items-start">
        <Specimen label="SegmentedControl, with a link-tab and counts">
          <SegmentedControl
            aria-label="Listing type"
            value={listing}
            onValueChange={setListing}
            options={[
              { value: "buy", label: "Buy" },
              { value: "rent", label: "Rent" },
              { value: "all", label: "All", count: 128 },
              { href: "#chips", label: "New projects" },
            ]}
          />
        </Specimen>
        <Specimen label='block, size="sm"'>
          <SegmentedControl
            aria-label="Enquiry type"
            block
            size="sm"
            defaultValue="enquire"
            className="w-72"
            options={[
              { value: "enquire", label: "Enquire" },
              { value: "visit", label: "Site visit" },
            ]}
          />
        </Specimen>
      </Row>
    </div>
  );
}

export function BadgesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Row className="items-center">
        {(
          [
            "neutral",
            "success",
            "warning",
            "danger",
            "info",
            "outline",
            "featured",
            "prime",
            "budget",
          ] as const
        ).map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Row>
      <Row className="items-center">
        {(["success", "warning", "danger", "info", "neutral"] as const).map((tone) => (
          <Badge key={tone} tone={tone} dot>
            {tone} with a dot
          </Badge>
        ))}
      </Row>
      <Row className="items-center">
        <StatusBadge kind="listing" status="live" />
        <StatusBadge kind="listing" status="pendingReview" />
        <StatusBadge kind="listing" status="sold" />
        <StatusBadge kind="listing" status="rentedOut" />
        <StatusBadge kind="listing" status="notApproved" />
        <StatusBadge kind="listing" status="draft" />
      </Row>
      <Row className="items-center">
        <StatusBadge kind="enquiry" status="new" />
        <StatusBadge kind="enquiry" status="contacted" />
        <StatusBadge kind="enquiry" status="closed" />
        <StatusBadge kind="enquiry" status="waitingForOwner" />
        <StatusBadge kind="unit" status="available" />
        <StatusBadge kind="unit" status="onHold" />
        <StatusBadge kind="unit" status="sold" />
        <StatusBadge kind="unit" status="blocked" />
      </Row>
    </div>
  );
}

export function CardPartsDemo() {
  const [shown, setShown] = useState(12);
  return (
    <div className="flex flex-col gap-8">
      <Row className="items-start">
        <Specimen label="PriceDisplay: sale in lakh">
          <PriceDisplay rupees={78_00_000} perSqftRupees={6500} />
        </Specimen>
        <Specimen label="crore, large">
          <PriceDisplay rupees={1_25_00_000} size="large" />
        </Specimen>
        <Specimen label="rent">
          <PriceDisplay rupees={48_000} listingType="rent" />
        </Specimen>
        <Specimen label="below one lakh">
          <PriceDisplay rupees={15_000} listingType="rent" />
        </Specimen>
      </Row>
      <Column className="max-w-none">
        <Specimen label="PropertyMeta: all facts">
          <PropertyMeta
            bedrooms={3}
            bathrooms={2}
            areaSqft={1450}
            furnishing="Semi-furnished"
            propertyType="Apartment"
          />
        </Specimen>
        <Specimen label="missing data is left out, never blank">
          <PropertyMeta bedrooms={2} bathrooms={null} areaSqft={undefined} propertyType="Plot" />
        </Specimen>
        <Specimen label="long text wraps">
          <PropertyMeta
            bedrooms={4}
            bathrooms={4}
            areaSqft={4200}
            furnishing="Fully furnished with modular kitchen and wardrobes"
            propertyType="Independent villa in a gated community"
            className="max-w-sm"
          />
        </Specimen>
      </Column>
      <div className="grid gap-3 md:grid-cols-3">
        <SpecTile label="Facing" value="East" icon={<Icon icon={MapPin} />} />
        <SpecTile label="Floor" value="4 of 12" />
        <SpecTile label="Age of property" value="Not provided" missing />
        <SpecTile
          label="Address"
          value="Plot 14, Third Cross Street, Thiruvanmiyur Extension, Chennai"
          icon={<Icon icon={MapPin} />}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile
          label="Live listings"
          value={14}
          icon={<Icon icon={Heart} />}
          note="2 added this week"
        />
        <StatTile label="New enquiries" value={7} icon={<Icon icon={Heart} />} iconTone="copper" />
        <StatTile
          label="Pending review"
          value={3}
          icon={<Icon icon={Heart} />}
          iconTone="warning"
          note="Needs attention: oldest is 3 days"
          attention
        />
      </div>
      <ShowMore
        shown={shown}
        total={48}
        progressLabel={`Showing ${shown} of 48`}
        buttonLabel="Show more homes"
        onShowMore={() => setShown((value) => Math.min(48, value + 12))}
      />
    </div>
  );
}

export function AvatarDemo() {
  return (
    <Row className="items-center">
      <Specimen label="initials">
        <Avatar>
          <AvatarFallback>PR</AvatarFallback>
        </Avatar>
      </Specimen>
      <Specimen label='size="sm"'>
        <Avatar size="sm">
          <AvatarFallback>SK</AvatarFallback>
        </Avatar>
      </Specimen>
    </Row>
  );
}

export function SortableDemo() {
  const names: Record<string, string> = {
    front: "Front view",
    kitchen: "Kitchen",
    bedroom: "Master bedroom",
  };
  const [ids, setIds] = useState(["front", "kitchen", "bedroom"]);
  return (
    <SortableList ids={ids} onReorder={setIds} className="max-w-lg">
      {ids.map((id) => (
        <SortableRow
          key={id}
          id={id}
          labels={{
            drag: `Drag ${names[id]}`,
            moveUp: `Move ${names[id]} up`,
            moveDown: `Move ${names[id]} down`,
          }}
        >
          <span className="text-title-sm text-ink">{names[id]}</span>
        </SortableRow>
      ))}
    </SortableList>
  );
}
