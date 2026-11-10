import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("charts");
}

export default function Page() {
  return <LabBoardPage board="charts" />;
}
