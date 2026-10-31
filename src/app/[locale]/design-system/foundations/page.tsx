import { LabBoardPage, labBoardMetadata } from "@/design-lab/lab-page";

export function generateMetadata() {
  return labBoardMetadata("foundations");
}

export default function Page() {
  return <LabBoardPage board="foundations" />;
}
