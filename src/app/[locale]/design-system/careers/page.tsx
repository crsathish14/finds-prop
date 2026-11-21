import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("careers");
}

export default function Page() {
  return <LabBoardPage board="careers" />;
}
