import { PropertyNotFound } from "@/features/property";

/** "Property not found": a wrong address, or a home that is not approved (sold, rented, withdrawn, in review). */
export default function NotFound() {
  return (
    <main id="main" className="flex-1">
      <PropertyNotFound />
    </main>
  );
}
