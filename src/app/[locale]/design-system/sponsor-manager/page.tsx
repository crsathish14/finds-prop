import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("sponsor-manager");
}

export default function Page() {
  return <LabBoardPage board="sponsor-manager" />;
}
