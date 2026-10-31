import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("components");
}

export default function Page() {
  return <LabBoardPage board="components" />;
}
