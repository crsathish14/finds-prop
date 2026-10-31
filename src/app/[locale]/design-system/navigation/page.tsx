import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("navigation");
}

export default function Page() {
  return <LabBoardPage board="navigation" />;
}
